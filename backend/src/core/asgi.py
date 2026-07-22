"""
ASGI config for the project.

It exposes the ASGI callable as a module-level variable named ``application``.

HTTP traffic is served by the normal Django app (the whole REST API, unchanged).
WebSocket traffic is routed through Channels: the origin is validated, the user
is resolved from the HttpOnly access-token cookie, and the connection is
dispatched to a consumer by URL (see ``operations.routing``).

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Resolve the HTTP application first — this also populates the app registry, so
# the imports below (which touch models) are safe to run afterwards.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from authentication.ws_auth import CookieJWTAuthMiddleware  # noqa: E402
import operations.routing  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        CookieJWTAuthMiddleware(
            URLRouter(operations.routing.websocket_urlpatterns)
        )
    ),
})
