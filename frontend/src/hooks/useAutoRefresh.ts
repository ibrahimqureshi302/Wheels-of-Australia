import { useEffect, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';

const POLL_INTERVAL_MS = 25000;

/**
 * Keep a page's data synchronised with the backend without a manual reload.
 *
 * Calls `reload` on a steady interval AND immediately whenever a new
 * notification arrives (a signal that something changed somewhere in the
 * system). Used by the admin panel so a driver/rental/mechanic action is
 * reflected automatically.
 *
 * `reload` may be redefined on every render; it's tracked via a ref so the
 * interval doesn't reset and callers don't need to memoise it.
 */
export function useAutoRefresh(reload: () => void): void {
  const { latestNotificationId } = useNotifications();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Refresh as soon as a new notification shows up (skips the initial mount,
  // where the page has just loaded its own data).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    reloadRef.current();
  }, [latestNotificationId]);

  // Steady-state polling as a fallback for events that don't notify.
  useEffect(() => {
    const id = setInterval(() => reloadRef.current(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
