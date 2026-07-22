import React from 'react';
import DashboardView from '../../components/Dashboard/DashboardView/DashboardView';
import MechanicDashboard from '../../components/Dashboard/MechanicDashboard';
import AdminDashboardPage from '../admin-dashboard';
import { useAuth } from '../../context/hooks';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();
  // Admins get the admin dashboard; mechanics get their driver-style dashboard;
  // everyone else gets the standard dashboard view.
  if (role === 'admin') {
    return <AdminDashboardPage />;
  }
  if (role === 'mechanic') {
    return <MechanicDashboard />;
  }
  return <DashboardView />;
};

export default DashboardPage;
