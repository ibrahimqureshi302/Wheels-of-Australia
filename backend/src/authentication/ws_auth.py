"""
WebSocket authentication from the HttpOnly access-token cookie.

The SPA stores no JWT in JavaScript — it authenticates purely from the HttpOnly
``access_token`` cookie (see ``authentication.authentication``). Browsers send
that cookie on the WebSocket handshake too, so this Channels middleware reads it,
validates it with SimpleJWT (reusing the exact same token/user resolution as the
HTTP path), and puts the resolved user on the connection ``scope``.

A stale/invalid/missing cookie resolves to ``AnonymousUser`` (the consumer then
closes the socket) rather than raising — mirroring the HTTP rule that a bad
cookie authenticates as anonymous instead of hard-failing. Suspension is NOT
enforced here; the consumer decides per-connection what a restricted user may do.
"""
from http.cookies import SimpleCookie

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .authentication import SuspensionAwareJWTAuthentication


def _access_token_from_scope(scope):
    """Pull the access-token cookie value out of the raw ASGI handshake headers."""
    for name, value in scope.get('headers', []):
        if name == b'cookie':
            jar = SimpleCookie()
            jar.load(value.decode('latin-1'))
            morsel = jar.get(settings.AUTH_COOKIE_ACCESS)
            return morsel.value if morsel else None
    return None


@database_sync_to_async
def _resolve_user(raw_token):
    """Validate the token and load its user, or AnonymousUser on any failure."""
    if not raw_token:
        return AnonymousUser()
    backend = SuspensionAwareJWTAuthentication()
    try:
        validated = backend.get_validated_token(raw_token)
        return backend.get_user(validated)
    except (InvalidToken, TokenError, AuthenticationFailed):
        return AnonymousUser()


class CookieJWTAuthMiddleware:
    """Channels middleware: set ``scope['user']`` from the access-token cookie."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope['user'] = await _resolve_user(_access_token_from_scope(scope))
        return await self.inner(scope, receive, send)
