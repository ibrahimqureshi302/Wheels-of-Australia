"""
Django admin configuration for authentication models.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.conf import settings
from django.urls import reverse
from django.utils.html import format_html
from django import forms

from .models import User, RegistrationRequest, Document, Notification
from .services import approve_registration, reject_registration, ApprovalError

#Pansari
class UserCreationForm(forms.ModelForm):
    """A form for creating new users. Includes all the required
    fields, plus a repeated password."""
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Password confirmation', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name', 'phone_number', 'role')

    def clean_password2(self):
        # Check that the two password entries match
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2

    def save(self, commit=True):
        # Save the provided password in hashed format
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """A form for updating users. Includes all the fields on
    the user, but replaces the password field with admin's
    password hash display field.
    """
    password = ReadOnlyPasswordHashField()

    class Meta:
        model = User
        fields = (
            'email', 'password', 'first_name', 'last_name', 'phone_number',
            'role', 'allowed_nav_paths', 'is_active', 'is_suspended',
            'suspension_reason', 'is_staff', 'is_superuser',
        )

    def clean_password(self):
        # Regardless of what the user provides, return the initial value.
        # This is done here, rather than on the field, because the
        # field does not have access to the initial value
        return self.initial["password"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # The forms to add and change user instances
    form = UserChangeForm
    add_form = UserCreationForm

    # The fields to be used in displaying the User model.
    # These override the definitions on the base UserAdmin
    # that reference specific fields on auth.User.
    list_display = ('email', 'role', 'first_name', 'last_name', 'is_staff', 'is_active', 'is_suspended', 'date_joined')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active', 'is_suspended', 'date_joined')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('first_name', 'last_name', 'phone_number', 'role', 'allowed_nav_paths')}),
        ('Access', {'fields': ('is_suspended', 'suspension_reason')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'must_change_password',
                                   'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
        ('Profile', {'fields': ('first_name', 'last_name', 'phone_number', 'role')}),
    )
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    filter_horizontal = ('groups', 'user_permissions',)
    # last_login / date_joined are non-editable model fields, so they must be
    # read-only or Django raises a FieldError when building the change form.
    readonly_fields = ('last_login', 'date_joined')
    actions = ['suspend_users', 'activate_users']

    @admin.action(description='Suspend selected accounts (lock to profile)')
    def suspend_users(self, request, queryset):
        # Never suspend superusers via bulk action. A suspended user can still log
        # in but is locked to their profile page; a generic reason is set (edit a
        # user individually to write a specific reason).
        count = queryset.filter(is_superuser=False).update(
            is_active=True,
            is_suspended=True,
            suspension_reason='Your account has been deactivated by an administrator.',
        )
        self.message_user(request, f'{count} account(s) suspended.', level=messages.WARNING)

    @admin.action(description='Re-activate selected accounts')
    def activate_users(self, request, queryset):
        # Reactivating clears the lock, the reason, any GPS tracking strikes, and
        # any legacy is_active=False so login + full access are fully restored.
        count = queryset.update(
            is_active=True, is_suspended=False, suspension_reason='', location_warning_count=0,
        )
        self.message_user(request, f'{count} account(s) re-activated.', level=messages.SUCCESS)


class DocumentInline(admin.TabularInline):
    """Read-only inline showing the files uploaded with a registration."""
    model = Document
    extra = 0
    can_delete = False
    fields = ('doc_type', 'original_name', 'file', 'preview', 'uploaded_at')
    readonly_fields = ('doc_type', 'original_name', 'file', 'preview', 'uploaded_at')

    def has_add_permission(self, request, obj=None):
        return False

    def preview(self, obj):
        if not obj or not obj.file:
            return '-'
        url = obj.file.url
        if url.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            return format_html(
                '<img src="{}" style="max-height:140px;border-radius:6px;border:1px solid #ddd;" />',
                url,
            )
        return format_html('<a href="{}" target="_blank" rel="noopener">Open file</a>', url)
    preview.short_description = 'Preview'


@admin.register(RegistrationRequest)
class RegistrationRequestAdmin(admin.ModelAdmin):
    """
    Admin review screen for self-registrations. Use the 'Approve' / 'Reject'
    actions to process a request. Approving creates the account, generates a
    password, and emails the applicant their credentials.
    """
    list_display = ('email', 'role', 'status', 'company_name', 'shop_name', 'created_at', 'reviewed_at')
    list_filter = ('status', 'role', 'rental_type', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'company_name', 'abn', 'shop_name')
    date_hierarchy = 'created_at'
    inlines = [DocumentInline]
    actions = ['approve_selected', 'reject_selected']
    readonly_fields = (
        'role', 'email', 'first_name', 'last_name', 'phone_number',
        'rental_type', 'company_name', 'abn', 'shop_name', 'shop_address',
        'extra', 'status', 'reviewed_by', 'reviewed_at', 'created_user',
        'created_at', 'updated_at',
    )
    fieldsets = (
        ('Applicant', {'fields': ('role', 'email', 'first_name', 'last_name', 'phone_number')}),
        ('Rental details', {'fields': ('rental_type', 'company_name', 'abn')}),
        ('Mechanic details', {'fields': ('shop_name', 'shop_address')}),
        ('Other submitted data', {'fields': ('extra',)}),
        ('Review', {'fields': (
            'status', 'rejection_reason', 'reviewed_by', 'reviewed_at',
            'created_user', 'created_at', 'updated_at',
        )}),
    )

    @admin.action(description='Approve selected (create account + email login credentials)')
    def approve_selected(self, request, queryset):
        approved = 0
        for reg in queryset:
            try:
                approve_registration(
                    reg, reviewer=request.user, login_url=settings.FRONTEND_LOGIN_URL
                )
                approved += 1
            except ApprovalError as exc:
                self.message_user(request, f'{reg.email}: {exc}', level=messages.ERROR)
        if approved:
            self.message_user(
                request,
                f'{approved} registration(s) approved — credentials emailed.',
                level=messages.SUCCESS,
            )

    @admin.action(description='Reject selected (email applicant)')
    def reject_selected(self, request, queryset):
        rejected = 0
        for reg in queryset:
            try:
                # Uses the rejection_reason already typed on the record, if any.
                reject_registration(reg, reviewer=request.user, reason=reg.rejection_reason)
                rejected += 1
            except ApprovalError as exc:
                self.message_user(request, f'{reg.email}: {exc}', level=messages.ERROR)
        if rejected:
            self.message_user(request, f'{rejected} registration(s) rejected.', level=messages.WARNING)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'recipient', 'notification_type', 'is_read', 'created_at', 'registration_link')
    list_filter = ('is_read', 'notification_type', 'created_at')
    search_fields = ('title', 'message', 'recipient__email')
    readonly_fields = ('recipient', 'notification_type', 'title', 'message', 'registration', 'created_at')

    @admin.display(description='Registration')
    def registration_link(self, obj):
        if obj.registration_id:
            url = reverse('admin:authentication_registrationrequest_change', args=[obj.registration_id])
            return format_html('<a href="{}">Review registration</a>', url)
        return '-'


# Hide the django_celery_beat "Periodic Tasks" section from the admin index.
# Scheduling still works (Celery Beat reads these models directly); we just
# don't surface the Intervals / Crontabs / Clocked / Solar / Periodic task
# screens in the admin UI.
try:
    from django_celery_beat.models import (
        ClockedSchedule,
        CrontabSchedule,
        IntervalSchedule,
        PeriodicTask,
        SolarSchedule,
    )

    for _beat_model in (
        ClockedSchedule,
        CrontabSchedule,
        IntervalSchedule,
        PeriodicTask,
        SolarSchedule,
    ):
        if admin.site.is_registered(_beat_model):
            admin.site.unregister(_beat_model)
except ImportError:
    # django_celery_beat not installed in this environment — nothing to hide.
    pass


# Hide Django's built-in "Groups" from the admin. This project uses its own
# `role` field for access control, so the auth Groups screen is unused.
if admin.site.is_registered(Group):
    admin.site.unregister(Group)
