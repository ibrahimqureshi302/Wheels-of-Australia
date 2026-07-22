"""
Authentication serializers for user registration, login, and profile.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.core.exceptions import ObjectDoesNotExist
from .models import User, RegistrationRequest, Document, Notification


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration.
    """
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ('email', 'password', 'password_confirm')

    def validate(self, attrs):
        """
        Validate that the two password entries match.
        """
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        """
        Create a new user with encrypted password.
        """
        validated_data.pop('password_confirm', None)
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    """
    email = serializers.EmailField()
    password = serializers.CharField(
        style={'input_type': 'password'},
        trim_whitespace=False
    )

    def validate(self, attrs):
        """
        Validate and authenticate the user.
        """
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )

            if not user:
                raise serializers.ValidationError(
                    'Unable to authenticate with provided credentials.'
                )

            # A restricted (suspended / deactivated) END USER may still log in —
            # they land on a locked Profile page that explains why. Only a
            # deactivated staff/superuser is fully blocked (Django-admin kill
            # switch).
            if not user.is_active and (user.is_staff or user.is_superuser):
                raise serializers.ValidationError(
                    'User account is disabled.'
                )

            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError(
                'Must include "email" and "password".'
            )


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile. Shape matches frontend User type.

    Beyond the core User fields it also exposes:
    - ``profile``: the role-specific details (driver licence, rental company,
      mechanic shop) so the self-service Profile page can show them. ``None``
      for admins and rental staff (who have no role profile).
    - ``admin_contact``: name + email of the primary admin, so a driver /
      rental / mechanic / rental-staff user can email the admin directly.
      ``None`` for admins.
    """
    full_name = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(format='iso-8601', read_only=True)
    profile = serializers.SerializerMethodField()
    admin_contact = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    # Report the UNIFIED restriction (suspended OR deactivated) + an effective
    # reason, so the Profile page shows the lock message in either case.
    is_suspended = serializers.SerializerMethodField()
    suspension_reason = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'role',
            'role_display',
            'date_joined',
            'is_active',
            'is_suspended',
            'suspension_reason',
            'phone_number',
            'allowed_nav_paths',
            'profile',
            'admin_contact',
            'documents',
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_is_suspended(self, obj):
        return obj.is_restricted

    def get_suspension_reason(self, obj):
        return obj.effective_suspension_reason if obj.is_restricted else ''

    def get_role_display(self, obj):
        return obj.get_role_display()

    def get_profile(self, obj):
        """Role-specific profile fields, read via the reverse one-to-one
        accessors so no extra imports/circular dependency are needed."""
        role = obj.role
        if role == 'driver':
            p = self._related(obj, 'driver_profile')
            return None if p is None else {'license_number': p.license_number}
        if role == 'rental' and not obj.allowed_nav_paths:
            p = self._related(obj, 'rental_profile')
            return None if p is None else {
                'rental_type': p.rental_type,
                'company_name': p.company_name,
                'abn': p.abn,
                'minimum_rental_days': p.minimum_rental_days,
            }
        if role == 'mechanic':
            p = self._related(obj, 'mechanic_profile')
            return None if p is None else {
                'shop_name': p.shop_name,
                'shop_address': p.shop_address,
                'abn': p.abn,
            }
        return None

    def get_documents(self, obj):
        """The documents this user uploaded during registration (every role
        except admin). Looked up via the reverse link from the approved
        registration request; empty for admins or users with no request."""
        if obj.role == 'admin' or obj.is_superuser:
            return []
        reg = self._related(obj, 'registration_request')
        if reg is None:
            return []
        return DocumentSerializer(reg.documents.all(), many=True, context=self.context).data

    def get_admin_contact(self, obj):
        if obj.role == 'admin' or obj.is_superuser:
            return None
        # Rental STAFF are created and managed by their rental OWNER, so their
        # help contact is the owner (not the platform admin). Falls through to
        # the admin only if the owner link is somehow missing.
        if obj.role == 'rental' and obj.allowed_nav_paths and obj.rental_parent_id:
            owner = obj.rental_parent
            if owner is not None:
                return {
                    'full_name': owner.get_full_name() or owner.email,
                    'email': owner.email,
                    'is_owner': True,
                }
        # Don't surface a suspended admin as the support contact — they're locked
        # out of acting on requests, so they can't help with reactivation.
        admin = (
            User.objects.filter(is_superuser=True, is_active=True, is_suspended=False)
            .order_by('date_joined', 'id').first()
            or User.objects.filter(role='admin', is_active=True, is_suspended=False)
            .order_by('date_joined', 'id').first()
        )
        if admin is None:
            return None
        return {'full_name': admin.get_full_name(), 'email': admin.email, 'is_owner': False}

    @staticmethod
    def _related(obj, attr):
        try:
            return getattr(obj, attr)
        except ObjectDoesNotExist:
            return None


class TokenResponseSerializer(serializers.Serializer):
    """
    Serializer for JWT token response.
    """
    access = serializers.CharField(
        help_text="JWT access token. Use this in the Authorization header as 'Bearer <token>'"
    )
    refresh = serializers.CharField(
        help_text="JWT refresh token. Use this to obtain new access tokens"
    )
    user = UserProfileSerializer(help_text="User profile information")


class ErrorResponseSerializer(serializers.Serializer):
    """
    Serializer for error responses.
    """
    detail = serializers.CharField(help_text="Error message describing what went wrong")

    class Meta:
        examples = [
            {
                "detail": "Invalid credentials provided"
            },
            {
                "email": ["This field is required."],
                "password": ["This field is required."]
            }
        ]


class RegistrationCreateSerializer(serializers.ModelSerializer):
    """
    Validates and creates a pending RegistrationRequest (no account yet).

    Enforces email format (EmailField) and prevents duplicate registrations:
    the same email cannot be used if an account already exists or a pending
    request is already awaiting review.
    """

    class Meta:
        model = RegistrationRequest
        fields = (
            'id',
            'role',
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'rental_type',
            'company_name',
            'abn',
            'shop_name',
            'shop_address',
            'extra',
        )
        read_only_fields = ('id',)

    def validate_role(self, value):
        if value not in ('driver', 'rental', 'mechanic'):
            raise serializers.ValidationError('Role must be driver, rental or mechanic.')
        return value

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                'An account with this email already exists. Please log in instead.'
            )
        if RegistrationRequest.objects.filter(
            email__iexact=email, status=RegistrationRequest.STATUS_PENDING
        ).exists():
            raise serializers.ValidationError(
                'A registration with this email is already awaiting review.'
            )
        return email

    @staticmethod
    def _clean_abn(value, required):
        """An ABN is exactly 11 digits (spaces stripped)."""
        v = (value or '').replace(' ', '')
        if not v:
            if required:
                raise serializers.ValidationError({'abn': 'ABN must be exactly 11 digits.'})
            return v
        if not (v.isdigit() and len(v) == 11):
            raise serializers.ValidationError({'abn': 'ABN must be exactly 11 digits.'})
        return v

    def validate(self, attrs):
        role = attrs.get('role')
        if role == 'rental':
            rental_type = attrs.get('rental_type')
            if rental_type not in ('company', 'individual'):
                raise serializers.ValidationError(
                    {'rental_type': 'Select company or individual.'}
                )
            if rental_type == 'company' and not attrs.get('company_name'):
                raise serializers.ValidationError(
                    {'company_name': 'Company name is required for company registration.'}
                )
            # ABN required + 11 digits for company rentals.
            attrs['abn'] = self._clean_abn(attrs.get('abn'), required=(rental_type == 'company'))
        elif role == 'mechanic':
            attrs['abn'] = self._clean_abn(attrs.get('abn'), required=True)
        return attrs


class DocumentSerializer(serializers.ModelSerializer):
    """Read serializer for an uploaded document, returning an absolute file URL."""

    file_url = serializers.SerializerMethodField()
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)

    class Meta:
        model = Document
        fields = ('id', 'doc_type', 'doc_type_display', 'file_url', 'original_name', 'uploaded_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        try:
            url = obj.file.url
        except ValueError:
            return None
        return request.build_absolute_uri(url) if request else url


class RegistrationDetailSerializer(serializers.ModelSerializer):
    """Full read serializer for admins reviewing a registration."""

    documents = DocumentSerializer(many=True, read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    requested_by_email = serializers.SerializerMethodField()

    class Meta:
        model = RegistrationRequest
        fields = (
            'id', 'role', 'role_display', 'email', 'first_name', 'last_name',
            'phone_number', 'rental_type', 'company_name', 'abn', 'shop_name',
            'shop_address', 'extra', 'status', 'status_display', 'rejection_reason',
            'reviewed_at', 'created_at', 'documents',
            'allowed_nav_paths', 'requested_by_email',
        )
        read_only_fields = fields

    def get_requested_by_email(self, obj):
        return obj.requested_by.email if obj.requested_by_id else None


class NotificationSerializer(serializers.ModelSerializer):
    """In-app notification for the current user."""

    class Meta:
        model = Notification
        fields = (
            'id', 'notification_type', 'title', 'message', 'link',
            'entity_type', 'entity_id', 'action', 'actor_name',
            'is_read', 'created_at', 'registration',
        )
        read_only_fields = fields
