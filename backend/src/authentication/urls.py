"""
Authentication URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenVerifyView,
)

from .views import (
    RegisterView,
    RegistrationSubmitView,
    LoginView,
    LogoutView,
    ProfileView,
    CookieTokenRefreshView,
    UserViewSet,
    AdminRegistrationViewSet,
    NotificationViewSet,
)


# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'registrations/admin', AdminRegistrationViewSet, basename='admin-registration')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    # Custom auth endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('registrations/', RegistrationSubmitView.as_view(), name='registration-submit'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', ProfileView.as_view(), name='profile'),

    # JWT endpoints. Refresh reads the HttpOnly refresh cookie and rotates the
    # access cookie — no token in the request/response body.
    path('jwt/create/', TokenObtainPairView.as_view(), name='jwt_create'),
    path('jwt/refresh/', CookieTokenRefreshView.as_view(), name='jwt_refresh'),
    path('jwt/verify/', TokenVerifyView.as_view(), name='jwt_verify'),

    # Include router URLs
    path('', include(router.urls)),
]
