import { ROUTES } from '../../constants/routes';
import type { Notification } from './types';

/**
 * Resolve where a notification should navigate for the given user role, with a
 * `highlight` query param so the destination page can flash/scroll to the exact
 * record and show what happened to it.
 *
 * Clicking a notification lands on the relevant SECTION/LIST page for that
 * entity (never an edit form). The `highlight` / `hlAction` params let that page
 * show a banner explaining which record the notification was about and what
 * happened to it. Routing is role-aware: a vehicle notification takes an admin
 * to the admin vehicles list and a rental owner to their fleet list. Returns
 * null when the entity has no page for this role — the caller then falls back to
 * the notification's plain `link`.
 */
export function resolveNotificationTarget(n: Notification, role: string | undefined): string | null {
  const r = (role || '').toLowerCase();
  const id = n.entityId;

  const hl = (path: string, highlightId?: string): string => {
    const params = new URLSearchParams();
    if (highlightId) params.set('highlight', highlightId);
    if (n.action) params.set('hlAction', n.action);
    params.set('notif', n.id);
    return `${path}?${params.toString()}`;
  };

  // Location-tracking warnings always send the driver to the Live map, where
  // they can re-enable location for their active rental. This overrides any
  // stale stored `link` on older notification rows (which pointed at My trips).
  if (n.type === 'location_warning') return hl(ROUTES.LIVE_MAP);

  // Any maintenance notification (quote, work-done, return, etc.) for the rental
  // owner belongs on the Maintenance page — that's where they accept quotes and
  // confirm returns. Keyed on the display TYPE (not entityType) so it also fixes
  // older rows still tagged entity_type='vehicle' (which would otherwise route to
  // the Fleet page). highlight uses the row's entityId — a maintenance-job id on
  // new rows (flashes the job), a vehicle id on legacy rows (just lands the page).
  if (n.type === 'maintenance' && r === 'rental') return hl(ROUTES.MAINTENANCE, id);

  // A mechanic's maintenance notifications (quote accepted/declined, info
  // requested, job closed/returned) all concern a job that appears in their
  // "My requests" list — send them there and flash the exact job.
  if (n.type === 'maintenance' && r === 'mechanic') return hl(ROUTES.MAINTENANCE_REQUESTS, id);

  // Staff-action notifications tell an owner what one of their staff did. The
  // backend stores the exact destination section in `link` (Maintenance,
  // Requests, Staff, Fleet…). Honour that link (with a highlight) rather than
  // guessing from entity_type — otherwise a maintenance action tagged
  // entity_type='vehicle' would wrongly route the owner to the Fleet list.
  if (n.type === 'staff' && n.link) return id ? hl(n.link, id) : n.link;

  switch (n.entityType) {
    case 'vehicle':
      if (r === 'admin') return hl(ROUTES.ADMIN.VEHICLES_ALL, id);
      if (r === 'rental') return hl(ROUTES.FLEET, id);
      return null;
    case 'driver':
      if (r === 'admin') return hl(ROUTES.ADMIN.DRIVERS, id);
      return null;
    case 'rental':
      if (r === 'admin') return hl(ROUTES.ADMIN.RENTALS, id);
      return null;
    case 'mechanic':
      if (r === 'admin') return hl(ROUTES.ADMIN.MECHANICS, id);
      return null;
    case 'rental_staff':
      if (r === 'admin') return hl(ROUTES.ADMIN.RENTAL_STAFF, id);
      if (r === 'rental') return hl(ROUTES.RENTAL.STAFF, id);
      return null;
    case 'registration':
      if (r === 'admin') return hl(ROUTES.ADMIN.REGISTRATIONS, id);
      return null;
    case 'booking':
      // No per-record admin page; route to the role's requests list.
      if (r === 'rental') return hl(ROUTES.RENTAL_REQUESTS, id);
      if (r === 'driver') return hl(ROUTES.MY_REQUESTS, id);
      return null;
    case 'maintenance':
      return hl(ROUTES.MAINTENANCE, id);
    default:
      return null;
  }
}
