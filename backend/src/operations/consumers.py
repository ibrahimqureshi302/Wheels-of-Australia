"""
Real-time GPS tracking over WebSockets (Phase 5 — live upgrade).

One consumer serves both sides of a vehicle's live position feed on the URL
``ws/track/<vehicle_id>/``; the role of the connecting user decides its mode:

* **driver** — may connect only to the vehicle of *their own* active trip. Sends
  ``{latitude, longitude, accuracy}`` frames; each is validated, broadcast live
  to everyone watching that vehicle, and (throttled) written to
  ``VehicleLocation`` so the Celery staleness watchdog keeps seeing fresh data.
* **viewer** (rental owner/staff with the ``/map`` section, or an admin) — may
  connect to vehicles they're allowed to see. Receives the last known position on
  connect, then a live ``position`` frame on every driver push.

This is an *upgrade* over the HTTP polling endpoints in ``tracking.py``, not a
replacement: the same ``VehicleLocation`` rows are written and read, so the
warning/suspension watchdog and the HTTP fallback keep working unchanged. The
authorization mirrors ``DriverLocationReportView`` / ``TrackedVehicleLocationsView``.
"""
import time

from django.utils import timezone
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Vehicle, RentalRequest, VehicleLocation
from .tracking import _active_trips, _coerce_coord

# Persist a driver's position to the DB at most this often. We broadcast every
# frame live, but only write on this cadence to keep DB load in line with the
# old ~45s HTTP reporting while still keeping ``recorded_at`` well inside the
# watchdog's STALE_THRESHOLD_MINUTES window.
WS_DB_SAVE_INTERVAL_SECONDS = 30

# Close codes (4000-4999 = application-defined).
CLOSE_UNAUTHENTICATED = 4401
CLOSE_FORBIDDEN = 4403


class VehicleTrackingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        try:
            self.vehicle_id = int(self.scope['url_route']['kwargs']['vehicle_id'])
        except (KeyError, ValueError):
            await self.close(code=CLOSE_FORBIDDEN)
            return

        if not self.user or not self.user.is_authenticated:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        self.mode = await self._authorize()
        if self.mode is None:
            await self.close(code=CLOSE_FORBIDDEN)
            return

        self.group = f'vehicle_{self.vehicle_id}'
        self._last_save = None  # monotonic seconds of the last DB write
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        # A viewer joining mid-trip should see the car immediately, not a blank
        # map until the next driver push.
        if self.mode == 'viewer':
            last = await self._last_location()
            if last:
                await self.send_json({'type': 'position', **last})

    async def disconnect(self, code):
        group = getattr(self, 'group', None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Only drivers push positions; anything a viewer sends is ignored.
        if getattr(self, 'mode', None) != 'driver':
            return

        lat = _coerce_coord(content.get('latitude'))
        lng = _coerce_coord(content.get('longitude'))
        if lat is None or lng is None or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return
        accuracy = _coerce_coord(content.get('accuracy'))

        now = time.monotonic()
        due = self._last_save is None or (now - self._last_save) >= WS_DB_SAVE_INTERVAL_SECONDS
        recorded_at = None
        if due:
            recorded_at = await self._save_position(lat, lng, accuracy)
            if recorded_at is None:
                # The trip ended (or was released) — stop tracking this socket.
                await self.send_json({'type': 'inactive'})
                return
            self._last_save = now

        await self.channel_layer.group_send(
            self.group,
            {
                'type': 'position_broadcast',
                'payload': {
                    'vehicle_id': self.vehicle_id,
                    'latitude': lat,
                    'longitude': lng,
                    'accuracy': accuracy,
                    'recorded_at': recorded_at or timezone.now().isoformat(),
                },
            },
        )

    async def position_broadcast(self, event):
        await self.send_json({'type': 'position', **event['payload']})

    # --- DB access (sync, off the event loop) --------------------------------

    @database_sync_to_async
    def _authorize(self):
        """Return 'driver', 'viewer', or None (not allowed) for this connection."""
        user = self.user
        role = getattr(user, 'role', None)

        if role == 'driver':
            allowed = _active_trips().filter(driver=user, vehicle_id=self.vehicle_id).exists()
            return 'driver' if allowed else None

        if role == 'admin' or user.is_superuser:
            return 'viewer'

        if role == 'rental':
            # local import avoids an import cycle at module load
            from .views import owning_rental, staff_lacks_section
            if staff_lacks_section(user, '/map'):
                return None
            owner = owning_rental(user)
            allowed = Vehicle.objects.filter(id=self.vehicle_id, rental=owner).exists()
            return 'viewer' if allowed else None

        return None

    @database_sync_to_async
    def _save_position(self, lat, lng, accuracy):
        """Store the position as the vehicle's latest, if the driver's trip is still
        active. Returns the ISO timestamp written, or None when there's no active
        trip (so the caller can end tracking)."""
        trip = (
            _active_trips()
            .filter(driver=self.user, vehicle_id=self.vehicle_id)
            .order_by('-reviewed_at')
            .first()
        )
        if trip is None:
            return None
        now = timezone.now()
        VehicleLocation.objects.update_or_create(
            vehicle=trip.vehicle,
            defaults={
                'driver': self.user,
                'rental_request': trip,
                'latitude': lat,
                'longitude': lng,
                'accuracy': accuracy,
                'recorded_at': now,
            },
        )
        return now.isoformat()

    @database_sync_to_async
    def _last_location(self):
        """Latest stored position for this vehicle on a running trip, or None."""
        loc = (
            VehicleLocation.objects
            .filter(vehicle_id=self.vehicle_id, rental_request__status=RentalRequest.STATUS_RUNNING)
            .first()
        )
        if not loc or loc.recorded_at is None:
            return None
        return {
            'vehicle_id': loc.vehicle_id,
            'latitude': loc.latitude,
            'longitude': loc.longitude,
            'accuracy': loc.accuracy,
            'recorded_at': loc.recorded_at.isoformat(),
        }
