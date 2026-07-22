"""
Operations business logic.

`create_profile_for_registration` is called from the authentication approval
flow (lazy import there to avoid a circular dependency) so that approving a
driver / rental / mechanic registration also creates its role profile.
"""

from .models import DriverProfile, RentalProfile, MechanicProfile


def create_profile_for_registration(user, registration):
    """
    Create (or update) the role-specific profile for a newly-approved
    registration, copying across the fields captured at sign-up. Idempotent.
    Rental staff (role='rental' with allowed_nav_paths set) are skipped — they
    are not rental owners and get no rental profile.
    """
    role = registration.role
    extra = registration.extra or {}

    if role == 'driver':
        DriverProfile.objects.update_or_create(
            user=user,
            defaults={'license_number': (extra.get('license_number') or '').strip()},
        )

    elif role == 'rental' and not user.allowed_nav_paths:
        RentalProfile.objects.update_or_create(
            user=user,
            defaults={
                'rental_type': registration.rental_type or '',
                'company_name': registration.company_name or '',
                'abn': registration.abn or '',
            },
        )

    elif role == 'mechanic':
        MechanicProfile.objects.update_or_create(
            user=user,
            defaults={
                'shop_name': registration.shop_name or '',
                'shop_address': registration.shop_address or '',
                'abn': registration.abn or '',
            },
        )
