"""
Authentication views for registration, login, profile, admin review and
notifications.

Class-based / generic DRF views. drf-spectacular generates the OpenAPI docs
automatically from the views + serializers, so no @extend_schema decorators are
needed here.
"""

from rest_framework import status, viewsets, mixins
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth import login
from django.conf import settings

from .cookies import set_auth_cookies, clear_auth_cookies
from .models import User, Document, RegistrationRequest, Notification
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    RegistrationCreateSerializer,
    RegistrationDetailSerializer,
    NotificationSerializer,
)
from .services import (
    notify_admins_of_registration,
    notify_admins_of_action,
    actor_label,
    approve_registration,
    reject_registration,
    ApprovalError,
)


class IsAdmin(BasePermission):
    """Allow access only to authenticated admins (role='admin' or superuser)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (getattr(user, 'role', None) == 'admin' or user.is_superuser)
        )


# File field names accepted on the registration endpoint, mapped to document types.
REGISTRATION_DOC_FIELDS = {
    'license': 'license',
    'passport': 'passport',
    'cnic': 'cnic',
    'certificate': 'certificate',
    'shop_image': 'shop_image',
}


class RegisterView(APIView):
    """Register a new user and sign them in via HttpOnly JWT cookies."""

    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        # Tokens are delivered as HttpOnly cookies, never in the JSON body, so JS
        # can't read them.
        response = Response({
            'user': UserProfileSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
        set_auth_cookies(response, access=str(refresh.access_token), refresh=str(refresh))
        return response


class RegistrationSubmitView(APIView):
    """Public driver/rental/mechanic self-registration. Stores a pending
    RegistrationRequest (+ uploaded documents) and notifies admins; no account
    is created until an admin approves."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = RegistrationCreateSerializer

    def post(self, request):
        serializer = RegistrationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        registration = serializer.save()

        for field_name, doc_type in REGISTRATION_DOC_FIELDS.items():
            uploaded = request.FILES.get(field_name)
            if uploaded:
                Document.objects.create(
                    registration=registration,
                    doc_type=doc_type,
                    file=uploaded,
                    original_name=getattr(uploaded, 'name', '')[:255],
                )

        notify_admins_of_registration(registration)

        return Response(
            {
                'id': registration.id,
                'status': registration.status,
                'detail': (
                    'Your registration has been submitted and is awaiting admin approval. '
                    'You will receive an email with your login details once approved.'
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Authenticate with email + password; sets HttpOnly JWT cookies + returns user."""

    permission_classes = [AllowAny]
    serializer_class = UserLoginSerializer

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        refresh = RefreshToken.for_user(user)
        user_data = {
            'id': user.id,
            'email': user.email,
            'first_name': getattr(user, 'first_name', '') or '',
            'last_name': getattr(user, 'last_name', '') or '',
            'full_name': user.get_full_name(),
            'role': getattr(user, 'role', 'driver'),
            'role_display': user.get_role_display() if hasattr(user, 'get_role_display') else '',
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'is_active': user.is_active,
            # Report the UNIFIED restriction so the SPA locks the user to their
            # profile whether they were suspended or deactivated.
            'is_suspended': user.is_restricted,
            'suspension_reason': user.effective_suspension_reason if user.is_restricted else '',
            'phone_number': getattr(user, 'phone_number', None) or None,
            'allowed_nav_paths': getattr(user, 'allowed_nav_paths', None),
        }
        # Tokens go out as HttpOnly cookies only — the body carries just the user
        # so the SPA can render role-based nav immediately.
        response = Response({'user': user_data}, status=status.HTTP_200_OK)
        set_auth_cookies(response, access=str(refresh.access_token), refresh=str(refresh))
        return response


class ProfileView(APIView):
    """Return the currently authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)


class CookieTokenRefreshView(APIView):
    """Rotate the access token using the HttpOnly refresh cookie.

    Reads the refresh token from the ``refresh_token`` cookie (falling back to a
    request-body ``refresh`` for API tooling), validates it through SimpleJWT's
    serializer — so token rotation / blacklisting behave exactly as configured —
    and writes the fresh token(s) back out as HttpOnly cookies. No token is ever
    returned in the JSON body. A missing/invalid refresh clears the cookies and
    returns 401 so the SPA falls back to login.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get('refresh')
        if not refresh:
            return Response({'detail': 'No refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={'refresh': refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken):
            response = Response({'detail': 'Invalid or expired refresh token.'},
                               status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        data = serializer.validated_data
        response = Response({'detail': 'Token refreshed.'}, status=status.HTTP_200_OK)
        # `refresh` is only present in the result when ROTATE_REFRESH_TOKENS is on.
        set_auth_cookies(response, access=data.get('access'), refresh=data.get('refresh'))
        return response


class LogoutView(APIView):
    """Clear the auth cookies (and best-effort blacklist the refresh token)."""

    permission_classes = [AllowAny]

    def post(self, request):
        refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get('refresh')
        if refresh:
            try:
                # Only invalidates server-side if the blacklist app is installed;
                # harmless no-op (caught) otherwise. The cookie is cleared regardless.
                RefreshToken(refresh).blacklist()
            except Exception:
                pass
        response = Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """List/retrieve active users (JWT protected). Supports ?email= filtering."""

    queryset = User.objects.filter(is_active=True)
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = User.objects.filter(is_active=True)
        email = self.request.query_params.get('email')
        if email is not None:
            queryset = queryset.filter(email__icontains=email)
        return queryset


class AdminRegistrationViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    Admin-only review of registration requests.

    - ``GET    /registrations/admin/``            list (?status=…, ?role=…; default hides rental_staff)
    - ``GET    /registrations/admin/{id}/``       retrieve one (with documents)
    - ``POST   /registrations/admin/{id}/approve/`` approve → create account, email credentials
    - ``POST   /registrations/admin/{id}/reject/``  reject → email applicant with reason
    - ``DELETE /registrations/admin/{id}/``       permanently delete the request (+ its documents)
    """

    queryset = RegistrationRequest.objects.all().prefetch_related('documents')
    serializer_class = RegistrationDetailSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = RegistrationRequest.objects.all().prefetch_related('documents')
        status_param = self.request.query_params.get('status')
        role_param = self.request.query_params.get('role')
        if role_param:
            qs = qs.filter(role=role_param)
        elif self.action == 'list':
            # Only the default LIST hides staff (they have their own page).
            # Detail actions (retrieve/approve/reject) must still find them.
            qs = qs.exclude(role='rental_staff')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        registration = self.get_object()
        try:
            approve_registration(
                registration,
                reviewer=request.user,
                login_url=settings.FRONTEND_LOGIN_URL,
            )
        except ApprovalError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        registration.refresh_from_db()
        # Surface the approval to other admins; deep-link to the new account.
        created = registration.created_user
        notify_admins_of_action(
            actor=request.user,
            action='approved',
            entity_type=registration.role,  # 'driver' / 'rental' / 'mechanic'
            entity_id=created.id if created else '',
            title='Registration approved',
            message=(f'{actor_label(request.user)} approved the '
                     f'{registration.get_role_display()} registration for {registration.email}.'),
            notification_type='new_registration',
        )
        return Response(self.get_serializer(registration).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        registration = self.get_object()
        reason = (request.data.get('reason') or '').strip()
        try:
            reject_registration(registration, reviewer=request.user, reason=reason)
        except ApprovalError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        registration.refresh_from_db()
        notify_admins_of_action(
            actor=request.user,
            action='rejected',
            entity_type='registration', entity_id=registration.id,
            title='Registration rejected',
            message=(f'{actor_label(request.user)} rejected the '
                     f'{registration.get_role_display()} registration for {registration.email}.'),
            notification_type='new_registration',
        )
        return Response(self.get_serializer(registration).data, status=status.HTTP_200_OK)


class NotificationsGranted(BasePermission):
    """Gate the notifications module for rental STAFF.

    A rental staff member (role 'rental' with ``allowed_nav_paths`` set) may use
    notifications only when '/notifications' is among their granted paths — so a
    staff member the owner didn't grant Notifications to can't read the bell/page
    data by calling the API directly, matching the sidebar + route-guard. Rental
    OWNERS (no allowed_nav_paths) and every other role (driver / mechanic / admin)
    always pass.
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, 'role', None) == 'rental' and getattr(user, 'allowed_nav_paths', None):
            return '/notifications' in (user.allowed_nav_paths or [])
        return True


class NotificationViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    """The current user's in-app notifications, with unread count, mark-read and
    delete (a user can delete their own notifications)."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, NotificationsGranted]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        updated = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'detail': f'{updated} notification(s) marked read.'})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(NotificationSerializer(notification).data)
