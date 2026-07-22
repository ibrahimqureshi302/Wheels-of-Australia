"""
Serializers for the admin Drivers / Rentals / Mechanics lists.

Each serializes a User (the single source of truth for name/email/phone/status)
and pulls role-specific extras from the attached profile when present. Field
names match the shapes the frontend consumes.
"""

from rest_framework import serializers

from authentication.models import User, RegistrationRequest
from authentication.serializers import DocumentSerializer
from .models import (
    Vehicle, RentalRequest, MaintenanceRequest,
    DriverProfile, RentalProfile, MechanicProfile, ActivityLog,
    SiteBranding,
)

import re

HEX_COLOR_RE = re.compile(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')


class ActivityLogSerializer(serializers.ModelSerializer):
    """One audit-trail entry: who did what, when, within a rental's account."""

    actor_id = serializers.IntegerField(read_only=True)
    rental_id = serializers.IntegerField(read_only=True)
    actor_name = serializers.SerializerMethodField()
    rental_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'action', 'summary', 'link', 'by_staff',
            'actor_id', 'actor_name', 'rental_id', 'rental_name', 'created_at',
        ]

    def get_actor_name(self, obj):
        # Prefer the live name; fall back to the snapshot if the actor is gone.
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.email or obj.actor_name
        return obj.actor_name

    def get_rental_name(self, obj):
        return rental_display_name(obj.rental) if obj.rental_id else ''


def user_documents(user, context):
    """Documents the user uploaded during registration, looked up via the
    approved registration request (created_user reverse link). Empty list when
    the user has no linked request (e.g. admin-created accounts)."""
    reg = getattr(user, 'registration_request', None)
    if reg is None:
        return []
    return DocumentSerializer(reg.documents.all(), many=True, context=context).data


def rental_display_name(rental_user):
    """Best display name for a rental owner: company name if set, else full name."""
    profile = getattr(rental_user, 'rental_profile', None)
    if profile and profile.company_name:
        return profile.company_name
    return rental_user.get_full_name()


def vehicle_renter_info(vehicle):
    """Driver currently renting this vehicle (latest approved request), or None.
    Powers the admin/rental "who took this vehicle" detail."""
    if vehicle.status not in (Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN):
        return None
    req = (
        vehicle.requests
        .filter(status__in=[RentalRequest.STATUS_RUNNING, RentalRequest.STATUS_COMPLETED])
        .select_related('driver')
        .order_by('-reviewed_at')
        .first()
    )
    if not req:
        return None
    return {
        'driver_name': req.driver.get_full_name(),
        'driver_email': req.driver.email,
        'driver_phone': req.driver.phone_number or '',
        'start_date': req.start_date,
        'end_date': req.end_date,
        'since': req.reviewed_at,
    }


def vehicle_trip_count(vehicle):
    """How many times this vehicle has been rented out — i.e. the number of
    booking requests that became active. A trip stays counted after it finishes
    (status moves running → completed), so we count both the currently-running
    rentals and the completed ones."""
    return vehicle.requests.filter(
        status__in=[RentalRequest.STATUS_RUNNING, RentalRequest.STATUS_COMPLETED]
    ).count()


def vehicle_maintenance_info(vehicle):
    """Accepted maintenance job for this vehicle (mechanic + work + price), or None.
    Powers the admin/rental "manage maintenance" detail."""
    if vehicle.status != Vehicle.STATUS_MAINTENANCE:
        return None
    mr = (
        vehicle.maintenance_requests
        .filter(status__in=MaintenanceRequest.ACTIVE_STATUSES)
        .select_related('mechanic', 'mechanic__mechanic_profile')
        .order_by('-decided_at')
        .first()
    )
    if not mr:
        return None
    mech = mr.mechanic
    return {
        'id': mr.id,
        'mechanic_name': mech.get_full_name() if mech else '',
        'mechanic_email': mech.email if mech else '',
        'shop_name': getattr(getattr(mech, 'mechanic_profile', None), 'shop_name', '') if mech else '',
        'work_description': mr.work_description,
        'quoted_price': mr.quoted_price,
        'estimated_value': mr.estimated_value,
        'estimated_unit': mr.estimated_unit,
        'mechanic_notes': mr.mechanic_notes,
        'since': mr.decided_at,
    }


def _status(user):
    # 'inactive' means restricted (locked to profile) — whether via is_suspended
    # or a legacy is_active=False. A restricted account can still log in.
    # See authentication.models.User.is_restricted.
    return 'inactive' if user.is_restricted else 'active'


def split_name(full_name):
    """Split a single 'full name' string into (first_name, last_name)."""
    full_name = (full_name or '').strip()
    if not full_name:
        return '', ''
    parts = full_name.split(' ', 1)
    return parts[0], (parts[1].strip() if len(parts) > 1 else '')


import re

ABN_RE = re.compile(r'^\d{11}$')


def clean_abn(value, required):
    """Normalise + validate an ABN (Australian Business Number).

    An ABN is exactly 11 digits. Spaces are stripped. Empty is allowed only when
    ``required`` is False. Raises ValidationError on anything else (too few / too
    many digits, letters, etc.)."""
    v = (value or '').replace(' ', '')
    if not v:
        if required:
            raise serializers.ValidationError('ABN must be exactly 11 digits.')
        return v
    if not ABN_RE.match(v):
        raise serializers.ValidationError('ABN must be exactly 11 digits.')
    return v


def unique_email(serializer, value):
    """Lower-case + ensure no other account uses this email (excluding self on edit)."""
    value = value.lower().strip()
    qs = User.objects.filter(email__iexact=value)
    if serializer.instance:
        qs = qs.exclude(pk=serializer.instance.pk)
    if qs.exists():
        raise serializers.ValidationError('An account with this email already exists.')
    return value


class _BaseUserWriteMixin:
    """Shared create/update plumbing for the role serializers.

    Each role serializer declares writable input fields and a `to_representation`
    that returns the read shape. Name comes in as a single `full_name`/`contact_name`
    and is split into User.first_name / last_name. `password` is required on create
    (admin sets it) and optional on edit (blank = keep current).
    """

    role = None  # set by subclass: 'driver' / 'rental' / 'mechanic'
    name_field = 'full_name'

    def validate_email(self, value):
        return unique_email(self, value)

    def validate(self, attrs):
        # Password is required when creating a brand-new account.
        if self.instance is None and not (attrs.get('password') or '').strip():
            raise serializers.ValidationError({'password': 'A password is required for a new account.'})
        # A reason is required when an admin sets an account to inactive — it is
        # shown to the suspended user on their profile so they know why.
        if attrs.get('status') == 'inactive' and not (attrs.get('suspension_reason') or '').strip():
            raise serializers.ValidationError(
                {'suspension_reason': 'A reason is required when setting an account to inactive.'}
            )
        return attrs

    def _apply_user_fields(self, user, validated):
        name = validated.pop(self.name_field, None)
        status = validated.pop('status', None)
        reason = validated.pop('suspension_reason', None)
        password = (validated.pop('password', '') or '').strip()
        phone = validated.pop('phone_number', None)
        if 'email' in validated:
            user.email = validated['email']
        if name is not None:
            user.first_name, user.last_name = split_name(name)
        if phone is not None:
            user.phone_number = phone
        if status is not None:
            # 'inactive' = suspended (locked to profile). is_active stays True so
            # the user can still log in to see the reason and contact the admin.
            if status == 'inactive':
                user.is_active = True
                user.is_suspended = True
                user.suspension_reason = (reason or '').strip() or user.suspension_reason
            else:
                # Reactivating clears the lock, the reason and any GPS strikes —
                # and any legacy is_active=False so login is fully restored.
                if getattr(user, 'pk', None) and user.is_restricted:
                    user.location_warning_count = 0
                user.is_active = True
                user.is_suspended = False
                user.suspension_reason = ''
        elif reason is not None:
            user.suspension_reason = reason.strip()
        if password:
            user.set_password(password)
        return password


class DriverSerializer(_BaseUserWriteMixin, serializers.ModelSerializer):
    role = 'driver'
    full_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(source='phone_number', required=False, allow_blank=True)
    license_number = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=['active', 'inactive'], write_only=True, required=False)
    suspension_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('id', 'full_name', 'email', 'phone', 'license_number', 'status', 'suspension_reason', 'password')

    def to_representation(self, instance):
        p = getattr(instance, 'driver_profile', None)
        return {
            'id': instance.id,
            'full_name': instance.get_full_name(),
            'email': instance.email,
            'phone': instance.phone_number,
            'license_number': p.license_number if p else '',
            'status': _status(instance),
            # GPS tracking strikes; 'suspended' is true once locked to profile.
            'location_warnings': instance.location_warning_count,
            'suspended': instance.is_restricted,
            'suspension_reason': instance.effective_suspension_reason if instance.is_restricted else '',
            'documents': user_documents(instance, self.context),
        }

    def create(self, validated_data):
        license_number = validated_data.pop('license_number', '')
        validated_data.setdefault('status', 'active')
        user = User(role='driver')
        self._apply_user_fields(user, validated_data)
        user.save()
        DriverProfile.objects.create(user=user, license_number=license_number)
        return user

    def update(self, instance, validated_data):
        license_number = validated_data.pop('license_number', None)
        self._apply_user_fields(instance, validated_data)
        instance.save()
        # Mutate the (possibly cached) profile so the response reflects the change.
        profile = getattr(instance, 'driver_profile', None) or DriverProfile(user=instance)
        if license_number is not None:
            profile.license_number = license_number
        profile.save()
        instance.driver_profile = profile
        return instance


class RentalSerializer(_BaseUserWriteMixin, serializers.ModelSerializer):
    role = 'rental'
    name_field = 'contact_name'
    contact_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(source='phone_number', required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=['active', 'inactive'], write_only=True, required=False)
    suspension_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    rental_type = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    company_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    abn = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    minimum_rental_days = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            'id', 'rental_type', 'company_name', 'abn', 'contact_name',
            'email', 'phone', 'status', 'suspension_reason', 'minimum_rental_days',
            'latitude', 'longitude', 'password',
        )

    PROFILE_FIELDS = ('rental_type', 'company_name', 'abn', 'minimum_rental_days', 'latitude', 'longitude')

    def validate(self, attrs):
        attrs = super().validate(attrs)  # password-required + reason-required checks
        # ABN is required + 11 digits for company rentals; ignored for individuals.
        if 'abn' in attrs:
            rtype = attrs.get('rental_type', '')
            attrs['abn'] = clean_abn(attrs.get('abn', ''), required=(rtype == 'company'))
        return attrs

    def to_representation(self, instance):
        p = getattr(instance, 'rental_profile', None)
        return {
            'id': instance.id,
            'rental_type': p.rental_type if p else '',
            'company_name': p.company_name if p else '',
            'abn': p.abn if p else '',
            'contact_name': instance.get_full_name(),
            'email': instance.email,
            'phone': instance.phone_number,
            'status': _status(instance),
            'suspended': instance.is_restricted,
            'suspension_reason': instance.effective_suspension_reason if instance.is_restricted else '',
            'minimum_rental_days': p.minimum_rental_days if p else None,
            'latitude': p.latitude if p else None,
            'longitude': p.longitude if p else None,
            'documents': user_documents(instance, self.context),
            'staff': [
                {
                    'id': m.id,
                    'full_name': m.get_full_name(),
                    'email': m.email,
                    'phone': m.phone_number,
                    'status': _status(m),
                    'allowed_nav_paths': m.allowed_nav_paths or [],
                }
                for m in instance.rental_staff.all()
            ],
        }

    def _pop_profile(self, validated_data):
        return {f: validated_data.pop(f) for f in self.PROFILE_FIELDS if f in validated_data}

    def create(self, validated_data):
        profile_data = self._pop_profile(validated_data)
        validated_data.setdefault('status', 'active')
        user = User(role='rental')
        self._apply_user_fields(user, validated_data)
        user.save()
        RentalProfile.objects.create(user=user, **profile_data)
        return user

    def update(self, instance, validated_data):
        profile_data = self._pop_profile(validated_data)
        self._apply_user_fields(instance, validated_data)
        instance.save()
        profile = getattr(instance, 'rental_profile', None) or RentalProfile(user=instance)
        for k, v in profile_data.items():
            setattr(profile, k, v)
        profile.save()
        instance.rental_profile = profile
        return instance


class MechanicSerializer(_BaseUserWriteMixin, serializers.ModelSerializer):
    role = 'mechanic'
    full_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(source='phone_number', required=False, allow_blank=True)
    shop_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    shop_address = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    abn = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    status = serializers.ChoiceField(choices=['active', 'inactive'], write_only=True, required=False)
    suspension_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('id', 'full_name', 'email', 'phone', 'shop_name', 'shop_address', 'abn', 'status', 'suspension_reason', 'password')

    PROFILE_FIELDS = ('shop_name', 'shop_address', 'abn')

    def validate_abn(self, value):
        # Mechanics must provide a valid 11-digit ABN.
        return clean_abn(value, required=True)

    def to_representation(self, instance):
        p = getattr(instance, 'mechanic_profile', None)
        return {
            'id': instance.id,
            'full_name': instance.get_full_name(),
            'email': instance.email,
            'phone': instance.phone_number,
            'shop_name': p.shop_name if p else '',
            'shop_address': p.shop_address if p else '',
            'abn': p.abn if p else '',
            'status': _status(instance),
            'suspended': instance.is_restricted,
            'suspension_reason': instance.effective_suspension_reason if instance.is_restricted else '',
            'documents': user_documents(instance, self.context),
        }

    def _pop_profile(self, validated_data):
        return {f: validated_data.pop(f) for f in self.PROFILE_FIELDS if f in validated_data}

    def create(self, validated_data):
        profile_data = self._pop_profile(validated_data)
        validated_data.setdefault('status', 'active')
        user = User(role='mechanic')
        self._apply_user_fields(user, validated_data)
        user.save()
        MechanicProfile.objects.create(user=user, **profile_data)
        return user

    def update(self, instance, validated_data):
        profile_data = self._pop_profile(validated_data)
        self._apply_user_fields(instance, validated_data)
        instance.save()
        profile = getattr(instance, 'mechanic_profile', None) or MechanicProfile(user=instance)
        for k, v in profile_data.items():
            setattr(profile, k, v)
        profile.save()
        instance.mechanic_profile = profile
        return instance


class VehicleSerializer(serializers.ModelSerializer):
    """Vehicle CRUD for the owning rental (Fleet page). `rental` is set from the
    request user, never the client."""

    renter = serializers.SerializerMethodField()
    maintenance = serializers.SerializerMethodField()
    # Real "trips" = how many times the car has actually been rented out
    # (count of approved bookings), not a stored counter.
    trips = serializers.SerializerMethodField()
    # Free text: one of the predefined cover-type codes OR a custom provider name.
    # Declared explicitly so DRF does not restrict it to the model's choices.
    insurance_type = serializers.CharField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = Vehicle
        fields = (
            'id', 'make', 'model', 'year', 'rego', 'insurance_expiry', 'insurance_type',
            'image_url', 'image_urls', 'status', 'maintenance_note', 'total_distance_km', 'trips',
            'oil_due_date', 'rego_due_date', 'odometer_km', 'last_oil_change_date',
            'last_rego_payment_date', 'rent_price_per_day', 'minimum_rental_days',
            'created_at', 'renter', 'maintenance',
        )
        read_only_fields = ('id', 'created_at', 'renter', 'maintenance', 'trips')

    def get_trips(self, obj):
        return vehicle_trip_count(obj)

    def get_renter(self, obj):
        return vehicle_renter_info(obj)

    def get_maintenance(self, obj):
        return vehicle_maintenance_info(obj)

    def validate(self, attrs):
        """Keep image_url (primary thumbnail) in sync with the first of image_urls."""
        image_urls = attrs.get('image_urls')
        if image_urls is not None:
            attrs['image_url'] = image_urls[0] if image_urls else ''
        return attrs


class AdminVehicleSerializer(serializers.ModelSerializer):
    """All-vehicles list/CRUD for admin. The owning rental is chosen by the admin
    via `rental` (a rental owner's id); `rental_name` is returned for display."""

    rental = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='rental', allowed_nav_paths__isnull=True),
        write_only=True,
    )
    rental_id = serializers.IntegerField(source='rental.id', read_only=True)
    rental_name = serializers.SerializerMethodField()
    renter = serializers.SerializerMethodField()
    maintenance = serializers.SerializerMethodField()
    # Real "trips" = count of approved bookings, not a stored counter (mirrors VehicleSerializer).
    trips = serializers.SerializerMethodField()
    # Free text: one of the predefined cover-type codes OR a custom provider name.
    # Declared explicitly so DRF does not restrict it to the model's choices.
    insurance_type = serializers.CharField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = Vehicle
        fields = (
            'id', 'make', 'model', 'year', 'rego', 'status', 'rent_price_per_day',
            'insurance_expiry', 'insurance_type', 'image_url', 'image_urls',
            'maintenance_note', 'total_distance_km', 'trips', 'oil_due_date',
            'rego_due_date', 'odometer_km', 'last_oil_change_date',
            'last_rego_payment_date', 'minimum_rental_days', 'created_at',
            'rental', 'rental_id', 'rental_name', 'renter', 'maintenance',
        )
        read_only_fields = ('id', 'created_at', 'renter', 'maintenance', 'trips')

    def get_rental_name(self, obj):
        return rental_display_name(obj.rental)

    def get_trips(self, obj):
        return vehicle_trip_count(obj)

    def get_renter(self, obj):
        return vehicle_renter_info(obj)

    def get_maintenance(self, obj):
        return vehicle_maintenance_info(obj)

    def validate(self, attrs):
        """Keep image_url (primary thumbnail) in sync with the first of image_urls."""
        image_urls = attrs.get('image_urls')
        if image_urls is not None:
            attrs['image_url'] = image_urls[0] if image_urls else ''
        return attrs


class RentalStaffSerializer(serializers.ModelSerializer):
    """Read view of a staff request as seen by the rental owner who created it."""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_user_id = serializers.IntegerField(source='created_user.id', read_only=True, default=None)

    class Meta:
        model = RegistrationRequest
        fields = (
            'id', 'first_name', 'last_name', 'email', 'phone_number',
            'allowed_nav_paths', 'status', 'status_display', 'rejection_reason',
            'created_at', 'created_user_id',
        )
        read_only_fields = fields


class RentalStaffCreateSerializer(serializers.Serializer):
    """A rental owner creates a staff account directly (no admin approval).

    The owner sets the login password, so the staff member can log in
    immediately with their email + that password. The new account is a
    role='rental' User with the granted nav paths and a link back to the owner.
    """

    first_name = serializers.CharField()
    last_name = serializers.CharField(required=False, allow_blank=True, default='')
    email = serializers.EmailField()
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    password = serializers.CharField(write_only=True)
    allowed_nav_paths = serializers.ListField(
        child=serializers.CharField(), allow_empty=False
    )

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate_password(self, value):
        if not (value or '').strip():
            raise serializers.ValidationError('A password is required.')
        return value

    def create(self, validated_data):
        owner = self.context['request'].user
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            role='rental',
            allowed_nav_paths=validated_data['allowed_nav_paths'],
            rental_parent=owner,
            is_active=True,
        )


class AdminRentalStaffSerializer(_BaseUserWriteMixin, serializers.ModelSerializer):
    """Admin full CRUD over rental staff (role='rental' Users with nav paths).

    The admin picks the owning rental via `rental` (a rental owner's id) and sets
    the password on create. `rental_name` is returned for grouping in the UI.
    """

    role = 'rental'
    full_name = serializers.CharField(write_only=True)
    phone = serializers.CharField(source='phone_number', required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=['active', 'inactive'], write_only=True, required=False)
    suspension_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    allowed_nav_paths = serializers.ListField(child=serializers.CharField(), required=False)
    rental = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='rental', allowed_nav_paths__isnull=True),
        write_only=True, required=False,
    )

    class Meta:
        model = User
        fields = ('id', 'full_name', 'email', 'phone', 'status', 'suspension_reason', 'password', 'allowed_nav_paths', 'rental')

    def validate(self, attrs):
        if self.instance is None:
            if not (attrs.get('password') or '').strip():
                raise serializers.ValidationError({'password': 'A password is required for a new account.'})
            if not attrs.get('rental'):
                raise serializers.ValidationError({'rental': 'Select the rental this staff member belongs to.'})
        # reason-required-when-inactive check
        if attrs.get('status') == 'inactive' and not (attrs.get('suspension_reason') or '').strip():
            raise serializers.ValidationError(
                {'suspension_reason': 'A reason is required when setting an account to inactive.'}
            )
        return attrs

    def to_representation(self, instance):
        owner = instance.rental_parent
        return {
            'id': instance.id,
            'full_name': instance.get_full_name(),
            'email': instance.email,
            'phone': instance.phone_number,
            'status': _status(instance),
            'suspended': instance.is_restricted,
            'suspension_reason': instance.effective_suspension_reason if instance.is_restricted else '',
            'allowed_nav_paths': instance.allowed_nav_paths or [],
            'rental_id': owner.id if owner else None,
            'rental_name': rental_display_name(owner) if owner else '',
            'documents': user_documents(instance, self.context),
        }

    def create(self, validated_data):
        owner = validated_data.pop('rental')
        paths = validated_data.pop('allowed_nav_paths', None) or ['/dashboard']
        validated_data.setdefault('status', 'active')
        user = User(role='rental', allowed_nav_paths=paths, rental_parent=owner)
        self._apply_user_fields(user, validated_data)
        user.save()
        return user

    def update(self, instance, validated_data):
        owner = validated_data.pop('rental', None)
        paths = validated_data.pop('allowed_nav_paths', None)
        if owner is not None:
            instance.rental_parent = owner
        if paths is not None:
            instance.allowed_nav_paths = paths
        self._apply_user_fields(instance, validated_data)
        instance.save()
        return instance


class RentalRequestSerializer(serializers.ModelSerializer):
    """Read view of a booking request, with vehicle/driver/rental details."""

    vehicle_make = serializers.CharField(source='vehicle.make', read_only=True)
    vehicle_model = serializers.CharField(source='vehicle.model', read_only=True)
    vehicle_rego = serializers.CharField(source='vehicle.rego', read_only=True)
    # Current vehicle status — lets the owner UI know a car is still out
    # (rented/pending_return) and must be released, even after the trip
    # auto-completed at the end of its rental period.
    vehicle_status = serializers.CharField(source='vehicle.status', read_only=True)
    driver_name = serializers.SerializerMethodField()
    driver_email = serializers.CharField(source='driver.email', read_only=True)
    rental_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = RentalRequest
        fields = (
            'id', 'vehicle', 'vehicle_make', 'vehicle_model', 'vehicle_rego', 'vehicle_status',
            'driver_name', 'driver_email', 'rental_name', 'start_date', 'end_date',
            'status', 'status_display', 'decision_reason', 'reviewed_at', 'created_at',
            'id_documents', 'verified_details', 'info_request_message',
            'return_state', 'return_requested_at',
        )
        read_only_fields = fields

    def get_driver_name(self, obj):
        return obj.driver.get_full_name()

    def get_rental_name(self, obj):
        return rental_display_name(obj.rental)


class RentalRequestCreateSerializer(serializers.ModelSerializer):
    """A driver creates a booking request for a vehicle, with identity docs."""

    id_documents = serializers.JSONField(required=False)
    verified_details = serializers.JSONField(required=False)

    class Meta:
        model = RentalRequest
        fields = ('id', 'vehicle', 'start_date', 'end_date', 'id_documents', 'verified_details')
        read_only_fields = ('id',)

    def validate_vehicle(self, vehicle):
        if vehicle.status != Vehicle.STATUS_AVAILABLE:
            raise serializers.ValidationError('This vehicle is not available for booking.')
        return vehicle

    def validate(self, attrs):
        start, end = attrs.get('start_date'), attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'End date must be on or after the start date.'})
        docs = attrs.get('id_documents') or []
        if not isinstance(docs, list) or len(docs) == 0:
            raise serializers.ValidationError(
                {'id_documents': 'Upload at least one identity document (passport, licence or visa).'}
            )
        # A driver may hold only one open request per vehicle at a time. While a
        # request is awaiting the rental's response ('pending') or the rental has
        # asked for more information ('info_requested'), block a duplicate — the
        # driver must wait for a decision or update the existing request. Once the
        # request is rejected/cancelled, a fresh request is allowed again.
        request = self.context.get('request')
        vehicle = attrs.get('vehicle')
        if request is not None and vehicle is not None:
            open_exists = RentalRequest.objects.filter(
                driver=request.user,
                vehicle=vehicle,
                status__in=[RentalRequest.STATUS_PENDING, RentalRequest.STATUS_INFO_REQUESTED],
            ).exists()
            if open_exists:
                raise serializers.ValidationError(
                    'You already have an open request for this vehicle. Wait for the '
                    'rental to respond, or update your existing request.'
                )
        return attrs

    def create(self, validated_data):
        driver = self.context['request'].user
        vehicle = validated_data['vehicle']
        return RentalRequest.objects.create(
            driver=driver,
            rental=vehicle.rental,
            **validated_data,
        )


class BrowseRentalSerializer(serializers.ModelSerializer):
    """Public-facing rental info for the driver 'Browse rentals' page. Reads the
    rental owner (a User) plus its profile, and the count of available vehicles
    (annotated on the queryset as `available_count`)."""

    rental_type = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    contact_name = serializers.SerializerMethodField()
    minimum_rental_days = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    available_vehicle_count = serializers.IntegerField(source='available_count', read_only=True)

    class Meta:
        model = User
        fields = (
            'id', 'rental_type', 'company_name', 'contact_name', 'email', 'phone_number',
            'minimum_rental_days', 'latitude', 'longitude', 'available_vehicle_count',
        )

    def _profile(self, obj):
        return getattr(obj, 'rental_profile', None)

    def get_rental_type(self, obj):
        p = self._profile(obj)
        return p.rental_type if p else ''

    def get_company_name(self, obj):
        p = self._profile(obj)
        return p.company_name if p else ''

    def get_contact_name(self, obj):
        return obj.get_full_name()

    def get_minimum_rental_days(self, obj):
        p = self._profile(obj)
        return p.minimum_rental_days if p else None

    def get_latitude(self, obj):
        p = self._profile(obj)
        return p.latitude if p else None

    def get_longitude(self, obj):
        p = self._profile(obj)
        return p.longitude if p else None


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    """Read view of a maintenance job, with vehicle / rental / mechanic details."""

    vehicle_make = serializers.CharField(source='vehicle.make', read_only=True)
    vehicle_model = serializers.CharField(source='vehicle.model', read_only=True)
    vehicle_rego = serializers.CharField(source='vehicle.rego', read_only=True)
    vehicle_image = serializers.CharField(source='vehicle.image_url', read_only=True)
    vehicle_status = serializers.CharField(source='vehicle.status', read_only=True)
    rental_name = serializers.SerializerMethodField()
    mechanic_name = serializers.SerializerMethodField()
    mechanic_email = serializers.CharField(source='mechanic.email', read_only=True, default='')
    mechanic_phone = serializers.CharField(source='mechanic.phone_number', read_only=True, default='')
    mechanic_shop = serializers.SerializerMethodField()
    mechanic_shop_address = serializers.SerializerMethodField()
    mechanic_abn = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = (
            'id', 'vehicle', 'vehicle_make', 'vehicle_model', 'vehicle_rego',
            'vehicle_image', 'vehicle_status', 'rental', 'rental_name',
            'mechanic', 'mechanic_name', 'mechanic_email', 'mechanic_phone',
            'mechanic_shop', 'mechanic_shop_address', 'mechanic_abn',
            'work_description', 'status', 'status_display', 'quoted_price',
            'estimated_value', 'estimated_unit', 'mechanic_notes', 'decision_reason',
            'id_documents', 'verified_details', 'info_request_message',
            'quoted_at', 'decided_at', 'work_completed_at', 'completed_at', 'created_at',
        )
        read_only_fields = fields

    def get_rental_name(self, obj):
        return rental_display_name(obj.rental)

    def get_mechanic_name(self, obj):
        return obj.mechanic.get_full_name() if obj.mechanic else ''

    def _mechanic_profile(self, obj):
        return getattr(obj.mechanic, 'mechanic_profile', None) if obj.mechanic else None

    def get_mechanic_shop(self, obj):
        profile = self._mechanic_profile(obj)
        return profile.shop_name if profile else ''

    def get_mechanic_shop_address(self, obj):
        profile = self._mechanic_profile(obj)
        return profile.shop_address if profile else ''

    def get_mechanic_abn(self, obj):
        profile = self._mechanic_profile(obj)
        return profile.abn if profile else ''


class MaintenanceRequestCreateSerializer(serializers.ModelSerializer):
    """A rental owner flags a vehicle for maintenance and describes the work."""

    class Meta:
        model = MaintenanceRequest
        fields = ('id', 'vehicle', 'work_description')
        read_only_fields = ('id',)

    def validate_work_description(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Describe the work that needs doing.')
        return value

    def validate_vehicle(self, vehicle):
        owner = self.context['owner']
        if vehicle.rental_id != owner.id:
            raise serializers.ValidationError('You can only request maintenance for your own vehicles.')
        open_states = [
            MaintenanceRequest.STATUS_PENDING,
            MaintenanceRequest.STATUS_QUOTED,
            MaintenanceRequest.STATUS_INFO_REQUESTED,
            MaintenanceRequest.STATUS_RUNNING,
            MaintenanceRequest.STATUS_ACCEPTED,
            MaintenanceRequest.STATUS_PENDING_RETURN,
        ]
        if vehicle.maintenance_requests.filter(status__in=open_states).exists():
            raise serializers.ValidationError('This vehicle already has an open maintenance request.')
        return vehicle

    def create(self, validated_data):
        owner = self.context['owner']
        vehicle = validated_data['vehicle']
        return MaintenanceRequest.objects.create(rental=owner, **validated_data)


class SiteBrandingSerializer(serializers.ModelSerializer):
    """The single global branding record (theme mode, colours, logo). Read by any
    user; only admins reach the write path (enforced in the view)."""

    class Meta:
        model = SiteBranding
        fields = ['mode', 'primary_color', 'secondary_color', 'logo_url', 'updated_at']
        read_only_fields = ['updated_at']

    def _validate_hex(self, value):
        if value and not HEX_COLOR_RE.match(value):
            raise serializers.ValidationError('Enter a valid hex colour, e.g. #6366f1.')
        return value

    def validate_primary_color(self, value):
        return self._validate_hex(value)

    def validate_secondary_color(self, value):
        return self._validate_hex(value)
