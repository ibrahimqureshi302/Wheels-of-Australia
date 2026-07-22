"""
Canonical, machine-readable catalogue of every AUTOMATIC state transition the
backend performs — i.e. changes to a booking, vehicle, maintenance job or account
that happen WITHOUT a direct click on that record by the affected user.

This is the single source of truth behind:
  * the ``GET /api/system/automatic-behaviors/`` endpoint (so frontend engineers
    and admins can read, at runtime, exactly when/why a status flips), and
  * the human-readable doc ``backend/docs/automatic-state-transitions.md``.

Keep this in sync when you add or change any automatic transition. Each entry:
  id           stable slug
  trigger      'time' (scheduled job) | 'event' (side-effect of another action)
  schedule     cron cadence when trigger == 'time', else ''
  actor        who/what causes it ('system', 'rental approval', …)
  affects      the entity whose state changes
  change       what changes (from → to)
  why          the business reason
  notifies     who is told automatically
  where        code location
"""

AUTOMATIC_BEHAVIORS = [
    {
        'id': 'booking.period_ended',
        'trigger': 'time',
        'schedule': 'daily 07:00 UTC (generate_vehicle_reminders)',
        'actor': 'system',
        'affects': 'booking',
        'change': "return_state: none → period_ended (booking STAYS 'running')",
        'why': ("Once a rental's end_date passes, the booking is flagged so the driver is "
                "prompted to 'Complete Trip'. It does NOT auto-complete — the trip only "
                "completes after the return handshake is confirmed."),
        'notifies': 'driver and owner (daily return nudge)',
        'where': 'operations/views.py::_mark_period_ended / process_*_due_returns',
    },
    {
        'id': 'vehicle.pending_return',
        'trigger': 'time',
        'schedule': 'daily 07:00 UTC',
        'actor': 'system',
        'affects': 'vehicle',
        'change': 'status: rented → pending_return',
        'why': ("Mirrors booking.period_ended: when the booked window closes the car is "
                "marked pending_return until the owner confirms the physical handover."),
        'notifies': 'driver and owner (daily return nudge)',
        'where': 'operations/views.py::_transition_to_pending_return',
    },
    {
        'id': 'driver.gps_suspension',
        'trigger': 'time',
        'schedule': 'every 5 min (monitor_active_trip_locations)',
        'actor': 'system',
        'affects': 'driver account',
        'change': 'is_suspended: false → true on the 3rd location-off strike',
        'why': ("During an active rental the vehicle must report GPS. If it goes stale, the "
                "driver is warned; after 3 strikes (spaced ≥60 min apart) the account is "
                "auto-suspended and locked to the profile page. Only an admin can reverse it."),
        'notifies': 'driver, owner, and all admins',
        'where': 'operations/tracking.py::_issue_location_warning',
    },
    {
        'id': 'booking.auto_rejected',
        'trigger': 'event',
        'schedule': '',
        'actor': 'rental approval of a competing booking',
        'affects': 'booking (other pending requests for the same vehicle)',
        'change': 'status: pending → rejected',
        'why': ("When one booking is approved the vehicle is taken, so every other still-pending "
                "request for that vehicle is auto-rejected to prevent double-booking."),
        'notifies': 'each losing driver (in-app notification)',
        'where': 'operations/views.py::RentalRequestViewSet._decide',
    },
    {
        'id': 'vehicle.rented_on_approval',
        'trigger': 'event',
        'schedule': '',
        'actor': 'rental approval',
        'affects': 'vehicle',
        'change': 'status: available → rented',
        'why': 'The approved car goes out with the driver.',
        'notifies': 'driver (approved) and admins (vehicle rented)',
        'where': 'operations/views.py::RentalRequestViewSet._decide',
    },
    {
        'id': 'vehicle.released_on_return',
        'trigger': 'event',
        'schedule': '',
        'actor': 'return confirmation (driver or owner, per handshake state)',
        'affects': 'vehicle + booking',
        'change': 'vehicle: rented/pending_return → available; booking → completed',
        'why': 'Confirming the return closes the trip and frees the car to be re-booked.',
        'notifies': 'the other party + admins',
        'where': 'operations/views.py::RentalRequestViewSet.confirm_return',
    },
    {
        'id': 'maintenance.auto_declined',
        'trigger': 'event',
        'schedule': '',
        'actor': 'owner accepting a competing quote',
        'affects': 'maintenance request (other open quotes for the same vehicle)',
        'change': 'status: pending/quoted/info_requested → declined',
        'why': 'One vehicle can only be in one mechanic\'s maintenance job at a time.',
        'notifies': 'each losing mechanic (in-app notification)',
        'where': 'operations/views.py::MaintenanceRequestViewSet.accept',
    },
    {
        'id': 'vehicle.maintenance_chain',
        'trigger': 'event',
        'schedule': '',
        'actor': 'quote accept / mechanic completes / owner confirms',
        'affects': 'vehicle + maintenance job',
        'change': ('vehicle: available → maintenance (accept) → pending_return (mechanic done) '
                   '→ available (owner confirms)'),
        'why': 'Maintenance lifecycle; the car is unavailable while a job is in progress.',
        'notifies': 'mechanic, owner, admins at each step',
        'where': 'operations/views.py::MaintenanceRequestViewSet.accept/complete/confirm_return',
    },
    {
        'id': 'reminder.daily_nudges',
        'trigger': 'time',
        'schedule': 'daily 07:00 UTC',
        'actor': 'system',
        'affects': 'notifications only (no record state change)',
        'change': 'creates oil-change / rego / return / maintenance-overdue reminders',
        'why': 'Recurring nudges, de-duplicated once per day per recipient/vehicle/type.',
        'notifies': 'the relevant owner / driver / mechanic',
        'where': 'operations/views.py reminder generators',
    },
    {
        'id': 'auth.token_rotation',
        'trigger': 'event',
        'schedule': '',
        'actor': 'system (on token refresh / logout)',
        'affects': 'session',
        'change': 'old refresh token is blacklisted; access token expires on its own',
        'why': 'Security: a rotated/old refresh token can never be replayed.',
        'notifies': 'n/a',
        'where': 'core/settings (SIMPLE_JWT) + authentication/views.py',
    },
    {
        'id': 'deletion.cascade_audit',
        'trigger': 'event',
        'schedule': '',
        'actor': 'admin/owner delete',
        'affects': 'related records (cascade) + a new DeletionAudit row',
        'change': ('deleting an owner/vehicle/booking cascades to related rows; a durable '
                   'DeletionAudit snapshot is written first for recovery/investigation'),
        'why': 'Referential integrity; the audit preserves a forensic trail of the cascade.',
        'notifies': 'other admins (panel sync)',
        'where': 'operations/views.py::record_deletion',
    },
]
