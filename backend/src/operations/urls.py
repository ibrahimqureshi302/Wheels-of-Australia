from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DriverViewSet,
    RentalViewSet,
    MechanicViewSet,
    AdminVehicleViewSet,
    AdminRentalStaffViewSet,
    FleetViewSet,
    RentalStaffViewSet,
    RentalRequestViewSet,
    MaintenanceRequestViewSet,
    BrowseRentalViewSet,
    ActivityLogViewSet,
    DashboardStatsView,
    DriverReminderSyncView,
    RentalReminderSyncView,
    AutomaticBehaviorsView,
    SiteBrandingView,
)
from .ocr import IdDocumentOcrView
from .tracking import (
    DriverLocationReportView,
    DriverLocationUnavailableView,
    TrackedVehicleLocationsView,
)

router = DefaultRouter()
router.register(r'admin/drivers', DriverViewSet, basename='admin-driver')
router.register(r'admin/rentals', RentalViewSet, basename='admin-rental')
router.register(r'admin/mechanics', MechanicViewSet, basename='admin-mechanic')
router.register(r'admin/vehicles', AdminVehicleViewSet, basename='admin-vehicle')
router.register(r'admin/rental-staff', AdminRentalStaffViewSet, basename='admin-rental-staff')
router.register(r'fleet', FleetViewSet, basename='fleet')
router.register(r'rental-staff', RentalStaffViewSet, basename='rental-staff')
router.register(r'rental-requests', RentalRequestViewSet, basename='rental-request')
router.register(r'maintenance-requests', MaintenanceRequestViewSet, basename='maintenance-request')
router.register(r'browse/rentals', BrowseRentalViewSet, basename='browse-rental')
router.register(r'activity', ActivityLogViewSet, basename='activity')

urlpatterns = router.urls + [
    path('admin/dashboard-stats/', DashboardStatsView.as_view(), name='admin-dashboard-stats'),
    path('driver/reminders/sync/', DriverReminderSyncView.as_view(), name='driver-reminders-sync'),
    path('rental/reminders/sync/', RentalReminderSyncView.as_view(), name='rental-reminders-sync'),
    path('ocr/extract/', IdDocumentOcrView.as_view(), name='ocr-extract'),
    path('driver/location/report/', DriverLocationReportView.as_view(), name='driver-location-report'),
    path('driver/location/unavailable/', DriverLocationUnavailableView.as_view(), name='driver-location-unavailable'),
    path('tracking/locations/', TrackedVehicleLocationsView.as_view(), name='tracking-locations'),
    path('system/automatic-behaviors/', AutomaticBehaviorsView.as_view(), name='automatic-behaviors'),
    path('system/branding/', SiteBrandingView.as_view(), name='site-branding'),
]
