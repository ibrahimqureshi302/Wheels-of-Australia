"""
Custom authentication backend.

Django's default ``ModelBackend`` rejects any ``is_active=False`` user inside
``authenticate()`` (via ``user_can_authenticate``), so a deactivated user can
never log in. Our product rule is the opposite: a restricted end user MUST be
able to log in so they can see why their account is restricted and contact the
admin — they are simply locked to their Profile page afterwards (enforced by
``SuspensionAwareJWTAuthentication``).

``RestrictedLoginModelBackend`` therefore allows inactive END USERS to
authenticate, while still blocking deactivated staff / superusers so the Django
admin keeps a real kill switch.
"""
from django.contrib.auth.backends import ModelBackend


class RestrictedLoginModelBackend(ModelBackend):
    def user_can_authenticate(self, user):
        if user.is_active:
            return True
        # Deactivated end users may still authenticate (they land on a locked
        # Profile page); deactivated staff/superusers stay blocked.
        return not (user.is_staff or user.is_superuser)
