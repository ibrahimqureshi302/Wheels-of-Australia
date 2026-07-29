"""
Authentication models with custom email-only User.
"""

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.base_user import BaseUserManager
from django.db import models

# Role choices aligned with frontend (admin, driver, rental, mechanic).
# Rental staff use role='rental' with allowed_nav_paths set.
ROLE_CHOICES = [
    ('admin', 'Admin'),
    ('driver', 'Driver'),
    ('rental', 'Rental'),
    ('mechanic', 'Mechanic'),
]

class UserManager(BaseUserManager):
    """
    Custom user manager for email-only authentication.
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Create and return a regular user with an email and password.
        """
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and return a superuser with an email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model that uses email as the unique identifier.
    """
    
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text='Email address used for authentication'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='driver',
        db_index=True,
        help_text='User role for RBAC (admin, driver, rental, mechanic).'
    )
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    allowed_nav_paths = models.JSONField(
        null=True,
        blank=True,
        help_text='For rental staff: list of nav paths they can access. Main rental has null.'
    )
    rental_parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='rental_staff',
        help_text='For rental staff: the rental owner they belong to. Null for everyone else.'
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password = models.BooleanField(
        default=False,
        help_text='True when the password was system-generated and the user should change it on first login.'
    )
    # Restricted-access flag. A suspended user can STILL log in, but is locked to
    # their Profile page (which shows ``suspension_reason`` + the admin-contact
    # help card); every other API call is rejected by SuspensionAwareJWTAuth.
    # Set when an admin marks the account inactive, or when GPS strikes hit the
    # limit. ``is_active`` deliberately stays True so login + JWT keep working
    # (SimpleJWT rejects is_active=False users on every request).
    is_suspended = models.BooleanField(default=False, db_index=True)
    suspension_reason = models.TextField(
        blank=True, default='',
        help_text='Message shown to a suspended user on their profile page.'
    )
    # GPS tracking strikes (drivers): incremented when their location is found to
    # be off during an active rental. At 3 the account is suspended
    # (is_suspended=True); an admin reactivation resets this to 0. See
    # operations.tracking.
    location_warning_count = models.PositiveIntegerField(default=0)
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = 'auth_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        indexes = [
            models.Index(fields=['email'], name='user_email_idx'),
            models.Index(
                fields=['is_active'],
                name='user_active_idx',
                condition=models.Q(is_active=True)
            ),
        ]

    def __str__(self):
        return self.email

    def get_full_name(self):
        if self.first_name or self.last_name:
            return f'{self.first_name or ""} {self.last_name or ""}'.strip()
        return self.email

    def get_short_name(self):
        return self.first_name or self.email.split('@')[0]

    @property
    def is_restricted(self):
        """True when this account is locked to its Profile page rather than
        having full app access.

        This unifies the two ways an end user can be restricted:
        - ``is_suspended`` — set by an admin (manual "inactive") or by the GPS
          3-strike auto-suspension.
        - ``is_active=False`` — a legacy/Django-admin deactivation. We treat it
          the same so a deactivated end user can still log in and see why,
          instead of being silently locked out at the login screen.

        Superusers are never restricted.
        """
        if self.is_superuser:
            return False
        return bool(self.is_suspended) or not self.is_active

    @property
    def effective_suspension_reason(self):
        """The message to show a restricted user. Falls back to a sensible
        default when no explicit reason was recorded."""
        if self.suspension_reason:
            return self.suspension_reason
        if not self.is_active:
            return (
                'Your account has been deactivated by an administrator. '
                'Please contact support to request reactivation.'
            )
        return 'Your account is suspended. Please contact an administrator.'


# Roles a registration request can carry. 'rental_staff' is not self-registered
# from the public site — it is created by a rental owner and, on approval,
# becomes a role='rental' User with allowed_nav_paths set and a rental_parent.
REGISTRABLE_ROLE_CHOICES = [
    ('driver', 'Driver'),
    ('rental', 'Rental'),
    ('mechanic', 'Mechanic'),
    ('rental_staff', 'Rental staff'),
]


class RegistrationRequest(models.Model):
    """
    A pending self-registration submitted by a driver, rental or mechanic.

    No account is created at submission time. The request is reviewed by an admin
    who either approves it (which creates an active User and emails generated
    credentials) or rejects it.
    """

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    RENTAL_TYPE_CHOICES = [
        ('company', 'Company'),
        ('individual', 'Individual'),
    ]

    role = models.CharField(max_length=20, choices=REGISTRABLE_ROLE_CHOICES, db_index=True)

    # Common contact details
    email = models.EmailField(db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)

    # Rental-specific
    rental_type = models.CharField(max_length=20, choices=RENTAL_TYPE_CHOICES, blank=True)
    company_name = models.CharField(max_length=255, blank=True)
    abn = models.CharField(max_length=20, blank=True)

    # Mechanic-specific
    shop_name = models.CharField(max_length=255, blank=True)
    shop_address = models.TextField(blank=True)

    # Rental-staff-specific: who requested it and which nav paths they may access.
    requested_by = models.ForeignKey(
        'User', null=True, blank=True, on_delete=models.CASCADE,
        related_name='requested_staff_registrations',
        help_text='Rental owner who created this staff request (rental_staff role only).'
    )
    allowed_nav_paths = models.JSONField(
        null=True, blank=True,
        help_text='Rental staff: nav paths the owner granted. Copied to the User on approval.'
    )

    # Any other free-form data supplied at registration
    extra = models.JSONField(null=True, blank=True)

    # Review workflow
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        'User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='reviewed_registrations'
    )
    created_user = models.OneToOneField(
        'User', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='registration_request'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Registration request'
        verbose_name_plural = 'Registration requests'

    def __str__(self):
        return f'{self.email} ({self.get_role_display()}) - {self.get_status_display()}'

    def create_user_account(self, generated_password):
        """
        Create the active User account for an approved registration.
        Returns the created User. The caller is responsible for emailing the
        generated password. Does NOT mark the request approved by itself.

        Rental staff become a role='rental' User with the granted nav paths and
        a link to the owning rental (rental_parent).
        """
        common = dict(
            email=self.email,
            password=generated_password,
            first_name=self.first_name,
            last_name=self.last_name,
            phone_number=self.phone_number,
            is_active=True,
            must_change_password=True,
        )
        if self.role == 'rental_staff':
            user = User.objects.create_user(
                role='rental',
                allowed_nav_paths=self.allowed_nav_paths or [],
                rental_parent=self.requested_by,
                **common,
            )
        else:
            user = User.objects.create_user(role=self.role, **common)
        self.created_user = user
        return user


def registration_document_upload_path(instance, filename):
    """Store uploaded documents grouped by registration id."""
    reg_id = instance.registration_id or 'unassigned'
    return f'registration_docs/{reg_id}/{filename}'


class Document(models.Model):
    """An uploaded file attached to a registration request (ID, certificate, shop image, ...)."""

    DOC_TYPE_CHOICES = [
        ('license', 'Driving Licence'),
        ('passport', 'Passport'),
        ('cnic', 'CNIC / National ID'),
        ('certificate', 'Company Certificate'),
        ('shop_image', 'Shop Image'),
        ('other', 'Other'),
    ]

    registration = models.ForeignKey(
        RegistrationRequest, related_name='documents', on_delete=models.CASCADE
    )
    doc_type = models.CharField(max_length=20, choices=DOC_TYPE_CHOICES, default='other')
    file = models.FileField(upload_to=registration_document_upload_path)
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.get_doc_type_display()} - {self.original_name or self.file.name}'


class Notification(models.Model):
    """An in-app notification, primarily used to alert admins of new registrations."""

    recipient = models.ForeignKey(
        'User', related_name='notifications', on_delete=models.CASCADE
    )
    notification_type = models.CharField(max_length=50, default='new_registration')
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    # Optional in-app deep link (a frontend path, e.g. '/rental/requests') so
    # clicking the notification can navigate to where the related work lives.
    # Kept as a fallback; prefer the entity_* fields below for role-aware routing.
    link = models.CharField(max_length=255, blank=True)
    # Generic reference to the record this notification is about. The frontend
    # resolves (entity_type, recipient role) -> the correct detail/edit page and
    # uses entity_id to scroll to / highlight the record once it lands there.
    entity_type = models.CharField(max_length=40, blank=True)  # 'vehicle','driver','rental','mechanic','rental_staff','booking','maintenance','registration'
    entity_id = models.CharField(max_length=64, blank=True)    # PK of that record (string-safe)
    action = models.CharField(max_length=40, blank=True)       # 'created','updated','deleted','approved','rejected',…
    # Snapshot of who performed the action (so the message survives the actor
    # being renamed or deleted), e.g. 'John Smith (driver)'.
    actor_name = models.CharField(max_length=255, blank=True)
    registration = models.ForeignKey(
        RegistrationRequest, null=True, blank=True, on_delete=models.CASCADE,
        related_name='notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} -> {self.recipient.email}'