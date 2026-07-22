import { apiClient } from '../../lib/api/client';

export interface DashboardStats {
  total_drivers: number;
  total_rentals: number;
  total_rental_staff: number;
  total_mechanics: number;
  total_vehicles: number;
  pending_registrations: number;
  pending_staff_requests: number;
  unread_notifications: number;
  vehicles_by_status: { available: number; rented: number; pending_return: number; maintenance: number };
  requests_by_status: {
    pending: number;
    approved: number;
    running: number;
    info_requested: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  rental_requests_trend: { month: string; count: number }[];
  top_rentals: { name: string; vehicles: number }[];
}

export const dashboardApi = {
  /** Aggregated admin dashboard counts (admin only). */
  stats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get('/admin/dashboard-stats/');
    return res.data as DashboardStats;
  },
};
