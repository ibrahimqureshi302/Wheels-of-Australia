"""
Operations domain models.
Phase 1: role-specific profiles attached one-to-one to a User. They hold the
extra fields captured at sign-up (license number, company name, shop details)
so the admin Drivers / Rentals / Mechanics lists have real data. The User row
remains the single source of truth for name, email, phone and active status.
"""

from django.db import models
from authentication.models import User

class DriverProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    license_number = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'DriverProfile<{self.user.email}>'


class RentalProfile(models.Model):
    RENTAL_TYPE_CHOICES = [
        ('company', 'Company'),
        ('individual', 'Individual'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='rental_profile')
    rental_type = models.CharField(max_length=20, choices=RENTAL_TYPE_CHOICES, blank=True)
    company_name = models.CharField(max_length=255, blank=True)
    abn = models.CharField(max_length=20, blank=True)
    minimum_rental_days = models.PositiveIntegerField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'RentalProfile<{self.user.email}>'


class MechanicProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mechanic_profile')
    shop_name = models.CharField(max_length=255, blank=True)
    shop_address = models.TextField(blank=True)
    abn = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'MechanicProfile<{self.user.email}>'


class Vehicle(models.Model):
    """A vehicle owned by a rental (role='rental' User)."""

    STATUS_AVAILABLE = 'available'
    STATUS_RENTED = 'rented'
    STATUS_PENDING_RETURN = 'pending_return'
    STATUS_MAINTENANCE = 'maintenance'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_RENTED, 'Rented'),
        # Rental period has ended but the owner hasn't confirmed the physical
        # return yet. The car can't be re-booked until the owner confirms.
        (STATUS_PENDING_RETURN, 'Pending return'),
        (STATUS_MAINTENANCE, 'Maintenance'),
    ]

    # Australian vehicle insurance cover types offered as quick-pick suggestions
    # in the UI. The field is NOT restricted to these — a rental/admin may also
    # type a custom insurance provider, so it is stored as free text (see the
    # serializers, which expose insurance_type as a plain CharField).
    INSURANCE_TYPE_CHOICES = [
        ('ctp', 'Compulsory Third Party'),
        ('third_party_property', 'Third-Party Property Damage'),
        ('third_party_fire_theft', 'Third-Party Fire and Theft'),
        ('comprehensive', 'Comprehensive Car Insurance'),
    ]

    rental = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='vehicles',
        limit_choices_to={'role': 'rental'},
        help_text='The rental owner that owns this vehicle.',
    )
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.PositiveIntegerField(null=True, blank=True)
    rego = models.CharField(max_length=20, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    # Either one of INSURANCE_TYPE_CHOICES codes or a custom provider name (free text).
    insurance_type = models.CharField(max_length=100, blank=True)
    # Primary image; TextField (not URLField) so it can hold an uploaded data URL.
    image_url = models.TextField(blank=True)
    # All vehicle photos (data URLs). The first is mirrored into image_url.
    image_urls = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE, db_index=True)
    # What maintenance is needed — captured when the rental sets status to
    # 'maintenance' directly from the fleet edit form.
    maintenance_note = models.TextField(blank=True)
    total_distance_km = models.PositiveIntegerField(default=0)
    trips = models.PositiveIntegerField(default=0)
    oil_due_date = models.DateField(null=True, blank=True)
    rego_due_date = models.DateField(null=True, blank=True)
    # Service & registration details captured by the rental owner.
    odometer_km = models.PositiveIntegerField(null=True, blank=True)
    last_oil_change_date = models.DateField(null=True, blank=True)
    last_rego_payment_date = models.DateField(null=True, blank=True)
    rent_price_per_day = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    minimum_rental_days = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.make} {self.model} ({self.rego})'


class VehicleReminderLog(models.Model):
    """Records that a recipient was reminded about a vehicle's oil change or rego
    expiry on a given day. The daily reminder dedup keys on this log (not on the
    Notification rows), so deleting a notification never causes it to be recreated
    the same day, and a new day's row lets the reminder fire again."""

    OIL = 'oil'
    REGO = 'rego'
    RETURN = 'return'
    MAINT = 'maint'
    NTYPE_CHOICES = [
        (OIL, 'Oil change'), (REGO, 'Rego expiry'), (RETURN, 'Return due'),
        (MAINT, 'Maintenance overdue'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehicle_reminder_logs')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='reminder_logs')
    ntype = models.CharField(max_length=10, choices=NTYPE_CHOICES)
    due_date = models.DateField()
    sent_date = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One reminder of each kind, per vehicle, per recipient, per day.
        unique_together = ('recipient', 'vehicle', 'ntype', 'sent_date')

    def __str__(self):
        return f'ReminderLog<{self.recipient_id} {self.vehicle_id} {self.ntype} {self.sent_date}>'


class ActivityLog(models.Model):
    """A persistent record of who did what within a rental owner's account.

    Every meaningful write performed by a rental OWNER or one of their STAFF
    members (adding a vehicle, approving a booking, accepting a maintenance
    quote, …) creates one row, attributed to the actor and scoped to the owner.
    Unlike notifications (which the owner can delete), this is a durable audit
    trail the owner can review to see exactly which staff member made each
    change. ``actor_name`` is snapshotted so the entry survives the actor being
    removed.
    """

    # The rental owner whose account the action belongs to (the scope).
    rental = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='activity_log',
        help_text='The rental owner this activity belongs to.',
    )
    # Who performed the action; null if that user is later deleted.
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activity_performed',
    )
    # Snapshot of the actor's display name at the time, so history is stable.
    actor_name = models.CharField(max_length=255, blank=True)
    # True when the actor was a staff sub-account (not the owner themselves).
    by_staff = models.BooleanField(default=False)
    # Machine-readable action code, e.g. 'request.approved', 'vehicle.created'.
    action = models.CharField(max_length=50, db_index=True)
    # Human-readable summary phrased as "<did something>", e.g.
    # "approved Jane Doe's booking for Toyota Corolla (ABC123)."
    summary = models.TextField()
    # In-app deep link to where the action happened.
    link = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Activity<{self.rental_id} {self.action} by {self.actor_name}>'


class RentalRequest(models.Model):
    """A driver's booking request for a vehicle, reviewed by the rental owner."""

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'        # legacy active state, superseded by 'running' (kept for old rows)
    STATUS_RUNNING = 'running'          # active rental: approved and the vehicle is out with the driver
    STATUS_REJECTED = 'rejected'
    STATUS_CANCELLED = 'cancelled'
    STATUS_INFO_REQUESTED = 'info_requested'
    STATUS_COMPLETED = 'completed'      # rental period finished (auto at end date, or early return confirmed)
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_INFO_REQUESTED, 'Information requested'),
        (STATUS_COMPLETED, 'Completed'),
    ]

    # --- Return handshake (orthogonal to ``status``; drives the return UI) ---
    # The booking stays RUNNING while a return is being negotiated; only the final
    # confirm-return flips it to COMPLETED. ``''`` (none) means the rental is just
    # running normally within its period.
    RETURN_NONE = ''
    RETURN_REQUESTED_BY_RENTAL = 'requested_by_rental'  # rental asked the driver to return early; driver acts next
    RETURN_REQUESTED_BY_DRIVER = 'requested_by_driver'  # driver asked the rental to return early; rental acts next
    RETURN_PERIOD_ENDED = 'period_ended'                # end_date passed (set by cron); driver clicks Complete Trip
    RETURN_DRIVER_COMPLETED = 'driver_completed'        # driver completed at end of period; rental confirms return
    RETURN_STATE_CHOICES = [
        (RETURN_NONE, 'None'),
        (RETURN_REQUESTED_BY_RENTAL, 'Early return requested by rental'),
        (RETURN_REQUESTED_BY_DRIVER, 'Early return requested by driver'),
        (RETURN_PERIOD_ENDED, 'Rental period ended'),
        (RETURN_DRIVER_COMPLETED, 'Driver completed trip'),
    ]

    driver = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='rental_requests',
        limit_choices_to={'role': 'driver'},
    )
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='requests')
    # Owning rental, denormalised from vehicle.rental for easy filtering.
    rental = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incoming_rental_requests')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    decision_reason = models.TextField(blank=True)
    # Identity verification captured before submitting (uploaded docs + OCR details).
    id_documents = models.JSONField(default=list, blank=True)
    verified_details = models.JSONField(null=True, blank=True)
    # The rental's "request more information" note (status info_requested).
    info_request_message = models.TextField(blank=True)
    # Return handshake state (see RETURN_* above) and when an early return was requested.
    return_state = models.CharField(
        max_length=20, choices=RETURN_STATE_CHOICES, default=RETURN_NONE, blank=True,
    )
    return_requested_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.driver.email} -> {self.vehicle} ({self.status})'


class MaintenanceRequest(models.Model):
    """A maintenance job for a vehicle.

    Lifecycle: a rental owner flags one of their vehicles for maintenance and
    writes the work needed (``pending``). Any mechanic can see the open pool and
    submit a quote — price + estimated duration (``quoted``); doing so assigns
    them to the job. The rental owner then accepts (``accepted`` → the vehicle's
    status becomes ``maintenance``) or declines (``declined``). When the work is
    done the job is marked ``completed`` and the vehicle returns to ``available``.
    Admins are notified at each step.
    """

    STATUS_PENDING = 'pending'      # rental flagged + wrote work; awaiting a mechanic quote
    STATUS_QUOTED = 'quoted'        # a mechanic submitted price + duration
    # rental accepted the quote; the repair is now under way and the vehicle is in
    # maintenance. (Legacy 'accepted' rows mean the same thing and are treated as
    # running everywhere — the accept action now sets 'running' directly.)
    STATUS_RUNNING = 'running'
    STATUS_ACCEPTED = 'accepted'    # legacy active state, superseded by 'running'
    STATUS_DECLINED = 'declined'    # rental declined the quote
    STATUS_CANCELLED = 'cancelled'  # mechanic withdrew their quote
    # mechanic marked the work done; vehicle awaits the rental's return confirmation
    STATUS_PENDING_RETURN = 'pending_return'
    STATUS_COMPLETED = 'completed'  # rental confirmed the return; vehicle back to available
    STATUS_INFO_REQUESTED = 'info_requested'  # rental asked the mechanic for more info
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_QUOTED, 'Quoted'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_DECLINED, 'Declined'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_PENDING_RETURN, 'Pending return'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_INFO_REQUESTED, 'Information requested'),
    ]
    # Active states where the repair is in progress (accepted by rental, not yet
    # returned). 'running' is current; 'accepted' is kept for legacy rows.
    ACTIVE_STATUSES = (STATUS_RUNNING, STATUS_ACCEPTED)

    DURATION_HOURS = 'hours'
    DURATION_DAYS = 'days'
    DURATION_UNIT_CHOICES = [
        (DURATION_HOURS, 'Hours'),
        (DURATION_DAYS, 'Days'),
    ]

    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name='maintenance_requests'
    )
    # Owning rental, denormalised from vehicle.rental for easy filtering.
    rental = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='maintenance_requests_as_rental'
    )
    # The mechanic who quoted/took the job; null until a mechanic quotes.
    mechanic = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='maintenance_requests_as_mechanic',
        limit_choices_to={'role': 'mechanic'},
    )
    work_description = models.TextField(help_text='The work the rental needs done.')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    quoted_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    estimated_value = models.PositiveIntegerField(null=True, blank=True)
    estimated_unit = models.CharField(max_length=10, choices=DURATION_UNIT_CHOICES, blank=True)
    mechanic_notes = models.TextField(blank=True)
    decision_reason = models.TextField(blank=True)
    # Identity verification captured before quoting (uploaded docs + OCR details).
    id_documents = models.JSONField(default=list, blank=True)
    verified_details = models.JSONField(null=True, blank=True)
    # The rental's "request more information" note (status info_requested).
    info_request_message = models.TextField(blank=True)
    quoted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    # When the mechanic marked the work done (job entered pending_return).
    work_completed_at = models.DateTimeField(null=True, blank=True)
    # When the rental confirmed the return (job fully completed).
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Maintenance<{self.vehicle} / {self.status}>'


class VehicleLocation(models.Model):
    """The latest GPS position reported for a vehicle by the driver currently
    renting it. One row per vehicle (upserted on each report). The rental owner's
    live map reads these; the staleness check in ``operations.tracking`` treats a
    missing or old ``recorded_at`` as 'location off' for the active trip."""

    vehicle = models.OneToOneField(
        Vehicle, on_delete=models.CASCADE, related_name='location'
    )
    # The driver and booking the position came from, for attribution on the map.
    driver = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='reported_locations',
        limit_choices_to={'role': 'driver'},
    )
    rental_request = models.ForeignKey(
        RentalRequest, on_delete=models.CASCADE, related_name='locations'
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy = models.FloatField(null=True, blank=True, help_text='Reported accuracy in metres.')
    recorded_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'VehicleLocation<{self.vehicle_id} @ {self.recorded_at:%Y-%m-%d %H:%M}>'


class LocationWarning(models.Model):
    """A single GPS 'location off' warning issued against a driver during an
    active rental. Rows serve two purposes: they de-duplicate warnings (no new
    warning within the gap window for the same trip) and they form the durable
    history behind the driver's running strike count. The cumulative count lives
    on ``User.location_warning_count``; ``warning_number`` snapshots its value at
    the moment the warning was issued (1, 2, 3 → suspension)."""

    driver = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='location_warnings',
        limit_choices_to={'role': 'driver'},
    )
    rental_request = models.ForeignKey(
        RentalRequest, on_delete=models.CASCADE, related_name='location_warnings'
    )
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.CASCADE, related_name='location_warnings'
    )
    warning_number = models.PositiveIntegerField(help_text="The driver's strike number when this was issued.")
    # True for the warning that crossed the threshold and suspended the account.
    suspended = models.BooleanField(default=False)
    issued_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f'LocationWarning<driver={self.driver_id} #{self.warning_number}>'


class DeletionAudit(models.Model):
    """A durable, standalone record of a destructive delete and everything it
    cascaded away.

    By design this model has NO foreign key to the thing that was deleted (only a
    SET_NULL link to the actor, which is itself nulled rather than cascaded). That
    is the whole point: a ``DeletionAudit`` row must SURVIVE the cascade it
    documents, so that after a rental owner / vehicle / driver is gone we still
    have a forensic record. It captures a curated field snapshot of the deleted
    row plus a per-model count of every related row the cascade removed, so an
    accidental delete can be investigated and (with the snapshot + counts)
    reconstructed or its blast radius understood. Created BEFORE the delete runs.
    """

    # Who performed the delete; nulled (not cascaded) if that admin is later
    # removed, and the display name is snapshotted so the entry stands alone.
    actor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deletion_audits',
    )
    actor_name = models.CharField(max_length=255, blank=True)
    # Frontend-style entity type of the deleted record
    # ('rental','driver','mechanic','vehicle','booking','maintenance', …).
    target_type = models.CharField(max_length=40, db_index=True)
    # The deleted row's original primary key and a human label.
    target_id = models.CharField(max_length=64, db_index=True)
    target_label = models.CharField(max_length=255, blank=True)
    # Curated {field: value} snapshot of the deleted row itself.
    snapshot = models.JSONField(default=dict, blank=True)
    # {model_label: count} for every row the cascade removed (incl. the target).
    cascade_counts = models.JSONField(default=dict, blank=True)
    # Sum of cascade_counts — the total number of rows the delete removed.
    cascade_total = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'DeletionAudit<{self.target_type} {self.target_id} by {self.actor_name}>'


class SiteBranding(models.Model):
    """App-wide branding the admin controls: theme mode, primary/secondary colour
    and logo.

    This is a deliberate SINGLE-ROW (singleton) model — there is exactly one
    branding record for the whole platform, always at ``pk=1``. Every user (any
    role) reads it on app load so the look-and-feel is GLOBAL, while only admins
    are allowed to write it (enforced in the view). That is what makes an admin's
    theme/colour change apply across the entire application for everyone, instead
    of living in one browser's local storage.
    """

    MODE_CHOICES = [('light', 'Light'), ('dark', 'Dark')]

    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='light')
    primary_color = models.CharField(max_length=7, default='#6366f1')
    secondary_color = models.CharField(max_length=7, default='#f59e0b')
    # A data URL (base64) or hosted URL — TextField because base64 logos are long.
    logo_url = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site branding'
        verbose_name_plural = 'Site branding'

    def save(self, *args, **kwargs):
        # Enforce the singleton: there is only ever one branding row (pk=1).
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        """Return the one branding row, creating it with defaults on first use."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Site branding'
