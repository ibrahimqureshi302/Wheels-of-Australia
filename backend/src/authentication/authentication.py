"""
Custom JWT authentication.

``SuspensionAwareJWTAuthentication`` is the single global chokepoint that
enforces account suspension. A suspended user (``is_suspended=True``) can still
authenticate so they can reach their own profile and log out, but every other
API endpoint is refused. We exempt the auth namespace (``/auth/...``) — login,
profile (``/auth/me/``), token refresh, logout — so the locked-out user can see
why they're suspended and contact the admin, but nothing else.

It also resolves the access token from the HttpOnly ``access_token`` cookie when
no Authorization header is present, so the SPA (which stores nothing in JS) is
authenticated purely from cookies. The Bearer header path is kept for Swagger /
API tooling.

This lives in the authentication class (not a permission) because individual
views override ``permission_classes`` but virtually never override
``authentication_classes``, so this reliably covers the whole API.
"""
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.exceptions import AuthenticationFailed


class SuspensionAwareJWTAuthentication(JWTAuthentication):
    # Any request whose path contains this segment is always allowed for a
    # restricted user (login, /auth/me/, /auth/logout/, /auth/jwt/refresh/, ...).
    EXEMPT_SEGMENT = '/auth/'

    def get_user(self, validated_token):
        """Resolve the token's user WITHOUT rejecting deactivated end users.

        SimpleJWT's default ``get_user`` raises for any ``is_active=False`` user,
        which would log out a restricted end user on every request — including
        the /auth/me/ call they need to learn why they're restricted. We mirror
        the default but only keep the kill switch for deactivated staff /
        superusers; the per-request lockout for restricted end users is applied
        in ``authenticate`` (which still lets them reach /auth/*).
        """
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            raise InvalidToken(_('Token contained no recognizable user identification'))

        try:
            user = self.user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
        except self.user_model.DoesNotExist:
            raise AuthenticationFailed(_('User not found'), code='user_not_found')

        if not user.is_active and (user.is_staff or user.is_superuser):
            raise AuthenticationFailed(_('User is inactive'), code='user_inactive')

        return user

    def authenticate(self, request):
        # Prefer the Authorization header (Swagger / API tooling); fall back to
        # the HttpOnly access-token cookie the SPA relies on.
        header = self.get_header(request)
        raw_token = self.get_raw_token(header) if header is not None else None
        from_cookie = False
        if raw_token is None:
            raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
            from_cookie = True
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
        except AuthenticationFailed:
            # A stale/invalid COOKIE (an expired token, or one whose user no
            # longer exists) must NOT hard-fail the request — otherwise a public
            # (AllowAny) endpoint like /system/branding/ returns 401 to a
            # logged-out browser that still holds an old cookie, the SPA tries to
            # refresh + auto-logout, and since JavaScript cannot clear an
            # HttpOnly cookie the page reloads and repeats forever. Treat it as
            # anonymous instead: public endpoints load, and protected ones still
            # return 401 via IsAuthenticated. An explicit Authorization header is
            # a deliberate credential, so keep the strict 401 there.
            if from_cookie:
                return None
            raise

        if getattr(user, 'is_restricted', False) and self.EXEMPT_SEGMENT not in request.path:
            # A restricted (suspended) user is locked out of every non-/auth/
            # endpoint — but we must NOT hard-fail with 401 here, because this
            # runs at the authentication layer, BEFORE permissions, and so would
            # also 401 genuinely PUBLIC endpoints (e.g. AllowAny /system/branding/
            # which every page loads for theming). That 401 makes the SPA fire its
            # token-refresh recovery; with ROTATE_REFRESH_TOKENS + BLACKLIST,
            # concurrent refreshes race and one hits a blacklisted token → the
            # user is auto-logged-out and can never reach their locked Profile
            # page. Instead, treat the suspended user as ANONYMOUS (return None),
            # exactly like the stale-cookie branch above: public endpoints then
            # serve normally, while protected (IsAuthenticated) endpoints still
            # return 401 — so the lockout is preserved with no logout loop. The
            # SPA already learns the account is suspended from /auth/me/ and locks
            # the UI to the Profile page from that flag.
            return None
        return user, validated_token
 

 