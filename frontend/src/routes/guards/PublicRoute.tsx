import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/hooks';
import { sessionUtils } from '../../utils/session';
import { ROUTES } from '../../constants/routes';

interface PublicRouteProps {
  children: React.ReactNode;
  /** When set, authenticated users are sent here instead of dashboard (e.g. Register → verify-otp). */
  redirectAuthenticatedTo?: string;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children, redirectAuthenticatedTo }) => {
  const { isAuthenticated, loading } = useAuth();

  // Wait for auth state to be determined
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

  // If authenticated, redirect (to verify-otp when coming from register or when back from OTP, else dashboard)
  if (isAuthenticated) {
    const to =
      redirectAuthenticatedTo ??
      (sessionUtils.hasPendingPhoneVerification() ? ROUTES.VERIFY_OTP : ROUTES.DASHBOARD);
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
