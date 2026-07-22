"""WebSocket URL routing for the operations app (real-time GPS tracking)."""
from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/track/(?P<vehicle_id>\d+)/$', consumers.VehicleTrackingConsumer.as_asgi()),
]
