import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Notification } from '../services/notifications/types';
import { notificationsApi } from '../services/notifications/api';
import { canUseNotifications } from '../constants/nav';
import { useAuth } from './hooks';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  /** Delete a single notification (optimistic; persisted to the backend). */
  deleteNotification: (id: string) => void;
  /** Re-fetch from the backend. */
  refresh: () => void;
  /** Id of the newest notification (notifications are newest-first). Changes
   * when a new event arrives — admin pages watch it to live-refresh their data. */
  latestNotificationId: string | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const isDriver = role === 'driver';
  const isRental = role === 'rental';
  const isMechanic = role === 'mechanic';
  // Rental staff only get notifications when granted the /notifications module;
  // without it the bell is hidden and the backend rejects the calls, so skip the
  // fetch entirely to avoid needless 403s.
  const canNotify = canUseNotifications(user);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications whenever auth state changes: the backend for signed-in
  // users, empty when signed out. For drivers we first ask the backend to
  // generate any due vehicle reminders (lazy, deduped).
  const refresh = useCallback(() => {
    if (!isAuthenticated || user?.is_suspended || !canNotify) {
      // Suspended users are locked to their profile and ungranted staff can't
      // read notifications; the backend rejects those calls, so don't fetch.
      setNotifications([]);
      return;
    }
    const ready = isDriver
      ? notificationsApi.syncDriverReminders()
      : isRental
        ? notificationsApi.syncRentalReminders()
        : isMechanic
          ? notificationsApi.syncMechanicReminders()
          : Promise.resolve();
    ready.then(() =>
      notificationsApi
        .list()
        .then(setNotifications)
        .catch(() => setNotifications([])),
    );
  }, [isAuthenticated, user?.is_suspended, canNotify, isDriver, isRental, isMechanic]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll so the bell, the notifications page and (via the newest-id signal
  // below) the admin panel stay current without a manual reload.
  useEffect(() => {
    if (!isAuthenticated || user?.is_suspended || !canNotify) return;
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh, isAuthenticated, user?.is_suspended, canNotify]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationsApi.markRead(id).catch(() => { /* leave optimistic state */ });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationsApi.markAllRead().catch(() => { /* leave optimistic state */ });
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationsApi.remove(id).catch(() => { /* leave optimistic state */ });
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const latestNotificationId = notifications.length ? notifications[0].id : null;

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, refresh, latestNotificationId }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, refresh, latestNotificationId]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextType {
  const ctx = React.useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}

export { NotificationContext };
