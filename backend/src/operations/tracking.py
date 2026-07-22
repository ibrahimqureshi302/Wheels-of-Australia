"""
GPS tracking for active rentals (Phase 5).

While a driver has an active (approved) rental, the frontend reports the
device's browser-GPS position here every ~45s. The latest position per vehicle
is stored on ``VehicleLocation`` and shown to the rental owner on the live map.

"Location off" is detected SERVER-SIDE by the absence of recent reports, not by
trusting the browser to announce it: a periodic Celery task
(``operations.tasks.monitor_active_trip_locations``) calls
``check_active_trip_locations`` which, for every active trip whose vehicle has
no fresh position, issues at most one warning per gap window and notifies the
driver and the rental owner. The driver's running strike count lives on
``User.location_warning_count``; the third strike suspends the account
(``is_suspended=True`` → locked to profile) and only an admin reactivation resets it.
"""
from datetime import timedelta
from contextlib import contextmanager

from django.utils import timezone
from django.db import connection, transaction

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.models import User
from authentication.services import notify_user, notify_admins
from .models import Vehicle, RentalRequest, VehicleLocation, LocationWarning


# --- Tuning (named so they're easy to adjust, like OIL_CHANGE_INTERVAL_DAYS) ---
# How long a vehicle may go without a position report before its location is
# considered "off". Also the grace period after a trip becomes active before we
# start expecting reports at all (so a freshly-approved trip isn't warned before
# the driver has even opened the app).
STALE_THRESHOLD_MINUTES = 15
# Minimum spacing between consecutive warnings for the same trip — stops a single
# sustained (or flapping) outage from racking up all three strikes too quickly.
# Widened to 60 min so that re-enabling GPS briefly and losing it again can't
# stack strikes in fast succession: with a 60-min gap, suspension (the 3rd strike)
# now takes at least ~2 hours of repeated/continued location-off, giving the
# driver ample chance to fix it after the first and second warnings.
WARNING_GAP_MINUTES = 60
# Strikes before the account is suspended.
MAX_STRIKES = 3
# Advisory-lock namespace for per-driver warning issuance (distinct from the
# reminder sync's REMINDER_LOCK_NS=4242).
TRACKING_LOCK_NS = 4243


def _active_trips():
    """Approved bookings whose vehicle is currently out with the driver and whose
    booked window has not yet ended.

    The ``end_date`` bound is essential: the frontend tracker only reports while
    ``end_date`` is today-or-later (it stops at end of the booked window). Without
    the same bound here, the server would keep expecting GPS for a trip the driver
    app has already stopped reporting on, and wrongly issue strikes — eventually
    auto-suspending a driver for a rental that is effectively over. A null
    ``end_date`` (open-ended) is treated as still active, matching the client."""
    today = timezone.localdate()
    return (
        RentalRequest.objects
        .filter(status=RentalRequest.STATUS_RUNNING,
                vehicle__status__in=[Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN])
        .exclude(end_date__lt=today)
        .select_related('driver', 'vehicle', 'rental')
    )


@contextmanager
def _tracking_lock(driver_id):
    """Serialize warning issuance per driver so the periodic task can't race with
    itself (or an overlapping run) and double-count strikes."""
    with transaction.atomic():
        with connection.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(%s, %s)', [TRACKING_LOCK_NS, driver_id])
        yield


def _vlabel(vehicle):
    return f'{vehicle.make} {vehicle.model} ({vehicle.rego})'.strip()


def _issue_location_warning(trip, now, gap_before):
    """Issue one 'location off' warning for ``trip`` if none was issued within the
    gap window. Increments the driver's strike count, notifies the driver and the
    rental owner, and on the third strike suspends the driver and alerts admins.
    Returns 1 if a warning was issued, else 0."""
    driver = trip.driver
    with _tracking_lock(driver.id):
        # Re-read inside the lock: another run may have just warned or suspended.
        driver.refresh_from_db(fields=['location_warning_count', 'is_suspended'])
        if driver.is_suspended:
            return 0
        if LocationWarning.objects.filter(rental_request=trip, issued_at__gte=gap_before).exists():
            return 0

        new_count = driver.location_warning_count + 1
        suspended = new_count >= MAX_STRIKES
        LocationWarning.objects.create(
            driver=driver, rental_request=trip, vehicle=trip.vehicle,
            warning_number=new_count, suspended=suspended,
        )
        driver.location_warning_count = new_count

        driver_name = driver.get_full_name() or driver.email
        vlabel = _vlabel(trip.vehicle)
        if suspended:
            # Locked to profile (can still log in to read the reason + contact
            # admin); is_active stays True so login/JWT keep working.
            driver.is_suspended = True
            driver.suspension_reason = (
                'Your account is suspended because your location was turned off '
                'during an active rental. Please contact an administrator.'
            )
            driver.save(update_fields=['location_warning_count', 'is_suspended', 'suspension_reason'])
            notify_user(
                driver,
                title='Account suspended — location turned off',
                message=(
                    f'Your account has been suspended after {MAX_STRIKES} warnings for '
                    f'turning location off while renting {vlabel}. Contact an administrator '
                    'to have your account reactivated.'
                ),
                notification_type='location_suspended',
                link='/profile',
            )
            notify_user(
                trip.rental,
                title='Driver suspended — location off',
                message=(
                    f'{driver_name} was suspended after {MAX_STRIKES} location warnings while '
                    f'renting {vlabel}. The vehicle can no longer be tracked.'
                ),
                notification_type='location_suspended',
                link='/map',
            )
            notify_admins(
                title='Driver suspended — GPS tracking',
                message=(
                    f'{driver_name} ({driver.email}) was auto-suspended after {MAX_STRIKES} '
                    f'location-off warnings while renting {vlabel}.'
                ),
                notification_type='location_suspended',
                link='/admin/drivers',
            )
        else:
            driver.save(update_fields=['location_warning_count'])
            notify_user(
                driver,
                title=f'Turn your location on (warning {new_count} of {MAX_STRIKES})',
                message=(
                    f'We can no longer track {vlabel}. Please enable location for your '
                    f'active rental. After {MAX_STRIKES} warnings your account is suspended.'
                ),
                notification_type='location_warning',
                link='/map',
            )
            notify_user(
                trip.rental,
                title='Driver location is off',
                message=(
                    f"{driver_name}'s location is off for {vlabel} "
                    f'(warning {new_count} of {MAX_STRIKES}).'
                ),
                notification_type='location_warning',
                link='/map',
            )
        return 1


def check_active_trip_locations():
    """For every active trip, warn (and ultimately suspend) when the vehicle has
    no fresh GPS position. Safe to call repeatedly — the gap window de-duplicates.
    Returns the number of warnings issued this run."""
    now = timezone.now()
    stale_before = now - timedelta(minutes=STALE_THRESHOLD_MINUTES)
    gap_before = now - timedelta(minutes=WARNING_GAP_MINUTES)
    issued = 0
    for trip in _active_trips():
        if trip.driver.is_suspended:
            continue
        # Don't expect reports until the trip has been active long enough for the
        # driver to have opened the app and granted permission.
        tracking_since = trip.reviewed_at or trip.created_at
        if tracking_since and tracking_since > stale_before:
            continue
        loc = VehicleLocation.objects.filter(vehicle=trip.vehicle).first()
        if loc and loc.recorded_at and loc.recorded_at >= stale_before:
            continue  # location is fresh — all good
        issued += _issue_location_warning(trip, now, gap_before)
    return issued


def _coerce_coord(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class DriverLocationReportView(APIView):
    """POST {latitude, longitude, accuracy?} — the driver's current position.

    Stored as the vehicle's latest location only while the driver has an active
    trip. No active trip → nothing is stored (``tracking: false``)."""

    permission_classes = [IsAuthenticated]  # IsDriver enforced below for clarity

    def post(self, request):
        if getattr(request.user, 'role', None) != 'driver':
            return Response({'tracking': False, 'detail': 'Only drivers report location.'}, status=403)

        lat = _coerce_coord(request.data.get('latitude'))
        lng = _coerce_coord(request.data.get('longitude'))
        if lat is None or lng is None or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response({'detail': 'latitude and longitude are required.'}, status=400)
        accuracy = _coerce_coord(request.data.get('accuracy'))

        trip = _active_trips().filter(driver=request.user).order_by('-reviewed_at').first()
        if trip is None:
            return Response({'tracking': False, 'warnings': request.user.location_warning_count})

        VehicleLocation.objects.update_or_create(
            vehicle=trip.vehicle,
            defaults={
                'driver': request.user,
                'rental_request': trip,
                'latitude': lat,
                'longitude': lng,
                'accuracy': accuracy,
                'recorded_at': timezone.now(),
            },
        )
        return Response({'tracking': True, 'warnings': request.user.location_warning_count})


class DriverLocationUnavailableView(APIView):
    """POST — the driver's browser reports location denied/unavailable. Lets the
    frontend confirm the 'off' state and read the current strike count for the
    banner. Strikes themselves are issued by the server-side staleness check, so
    this endpoint never suspends on its own (a brief permission prompt shouldn't
    cost a strike)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if getattr(request.user, 'role', None) != 'driver':
            return Response({'detail': 'Only drivers report location.'}, status=403)
        trip = _active_trips().filter(driver=request.user).exists()
        return Response({
            'tracking': bool(trip),
            'warnings': request.user.location_warning_count,
            'max_strikes': MAX_STRIKES,
        })


class TrackedVehicleLocationsView(APIView):
    """GET — latest vehicle positions for the live map.

    A rental owner (or their staff) sees positions for their own fleet's active
    trips; an admin sees them all. Drivers don't use this (they only report)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # local import avoids a cycle at import time
        from .views import owning_rental, staff_lacks_section

        user = request.user
        role = getattr(user, 'role', None)
        qs = (
            VehicleLocation.objects
            .select_related('vehicle', 'driver', 'rental_request')
            .filter(rental_request__status=RentalRequest.STATUS_RUNNING)
        )
        if role == 'admin' or user.is_superuser:
            pass
        elif role == 'rental':
            # Rental staff need the Live map (/map) module granted to see it.
            if staff_lacks_section(user, '/map'):
                return Response({'detail': 'Not permitted.'}, status=403)
            owner = owning_rental(user)
            qs = qs.filter(vehicle__rental=owner)
        else:
            return Response({'detail': 'Not permitted.'}, status=403)

        now = timezone.now()
        stale_before = now - timedelta(minutes=STALE_THRESHOLD_MINUTES)
        results = []
        for loc in qs:
            results.append({
                'vehicle_id': loc.vehicle_id,
                'vehicle_label': _vlabel(loc.vehicle),
                'rego': loc.vehicle.rego,
                'driver_name': loc.driver.get_full_name() or loc.driver.email,
                'latitude': loc.latitude,
                'longitude': loc.longitude,
                'accuracy': loc.accuracy,
                'recorded_at': loc.recorded_at.isoformat(),
                'stale': bool(loc.recorded_at and loc.recorded_at < stale_before),
            })
        return Response(results)
