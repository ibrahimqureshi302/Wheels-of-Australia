"""
HttpOnly JWT cookie helpers.

The SPA no longer stores JWTs in localStorage. Instead the access and refresh
tokens are delivered as HttpOnly cookies that JavaScript can never read, which
removes the XSS token-theft surface. These helpers are the single place that
knows the cookie names and security attributes (see the ``AUTH_COOKIE_*``
settings) so login, refresh and logout all stay consistent.
"""

from django.conf import settings


def _cookie_kwargs():
    """Shared security attributes for both auth cookies."""
    return {
        'httponly': settings.AUTH_COOKIE_HTTP_ONLY,
        'secure': settings.AUTH_COOKIE_SECURE,
        'samesite': settings.AUTH_COOKIE_SAMESITE,
        'domain': settings.AUTH_COOKIE_DOMAIN,
        'path': settings.AUTH_COOKIE_PATH,
    }


def _max_age(setting_key):
    """Cookie lifetime (seconds) mirrored from the matching SIMPLE_JWT lifetime."""
    return int(settings.SIMPLE_JWT[setting_key].total_seconds())


def set_auth_cookies(response, access=None, refresh=None):
    """Attach the access and/or refresh JWTs to ``response`` as HttpOnly cookies."""
    if access is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_ACCESS,
            access,
            max_age=_max_age('ACCESS_TOKEN_LIFETIME'),
            **_cookie_kwargs(),
        )
    if refresh is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            refresh,
            max_age=_max_age('REFRESH_TOKEN_LIFETIME'),
            **_cookie_kwargs(),
        )
    return response


def clear_auth_cookies(response):
    """Expire both auth cookies (logout / invalid-refresh)."""
    for name in (settings.AUTH_COOKIE_ACCESS, settings.AUTH_COOKIE_REFRESH):
        response.delete_cookie(
            name,
            path=settings.AUTH_COOKIE_PATH,
            domain=settings.AUTH_COOKIE_DOMAIN,
            samesite=settings.AUTH_COOKIE_SAMESITE,
        )
    return response
