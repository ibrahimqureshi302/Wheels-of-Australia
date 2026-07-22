from django.contrib import admin

from .models import (
    DriverProfile, RentalProfile, MechanicProfile, Vehicle, RentalRequest,
    VehicleLocation, LocationWarning, DeletionAudit, SiteBranding,
)


@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'license_number', 'created_at')
    search_fields = ('user__email', 'license_number')


@admin.register(RentalProfile)
class RentalProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'rental_type', 'company_name', 'abn', 'created_at')
    search_fields = ('user__email', 'company_name', 'abn')


@admin.register(MechanicProfile)
class MechanicProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'shop_name', 'abn', 'created_at')
    search_fields = ('user__email', 'shop_name', 'abn')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('make', 'model', 'rego', 'rental', 'status', 'rent_price_per_day')
    list_filter = ('status',)
    search_fields = ('make', 'model', 'rego', 'rental__email')


@admin.register(RentalRequest)
class RentalRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'driver', 'vehicle', 'rental', 'status', 'start_date', 'end_date', 'created_at')
    list_filter = ('status',)
    search_fields = ('driver__email', 'vehicle__rego', 'rental__email')


@admin.register(VehicleLocation)
class VehicleLocationAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'driver', 'latitude', 'longitude', 'recorded_at')
    search_fields = ('vehicle__rego', 'driver__email')
    readonly_fields = ('vehicle', 'driver', 'rental_request', 'latitude', 'longitude',
                       'accuracy', 'recorded_at', 'created_at')


@admin.register(LocationWarning)
class LocationWarningAdmin(admin.ModelAdmin):
    list_display = ('driver', 'vehicle', 'warning_number', 'suspended', 'issued_at')
    list_filter = ('suspended',)
    search_fields = ('driver__email', 'vehicle__rego')
    readonly_fields = ('driver', 'rental_request', 'vehicle', 'warning_number', 'suspended', 'issued_at')


@admin.register(DeletionAudit)
class DeletionAuditAdmin(admin.ModelAdmin):
    """Forensic record of destructive deletes and their cascade. Read-only — the
    whole point is an immutable trail that survives the records it documents."""
    list_display = ('created_at', 'target_type', 'target_label', 'target_id',
                    'actor_name', 'cascade_total')
    list_filter = ('target_type', 'created_at')
    search_fields = ('target_label', 'target_id', 'actor_name')
    readonly_fields = ('actor', 'actor_name', 'target_type', 'target_id', 'target_label',
                       'snapshot', 'cascade_counts', 'cascade_total', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(SiteBranding)
class SiteBrandingAdmin(admin.ModelAdmin):
    """The single global branding row. Editable here too, but normally driven by
    the admin Settings page."""
    list_display = ('__str__', 'mode', 'primary_color', 'secondary_color', 'updated_at')

    def has_add_permission(self, request):
        # Singleton — never add a second row.
        return not SiteBranding.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
