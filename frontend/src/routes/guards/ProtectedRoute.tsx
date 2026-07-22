import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/hooks';
import { ROUTES } from '../../constants/routes';
import type { AppRole } from '../../constants/roles';
import { canAccess, normalizeRole } from '../../constants/roles';
import { isStaffPathAllowed } from '../../constants/nav';
import Layout from '../../components/Layout';
import NoAccessPage from '../../pages/no-access';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** When set, only users with this role (or admin) can access. Otherwise any authenticated user can access. */
  requiredRole?: AppRole;
  /** When true, only auth is checked; children render without Layout (e.g. verify-otp after register). */
  noLayout?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  noLayout = false,
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.2rem',
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location }}
        replace
      />
    );
  }

  // Suspended accounts can log in but are locked to their Profile page (which
  // shows the suspension reason + the admin-contact help card). Every other
  // route redirects there. Admins are never suspended, but guard anyway.
  if (user?.is_suspended && normalizeRole(user?.role) !== 'admin' && location.pathname !== ROUTES.PROFILE) {
    return <Navigate to={ROUTES.PROFILE} replace />;
  }

  if (requiredRole && !canAccess(user?.role, [requiredRole])) {
    return (
      <Layout>
        <NoAccessPage />
      </Layout>
    );
  }

  // Rental STAFF: enforce their granted pages. Even though the nav hides
  // ungranted sections, a staff member must not reach one by typing its URL.
  const grantedPaths = user?.allowed_nav_paths;
  if (
    normalizeRole(user?.role) === 'rental' &&
    grantedPaths && grantedPaths.length > 0 &&
    !isStaffPathAllowed(grantedPaths, location.pathname)
  ) {
    return (
      <Layout>
        <NoAccessPage />
      </Layout>
    );
  }

  if (noLayout) {
    return <>{children}</>;
  }

  return (
    <Layout>
      {children}
    </Layout>
  );
};

export default ProtectedRoute;
