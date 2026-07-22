"""
Celery tasks for the operations app.
"""

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


def _alert_admins_task_failed(task_name, detail):
    """Notify every admin that a scheduled task failed, so a silent cron failure
    (e.g. the 7 AM period-ended sweep) doesn't go unnoticed. Best-effort: never
    raises, so alerting can't mask the original error."""
    try:
        from authentication.services import notify_admins
        notify_admins(
            title='Scheduled task failed',
            message=(f'The scheduled task "{task_name}" failed: {detail}. '
                     'Rental period-end flagging / reminders may be delayed — please investigate.'),
            notification_type='system',
            link='/admin-dashboard',
        )
    except Exception:  # pragma: no cover - alerting must never raise
        logger.exception('Failed to alert admins about %s failure', task_name)


def _count_unflagged_ended_rentals():
    """How many RUNNING bookings are past their end_date but were NOT moved into
    a period-ended/return state. After a healthy sweep this should be 0; a non-zero
    count means some ended rentals were missed (e.g. a vehicle left in an
    unexpected status) and need a human to look."""
    from django.utils import timezone
    from .models import RentalRequest
    return (
        RentalRequest.objects
        .filter(status=RentalRequest.STATUS_RUNNING,
                return_state=RentalRequest.RETURN_NONE,
                end_date__isnull=False,
                end_date__lt=timezone.localdate())
        .count()
    )


@shared_task
def generate_vehicle_reminders():
    """Daily sweep that, for every rental owner's fleet and for the vehicles
    drivers are currently renting:
      - creates any due oil-change / rego-expiry reminders, and
      - flags any ended rentals as 'pending_return' and sends the daily
        confirm-return nudge to both the owner and the driver.
    Reuses the same (per-day de-duplicated) generators the on-open sync endpoints
    use, so reminders/nudges recur each day across their active window. This run
    is what guarantees they appear even for users who never open the app.

    Wrapped in failure alerting: if the sweep raises, every admin is notified and
    the error re-raised so Celery records the failure. After a successful sweep it
    VERIFIES that no past-end rental was left unflagged and alerts admins if any
    slipped through. Returns the number of new notifications created."""
    from authentication.models import User
    from .views import (
        generate_rental_vehicle_reminders,
        generate_driver_vehicle_reminders,
        generate_maintenance_overdue_reminders,
        process_owner_due_returns,
        process_driver_due_returns,
    )

    created = 0
    try:
        # Rental OWNERS only (staff are role 'rental' WITH allowed_nav_paths set).
        for owner in User.objects.filter(role='rental', allowed_nav_paths__isnull=True):
            created += generate_rental_vehicle_reminders(owner)
            created += process_owner_due_returns(owner)
        for driver in User.objects.filter(role='driver'):
            created += generate_driver_vehicle_reminders(driver)
            created += process_driver_due_returns(driver)
        # Mechanics: nudge any overdue accepted jobs not yet marked done.
        for mechanic in User.objects.filter(role='mechanic'):
            created += generate_maintenance_overdue_reminders(mechanic)
    except Exception as exc:
        logger.exception('generate_vehicle_reminders failed')
        _alert_admins_task_failed('generate_vehicle_reminders', str(exc) or exc.__class__.__name__)
        raise

    # Health check: every ended rental should now be flagged. If not, alert admins
    # so they can investigate the stragglers rather than have them sit silently.
    unflagged = _count_unflagged_ended_rentals()
    if unflagged:
        logger.error('generate_vehicle_reminders: %s ended rental(s) left UNFLAGGED', unflagged)
        _alert_admins_task_failed(
            'generate_vehicle_reminders',
            f'{unflagged} ended rental(s) past their end date were not flagged for return',
        )

    logger.info('generate_vehicle_reminders: created %s notification(s); unflagged ended rentals=%s',
                created, unflagged)
    return created


@shared_task
def monitor_active_trip_locations():
    """Periodic GPS check: for every active rental whose vehicle has stopped
    reporting its location, issue a 'location off' warning (notifying the driver
    and the rental owner) and suspend the driver on the third strike. The gap
    window de-duplicates, so frequent runs are safe. Returns warnings issued."""
    from .tracking import check_active_trip_locations

    try:
        issued = check_active_trip_locations()
    except Exception as exc:
        logger.exception('monitor_active_trip_locations failed')
        _alert_admins_task_failed('monitor_active_trip_locations', str(exc) or exc.__class__.__name__)
        raise
    logger.info('monitor_active_trip_locations: issued %s warning(s)', issued)
    return issued
