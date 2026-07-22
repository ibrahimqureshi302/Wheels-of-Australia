"""
Business logic for the registration approval workflow.

Kept separate from views/admin so the same logic powers both the Django admin
actions and any future REST endpoints.
"""

import secrets

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import RegistrationRequest, User, Notification
from .tasks import (
    send_registration_approved_email,
    send_registration_rejected_email,
)


# Simple, easy-to-read words used to build approved-user passwords. Australian /
# car-rental themed so they look on-brand and are easy to type and remember.
_PASSWORD_WORDS = [
    'Koala', 'Sydney', 'Outback', 'Dingo', 'Reef', 'Wombat', 'Boomerang',
    'Kangaroo', 'Canberra', 'Darwin', 'Perth', 'Hobart', 'Brisbane', 'Wheels',
    'Highway', 'Engine', 'Cruiser', 'Driver', 'Journey', 'Sunset', 'Harbour',
    'Eucalypt', 'Possum', 'Emu', 'Opal', 'Coral', 'Desert', 'Summit',
]


def generate_password():
    """
    Return a simple, easy-to-understand password: a capitalised word followed by
    four digits (e.g. ``Koala4821``). Easy to read and type, while still random
    enough for a system-generated, change-on-first-login credential.
    """
    word = secrets.choice(_PASSWORD_WORDS)
    digits = f'{secrets.randbelow(10000):04d}'
    return f'{word}{digits}'


def actor_label(user):
    """Human snapshot of who performed an action, e.g. 'John Smith (driver)'.
    Used so a notification still reads correctly if the user is later renamed
    or deleted."""
    if user is None:
        return ''
    name = user.get_full_name() or user.email
    role = getattr(user, 'role', '') or ''
    return f'{name} ({role})' if role else name


def notify_user(recipient, title, message, notification_type='system', link='',
                entity_type='', entity_id='', action='', actor_name=''):
    """Create a single in-app notification for one user (driver, mechanic, …).
    `link` is an optional frontend path the notification deep-links to; the
    entity_* fields let the frontend route per-role and highlight the record."""
    if recipient is None:
        return None
    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link or '',
        entity_type=entity_type or '',
        entity_id=str(entity_id) if entity_id else '',
        action=action or '',
        actor_name=actor_name or '',
    )


def notify_admins(title, message, notification_type='system', link='',
                  entity_type='', entity_id='', action='', actor_name='',
                  exclude=None):
    """Create an in-app notification for every admin. Generic helper used across
    the app (vehicle rented, maintenance events, etc.). Returns the count sent.

    `exclude` is an optional User (typically the actor) to skip, so an admin who
    performs an action is not notified about their own change."""
    # Skip suspended admins — they're locked to their profile and can't act on
    # these notifications, so routing work to them would silently stall it.
    admins = User.objects.filter(is_active=True, is_suspended=False).filter(
        Q(role='admin') | Q(is_superuser=True)
    ).distinct()
    if exclude is not None and getattr(exclude, 'pk', None) is not None:
        admins = admins.exclude(pk=exclude.pk)
    notifications = [
        Notification(
            recipient=admin,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link or '',
            entity_type=entity_type or '',
            entity_id=str(entity_id) if entity_id else '',
            action=action or '',
            actor_name=actor_name or '',
        )
        for admin in admins
    ]
    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_admins_of_action(actor, action, entity_type, entity_id, title, message,
                            notification_type='system', link=''):
    """Notify every admin that `actor` performed `action` on a record, so the
    admin panel surfaces (and can deep-link to) any change made by a driver,
    rental, mechanic or staff member. The acting user is excluded so they don't
    get pinged about their own change."""
    return notify_admins(
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_name=actor_label(actor),
        exclude=actor,
    )


def notify_admins_of_registration(registration):
    """Create an in-app notification for every admin about a new registration."""
    # Skip suspended admins — they're locked to their profile and can't act on
    # these notifications, so routing work to them would silently stall it.
    admins = User.objects.filter(is_active=True, is_suspended=False).filter(
        Q(role='admin') | Q(is_superuser=True)
    ).distinct()
    notifications = [
        Notification(
            recipient=admin,
            notification_type='new_registration',
            title=f'New {registration.get_role_display()} registration',
            message=f'{registration.email} submitted a {registration.get_role_display()} '
                    f'registration and is awaiting review.',
            registration=registration,
            entity_type='registration',
            entity_id=str(registration.id),
            action='submitted',
            actor_name=registration.email,
        )
        for admin in admins
    ]
    Notification.objects.bulk_create(notifications)
    return len(notifications)


def notify_admins_of_staff_created(staff_user, owner):
    """Create an in-app notification for every admin when a rental owner adds a
    staff member directly (no approval step)."""
    # Skip suspended admins — they're locked to their profile and can't act on
    # these notifications, so routing work to them would silently stall it.
    admins = User.objects.filter(is_active=True, is_suspended=False).filter(
        Q(role='admin') | Q(is_superuser=True)
    ).distinct()
    owner_name = owner.get_full_name() or owner.email
    staff_name = staff_user.get_full_name() or staff_user.email
    notifications = [
        Notification(
            recipient=admin,
            notification_type='rental_staff_created',
            title='New rental staff added',
            message=f'{owner_name} added staff member {staff_name} ({staff_user.email}).',
            entity_type='rental_staff',
            entity_id=str(staff_user.id),
            action='created',
            actor_name=owner_name,
        )
        for admin in admins
    ]
    Notification.objects.bulk_create(notifications)
    return len(notifications)


class ApprovalError(Exception):
    """Raised when a registration cannot be approved/rejected."""


@transaction.atomic
def approve_registration(registration, reviewer=None, login_url=''):
    """
    Approve a pending registration: create an active user with a generated
    password, mark the request approved, and email the credentials.

    Returns (user, raw_password).
    """
    if registration.status != RegistrationRequest.STATUS_PENDING:
        raise ApprovalError(
            f'Registration is already {registration.get_status_display().lower()}.'
        )
    if User.objects.filter(email__iexact=registration.email).exists():
        raise ApprovalError('An account with this email already exists.')

    raw_password = generate_password()
    user = registration.create_user_account(raw_password)

    registration.status = RegistrationRequest.STATUS_APPROVED
    registration.reviewed_by = reviewer
    registration.reviewed_at = timezone.now()
    registration.save(update_fields=[
        'status', 'reviewed_by', 'reviewed_at', 'created_user', 'updated_at'
    ])

    # Create the role-specific profile so admin lists have real data.
    # Lazy import avoids a circular dependency (operations imports authentication).
    from operations.services import create_profile_for_registration
    create_profile_for_registration(user, registration)

    # Console email backend in dev → prints to the server log.
    send_registration_approved_email(
        registration.email, raw_password, registration.role, login_url
    )
    return user, raw_password


@transaction.atomic
def reject_registration(registration, reviewer=None, reason=''):
    """Reject a pending registration and email the applicant."""
    if registration.status != RegistrationRequest.STATUS_PENDING:
        raise ApprovalError(
            f'Registration is already {registration.get_status_display().lower()}.'
        )
    registration.status = RegistrationRequest.STATUS_REJECTED
    registration.rejection_reason = reason or ''
    registration.reviewed_by = reviewer
    registration.reviewed_at = timezone.now()
    registration.save(update_fields=[
        'status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'updated_at'
    ])

    send_registration_rejected_email(registration.email, registration.role, reason)
    return registration
