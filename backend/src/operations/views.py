"""
Admin-only read endpoints backing the Drivers / Rentals / Mechanics lists.

Each lists the active users of a role, joined with their profile. CRUD
(suspend/activate, edit) can be layered on in a later phase.
"""

import logging
from datetime import timedelta

from rest_framework import viewsets, mixins, status as drf_status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from contextlib import contextmanager

from django.utils import timezone
from django.db import connection, transaction, router
from django.db.models import Count, Q
from django.db.models.deletion import Collector
from django.db.models.functions import TruncMonth

from authentication.models import User, RegistrationRequest, Notification
from authentication.views import IsAdmin
from authentication.services import (
    notify_admins_of_staff_created, notify_admins, notify_user,
    notify_admins_of_action, actor_label,
)
from .models import (
    Vehicle, RentalRequest, MaintenanceRequest, VehicleReminderLog, ActivityLog,
    DeletionAudit, SiteBranding,
)
from .serializers import (
    DriverSerializer,
    RentalSerializer,
    MechanicSerializer,
    VehicleSerializer,
    AdminVehicleSerializer,
    RentalStaffCreateSerializer,
    AdminRentalStaffSerializer,
    RentalRequestSerializer,
    RentalRequestCreateSerializer,
    BrowseRentalSerializer,
    MaintenanceRequestSerializer,
    MaintenanceRequestCreateSerializer,
    ActivityLogSerializer,
    SiteBrandingSerializer,
    rental_display_name,
)
from rest_framework.permissions import AllowAny


def owning_rental(user):
    """The rental owner a user acts for: themselves if an owner, else their parent."""
    if getattr(user, 'role', None) != 'rental':
        return None
    return user.rental_parent if user.allowed_nav_paths else user


def is_rental_staff(user):
    """True when the user is a rental STAFF member (role rental + nav paths)."""
    return getattr(user, 'role', None) == 'rental' and bool(getattr(user, 'allowed_nav_paths', None))


def staff_lacks_section(user, nav_path):
    """True when ``user`` is rental STAFF and ``nav_path`` isn't in their grants.

    Used to deny an ungranted staff member access to a section's API directly
    (not just hide it in the sidebar). Rental owners and every other role never
    'lack' a section here — their own role permission / queryset scope governs.
    """
    return is_rental_staff(user) and nav_path not in (getattr(user, 'allowed_nav_paths', None) or [])


# Short, admin-facing titles per action code. Falls back to a humanised form of
# the code (e.g. 'vehicle.created' -> 'Vehicle Created') when not listed.
_ADMIN_ACTION_TITLES = {
    'vehicle.created': 'Vehicle added',
    'vehicle.updated': 'Vehicle updated',
    'vehicle.deleted': 'Vehicle removed',
    'staff.created': 'Rental staff added',
    'staff.updated': 'Rental staff updated',
    'staff.deleted': 'Rental staff removed',
}


def record_action(actor, owner, action, summary, link='', notify_title=None,
                  entity_type='', entity_id='', notify_admin=False):
    """Persist a durable activity-log entry attributing ``summary`` to ``actor``
    within the ``owner`` rental's scope, and — when a STAFF member (not the owner)
    performed it — also send the owner a notification so they're alerted live.

    ``action`` is a machine code (e.g. 'request.approved'); ``summary`` is the
    human phrase ("approved Jane's booking for …"). Logs every owner/staff action
    so the owner has a complete history; the notification fires for staff only.
    No-op for admins or when there is no owning rental.

    ``entity_type``/``entity_id`` let the owner's (and, when ``notify_admin`` is
    set, the admins') notification deep-link to the affected record. Set
    ``notify_admin=True`` only where there isn't already a curated
    ``notify_admins(...)`` call for this action, to avoid double-notifying admins.
    """
    if owner is None or actor is None:
        return
    actor_name = actor.get_full_name() or actor.email
    by_staff = actor.id != owner.id
    ActivityLog.objects.create(
        rental=owner,
        actor=actor,
        actor_name=actor_name,
        by_staff=by_staff,
        action=action,
        summary=summary,
        link=link,
    )
    if by_staff and notify_title:
        notify_user(
            owner,
            title=notify_title,
            message=f'{actor_name}: {summary}',
            notification_type='staff_action',
            link=link,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action.split('.')[-1] if '.' in action else action,
        )
    # Surface the change to the admin panel (with a navigable entity reference)
    # when asked. The actor is excluded so they aren't pinged about their own work.
    if notify_admin and getattr(actor, 'role', None) != 'admin':
        title = _ADMIN_ACTION_TITLES.get(action, action.replace('.', ' ').replace('_', ' ').title())
        notify_admins_of_action(
            actor=actor,
            action=action.split('.')[-1] if '.' in action else action,
            entity_type=entity_type,
            entity_id=entity_id,
            title=title,
            message=f'{actor_label(actor)} {summary}',
        )


logger = logging.getLogger(__name__)

# Curated, JSON-safe field snapshots per model — enough to investigate or
# reconstruct a deleted record without dumping large/binary columns
# (id_documents, base64 images, etc.). Falls back to a generic snapshot.
_SNAPSHOT_FIELDS = {
    'User': ('id', 'email', 'first_name', 'last_name', 'role', 'phone_number',
             'is_active', 'is_suspended', 'date_joined'),
    'Vehicle': ('id', 'make', 'model', 'rego', 'status', 'rent_price_per_day', 'rental_id'),
    'RentalRequest': ('id', 'driver_id', 'vehicle_id', 'rental_id', 'status',
                      'return_state', 'start_date', 'end_date', 'created_at'),
    'MaintenanceRequest': ('id', 'vehicle_id', 'rental_id', 'mechanic_id', 'status',
                           'created_at'),
}


def _snapshot_instance(instance):
    """A small JSON-safe dict of an instance's key fields for the deletion audit."""
    names = _SNAPSHOT_FIELDS.get(type(instance).__name__)
    if names is None:
        # Generic fallback: every local concrete field, stringified & truncated.
        names = [f.name for f in instance._meta.concrete_fields]
    snap = {}
    for name in names:
        try:
            value = getattr(instance, name)
        except Exception:
            continue
        if value is None or isinstance(value, (int, float, bool)):
            snap[name] = value
        else:
            snap[name] = str(value)[:500]
    return snap


def record_deletion(actor, instance, target_type):
    """Write a durable :class:`DeletionAudit` BEFORE ``instance`` is deleted,
    capturing a snapshot of the row and a per-model count of everything the
    cascade will remove. Best-effort: never blocks or breaks the delete itself.

    ``actor`` is the user performing the delete (may be None for system deletes);
    ``target_type`` is the frontend entity type ('rental','vehicle','driver',…).
    Returns the created DeletionAudit, or None if auditing failed."""
    try:
        # Enumerate the full cascade WITHOUT deleting, using Django's own planner
        # so the counts exactly match what .delete() would remove.
        counts = {}
        try:
            collector = Collector(using=router.db_for_write(type(instance)))
            collector.collect([instance])
            for model, objs in collector.data.items():
                if objs:
                    counts[model._meta.label] = counts.get(model._meta.label, 0) + len(objs)
            for qs in collector.fast_deletes:
                if qs.model._meta.label:  # fast-deleted relations (no signals)
                    counts[qs.model._meta.label] = counts.get(qs.model._meta.label, 0) + qs.count()
        except Exception:  # pragma: no cover - planner is best-effort
            logger.exception('record_deletion: cascade planning failed for %r', instance)

        label = AdminWriteNotifyMixin._entity_label(instance) if hasattr(instance, '_meta') else str(instance)
        audit = DeletionAudit.objects.create(
            actor=actor if getattr(actor, 'pk', None) else None,
            actor_name=(actor.get_full_name() or actor.email) if getattr(actor, 'pk', None) else 'system',
            target_type=target_type,
            target_id=str(instance.pk),
            target_label=str(label)[:255],
            snapshot=_snapshot_instance(instance),
            cascade_counts=counts,
            cascade_total=sum(counts.values()),
        )
        logger.warning(
            'DELETION %s "%s" (id=%s) by %s — cascade removes %s row(s): %s',
            target_type, label, instance.pk, audit.actor_name, audit.cascade_total, counts,
        )
        return audit
    except Exception:  # pragma: no cover - auditing must never block a delete
        logger.exception('record_deletion: failed to audit deletion of %r', instance)
        return None


class AdminWriteNotifyMixin:
    """Mixin for admin ModelViewSets: when one admin creates/updates/deletes a
    record, notify every OTHER admin so the admin panel stays synchronised and
    the change is navigable. The acting admin is excluded (no self-pings).

    Set ``notify_entity_type`` to one of the frontend entity types
    ('driver','rental','mechanic','vehicle','rental_staff')."""

    notify_entity_type = ''

    @staticmethod
    def _entity_label(obj):
        if hasattr(obj, 'make'):  # Vehicle
            return f'{obj.make} {obj.model} ({obj.rego})'
        # User-like (driver/rental/mechanic/staff)
        name = getattr(obj, 'get_full_name', lambda: '')() or getattr(obj, 'email', '') or str(obj)
        return name

    def _notify_admin_write(self, label, action, entity_id=''):
        noun = self.notify_entity_type.replace('_', ' ')
        notify_admins_of_action(
            actor=self.request.user,
            action=action,
            entity_type=self.notify_entity_type,
            entity_id=entity_id,
            title=f'{noun.title()} {action}',
            message=f'{actor_label(self.request.user)} {action} {noun} {label}.',
        )

    def perform_create(self, serializer):
        obj = serializer.save()
        self._notify_admin_write(self._entity_label(obj), 'created', entity_id=obj.pk)

    def perform_update(self, serializer):
        old_status = getattr(serializer.instance, 'status', None)
        old_suspended = getattr(serializer.instance, 'is_suspended', None)
        obj = serializer.save()
        self._notify_admin_write(self._entity_label(obj), 'updated', entity_id=obj.pk)
        # Tell the affected user when an admin manually suspends or reactivates
        # their account — parity with the automatic GPS-suspension flow, which
        # already notifies the user directly. (Vehicles have no is_suspended, so
        # old_suspended is None there and this block is skipped.)
        new_suspended = getattr(obj, 'is_suspended', None)
        if old_suspended is not None and old_suspended != new_suspended:
            if new_suspended:
                reason = (getattr(obj, 'suspension_reason', '') or '').strip()
                notify_user(
                    obj,
                    title='Your account has been suspended',
                    message=('An administrator has suspended your account.'
                             + (f' Reason: {reason}' if reason else '')
                             + ' Please contact support if you believe this is a mistake.'),
                    notification_type='suspension',
                    link='/profile',
                )
            else:
                notify_user(
                    obj,
                    title='Your account has been reactivated',
                    message='An administrator has reactivated your account — welcome back!',
                    notification_type='rental_decision',
                    link='/profile',
                )
        # Admin manually freed a vehicle → drop any open maintenance request.
        if (self.notify_entity_type == 'vehicle'
                and old_status != Vehicle.STATUS_AVAILABLE
                and getattr(obj, 'status', None) == Vehicle.STATUS_AVAILABLE):
            close_open_maintenance_for_vehicle(
                obj, self.request.user, 'An admin set the vehicle back to available.'
            )

    def perform_destroy(self, instance):
        label = self._entity_label(instance)
        # Durable forensic record BEFORE the cascade wipes related rows, so an
        # accidental owner/vehicle delete can be investigated or reconstructed.
        record_deletion(self.request.user, instance, self.notify_entity_type)
        instance.delete()
        # No entity_id: the record is gone, so admins land on the list page.
        self._notify_admin_write(label, 'deleted')


class IsRental(BasePermission):
    """Allow only authenticated rental users (owners or staff)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'rental')


class IsRentalOwner(BasePermission):
    """Allow only rental OWNERS (role='rental' with no allowed_nav_paths). Staff,
    who have allowed_nav_paths set, cannot manage other staff."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and getattr(user, 'role', None) == 'rental'
            and not user.allowed_nav_paths
        )


class RentalSectionPermission(BasePermission):
    """Defense-in-depth for rental section endpoints.

    A rental OWNER always passes; a rental STAFF member passes only when this
    section's nav path is among their granted ``allowed_nav_paths`` — so a staff
    member can't pull data for a section they weren't granted by calling the API
    directly, not just by having it hidden in the sidebar. Non-rental users
    (driver / mechanic / admin) pass here; their own role permission and the
    per-role queryset scope already govern what they can see.
    """

    nav_path = ''

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if getattr(user, 'role', None) == 'rental' and user.allowed_nav_paths:
            return self.nav_path in (user.allowed_nav_paths or [])
        return True


class FleetSectionGranted(RentalSectionPermission):
    nav_path = '/fleet'


class RentalRequestsSectionGranted(RentalSectionPermission):
    nav_path = '/rental/requests'


class MaintenanceSectionGranted(RentalSectionPermission):
    nav_path = '/maintenance'


class DriverViewSet(AdminWriteNotifyMixin, viewsets.ModelViewSet):
    """Admin full CRUD over driver accounts."""

    serializer_class = DriverSerializer
    permission_classes = [IsAdmin]
    notify_entity_type = 'driver'

    def get_queryset(self):
        return (
            User.objects.filter(role='driver')
            .select_related('driver_profile', 'registration_request')
            .prefetch_related('registration_request__documents')
            .order_by('-date_joined')
        )

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Lift a (GPS) suspension: unlock the account and clear the strike count."""
        driver = self.get_object()
        driver.is_active = True
        driver.is_suspended = False
        driver.suspension_reason = ''
        driver.location_warning_count = 0
        driver.save(update_fields=['is_active', 'is_suspended', 'suspension_reason', 'location_warning_count'])
        driver_label = driver.get_full_name() or driver.email
        # Tell the driver their account is active again …
        notify_user(
            driver,
            title='Account reactivated',
            message='An admin lifted your suspension. You can sign in and drive again.',
            notification_type='system',
            link='/dashboard',
        )
        # … and surface the change to other admins (panel sync).
        notify_admins_of_action(
            actor=request.user,
            action='reactivated',
            entity_type='driver', entity_id=driver.id,
            title='Driver reactivated',
            message=f'{actor_label(request.user)} reactivated driver {driver_label}.',
        )
        return Response(self.get_serializer(driver).data)


class RentalViewSet(AdminWriteNotifyMixin, viewsets.ModelViewSet):
    """Admin full CRUD over rental owner accounts."""

    serializer_class = RentalSerializer
    permission_classes = [IsAdmin]
    notify_entity_type = 'rental'

    def get_queryset(self):
        # Rental OWNERS only — staff are role='rental' WITH allowed_nav_paths set.
        return (
            User.objects.filter(role='rental', allowed_nav_paths__isnull=True)
            .select_related('rental_profile', 'registration_request')
            .prefetch_related('rental_staff', 'registration_request__documents')
            .order_by('-date_joined')
        )


class MechanicViewSet(AdminWriteNotifyMixin, viewsets.ModelViewSet):
    """Admin full CRUD over mechanic accounts."""

    serializer_class = MechanicSerializer
    permission_classes = [IsAdmin]
    notify_entity_type = 'mechanic'

    def get_queryset(self):
        return (
            User.objects.filter(role='mechanic')
            .select_related('mechanic_profile', 'registration_request')
            .prefetch_related('registration_request__documents')
            .order_by('-date_joined')
        )


def close_open_maintenance_for_vehicle(vehicle, actor, reason):
    """When a vehicle is manually put back to *available* (by its rental owner on
    the Fleet page, or by an admin on the Vehicles page), any maintenance request
    still open for it is removed so the vehicle drops off the maintenance page
    entirely. The assigned mechanic (if any) and admins are notified. Returns the
    number of requests removed. No-op when there's nothing open."""
    open_states = (
        MaintenanceRequest.STATUS_PENDING, MaintenanceRequest.STATUS_QUOTED,
        MaintenanceRequest.STATUS_RUNNING, MaintenanceRequest.STATUS_ACCEPTED,
        MaintenanceRequest.STATUS_INFO_REQUESTED, MaintenanceRequest.STATUS_PENDING_RETURN,
    )
    open_reqs = list(
        vehicle.maintenance_requests.filter(status__in=open_states).select_related('mechanic')
    )
    if not open_reqs:
        return 0
    label = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
    # Notify any assigned mechanic BEFORE the request row is deleted.
    for mr in open_reqs:
        if mr.mechanic_id:
            notify_user(
                mr.mechanic,
                title='Maintenance job closed',
                message=(
                    f'The maintenance request for {label} was closed because the '
                    f'vehicle was set back to available.'
                ),
                notification_type='maintenance_declined',
                link='/maintenance-requests',
                entity_type='vehicle', entity_id=vehicle.id, action='cancelled',
            )
    removed = vehicle.maintenance_requests.filter(status__in=open_states).delete()[0]
    notify_admins(
        title='Maintenance request closed',
        message=(
            f'{actor_label(actor)} set {label} back to available — '
            f'{len(open_reqs)} open maintenance request(s) were removed. {reason}'
        ),
        notification_type='maintenance_declined',
        entity_type='vehicle', entity_id=vehicle.id, action='cancelled',
        actor_name=actor_label(actor),
    )
    return removed


class AdminVehicleViewSet(AdminWriteNotifyMixin, viewsets.ModelViewSet):
    """Admin full CRUD over all vehicles across every rental, with the owning
    rental's name. The admin chooses the owning rental on create/edit."""

    serializer_class = AdminVehicleSerializer
    permission_classes = [IsAdmin]
    notify_entity_type = 'vehicle'

    def get_queryset(self):
        return Vehicle.objects.select_related('rental', 'rental__rental_profile').all()


class FleetViewSet(viewsets.ModelViewSet):
    """A rental owner's own vehicles (the Fleet page) — full CRUD, scoped to the
    logged-in rental so one rental can never see or edit another's vehicles."""

    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, IsRental, FleetSectionGranted]

    def get_queryset(self):
        # Scope to the rental OWNER, so a staff member acting for the owner sees
        # and edits the owner's fleet — not an (empty) fleet of their own.
        owner = owning_rental(self.request.user)
        if owner is None:
            return Vehicle.objects.none()
        return Vehicle.objects.filter(rental=owner).order_by('-created_at')

    def perform_create(self, serializer):
        owner = owning_rental(self.request.user)
        vehicle = serializer.save(rental=owner)
        label = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        record_action(
            self.request.user, owner, 'vehicle.created',
            f'added vehicle {label}.',
            link='/fleet', notify_title='Vehicle added by staff',
            entity_type='vehicle', entity_id=vehicle.id, notify_admin=True,
        )

    def perform_update(self, serializer):
        owner = owning_rental(self.request.user)
        old_status = serializer.instance.status
        vehicle = serializer.save()
        label = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        record_action(
            self.request.user, owner, 'vehicle.updated',
            f'updated vehicle {label}.',
            link='/fleet', notify_title='Vehicle updated by staff',
            entity_type='vehicle', entity_id=vehicle.id, notify_admin=True,
        )
        # Rental manually freed a vehicle (rented/maintenance → available) →
        # auto-cancel any open maintenance request so it leaves the maintenance page.
        if old_status != Vehicle.STATUS_AVAILABLE and vehicle.status == Vehicle.STATUS_AVAILABLE:
            close_open_maintenance_for_vehicle(
                vehicle, self.request.user, 'The rental set the vehicle back to available.'
            )

    def perform_destroy(self, instance):
        owner = owning_rental(self.request.user)
        label = f'{instance.make} {instance.model} ({instance.rego})'
        # Forensic snapshot + cascade counts before the vehicle (and its bookings,
        # maintenance, locations, …) are removed.
        record_deletion(self.request.user, instance, 'vehicle')
        instance.delete()
        # No entity_id: the vehicle is gone, so admins land on the vehicles list.
        record_action(
            self.request.user, owner, 'vehicle.deleted',
            f'removed vehicle {label}.',
            link='/fleet', notify_title='Vehicle removed by staff',
            entity_type='vehicle', notify_admin=True,
        )


class RentalStaffViewSet(viewsets.GenericViewSet):
    """A rental owner manages their staff.

    Creating a staff member creates the account immediately (no admin approval):
    the owner sets the login password, so the staff member can sign in straight
    away. Admins are notified of each new staff member. The owner can edit a
    member's allowed pages / name / phone and remove a member.

    Item ids are prefixed ('u<id>') for forward compatibility with the frontend.
    """

    permission_classes = [IsAuthenticated, IsRentalOwner]

    # --- serialization helpers -------------------------------------------------
    @staticmethod
    def _user_item(u):
        return {
            'id': f'u{u.id}',
            'kind': 'staff',
            'user_id': u.id,
            'request_id': None,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'email': u.email,
            'phone_number': u.phone_number,
            'allowed_nav_paths': u.allowed_nav_paths or [],
            'status': 'inactive' if u.is_restricted else 'active',
        }

    def _resolve(self, pk):
        """Return the staff User for a prefixed id, scoped to this owner, or None."""
        owner = self.request.user
        if not pk or len(pk) < 2 or pk[0] != 'u':
            return None
        raw_id = pk[1:]
        if not raw_id.isdigit():
            return None
        return User.objects.filter(id=raw_id, role='rental', rental_parent=owner).first()

    # --- actions ---------------------------------------------------------------
    def list(self, request):
        owner = request.user
        staff_users = User.objects.filter(role='rental', rental_parent=owner).order_by('-date_joined')
        return Response([self._user_item(u) for u in staff_users])

    def create(self, request):
        serializer = RentalStaffCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        staff_user = serializer.save()
        notify_admins_of_staff_created(staff_user, request.user)
        record_action(
            request.user, request.user, 'staff.created',
            f'added staff member {staff_user.get_full_name() or staff_user.email}.',
            link='/rental/staff',
        )
        return Response(self._user_item(staff_user), status=drf_status.HTTP_201_CREATED)

    def _apply_edit(self, obj):
        data = self.request.data
        paths = data.get('allowed_nav_paths')
        if paths is not None:
            # A staff member is distinguished from an owner by having a NON-EMPTY
            # allowed_nav_paths; an empty list would silently promote them to
            # owner (owning_rental / IsRentalOwner treat falsy nav paths as an
            # owner). Reject it so staff can't be escalated via an edit.
            if not isinstance(paths, list) or not paths:
                raise ValidationError(
                    {'allowed_nav_paths': 'Select at least one section for this staff member.'}
                )
            obj.allowed_nav_paths = paths
        if data.get('first_name') is not None:
            obj.first_name = data['first_name']
        if data.get('last_name') is not None:
            obj.last_name = data['last_name']
        if data.get('phone_number') is not None:
            obj.phone_number = data['phone_number']
        obj.save()

    def partial_update(self, request, pk=None):
        obj = self._resolve(pk)
        if not obj:
            return Response({'detail': 'Staff member not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        self._apply_edit(obj)
        record_action(
            request.user, request.user, 'staff.updated',
            f'updated staff member {obj.get_full_name() or obj.email}.',
            link='/rental/staff',
            entity_type='rental_staff', entity_id=obj.id, notify_admin=True,
        )
        return Response(self._user_item(obj))

    def update(self, request, pk=None):
        return self.partial_update(request, pk)

    def destroy(self, request, pk=None):
        obj = self._resolve(pk)
        if not obj:
            return Response({'detail': 'Staff member not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        staff_label = obj.get_full_name() or obj.email
        obj.delete()
        # No entity_id: the staff member is gone, so admins land on the staff list.
        record_action(
            request.user, request.user, 'staff.deleted',
            f'removed staff member {staff_label}.',
            link='/rental/staff',
            entity_type='rental_staff', notify_admin=True,
        )
        return Response(status=drf_status.HTTP_204_NO_CONTENT)


class AdminRentalStaffViewSet(AdminWriteNotifyMixin, viewsets.ModelViewSet):
    """Admin full CRUD over every rental's staff, grouped by the owning rental."""

    serializer_class = AdminRentalStaffSerializer
    permission_classes = [IsAdmin]
    notify_entity_type = 'rental_staff'

    def get_queryset(self):
        return (
            User.objects.filter(role='rental', allowed_nav_paths__isnull=False)
            .select_related('rental_parent', 'rental_parent__rental_profile', 'registration_request')
            .prefetch_related('registration_request__documents')
            .order_by('-date_joined')
        )


class RentalRequestViewSet(viewsets.ModelViewSet):
    """Booking requests, scoped by role:
      - driver: sees and creates their own requests
      - rental (owner/staff): sees requests for their fleet; can approve/reject
      - admin: sees all (read)
    """

    permission_classes = [IsAuthenticated, RentalRequestsSectionGranted]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']  # PUT via actions; DELETE = remove a request

    def get_serializer_class(self):
        return RentalRequestCreateSerializer if self.action == 'create' else RentalRequestSerializer

    def destroy(self, request, *args, **kwargs):
        """Permanently remove a booking request. The owning rental (owner or
        staff) or an admin may delete; the requesting driver may delete their
        own. An approved/active booking can't be deleted from under the driver."""
        booking = self.get_object()
        user = request.user
        is_admin = getattr(user, 'role', None) == 'admin' or user.is_superuser
        owner = owning_rental(user)
        is_owning_rental = owner is not None and booking.rental_id == owner.id
        is_requesting_driver = booking.driver_id == user.id
        if not (is_admin or is_owning_rental or is_requesting_driver):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if not is_admin and booking.status == RentalRequest.STATUS_RUNNING:
            # The driver may delete a running booking only once the rental
            # period has ended (trip complete); nobody can delete an active one.
            ended = bool(booking.end_date and booking.end_date < timezone.localdate())
            if not (is_requesting_driver and ended):
                return Response(
                    {'detail': 'An active running booking can\'t be deleted until the rental period ends.'},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
        # If this booking was still holding the vehicle (an active or just-ended
        # trip), release it back to the pool first — otherwise deleting the
        # booking would strand the vehicle in 'rented'/'pending_return' with no
        # booking left to confirm a return against.
        vehicle = booking.vehicle
        if (booking.status == RentalRequest.STATUS_RUNNING
                and vehicle.status in (Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN)):
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])
        record_deletion(user, booking, 'booking')
        booking.delete()
        return Response(status=drf_status.HTTP_204_NO_CONTENT)

    def get_queryset(self):
        user = self.request.user
        base = RentalRequest.objects.select_related('vehicle', 'driver', 'rental', 'rental__rental_profile')
        role = getattr(user, 'role', None)
        if role == 'admin' or user.is_superuser:
            return base.all()
        if role == 'driver':
            return base.filter(driver=user)
        if role == 'rental':
            owner = owning_rental(user)
            return base.filter(rental=owner) if owner else base.none()
        return base.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'driver':
            return Response({'detail': 'Only drivers can create booking requests.'},
                            status=drf_status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        booking = serializer.save()
        vehicle = booking.vehicle
        vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        driver_name = booking.driver.get_full_name() or booking.driver.email
        # Tell the owning rental a new request needs a decision …
        notify_user(
            vehicle.rental,
            title='New booking request',
            message=f'{driver_name} requested to rent {vlabel}.',
            notification_type='rental_decision',
            link='/rental/requests',
            entity_type='booking', entity_id=booking.id, action='booking_requested',
            actor_name=actor_label(self.request.user),
        )
        # … and surface it to the admin panel (navigates to the vehicle).
        notify_admins_of_action(
            actor=self.request.user,
            action='booking_requested',
            entity_type='vehicle', entity_id=vehicle.id,
            title='New booking request',
            message=(f'{actor_label(self.request.user)} requested to rent {vlabel} '
                     f'from {rental_display_name(vehicle.rental)}.'),
            notification_type='rental_decision',
        )

    def _decide(self, request, new_status):
        booking = self.get_object()
        # Only the owning rental (or admin) may decide.
        owner = owning_rental(request.user)
        is_admin = getattr(request.user, 'role', None) == 'admin' or request.user.is_superuser
        if not is_admin and booking.rental_id != getattr(owner, 'id', None):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.status not in (RentalRequest.STATUS_PENDING, RentalRequest.STATUS_INFO_REQUESTED):
            return Response({'detail': f'Request is already {booking.get_status_display().lower()}.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        booking.status = new_status
        booking.decision_reason = (request.data.get('reason') or '').strip()
        booking.reviewed_at = timezone.now()
        booking.save(update_fields=['status', 'decision_reason', 'reviewed_at', 'updated_at'])

        # Tell the driver their booking was approved / rejected.
        vehicle_label = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        if new_status == RentalRequest.STATUS_RUNNING:
            notify_user(
                booking.driver,
                title='Booking approved',
                message=f'Your request for {vehicle_label} was approved. Enjoy the trip!',
                notification_type='rental_decision',
                link='/my-requests',
                entity_type='booking', entity_id=booking.id, action='approved',
            )
        elif new_status == RentalRequest.STATUS_REJECTED:
            reason = booking.decision_reason
            notify_user(
                booking.driver,
                title='Booking rejected',
                message=f'Your request for {vehicle_label} was rejected.'
                        + (f' Reason: {reason}' if reason else ''),
                notification_type='rental_decision',
                link='/my-requests',
                entity_type='booking', entity_id=booking.id, action='rejected',
            )

        if new_status == RentalRequest.STATUS_RUNNING:
            # The vehicle is now taken: flag it 'rented' everywhere and
            # auto-reject every other still-pending request for it.
            vehicle = booking.vehicle
            if vehicle.status != Vehicle.STATUS_RENTED:
                vehicle.status = Vehicle.STATUS_RENTED
                vehicle.save(update_fields=['status', 'updated_at'])
            # Iterate (not bulk .update()) so each losing driver is notified
            # individually — previously the rejection was silent (reason only).
            losing = list(
                RentalRequest.objects
                .filter(vehicle_id=vehicle.id, status=RentalRequest.STATUS_PENDING)
                .exclude(pk=booking.pk)
                .select_related('driver')
            )
            auto_reason = 'Vehicle is no longer available (rented out).'
            now = timezone.now()
            for other in losing:
                other.status = RentalRequest.STATUS_REJECTED
                other.decision_reason = auto_reason
                other.reviewed_at = now
                other.save(update_fields=['status', 'decision_reason', 'reviewed_at', 'updated_at'])
                notify_user(
                    other.driver,
                    title='Booking declined — vehicle taken',
                    message=(f'Your request for {vehicle_label} was automatically declined because '
                             'it was just rented to another driver. Browse other available vehicles.'),
                    notification_type='rental_decision',
                    link='/my-requests',
                    entity_type='booking', entity_id=other.id, action='rejected',
                )
            # Tell admins a vehicle has gone out on rent.
            notify_admins(
                title='Vehicle rented',
                message=(
                    f'{rental_display_name(vehicle.rental)} approved '
                    f'{booking.driver.get_full_name()} to rent '
                    f'{vehicle.make} {vehicle.model} ({vehicle.rego}).'
                ),
                notification_type='vehicle_rented',
                entity_type='vehicle', entity_id=vehicle.id, action='approved',
                actor_name=actor_label(request.user),
            )
        # If a staff member made this decision, tell the rental owner. Admins are
        # already told about approvals ('Vehicle rented' above); for rejections,
        # notify_admin surfaces the decision to the admin panel too.
        decision_word = 'approved' if new_status == RentalRequest.STATUS_RUNNING else 'rejected'
        record_action(
            request.user, owner, f'request.{decision_word}',
            f'{decision_word} {booking.driver.get_full_name()}\'s booking for {vehicle_label}.',
            link='/rental/requests', notify_title=f'Booking {decision_word} by staff',
            entity_type='booking', entity_id=booking.id,
            notify_admin=(new_status == RentalRequest.STATUS_REJECTED),
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        # Approving puts the booking straight into the active 'running' state
        # (the vehicle goes out with the driver); it auto-completes when the
        # rental period ends. There is no lingering 'approved' state.
        return self._decide(request, RentalRequest.STATUS_RUNNING)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._decide(request, RentalRequest.STATUS_REJECTED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """The owning driver (or admin) cancels a request. Allowed in any
        status; the row is kept (status set to 'cancelled') for history."""
        booking = self.get_object()
        is_admin = getattr(request.user, 'role', None) == 'admin' or request.user.is_superuser
        if not is_admin and booking.driver_id != request.user.id:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.status != RentalRequest.STATUS_CANCELLED:
            booking.status = RentalRequest.STATUS_CANCELLED
            booking.save(update_fields=['status', 'updated_at'])
            vehicle = booking.vehicle
            vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
            driver_name = booking.driver.get_full_name() or booking.driver.email
            # Tell the owning rental the request was withdrawn …
            notify_user(
                vehicle.rental,
                title='Booking request cancelled',
                message=f'{driver_name} cancelled their request for {vlabel}.',
                notification_type='rental_decision',
                link='/rental/requests',
                entity_type='booking', entity_id=booking.id, action='cancelled',
                actor_name=actor_label(request.user),
            )
            # … and surface it to the admin panel.
            notify_admins_of_action(
                actor=request.user,
                action='cancelled',
                entity_type='vehicle', entity_id=vehicle.id,
                title='Booking request cancelled',
                message=(f'{actor_label(request.user)} cancelled their request for '
                         f'{vlabel} from {rental_display_name(vehicle.rental)}.'),
                notification_type='rental_decision',
            )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    def _booking_party(self, request, booking):
        """How ``request.user`` relates to ``booking``: 'admin', 'rental' (the
        owning rental owner/staff), 'driver' (the booking's driver), or None."""
        user = request.user
        if getattr(user, 'role', None) == 'admin' or user.is_superuser:
            return 'admin'
        owner = owning_rental(user)
        if owner is not None and booking.rental_id == owner.id:
            return 'rental'
        if booking.driver_id == user.id:
            return 'driver'
        return None

    @staticmethod
    def _home_link(booking, user):
        """The list page a given user manages this booking from."""
        return '/my-requests' if user.id == booking.driver_id else '/rental/requests'

    @action(detail=True, methods=['post'], url_path='request-return')
    def request_return(self, request, pk=None):
        """Either party (rental owner/staff or the driver) asks to end an active
        rental early, before its end date. Records who initiated and notifies the
        OTHER party to confirm or decline; the booking stays RUNNING meanwhile."""
        booking = self.get_object()
        party = self._booking_party(request, booking)
        if party is None:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.status != RentalRequest.STATUS_RUNNING or booking.return_state != RentalRequest.RETURN_NONE:
            return Response({'detail': 'A return can only be requested on an active rental with no return already in progress.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if booking.end_date and booking.end_date < timezone.localdate():
            return Response({'detail': 'The rental period has ended — the driver should use Complete Trip instead.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # Admins acting on behalf are treated as the rental side.
        from_rental = party in ('rental', 'admin')
        booking.return_state = (RentalRequest.RETURN_REQUESTED_BY_RENTAL if from_rental
                                else RentalRequest.RETURN_REQUESTED_BY_DRIVER)
        booking.return_requested_at = timezone.now()
        booking.save(update_fields=['return_state', 'return_requested_at', 'updated_at'])
        vlabel = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        driver_name = booking.driver.get_full_name() or booking.driver.email
        if from_rental:
            notify_user(
                booking.driver,
                title='Early return requested',
                message=(f'{rental_display_name(booking.rental)} asked you to return {vlabel} early. '
                         'Open Incoming requests to confirm or decline.'),
                notification_type='rental_decision',
                link='/my-requests?tab=incoming',
            )
        else:
            notify_user(
                booking.rental,
                title='Early return requested',
                message=(f'{driver_name} asked to return {vlabel} early. '
                         'Open Incoming requests to confirm or decline.'),
                notification_type='rental_decision',
                link='/rental/requests?tab=incoming',
            )
        notify_admins(
            title='Early return requested',
            message=(f'{actor_label(request.user)} requested an early return of {vlabel} '
                     f'({rental_display_name(booking.rental)} / {driver_name}).'),
            notification_type='rental_decision',
            entity_type='vehicle', entity_id=booking.vehicle_id, action='return_requested',
            actor_name=actor_label(request.user),
            exclude=request.user if party == 'admin' else None,
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel-return')
    def cancel_return(self, request, pk=None):
        """Decline (recipient) or withdraw (initiator) an outstanding early-return
        request; the rental simply continues running. Either party or an admin
        may call this."""
        booking = self.get_object()
        party = self._booking_party(request, booking)
        if party is None:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.return_state not in (RentalRequest.RETURN_REQUESTED_BY_RENTAL,
                                        RentalRequest.RETURN_REQUESTED_BY_DRIVER):
            return Response({'detail': 'There is no early-return request to cancel.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        initiated_by_rental = booking.return_state == RentalRequest.RETURN_REQUESTED_BY_RENTAL
        booking.return_state = RentalRequest.RETURN_NONE
        booking.return_requested_at = None
        booking.save(update_fields=['return_state', 'return_requested_at', 'updated_at'])
        vlabel = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        initiator = booking.rental if initiated_by_rental else booking.driver
        recipient = booking.driver if initiated_by_rental else booking.rental
        if party == 'admin':
            # An admin cancelled on behalf of neither party — tell BOTH the
            # initiator and the recipient the request is off, so the party that
            # was waiting to act isn't left with a stale Incoming request.
            for target in (initiator, recipient):
                notify_user(
                    target,
                    title='Early return cancelled',
                    message=f'An admin cancelled the early return of {vlabel}. The rental continues as normal.',
                    notification_type='rental_decision',
                    link=self._home_link(booking, target),
                )
            return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)
        # One of the two parties acted; tell whoever did NOT act. If the initiator
        # withdrew, tell the recipient; if the recipient declined, tell the initiator.
        actor_is_initiator = (not initiated_by_rental) if party == 'driver' else initiated_by_rental
        target = recipient if actor_is_initiator else initiator
        verb = 'withdrawn' if actor_is_initiator else 'declined'
        notify_user(
            target,
            title=f'Early return {verb}',
            message=f'The early return of {vlabel} was {verb}. The rental continues as normal.',
            notification_type='rental_decision',
            link=self._home_link(booking, target),
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='complete-trip')
    def complete_trip(self, request, pk=None):
        """End-of-period flow: once the period has ended (return_state
        'period_ended'), the driver marks the trip complete and the rental is
        asked to confirm the physical return."""
        booking = self.get_object()
        party = self._booking_party(request, booking)
        if party not in ('driver', 'admin'):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.return_state != RentalRequest.RETURN_PERIOD_ENDED:
            return Response({'detail': 'This trip is not awaiting completion.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        booking.return_state = RentalRequest.RETURN_DRIVER_COMPLETED
        booking.save(update_fields=['return_state', 'updated_at'])
        vlabel = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        driver_name = booking.driver.get_full_name() or booking.driver.email
        notify_user(
            booking.rental,
            title='Driver completed the trip',
            message=(f'{driver_name} completed the trip for {vlabel}. '
                     'Confirm the return to make it available again.'),
            notification_type='rental_decision',
            link='/rental/requests',
            entity_type='booking', entity_id=booking.id, action='trip_completed',
        )
        notify_admins(
            title='Driver completed trip',
            message=f'{driver_name} completed the trip for {vlabel}; awaiting the owner\'s return confirmation.',
            notification_type='rental_decision',
            entity_type='vehicle', entity_id=booking.vehicle_id, action='trip_completed',
            actor_name=actor_label(request.user),
            exclude=request.user if party == 'admin' else None,
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='confirm-return')
    def confirm_return(self, request, pk=None):
        """Final return step — completes the booking and releases the vehicle to
        'available'. Who may confirm depends on the return handshake state:
          - requested_by_rental → the DRIVER confirms (accepts the owner's request)
          - requested_by_driver → the RENTAL confirms (accepts the driver's request)
          - driver_completed     → the RENTAL confirms the end-of-period return
          - none (legacy)        → the RENTAL confirms a still-out, just-ended booking
        Idempotent vehicle release; both parties and admins are notified."""
        booking = self.get_object()
        party = self._booking_party(request, booking)
        if party is None:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        state = booking.return_state
        if state == RentalRequest.RETURN_REQUESTED_BY_RENTAL:
            allowed = party in ('driver', 'admin')
        elif state in (RentalRequest.RETURN_REQUESTED_BY_DRIVER,
                       RentalRequest.RETURN_DRIVER_COMPLETED):
            allowed = party in ('rental', 'admin')
        elif state == RentalRequest.RETURN_NONE:
            # Legacy path — only for a booking whose period has ended (or whose
            # vehicle the cron already flipped to pending_return). An admin may
            # always force it; a rental owner may NOT complete a still-in-period
            # trip this way (they must use the early-return handshake instead),
            # which would otherwise end the driver's rental out from under them.
            period_ended = bool(booking.end_date and booking.end_date < timezone.localdate())
            allowed = party == 'admin' or (
                party == 'rental'
                and (period_ended or booking.vehicle.status == Vehicle.STATUS_PENDING_RETURN)
            )
        else:
            allowed = False
        if not allowed:
            return Response({'detail': 'You can\'t confirm this return in its current state.'},
                            status=drf_status.HTTP_403_FORBIDDEN)
        vehicle = booking.vehicle
        if booking.status not in (RentalRequest.STATUS_RUNNING, RentalRequest.STATUS_COMPLETED):
            return Response({'detail': 'Only an active or just-ended booking can be returned.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # For an explicit handshake (a driver/rental early-return that the other
        # party is now confirming, or an end-of-period driver_completed), both
        # sides have agreed to end the rental, so we complete it regardless of the
        # vehicle's current status — the release below is idempotent. Only the
        # legacy no-handshake path additionally requires the car to still be out,
        # since that path *infers* "the car is out and just needs returning".
        if state == RentalRequest.RETURN_NONE and vehicle.status not in (
            Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN,
        ):
            return Response({'detail': 'Only an active or just-ended booking with the vehicle still out can be returned.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if booking.status == RentalRequest.STATUS_RUNNING:
            booking.status = RentalRequest.STATUS_COMPLETED
        booking.return_state = RentalRequest.RETURN_NONE
        booking.return_requested_at = None
        booking.save(update_fields=['status', 'return_state', 'return_requested_at', 'updated_at'])
        # Release the car unless it's in maintenance (don't override that).
        if vehicle.status in (Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN):
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])
        vehicle_label = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        driver_name = booking.driver.get_full_name() or booking.driver.email
        # Tell the driver (unless they're the one confirming).
        if party != 'driver':
            notify_user(
                booking.driver,
                title='Return confirmed',
                message=f'Your return of {vehicle_label} has been confirmed. Thanks for renting with us!',
                notification_type='rental_decision',
                link='/my-trips',
                entity_type='booking', entity_id=booking.id, action='return_confirmed',
            )
        # Tell the rental (unless they're the one confirming).
        if party != 'rental':
            notify_user(
                booking.rental,
                title='Vehicle returned',
                message=f'{driver_name} returned {vehicle_label}. It is available to rent again.',
                notification_type='rental_decision',
                link='/rental/requests',
                entity_type='booking', entity_id=booking.id, action='returned',
            )
        notify_admins(
            title='Vehicle returned',
            message=(f'{vehicle_label} ({rental_display_name(vehicle.rental)} / {driver_name}) '
                     'was returned and is available again.'),
            notification_type='vehicle_rented',
            entity_type='vehicle', entity_id=vehicle.id, action='returned',
            actor_name=actor_label(request.user),
            exclude=request.user if party == 'admin' else None,
        )
        record_action(
            request.user, owning_rental(request.user), 'request.return_confirmed',
            f'confirmed the return of {vehicle_label} by {driver_name}.',
            link='/rental/requests', notify_title='Return confirmed by staff',
            entity_type='booking', entity_id=booking.id,
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='request-info')
    def request_info(self, request, pk=None):
        """The owning rental (or admin) asks the driver for more information.
        Moves the request to 'info_requested' with a message for the driver."""
        booking = self.get_object()
        owner = owning_rental(request.user)
        is_admin = getattr(request.user, 'role', None) == 'admin' or request.user.is_superuser
        if not is_admin and booking.rental_id != getattr(owner, 'id', None):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.status not in (RentalRequest.STATUS_PENDING, RentalRequest.STATUS_INFO_REQUESTED):
            return Response({'detail': 'You can only request info on a pending request.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'message': 'Describe what extra information you need.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        booking.status = RentalRequest.STATUS_INFO_REQUESTED
        booking.info_request_message = message
        booking.save(update_fields=['status', 'info_request_message', 'updated_at'])
        vlabel = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        notify_user(
            booking.driver,
            title='More information requested',
            message=f'For your {vlabel} booking: {message}',
            notification_type='rental_decision',
            link='/my-requests',
            entity_type='booking', entity_id=booking.id, action='info_requested',
        )
        record_action(
            request.user, owner, 'request.info_requested',
            f'asked {booking.driver.get_full_name()} for more info on {vlabel}.',
            link='/rental/requests', notify_title='Requested more info by staff',
            entity_type='booking', entity_id=booking.id, notify_admin=True,
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='provide-info')
    def provide_info(self, request, pk=None):
        """The driver supplies the requested documents/details; the request
        returns to 'pending' for the rental to review again."""
        booking = self.get_object()
        if booking.driver_id != request.user.id:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if booking.status != RentalRequest.STATUS_INFO_REQUESTED:
            return Response({'detail': 'This request is not awaiting more information.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        new_docs = request.data.get('id_documents')
        if not isinstance(new_docs, list) or len(new_docs) == 0:
            return Response({'id_documents': 'Upload at least one document.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        booking.id_documents = (booking.id_documents or []) + new_docs
        details = request.data.get('verified_details')
        if isinstance(details, dict):
            booking.verified_details = details
        booking.status = RentalRequest.STATUS_PENDING
        booking.save(update_fields=['id_documents', 'verified_details', 'status', 'updated_at'])
        vlabel = f'{booking.vehicle.make} {booking.vehicle.model} ({booking.vehicle.rego})'
        notify_user(
            booking.rental,
            title='Driver provided more information',
            message=f'{booking.driver.get_full_name()} added documents for {vlabel}. Ready for review.',
            notification_type='rental_decision',
            link='/rental/requests',
            entity_type='booking', entity_id=booking.id, action='info_provided',
            actor_name=actor_label(request.user),
        )
        notify_admins_of_action(
            actor=request.user,
            action='info_provided',
            entity_type='vehicle', entity_id=booking.vehicle_id,
            title='Driver provided more information',
            message=f'{actor_label(request.user)} added documents for {vlabel}.',
            notification_type='rental_decision',
        )
        return Response(RentalRequestSerializer(booking).data, status=drf_status.HTTP_200_OK)


class IsMechanic(BasePermission):
    """Allow only authenticated mechanic users."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'mechanic')


class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    """Maintenance jobs, scoped by role:
      - rental (owner/staff): create for own vehicles; accept/decline/complete a quote
      - mechanic: sees the open pool + their own jobs; submits a quote (price + duration)
      - admin: sees all (read)
    Admins are notified at each step.
    """

    permission_classes = [IsAuthenticated, MaintenanceSectionGranted]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']  # decisions via actions

    def get_serializer_class(self):
        if self.action == 'create':
            return MaintenanceRequestCreateSerializer
        return MaintenanceRequestSerializer

    def get_queryset(self):
        user = self.request.user
        base = MaintenanceRequest.objects.select_related(
            'vehicle', 'rental', 'rental__rental_profile',
            'mechanic', 'mechanic__mechanic_profile',
        )
        role = getattr(user, 'role', None)
        if role == 'admin' or user.is_superuser:
            return base.all()
        if role == 'mechanic':
            # The open pool (anyone can quote) plus jobs this mechanic took.
            return base.filter(Q(status=MaintenanceRequest.STATUS_PENDING) | Q(mechanic=user))
        if role == 'rental':
            owner = owning_rental(user)
            return base.filter(rental=owner) if owner else base.none()
        return base.none()

    def create(self, request, *args, **kwargs):
        owner = owning_rental(request.user)
        if not owner:
            return Response({'detail': 'Only rental users can request maintenance.'},
                            status=drf_status.HTTP_403_FORBIDDEN)
        serializer = MaintenanceRequestCreateSerializer(
            data=request.data, context={'owner': owner, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        mr = serializer.save()
        vehicle = mr.vehicle
        # Flagging a vehicle puts it into maintenance straight away — it stays
        # there through the whole quote/repair workflow and is freed only when
        # the rental cancels the pending request, an admin/rental changes it
        # manually, or the completed-return flow runs. (Only available vehicles
        # can be flagged, so this is an available → maintenance transition.)
        if vehicle.status == Vehicle.STATUS_AVAILABLE:
            vehicle.status = Vehicle.STATUS_MAINTENANCE
            vehicle.save(update_fields=['status', 'updated_at'])
        notify_admins(
            title='Vehicle sent to maintenance',
            message=(
                f'{rental_display_name(owner)} flagged {vehicle.make} {vehicle.model} '
                f'({vehicle.rego}) for maintenance: {mr.work_description[:120]}'
            ),
            notification_type='maintenance_requested',
            entity_type='vehicle', entity_id=vehicle.id, action='flagged',
            actor_name=actor_label(request.user),
        )
        record_action(
            request.user, owner, 'maintenance.flagged',
            f'flagged {vehicle.make} {vehicle.model} ({vehicle.rego}) for maintenance.',
            link='/maintenance', notify_title='Vehicle flagged for maintenance by staff',
            entity_type='vehicle', entity_id=vehicle.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_201_CREATED)

    # Statuses in which a mechanic already has "skin in the game" for a vehicle —
    # an outstanding quote, an info request, or an in-progress repair. Used to stop
    # a mechanic double-quoting the same vehicle while one of theirs is still live.
    MECHANIC_ACTIVE_STATUSES = (
        MaintenanceRequest.STATUS_QUOTED,
        MaintenanceRequest.STATUS_INFO_REQUESTED,
        MaintenanceRequest.STATUS_RUNNING,
        MaintenanceRequest.STATUS_ACCEPTED,
        MaintenanceRequest.STATUS_PENDING_RETURN,
    )

    @action(detail=True, methods=['post'])
    def quote(self, request, pk=None):
        """A mechanic submits a price + estimated duration for an open vehicle.

        Multiple mechanics compete for the same vehicle. Rather than claim the
        rental's original 'pending' pool request, each quote is recorded as its
        OWN maintenance-request row (``mechanic`` set, status ``quoted``) while the
        pool row stays ``pending`` so other mechanics keep seeing the vehicle and
        can quote too. A mechanic may only have one *active* quote per vehicle at a
        time — they must wait for a decision (or withdraw) before quoting again."""
        if getattr(request.user, 'role', None) != 'mechanic':
            return Response({'detail': 'Only mechanics can submit a quote.'},
                            status=drf_status.HTTP_403_FORBIDDEN)
        pool = self.get_object()
        # Quotes are always sent against the open 'pending' pool row for a vehicle.
        if pool.status != MaintenanceRequest.STATUS_PENDING:
            return Response({'detail': 'This job is no longer open for quoting.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # One live quote per mechanic per vehicle (mirrors the driver's "no
        # duplicate active request for the same vehicle" rule).
        if MaintenanceRequest.objects.filter(
            vehicle=pool.vehicle, mechanic=request.user,
            status__in=self.MECHANIC_ACTIVE_STATUSES,
        ).exists():
            return Response(
                {'detail': 'You already have an active quote for this vehicle. '
                           'Wait for the rental to respond (or withdraw it) before quoting again.'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        # Validate price.
        try:
            price = float(request.data.get('quoted_price'))
            if price < 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'quoted_price': 'Enter a valid price.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # Validate duration value + unit.
        try:
            value = int(request.data.get('estimated_value'))
            if value <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'estimated_value': 'Enter how long it will take.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        unit = request.data.get('estimated_unit')
        if unit not in (MaintenanceRequest.DURATION_HOURS, MaintenanceRequest.DURATION_DAYS):
            return Response({'estimated_unit': 'Choose hours or days.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # Identity documents (uploaded + OCR-confirmed) are required to quote.
        docs = request.data.get('id_documents')
        if not isinstance(docs, list) or len(docs) == 0:
            return Response(
                {'id_documents': 'Upload at least one identity document (passport, licence or visa).'},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )

        details = request.data.get('verified_details')
        # Record this mechanic's quote as a NEW row; the pool row is left untouched
        # (still 'pending') so other mechanics can keep quoting the same vehicle.
        mr = MaintenanceRequest.objects.create(
            vehicle=pool.vehicle,
            rental=pool.rental,
            work_description=pool.work_description,
            mechanic=request.user,
            quoted_price=price,
            estimated_value=value,
            estimated_unit=unit,
            mechanic_notes=(request.data.get('mechanic_notes') or '').strip(),
            id_documents=docs,
            verified_details=details if isinstance(details, dict) else None,
            status=MaintenanceRequest.STATUS_QUOTED,
            quoted_at=timezone.now(),
        )
        v = mr.vehicle
        notify_admins(
            title='Mechanic submitted a quote',
            message=(
                f'{request.user.get_full_name()} quoted ${price:.2f} '
                f'({value} {unit}) for {v.make} {v.model} ({v.rego}).'
            ),
            notification_type='maintenance_quoted',
            entity_type='vehicle', entity_id=v.id, action='quoted',
            actor_name=actor_label(request.user),
        )
        # Tell the owning rental a quote arrived (bell + /notifications, like driver flow).
        notify_user(
            mr.rental,
            title='New maintenance quote',
            message=(
                f'{request.user.get_full_name()} quoted ${price:.2f} '
                f'({value} {unit}) for {v.make} {v.model} ({v.rego}). Review it in Maintenance.'
            ),
            notification_type='maintenance_quoted',
            link='/maintenance',
            entity_type='vehicle', entity_id=v.id, action='quoted',
            actor_name=actor_label(request.user),
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    def _is_owning_rental(self, request, mr):
        is_admin = getattr(request.user, 'role', None) == 'admin' or request.user.is_superuser
        owner = owning_rental(request.user)
        return is_admin or mr.rental_id == getattr(owner, 'id', None)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """The owning rental accepts the quote → vehicle moves to maintenance."""
        mr = self.get_object()
        if not self._is_owning_rental(request, mr):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status != MaintenanceRequest.STATUS_QUOTED:
            return Response({'detail': 'Only a quoted job can be accepted.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        # Accepting starts the repair: the job goes straight to 'running' and the
        # vehicle moves into maintenance. It surfaces under the mechanic's Vehicle
        # repair → Running section immediately.
        mr.status = MaintenanceRequest.STATUS_RUNNING
        mr.decided_at = timezone.now()
        mr.decision_reason = ''
        mr.save(update_fields=['status', 'decided_at', 'decision_reason', 'updated_at'])
        vehicle = mr.vehicle
        if vehicle.status != Vehicle.STATUS_MAINTENANCE:
            vehicle.status = Vehicle.STATUS_MAINTENANCE
            vehicle.save(update_fields=['status', 'updated_at'])
        vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        notify_admins(
            title='Maintenance quote accepted',
            message=(
                f'{rental_display_name(mr.rental)} accepted '
                f'{mr.mechanic.get_full_name() if mr.mechanic else "a mechanic"}\'s quote for '
                f'{vlabel}; it is now in maintenance.'
            ),
            notification_type='maintenance_accepted',
            entity_type='vehicle', entity_id=vehicle.id, action='accepted',
            actor_name=actor_label(request.user),
        )
        # Tell the mechanic their quote was accepted.
        notify_user(
            mr.mechanic,
            title='Quote accepted',
            message=f'{rental_display_name(mr.rental)} accepted your quote for {vlabel}. You can start the work.',
            notification_type='maintenance_accepted',
            link='/maintenance/requests',
            entity_type='maintenance', entity_id=mr.id, action='accepted',
        )
        # Accepting one mechanic closes the competition for this vehicle. Reject
        # EVERY other still-open row for the SAME vehicle — competing quotes AND
        # quotes currently awaiting more info both get rejected here (an
        # info-request in flight is superseded the moment another quote wins) —
        # and cancel the leftover 'pending' pool row so the vehicle drops out of
        # the open pool. Each affected mechanic is told their quote was rejected
        # because another mechanic's was accepted.
        siblings = (
            MaintenanceRequest.objects.filter(vehicle=mr.vehicle)
            .exclude(pk=mr.pk)
            .filter(status__in=[
                MaintenanceRequest.STATUS_PENDING,
                MaintenanceRequest.STATUS_QUOTED,
                MaintenanceRequest.STATUS_INFO_REQUESTED,
            ])
        )
        for sib in siblings:
            # The mechanic-less pool row is simply cancelled (nobody to notify);
            # a mechanic's competing/awaiting-info quote is declined + notified.
            if sib.mechanic_id:
                sib.status = MaintenanceRequest.STATUS_DECLINED
                sib.decision_reason = "Rejected because the rental accepted another mechanic's quote for this vehicle."
            else:
                sib.status = MaintenanceRequest.STATUS_CANCELLED
                sib.decision_reason = "Closed because a quote was accepted for this vehicle."
            sib.decided_at = timezone.now()
            sib.save(update_fields=['status', 'decision_reason', 'decided_at', 'updated_at'])
            if sib.mechanic_id:
                notify_user(
                    sib.mechanic,
                    title='Quote rejected',
                    message=(f'{rental_display_name(mr.rental)} accepted another mechanic\'s quote for '
                             f'{vlabel}, so your quote was rejected.'),
                    notification_type='maintenance_declined',
                    link='/maintenance/requests',
                    entity_type='maintenance', entity_id=sib.id, action='declined',
                )
        record_action(
            request.user, owning_rental(request.user), 'maintenance.accepted',
            f'accepted the quote for {vlabel}; it is now in maintenance.',
            link='/maintenance', notify_title='Maintenance quote accepted by staff',
            entity_type='vehicle', entity_id=vehicle.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """The owning rental rejects one mechanic's quote.

        Declining rejects only *this quote*, not the maintenance need. The
        rejected quote row becomes terminal (``declined``); the vehicle's original
        ``pending`` pool row is untouched, so it stays open for new quotes — the
        just-rejected mechanic and any other mechanic may submit a fresh quote. The
        vehicle's status is deliberately left as-is (rejecting a quote must never
        flip a vehicle back to ``available``)."""
        mr = self.get_object()
        if not self._is_owning_rental(request, mr):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status != MaintenanceRequest.STATUS_QUOTED:
            return Response({'detail': 'Only a quoted job can be declined.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        v = mr.vehicle
        vlabel = f'{v.make} {v.model} ({v.rego})'
        mechanic = mr.mechanic
        reason = (request.data.get('reason') or '').strip()
        # Mark just this quote rejected. The pool row (still 'pending') keeps the
        # vehicle open for new quotes, so we don't clear/reopen this row.
        mr.status = MaintenanceRequest.STATUS_DECLINED
        mr.decision_reason = reason
        mr.decided_at = timezone.now()
        mr.save(update_fields=['status', 'decision_reason', 'decided_at', 'updated_at'])
        # Safety net: if the vehicle somehow has no open pool row left (e.g. it was
        # cancelled), reopen this one so the vehicle stays quotable.
        if not MaintenanceRequest.objects.filter(
            vehicle=v, status=MaintenanceRequest.STATUS_PENDING,
        ).exists():
            MaintenanceRequest.objects.create(
                vehicle=v, rental=mr.rental, work_description=mr.work_description,
                status=MaintenanceRequest.STATUS_PENDING,
            )
        notify_admins(
            title='Maintenance quote declined',
            message=f'{rental_display_name(mr.rental)} declined a quote for {vlabel}. '
                    'The job is still open for new quotes.',
            notification_type='maintenance_declined',
            entity_type='vehicle', entity_id=v.id, action='declined',
            actor_name=actor_label(request.user),
        )
        # Tell the declined mechanic — and let them know they can quote again.
        if mechanic:
            notify_user(
                mechanic,
                title='Quote declined',
                message=f'{rental_display_name(mr.rental)} declined your quote for {vlabel}.'
                        + (f' Reason: {reason}.' if reason else '')
                        + ' The job is open again if you would like to send a new quote.',
                notification_type='maintenance_declined',
                link='/maintenance/requests',
                entity_type='maintenance', entity_id=mr.id, action='declined',
            )
        record_action(
            request.user, owning_rental(request.user), 'maintenance.declined',
            f'declined the quote for {vlabel}; the job is open for new quotes.',
            link='/maintenance', notify_title='Maintenance quote declined by staff',
            entity_type='vehicle', entity_id=v.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='request-info')
    def request_info(self, request, pk=None):
        """The owning rental (or admin) asks the mechanic for more information
        about their quote. Moves the job to 'info_requested'."""
        mr = self.get_object()
        if not self._is_owning_rental(request, mr):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status != MaintenanceRequest.STATUS_QUOTED:
            return Response({'detail': 'You can only request info on a quoted job.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'message': 'Describe what extra information you need.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        mr.status = MaintenanceRequest.STATUS_INFO_REQUESTED
        mr.info_request_message = message
        mr.save(update_fields=['status', 'info_request_message', 'updated_at'])
        v = mr.vehicle
        notify_user(
            mr.mechanic,
            title='More information requested',
            message=f'For your {v.make} {v.model} ({v.rego}) quote: {message}',
            notification_type='maintenance_quoted',
            link='/maintenance/requests',
            entity_type='maintenance', entity_id=mr.id, action='info_requested',
        )
        record_action(
            request.user, owning_rental(request.user), 'maintenance.info_requested',
            f'asked the mechanic for more info on {v.make} {v.model} ({v.rego}).',
            link='/maintenance', notify_title='Requested more info by staff',
            entity_type='vehicle', entity_id=v.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='provide-info')
    def provide_info(self, request, pk=None):
        """The assigned mechanic supplies the requested documents/details; the
        job returns to 'quoted' for the rental to review again."""
        mr = self.get_object()
        if getattr(request.user, 'role', None) != 'mechanic' or mr.mechanic_id != request.user.id:
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status != MaintenanceRequest.STATUS_INFO_REQUESTED:
            return Response({'detail': 'This job is not awaiting more information.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        new_docs = request.data.get('id_documents')
        if not isinstance(new_docs, list) or len(new_docs) == 0:
            return Response({'id_documents': 'Upload at least one document.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        mr.id_documents = (mr.id_documents or []) + new_docs
        details = request.data.get('verified_details')
        if isinstance(details, dict):
            mr.verified_details = details
        mr.status = MaintenanceRequest.STATUS_QUOTED
        mr.save(update_fields=['id_documents', 'verified_details', 'status', 'updated_at'])
        v = mr.vehicle
        notify_user(
            mr.rental,
            title='Mechanic provided more information',
            message=f'The mechanic added documents for {v.make} {v.model} ({v.rego}). Ready for review.',
            notification_type='maintenance_quoted',
            link='/maintenance',
            entity_type='vehicle', entity_id=v.id, action='info_provided',
            actor_name=actor_label(request.user),
        )
        notify_admins_of_action(
            actor=request.user,
            action='info_provided',
            entity_type='vehicle', entity_id=v.id,
            title='Mechanic provided more information',
            message=f'{actor_label(request.user)} added documents for {v.make} {v.model} ({v.rego}).',
            notification_type='maintenance_quoted',
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a request before the job is under way.
          - assigned mechanic: withdraws their quote (status 'quoted')
          - owning rental (owner/staff): cancels the request while it is still
            pending / quoted / awaiting more info (never once 'accepted')."""
        mr = self.get_object()
        is_mechanic_owner = (
            getattr(request.user, 'role', None) == 'mechanic' and mr.mechanic_id == request.user.id
        )
        is_owning_rental = self._is_owning_rental(request, mr)
        if not (is_mechanic_owner or is_owning_rental):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)

        if is_owning_rental and not is_mechanic_owner:
            # The rental may cancel the whole maintenance need while it is still
            # PENDING or INFO_REQUESTED (waiting on the mechanic). Once a live quote
            # is on the table they must decline it instead, and once ACCEPTED the
            # repair is under way. Allowing INFO_REQUESTED here is what lets an owner
            # free a vehicle when the mechanic never answers an info request.
            if mr.status not in (MaintenanceRequest.STATUS_PENDING,
                                 MaintenanceRequest.STATUS_INFO_REQUESTED):
                return Response({'detail': 'Only a pending request can be cancelled. Decline the quote instead.'},
                                status=drf_status.HTTP_400_BAD_REQUEST)
            mr.status = MaintenanceRequest.STATUS_CANCELLED
            mr.decided_at = timezone.now()
            mr.save(update_fields=['status', 'decided_at', 'updated_at'])
            v = mr.vehicle
            vlabel = f'{v.make} {v.model} ({v.rego})'
            # Cancelling the maintenance need drops the whole competition: reject
            # every other open row for this vehicle (competing quotes + the pool
            # row) so no stale quote lingers, and tell each affected mechanic.
            siblings = (
                MaintenanceRequest.objects.filter(vehicle=v)
                .exclude(pk=mr.pk)
                .filter(status__in=[
                    MaintenanceRequest.STATUS_PENDING,
                    MaintenanceRequest.STATUS_QUOTED,
                    MaintenanceRequest.STATUS_INFO_REQUESTED,
                ])
            )
            for sib in siblings:
                sib.status = MaintenanceRequest.STATUS_CANCELLED
                sib.decided_at = timezone.now()
                sib.decision_reason = 'The rental cancelled the maintenance request for this vehicle.'
                sib.save(update_fields=['status', 'decided_at', 'decision_reason', 'updated_at'])
                if sib.mechanic_id:
                    notify_user(
                        sib.mechanic,
                        title='Maintenance request cancelled',
                        message=f'{rental_display_name(mr.rental)} cancelled the maintenance request for {vlabel}.',
                        notification_type='maintenance_declined',
                        link='/maintenance/requests',
                        entity_type='maintenance', entity_id=sib.id, action='cancelled',
                    )
            # Cancelling the maintenance need frees the vehicle back to available.
            if v.status in (Vehicle.STATUS_MAINTENANCE, Vehicle.STATUS_PENDING_RETURN):
                v.status = Vehicle.STATUS_AVAILABLE
                v.save(update_fields=['status', 'updated_at'])
            if mr.mechanic_id:
                notify_user(
                    mr.mechanic,
                    title='Maintenance request cancelled',
                    message=f'{rental_display_name(mr.rental)} cancelled the request for {vlabel}.',
                    notification_type='maintenance_declined',
                    link='/maintenance/requests',
                )
            notify_admins_of_action(
                actor=request.user, action='cancelled',
                entity_type='vehicle', entity_id=v.id,
                title='Maintenance request cancelled',
                message=(f'{actor_label(request.user)} cancelled the maintenance request for '
                         f'{v.make} {v.model} ({v.rego}).'),
                notification_type='maintenance_declined',
            )
            return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

        # Mechanic withdrawing their own quote.
        if mr.status != MaintenanceRequest.STATUS_QUOTED:
            return Response({'detail': 'You can only cancel a quote the rental has not yet decided on.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        mr.status = MaintenanceRequest.STATUS_CANCELLED
        mr.decided_at = timezone.now()
        mr.save(update_fields=['status', 'decided_at', 'updated_at'])
        v = mr.vehicle
        vlabel = f'{v.make} {v.model} ({v.rego})'
        # Tell the owning rental (and admins) the mechanic withdrew their quote.
        notify_user(
            mr.rental,
            title='Mechanic withdrew their quote',
            message=f'{request.user.get_full_name()} withdrew their quote for {vlabel}.',
            notification_type='maintenance_declined',
            link='/maintenance',
            entity_type='vehicle', entity_id=v.id, action='quote_withdrawn',
            actor_name=actor_label(request.user),
        )
        notify_admins_of_action(
            actor=request.user, action='quote_withdrawn',
            entity_type='vehicle', entity_id=v.id,
            title='Mechanic withdrew their quote',
            message=f'{actor_label(request.user)} withdrew their quote for {vlabel}.',
            notification_type='maintenance_declined',
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """Delete a maintenance request.
          - admin: any request
          - mechanic (job owner): only once it is declined or cancelled
          - owning rental (owner/staff): only a closed request — cancelled or
            completed. A pending request must be cancelled first; any other
            (active) status cannot be deleted.
        """
        mr = self.get_object()
        user = request.user
        mechanic_deletable = (
            MaintenanceRequest.STATUS_DECLINED,
            MaintenanceRequest.STATUS_CANCELLED,
            MaintenanceRequest.STATUS_COMPLETED,
        )
        is_admin = getattr(user, 'role', None) == 'admin' or user.is_superuser
        is_mechanic_owner = getattr(user, 'role', None) == 'mechanic' and mr.mechanic_id == user.id
        owner = owning_rental(user)
        is_owning_rental = owner is not None and mr.rental_id == owner.id
        if not (is_admin or is_mechanic_owner or is_owning_rental):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if is_admin:
            pass
        elif is_owning_rental:
            rental_deletable = (
                MaintenanceRequest.STATUS_CANCELLED,
                MaintenanceRequest.STATUS_COMPLETED,
            )
            if mr.status not in rental_deletable:
                detail = (
                    'Cancel the request first, then you can delete it.'
                    if mr.status == MaintenanceRequest.STATUS_PENDING
                    else 'Only a cancelled or completed request can be deleted.'
                )
                return Response({'detail': detail}, status=drf_status.HTTP_400_BAD_REQUEST)
        elif mr.status not in mechanic_deletable:
            return Response({'detail': 'Cancel the request first — only declined, cancelled or completed requests can be deleted.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        record_deletion(user, mr, 'maintenance')
        mr.delete()
        return Response(status=drf_status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark an accepted job's work done.

        - Mechanic marks it done → the job moves to ``pending_return`` and the
          vehicle to ``pending_return``; the owning rental is asked to confirm
          (it does NOT go straight to available).
        - The owning rental marking it done is the authority for the return, so
          it goes straight to ``completed`` and the vehicle to ``available``.
        """
        mr = self.get_object()
        is_mechanic_on_job = (
            getattr(request.user, 'role', None) == 'mechanic' and mr.mechanic_id == request.user.id
        )
        is_owning_rental = self._is_owning_rental(request, mr)
        if not (is_owning_rental or is_mechanic_on_job):
            return Response({'detail': 'Not allowed.'}, status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status not in MaintenanceRequest.ACTIVE_STATUSES:
            return Response({'detail': 'Only a running job can be completed.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        vehicle = mr.vehicle
        vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'

        # Mechanic finishing the work → awaits the rental's return confirmation.
        if is_mechanic_on_job and not is_owning_rental:
            mr.status = MaintenanceRequest.STATUS_PENDING_RETURN
            mr.work_completed_at = timezone.now()
            mr.save(update_fields=['status', 'work_completed_at', 'updated_at'])
            if vehicle.status == Vehicle.STATUS_MAINTENANCE:
                vehicle.status = Vehicle.STATUS_PENDING_RETURN
                vehicle.save(update_fields=['status', 'updated_at'])
            notify_admins(
                title='Maintenance work done — awaiting confirmation',
                message=(f'{request.user.get_full_name()} marked {vlabel} maintenance done. '
                         f'Awaiting {rental_display_name(mr.rental)}\'s return confirmation.'),
                notification_type='maintenance_pending_return',
                entity_type='vehicle', entity_id=vehicle.id, action='work_done',
                actor_name=actor_label(request.user),
            )
            notify_user(
                mr.rental,
                title='Your vehicle work is complete — you can take it',
                message=(f'{request.user.get_full_name()} finished the work on {vlabel}. '
                         f'Your vehicle work is complete now — you can take it. '
                         f'Confirm the return to make the vehicle available again.'),
                notification_type='maintenance_pending_return',
                link='/maintenance',
                # Point at the maintenance job (not the vehicle) so clicking the
                # notification lands the owner on the Maintenance page and flashes
                # this exact job — where Confirm Return properly completes the
                # maintenance record and frees the vehicle.
                entity_type='maintenance', entity_id=mr.id, action='work_done',
                actor_name=actor_label(request.user),
            )
            return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

        # Owning rental marking it done themselves → straight to available.
        mr.status = MaintenanceRequest.STATUS_COMPLETED
        mr.work_completed_at = mr.work_completed_at or timezone.now()
        mr.completed_at = timezone.now()
        mr.save(update_fields=['status', 'work_completed_at', 'completed_at', 'updated_at'])
        if vehicle.status in (Vehicle.STATUS_MAINTENANCE, Vehicle.STATUS_PENDING_RETURN):
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])
        notify_admins(
            title='Maintenance completed',
            message=(f'{vlabel} maintenance is complete and the vehicle is available again.'),
            notification_type='maintenance_completed',
            entity_type='vehicle', entity_id=vehicle.id, action='completed',
            actor_name=actor_label(request.user),
        )
        if mr.mechanic_id:
            notify_user(
                mr.mechanic,
                title='Maintenance closed',
                message=f'{rental_display_name(mr.rental)} marked {vlabel} maintenance complete.',
                notification_type='maintenance_completed',
                link='/maintenance/requests',
                entity_type='maintenance', entity_id=mr.id, action='completed',
            )
        record_action(
            request.user, owning_rental(request.user), 'maintenance.completed',
            f'marked {vlabel} maintenance complete.',
            link='/maintenance', notify_title='Maintenance completed by staff',
            entity_type='vehicle', entity_id=vehicle.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='confirm-return')
    def confirm_return(self, request, pk=None):
        """The owning rental confirms the vehicle has been returned after the
        mechanic finished → job ``completed``, vehicle back to ``available``."""
        mr = self.get_object()
        if not self._is_owning_rental(request, mr):
            return Response({'detail': 'Only the owning rental can confirm the return.'},
                            status=drf_status.HTTP_403_FORBIDDEN)
        if mr.status != MaintenanceRequest.STATUS_PENDING_RETURN:
            return Response({'detail': 'This job is not awaiting a return confirmation.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        mr.status = MaintenanceRequest.STATUS_COMPLETED
        mr.completed_at = timezone.now()
        mr.save(update_fields=['status', 'completed_at', 'updated_at'])
        vehicle = mr.vehicle
        vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
        if vehicle.status in (Vehicle.STATUS_MAINTENANCE, Vehicle.STATUS_PENDING_RETURN):
            vehicle.status = Vehicle.STATUS_AVAILABLE
            vehicle.save(update_fields=['status', 'updated_at'])
        notify_admins(
            title='Maintenance completed',
            message=f'{rental_display_name(mr.rental)} confirmed the return of {vlabel}. It is available again.',
            notification_type='maintenance_completed',
            entity_type='vehicle', entity_id=vehicle.id, action='return_confirmed',
            actor_name=actor_label(request.user),
        )
        if mr.mechanic_id:
            notify_user(
                mr.mechanic,
                title='Return confirmed',
                message=f'{rental_display_name(mr.rental)} confirmed the return of {vlabel}. Job closed.',
                notification_type='maintenance_completed',
                link='/maintenance/requests',
                entity_type='maintenance', entity_id=mr.id, action='return_confirmed',
            )
        record_action(
            request.user, owning_rental(request.user), 'maintenance.return_confirmed',
            f'confirmed the return of {vlabel}.',
            link='/maintenance', notify_title='Maintenance return confirmed by staff',
            entity_type='vehicle', entity_id=vehicle.id,
        )
        return Response(MaintenanceRequestSerializer(mr).data, status=drf_status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='sync-reminders')
    def sync_reminders(self, request):
        """Mechanic-only: lazily create any overdue-maintenance reminders for the
        signed-in mechanic. Safe to call on every app open; deduped per day."""
        if getattr(request.user, 'role', None) != 'mechanic':
            return Response({'created': 0})
        created = generate_maintenance_overdue_reminders(request.user)
        return Response({'created': created})


class IsDriver(BasePermission):
    """Allow only authenticated driver users."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'driver')


class BrowseRentalViewSet(viewsets.ReadOnlyModelViewSet):
    """Driver-facing 'Browse rentals' catalogue: active rental owners that have
    at least one available vehicle, plus each rental's available vehicles."""

    serializer_class = BrowseRentalSerializer
    permission_classes = [IsAuthenticated, IsDriver]

    def get_queryset(self):
        return (
            User.objects.filter(role='rental', allowed_nav_paths__isnull=True,
                                is_active=True, is_suspended=False)
            .select_related('rental_profile')
            .annotate(available_count=Count('vehicles', filter=Q(vehicles__status=Vehicle.STATUS_AVAILABLE)))
            .filter(available_count__gt=0)
            .order_by('-available_count')
        )

    @action(detail=True, methods=['get'])
    def vehicles(self, request, pk=None):
        """Available vehicles for one rental owner."""
        owner = self.get_object()
        qs = Vehicle.objects.filter(rental=owner, status=Vehicle.STATUS_AVAILABLE).order_by('-created_at')
        return Response(VehicleSerializer(qs, many=True).data)


# --- Driver vehicle reminders (oil change / rego payment / rego expiry) ---------
# Typical service & registration intervals; "approaching" = within the window.
OIL_CHANGE_INTERVAL_DAYS = 180
REMINDER_WINDOW_DAYS = 7
REMINDER_LOCK_NS = 4242  # advisory-lock namespace for per-recipient reminder syncs


@contextmanager
def _reminder_lock(recipient_id):
    """Serialize reminder generation per recipient. Two concurrent syncs (the app
    can fire the on-open sync more than once, and the daily task may overlap one)
    would otherwise both pass the "already exists?" check and create duplicate
    notifications. A transaction-scoped Postgres advisory lock keyed on the
    recipient makes the check-then-create atomic per user."""
    with transaction.atomic():
        with connection.cursor() as cur:
            cur.execute('SELECT pg_advisory_xact_lock(%s, %s)', [REMINDER_LOCK_NS, recipient_id])
        yield


def _maybe_remind(recipient, vehicle, ntype, label, due_date, today, link='/my-trips'):
    """Create a reminder for `recipient` (driver or rental owner) about a vehicle
    when `due_date` is in the active window — from REMINDER_WINDOW_DAYS before it
    through REMINDER_WINDOW_DAYS after it (i.e. 7 days before due until 7 days
    overdue, then it stops). Re-sent at most once per calendar day, so the
    reminder appears daily across that window. Dedup is tracked on a
    VehicleReminderLog row rather than the notification itself, so a notification
    the user deletes is never recreated the same day. Returns 1 if created, else 0."""
    if not due_date or abs((due_date - today).days) > REMINDER_WINDOW_DAYS:
        return 0
    # One log row per recipient + vehicle + type + day. If it already exists we
    # already reminded today (even if the user has since deleted the notification).
    _log, created = VehicleReminderLog.objects.get_or_create(
        recipient=recipient, vehicle=vehicle, ntype=ntype, sent_date=today,
        defaults={'due_date': due_date},
    )
    if not created:
        return 0
    vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
    due_iso = due_date.isoformat()
    overdue = due_date < today
    when = f'was due on {due_iso}' if overdue else f'is due on {due_iso}'
    notify_user(
        recipient,
        title=f'{label} {"overdue" if overdue else "due soon"}',
        message=f'{label} for {vlabel} {when}.',
        notification_type=ntype,
        link=link,
    )
    return 1


def generate_driver_vehicle_reminders(driver):
    """For each vehicle the driver currently rents — i.e. has an active (approved,
    not-yet-completed) booking on — create any due reminders (oil change, rego
    expiry). Once the owner confirms the return the booking becomes 'completed'
    and the driver stops receiving that vehicle's reminders. De-duplicated per
    day, so it's safe to call on every app open. Returns the number created."""
    today = timezone.localdate()
    vehicle_ids = (
        RentalRequest.objects
        .filter(driver=driver,
                status__in=[RentalRequest.STATUS_RUNNING, RentalRequest.STATUS_COMPLETED],
                vehicle__status__in=[Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN])
        .values_list('vehicle_id', flat=True).distinct()
    )
    created = 0
    with _reminder_lock(driver.id):
        for vehicle in Vehicle.objects.filter(id__in=list(vehicle_ids)):
            oil_due = (
                vehicle.last_oil_change_date + timedelta(days=OIL_CHANGE_INTERVAL_DAYS)
                if vehicle.last_oil_change_date else None
            )
            created += _maybe_remind(driver, vehicle, 'oil', 'Oil change', oil_due, today)
            created += _maybe_remind(driver, vehicle, 'rego', 'Rego expiry', vehicle.rego_due_date, today)
    return created


class DriverReminderSyncView(APIView):
    """Called by the driver app on open; lazily creates any due vehicle reminders
    (oil change / rego expiry) for the driver, plus any 'rental period ended'
    return reminders for vehicles they still hold."""

    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        created = generate_driver_vehicle_reminders(request.user)
        created += process_driver_due_returns(request.user)
        return Response({'created': created})


def generate_rental_vehicle_reminders(owner):
    """For every vehicle the rental owner has in their fleet, create any due
    reminders (oil change, rego expiry) addressed to the owner — regardless of
    whether the vehicle is currently rented out. De-duplicated per day, so it's
    safe to call on every app open. Returns the number of new reminders."""
    if owner is None:
        return 0
    today = timezone.localdate()
    created = 0
    with _reminder_lock(owner.id):
        for vehicle in Vehicle.objects.filter(rental=owner):
            oil_due = (
                vehicle.last_oil_change_date + timedelta(days=OIL_CHANGE_INTERVAL_DAYS)
                if vehicle.last_oil_change_date else None
            )
            created += _maybe_remind(owner, vehicle, 'oil', 'Oil change', oil_due, today, link='/fleet')
            created += _maybe_remind(owner, vehicle, 'rego', 'Rego expiry', vehicle.rego_due_date, today, link='/fleet')
    return created


class RentalReminderSyncView(APIView):
    """Called by the rental app on open; lazily creates any due fleet reminders
    (oil change / rego expiry) for the rental owner, plus any 'rental period
    ended — confirm return' nudges for that fleet. Staff trigger these for the
    owner they act for."""

    permission_classes = [IsAuthenticated, IsRental]

    def post(self, request):
        owner = owning_rental(request.user) or request.user
        created = generate_rental_vehicle_reminders(owner)
        created += process_owner_due_returns(owner)
        return Response({'created': created})


# --- End-of-rental returns (hybrid: auto-complete + notify, owner confirms) ----
# When a running booking's end_date passes, the request auto-completes (so the
# driver immediately sees a finished trip) and the vehicle is auto-moved to
# 'pending_return'. Both the owner and the driver get a daily nudge until the
# owner confirms the physical return (which releases the vehicle to 'available').


def _due_return_bookings(today):
    """Ended bookings whose vehicle is still out (rented or awaiting return).
    Covers both running rentals that just ended (to be auto-completed) and ones
    already auto-completed but still awaiting the owner's return confirmation."""
    return (
        RentalRequest.objects
        .filter(
            status__in=[RentalRequest.STATUS_RUNNING, RentalRequest.STATUS_COMPLETED],
            end_date__isnull=False,
            end_date__lt=today,
            vehicle__status__in=[Vehicle.STATUS_RENTED, Vehicle.STATUS_PENDING_RETURN],
        )
        .select_related('vehicle', 'vehicle__rental', 'driver')
    )


def _transition_to_pending_return(vehicle):
    """One-time flip rented → pending_return when the period ends. Idempotent."""
    if vehicle.status == Vehicle.STATUS_RENTED:
        vehicle.status = Vehicle.STATUS_PENDING_RETURN
        vehicle.save(update_fields=['status', 'updated_at'])


def _mark_period_ended(booking):
    """A running rental whose period has ended moves into the 'period_ended'
    return state so the driver is prompted to Complete Trip (the booking stays
    RUNNING; it only completes once the return is confirmed). Idempotent, and a
    booking already negotiating a return (any non-empty return_state) is left
    untouched so an in-flight early-return handshake isn't clobbered."""
    if booking.status == RentalRequest.STATUS_RUNNING and booking.return_state == RentalRequest.RETURN_NONE:
        booking.return_state = RentalRequest.RETURN_PERIOD_ENDED
        booking.save(update_fields=['return_state', 'updated_at'])


# An early-return handshake initiated by either party is being negotiated; the
# daily 'period ended' nudge is suppressed while one is outstanding so the two
# flows don't talk over each other (the pending request already prompts action).
_PENDING_EARLY_RETURN = (
    RentalRequest.RETURN_REQUESTED_BY_RENTAL,
    RentalRequest.RETURN_REQUESTED_BY_DRIVER,
)


def _maybe_return_nudge(recipient, vehicle, end_date, today, link, is_owner):
    """Daily 'rental period ended' nudge for one recipient. De-duplicated per day
    on a VehicleReminderLog row (ntype='return'), so a deleted notification is not
    recreated the same day and it re-appears daily until the return is confirmed.
    Returns 1 if created, else 0."""
    _log, created = VehicleReminderLog.objects.get_or_create(
        recipient=recipient, vehicle=vehicle, ntype=VehicleReminderLog.RETURN, sent_date=today,
        defaults={'due_date': end_date or today},
    )
    if not created:
        return 0
    vlabel = f'{vehicle.make} {vehicle.model} ({vehicle.rego})'
    end_iso = (end_date or today).isoformat()
    if is_owner:
        title = 'Rental period ended'
        message = (f'The rental period for {vlabel} ended on {end_iso}. Once the driver completes '
                   'the trip you can confirm the return to make it available again.')
    else:
        title = 'Rental period ended — complete your trip'
        message = (f'Your rental of {vlabel} ended on {end_iso}. Return it to the owner and '
                   'tap Complete Trip on My Trips.')
    notify_user(recipient, title=title, message=message,
                notification_type='rental_return', link=link)
    return 1


def process_owner_due_returns(owner):
    """For the owner's fleet: flag any ended rentals as pending_return and send the
    owner today's confirm-return nudge. Returns the number of nudges created."""
    if owner is None:
        return 0
    today = timezone.localdate()
    created = 0
    bookings = list(_due_return_bookings(today).filter(vehicle__rental=owner))
    with _reminder_lock(owner.id):
        for booking in bookings:
            _mark_period_ended(booking)
            _transition_to_pending_return(booking.vehicle)
            if booking.return_state in _PENDING_EARLY_RETURN:
                continue  # early-return handshake in flight — don't also nudge
            created += _maybe_return_nudge(
                owner, booking.vehicle, booking.end_date, today, link='/rental/requests', is_owner=True)
    return created


def process_driver_due_returns(driver):
    """For the driver: flag any of their ended rentals as pending_return and send
    the driver today's return reminder. Returns the number of nudges created."""
    today = timezone.localdate()
    created = 0
    bookings = list(_due_return_bookings(today).filter(driver=driver))
    with _reminder_lock(driver.id):
        for booking in bookings:
            _mark_period_ended(booking)
            _transition_to_pending_return(booking.vehicle)
            if booking.return_state in _PENDING_EARLY_RETURN:
                continue  # early-return handshake in flight — don't also nudge
            created += _maybe_return_nudge(
                driver, booking.vehicle, booking.end_date, today, link='/my-trips', is_owner=False)
    return created


# --- Maintenance overdue reminders ---------------------------------------------
def _maintenance_deadline(mr):
    """The agreed completion time for an accepted job = decided_at + the
    mechanic's estimate. None if the estimate or decision time is missing."""
    if not mr.decided_at or not mr.estimated_value or not mr.estimated_unit:
        return None
    if mr.estimated_unit == MaintenanceRequest.DURATION_HOURS:
        return mr.decided_at + timedelta(hours=mr.estimated_value)
    return mr.decided_at + timedelta(days=mr.estimated_value)


def generate_maintenance_overdue_reminders(mechanic):
    """For each accepted job the mechanic still hasn't marked done, once the
    agreed completion time has passed send a daily 'please complete the work'
    reminder. De-duplicated per day on a VehicleReminderLog row (ntype='maint'),
    so it recurs daily and a deleted notification isn't recreated the same day.
    Returns the number of reminders created."""
    if mechanic is None or getattr(mechanic, 'role', None) != 'mechanic':
        return 0
    now = timezone.now()
    today = timezone.localdate()
    created = 0
    jobs = MaintenanceRequest.objects.filter(
        mechanic=mechanic, status__in=MaintenanceRequest.ACTIVE_STATUSES
    ).select_related('vehicle')
    with _reminder_lock(mechanic.id):
        for mr in jobs:
            deadline = _maintenance_deadline(mr)
            if not deadline or now <= deadline:
                continue
            _log, was_created = VehicleReminderLog.objects.get_or_create(
                recipient=mechanic, vehicle=mr.vehicle, ntype=VehicleReminderLog.MAINT,
                sent_date=today, defaults={'due_date': deadline.date()},
            )
            if not was_created:
                continue
            v = mr.vehicle
            notify_user(
                mechanic,
                title='Maintenance overdue — please complete the work',
                message=(f'The agreed time for {v.make} {v.model} ({v.rego}) has passed. '
                         f'Please finish the work and mark it complete.'),
                notification_type='maintenance_reminder',
                link='/maintenance',
            )
            created += 1
    return created


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """The 'who did what' audit trail.

      - rental OWNER: every action in their account (their own + all their staff)
      - rental STAFF: no access (this is an owner oversight tool)
      - admin: all activity across every rental
    """

    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = ActivityLog.objects.select_related('actor', 'rental', 'rental__rental_profile')
        role = getattr(user, 'role', None)
        if role == 'admin' or user.is_superuser:
            return base.all()
        if role == 'rental' and not is_rental_staff(user):
            return base.filter(rental=user)
        return base.none()


class DashboardStatsView(APIView):
    """Aggregated counts for the admin dashboard cards."""

    permission_classes = [IsAdmin]

    # Short month labels indexed 1..12 (index 0 unused).
    _MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    def get(self, request):
        rental_owners = User.objects.filter(role='rental', allowed_nav_paths__isnull=True)
        rental_staff = User.objects.filter(role='rental', allowed_nav_paths__isnull=False)

        # Vehicles grouped by status (for the "Vehicles by status" panel).
        vehicles_by_status = {'available': 0, 'rented': 0, 'pending_return': 0, 'maintenance': 0}
        for row in Vehicle.objects.values('status').annotate(c=Count('id')):
            if row['status'] in vehicles_by_status:
                vehicles_by_status[row['status']] = row['c']

        # Booking requests broken down by status (for the "Requests by status" panel).
        status_counts = {
            row['status']: row['c']
            for row in RentalRequest.objects.values('status').annotate(c=Count('id'))
        }
        requests_by_status = {
            key: status_counts.get(key, 0)
            for key in ('pending', 'approved', 'running', 'info_requested', 'completed', 'rejected', 'cancelled')
        }

        # Booking requests per month — last 6 months, gap-filled so the chart
        # always shows a full window even when a month had no requests.
        now = timezone.now()
        window = []
        yy, mm = now.year, now.month
        for _ in range(6):
            window.append((yy, mm))
            mm -= 1
            if mm == 0:
                mm = 12
                yy -= 1
        window.reverse()  # oldest → newest
        trend_counts = {
            (row['m'].year, row['m'].month): row['c']
            for row in (
                RentalRequest.objects
                .annotate(m=TruncMonth('created_at'))
                .values('m')
                .annotate(c=Count('id'))
            )
            if row['m'] is not None
        }
        rental_requests_trend = [
            {'month': self._MONTHS[m], 'count': trend_counts.get((y, m), 0)}
            for (y, m) in window
        ]

        # Top rentals by fleet size (for the "Top rentals" table).
        top = Vehicle.objects.values('rental').annotate(c=Count('id')).order_by('-c')[:5]
        rental_ids = [row['rental'] for row in top if row['rental'] is not None]
        owners_by_id = {u.id: u for u in User.objects.filter(id__in=rental_ids)}
        top_rentals = [
            {
                'name': rental_display_name(owners_by_id[row['rental']]),
                'vehicles': row['c'],
            }
            for row in top
            if row['rental'] in owners_by_id
        ]

        return Response({
            'total_drivers': User.objects.filter(role='driver').count(),
            'total_rentals': rental_owners.count(),
            'total_rental_staff': rental_staff.count(),
            'total_mechanics': User.objects.filter(role='mechanic').count(),
            'total_vehicles': Vehicle.objects.count(),
            'pending_registrations': RegistrationRequest.objects.filter(
                status=RegistrationRequest.STATUS_PENDING
            ).exclude(role='rental_staff').count(),
            'pending_staff_requests': RegistrationRequest.objects.filter(
                status=RegistrationRequest.STATUS_PENDING, role='rental_staff'
            ).count(),
            'unread_notifications': Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count(),
            'vehicles_by_status': vehicles_by_status,
            'requests_by_status': requests_by_status,
            'rental_requests_trend': rental_requests_trend,
            'top_rentals': top_rentals,
        })


class AutomaticBehaviorsView(APIView):
    """GET — the catalogue of every AUTOMATIC state transition the backend makes
    (a booking/vehicle/account changing status without a direct click on it).

    Exists so frontend engineers and admins can see, at runtime, exactly when and
    why a status flips on its own — e.g. why a booking became 'period_ended' or a
    driver was suspended. Authenticated read-only; sourced from
    ``operations.automatic_behaviors.AUTOMATIC_BEHAVIORS``."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .automatic_behaviors import AUTOMATIC_BEHAVIORS
        return Response({'count': len(AUTOMATIC_BEHAVIORS), 'behaviors': AUTOMATIC_BEHAVIORS})


class SiteBrandingView(APIView):
    """The single, app-wide branding record (theme mode, primary/secondary colour,
    logo).

    GET is open to everyone (any role, even unauthenticated) so every user's app
    loads the same global look. PUT/PATCH is admin-only — that is what makes the
    theme/colour change something *only an admin can make* yet that *applies to the
    whole application* for all users, rather than living in one browser.
    """

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAdmin()]
        return [AllowAny()]

    def get(self, request):
        branding = SiteBranding.load()
        return Response(SiteBrandingSerializer(branding).data)

    def put(self, request):
        return self._update(request)

    def patch(self, request):
        return self._update(request)

    def _update(self, request):
        branding = SiteBranding.load()
        serializer = SiteBrandingSerializer(branding, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
