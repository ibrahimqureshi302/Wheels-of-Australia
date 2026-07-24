import { apiClient } from '../../lib/api/client';
import type { Notification, NotificationType, NotificationEntityType } from './types';

/** Shape returned by the backend in-app notifications endpoint. */
interface ApiNotification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  registration: number | null;
  link: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  actor_name?: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

/** Map the backend notification_type to a frontend display type. */
function mapType(backendType: string): NotificationType {
  if (backendType === 'new_registration') return 'registration';
  if (backendType === 'rental_staff_created') return 'staff';
  if (backendType === 'staff_action') return 'staff';
  if (backendType === 'vehicle_rented') return 'vehicle_rented';
  if (backendType === 'rental_decision') return 'rental_decision';
  if (backendType === 'oil') return 'oil';
  if (backendType === 'payment') return 'payment';
  if (backendType === 'rego') return 'rego';
  if (backendType === 'location_disabled') return 'location_disabled';
  if (backendType === 'location_warning') return 'location_warning';
  if (backendType === 'suspension' || backendType === 'location_suspended') return 'suspension';
  if (backendType === 'rental_return') return 'rental_decision';
  if (backendType.startsWith('maintenance_')) return 'maintenance';
  return 'system';
}

function mapNotification(n: ApiNotification): Notification {
  return {
    id: String(n.id),
    type: mapType(n.notification_type),
    title: n.title,
    message: n.message || undefined,
    createdAt: n.created_at,
    read: n.is_read,
    entityType: (n.entity_type || '') as NotificationEntityType,
    entityId: n.entity_id || (n.registration != null ? String(n.registration) : undefined),
    action: n.action || undefined,
    actorName: n.actor_name || undefined,
    link: n.link || undefined,
  };
}

export const notificationsApi = {
  /** List the current user's in-app notifications (newest first). */
  list: async (): Promise<Notification[]> => {
    const res = await apiClient.get('/auth/notifications/');
    return unwrapList<ApiNotification>(res.data).map(mapNotification);
  },
  /** Mark a single notification as read. */
  markRead: async (id: string): Promise<void> => {
    await apiClient.post(`/auth/notifications/${id}/mark-read/`);
  },
  /** Mark every notification as read. */
  markAllRead: async (): Promise<void> => {
    await apiClient.post('/auth/notifications/mark-all-read/');
  },
  /** Delete a single notification. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/auth/notifications/${id}/`);
  },
  /** Driver-only: lazily generate any due vehicle reminders (oil/rego expiry).
   * Safe to call on every app open; the backend de-duplicates. Non-fatal. */
  syncDriverReminders: async (): Promise<void> => {
    try {
      await apiClient.post('/driver/reminders/sync/');
    } catch {
      /* non-fatal — reminders just won't refresh this time */
    }
  },
  /** Rental-only: lazily generate any due fleet reminders (oil/rego expiry) for
   * the rental owner. Safe to call on every app open; the backend de-duplicates. */
  syncRentalReminders: async (): Promise<void> => {
    try {
      await apiClient.post('/rental/reminders/sync/');
    } catch {
      /* non-fatal — reminders just won't refresh this time */
    }
  },
  /** Mechanic-only: lazily generate any overdue-maintenance reminders (jobs the
   * mechanic hasn't marked complete past the agreed time). Deduped per day. */
  syncMechanicReminders: async (): Promise<void> => {
    try {
      await apiClient.post('/maintenance-requests/sync-reminders/');
    } catch {
      /* non-fatal — reminders just won't refresh this time */
    }
  },
};
