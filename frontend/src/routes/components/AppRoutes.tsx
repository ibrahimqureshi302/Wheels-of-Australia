import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

// Import pages
import HomePage from '../../pages/home';
import LoginPage from '../../pages/login';
import RegisterPage from '../../pages/register';
import VerifyOTPPage from '../../pages/verify-otp';
import DashboardPage from '../../pages/dashboard';
import ProfilePage from '../../pages/profile';
import NotificationsPage from '../../pages/notifications';
import RentalRegisterPage from '../../pages/rental-register';
import MechanicRegisterPage from '../../pages/mechanic-register';
import FleetPage from '../../pages/fleet';
import FleetAddPage from '../../pages/fleet/add';
import FleetEditPage from '../../pages/fleet/edit';
import VehiclesPage from '../../pages/vehicles';
import VehiclesRentalPage from '../../pages/vehicles/rental';
import RentalRequestsPage from '../../pages/rental-requests';
import MyRequestsPage from '../../pages/my-requests';
import MyTripsPage from '../../pages/my-trips';
import LiveMapPage from '../../pages/live-map';
import DistanceSummaryPage from '../../pages/distance-summary';
import MaintenancePage from '../../pages/maintenance';
import MaintenanceRequestsPage from '../../pages/maintenance-requests';
import MaintenanceHistoryPage from '../../pages/maintenance-history';
import AdminSettingsPage from '../../pages/admin-settings';
import AdminDashboardPage from '../../pages/admin-dashboard';
import AdminRegistrationsPage from '../../pages/admin-registrations';
import DriversPage from '../../pages/drivers';
import DriversAddPage from '../../pages/drivers/add';
import DriversEditPage from '../../pages/drivers/edit';
import RentalsPage from '../../pages/rentals';
import RentalsAddPage from '../../pages/rentals/add';
import RentalsEditPage from '../../pages/rentals/edit';
import MechanicsPage from '../../pages/mechanics';
import MechanicsAddPage from '../../pages/mechanics/add';
import MechanicsEditPage from '../../pages/mechanics/edit';
import AdminVehiclesPage from '../../pages/admin-vehicles';
import VehiclesAddPage from '../../pages/admin-vehicles/add';
import VehiclesEditPage from '../../pages/admin-vehicles/edit';
import RentalStaffPage from '../../pages/rental-staff';
import RentalStaffAddPage from '../../pages/rental-staff/add';
import RentalStaffEditPage from '../../pages/rental-staff/edit';
import AdminRentalStaffPage from '../../pages/admin-rental-staff';
import AdminRentalStaffAddPage from '../../pages/admin-rental-staff/add';
import AdminRentalStaffEditPage from '../../pages/admin-rental-staff/edit';
import ActivityPage from '../../pages/activity';

// Import route guards and layout
import ProtectedRoute from '../guards/ProtectedRoute';
import PublicRoute from '../guards/PublicRoute';
import AnimatedPageLayout from './AnimatedPageLayout';
import { useAuth } from '../../context/hooks';
import { sessionUtils } from '../../utils/session';

// 404 Not Found component
const NotFoundPage: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '2rem' }}>
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
  </div>
);

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  // Show loading spinner while determining auth state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AnimatedPageLayout />}>
        {/* Root: public landing page for visitors; authenticated users go to their dashboard (or pending OTP). */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate
                to={sessionUtils.hasPendingPhoneVerification() ? ROUTES.VERIFY_OTP : ROUTES.DASHBOARD}
                replace
              />
            ) : (
              <HomePage />
            )
          }
        />

        {/* Auth Routes - Only accessible when not authenticated */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path={ROUTES.REGISTER}
          element={
            <PublicRoute redirectAuthenticatedTo={ROUTES.VERIFY_OTP}>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes - Only accessible when authenticated */}
        <Route
          path={ROUTES.VERIFY_OTP}
          element={
            <ProtectedRoute noLayout>
              <VerifyOTPPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.PROFILE}
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.NOTIFICATIONS}
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        {/* Rental & mechanic register: public so the login-page links open the forms directly */}
        <Route path={ROUTES.RENTAL_REGISTER} element={<RentalRegisterPage />} />
        <Route path={ROUTES.MECHANIC_REGISTER} element={<MechanicRegisterPage />} />
        <Route
          path={ROUTES.FLEET}
          element={
            <ProtectedRoute>
              <FleetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FLEET_ADD}
          element={
            <ProtectedRoute>
              <FleetAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.FLEET_EDIT}
          element={
            <ProtectedRoute>
              <FleetEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.VEHICLES_RENTAL}
          element={
            <ProtectedRoute requiredRole="driver">
              <VehiclesRentalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.VEHICLES}
          element={
            <ProtectedRoute requiredRole="driver">
              <VehiclesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RENTAL_REQUESTS}
          element={
            <ProtectedRoute>
              <RentalRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MY_REQUESTS}
          element={
            <ProtectedRoute requiredRole="driver">
              <MyRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MY_TRIPS}
          element={
            <ProtectedRoute requiredRole="driver">
              <MyTripsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LIVE_MAP}
          element={
            <ProtectedRoute>
              <LiveMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DISTANCE_SUMMARY}
          element={
            <ProtectedRoute>
              <DistanceSummaryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MAINTENANCE}
          element={
            <ProtectedRoute>
              <MaintenancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MAINTENANCE_REQUESTS}
          element={
            <ProtectedRoute requiredRole="mechanic">
              <MaintenanceRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MAINTENANCE_HISTORY}
          element={
            <ProtectedRoute requiredRole="mechanic">
              <MaintenanceHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RENTAL.STAFF}
          element={
            <ProtectedRoute requiredRole="rental">
              <RentalStaffPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RENTAL.STAFF_ADD}
          element={
            <ProtectedRoute requiredRole="rental">
              <RentalStaffAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RENTAL.STAFF_EDIT}
          element={
            <ProtectedRoute requiredRole="rental">
              <RentalStaffEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.RENTAL.ACTIVITY}
          element={
            <ProtectedRoute requiredRole="rental">
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.DASHBOARD}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.SETTINGS}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.ACTIVITY}
          element={
            <ProtectedRoute requiredRole="admin">
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.REGISTRATIONS}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRegistrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.DRIVERS}
          element={
            <ProtectedRoute requiredRole="admin">
              <DriversPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.DRIVERS_ADD}
          element={
            <ProtectedRoute requiredRole="admin">
              <DriversAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.DRIVERS_EDIT}
          element={
            <ProtectedRoute requiredRole="admin">
              <DriversEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTALS}
          element={
            <ProtectedRoute requiredRole="admin">
              <RentalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTALS_ADD}
          element={
            <ProtectedRoute requiredRole="admin">
              <RentalsAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTALS_EDIT}
          element={
            <ProtectedRoute requiredRole="admin">
              <RentalsEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.MECHANICS}
          element={
            <ProtectedRoute requiredRole="admin">
              <MechanicsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.MECHANICS_ADD}
          element={
            <ProtectedRoute requiredRole="admin">
              <MechanicsAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.MECHANICS_EDIT}
          element={
            <ProtectedRoute requiredRole="admin">
              <MechanicsEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.VEHICLES_ALL}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminVehiclesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.VEHICLES_ADD}
          element={
            <ProtectedRoute requiredRole="admin">
              <VehiclesAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.VEHICLES_EDIT}
          element={
            <ProtectedRoute requiredRole="admin">
              <VehiclesEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTAL_STAFF}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRentalStaffPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTAL_STAFF_ADD}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRentalStaffAddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN.RENTAL_STAFF_EDIT}
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRentalStaffEditPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect old routes */}
        <Route path="/auth/login" element={<Navigate to={ROUTES.LOGIN} replace />} />

        {/* 404 Route */}
        <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
