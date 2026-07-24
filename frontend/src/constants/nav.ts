import type { AppRole } from './roles';
import { hasRole } from './roles';
import { ROUTES } from './routes';

export interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  allowedRoles: AppRole[];
}

/** User-like shape for nav filtering (role + optional allowed_nav_paths for rental staff). */
export interface UserForNav {
  role?: string;
  allowed_nav_paths?: string[];
}

/**
 * Flat registry of every sidebar destination (one entry per unique path).
 *
 * `allowedRoles` is used by the rental-staff "grantable menus" pickers; the
 * actual per-role sidebar ORDER lives in `ROLE_NAV_ORDER` below.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: ROUTES.DASHBOARD, labelKey: 'navigation.dashboard', icon: 'Dashboard', allowedRoles: ['admin', 'driver', 'rental', 'mechanic'] },
  { path: ROUTES.ADMIN.REGISTRATIONS, labelKey: 'navigation.registrations', icon: 'HowToReg', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.RENTALS, labelKey: 'navigation.rentals', icon: 'Business', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.RENTAL_STAFF, labelKey: 'navigation.rentalStaffAdmin', icon: 'People', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.DRIVERS, labelKey: 'navigation.drivers', icon: 'People', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.MECHANICS, labelKey: 'navigation.mechanics', icon: 'Build', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.VEHICLES_ALL, labelKey: 'navigation.vehiclesAdmin', icon: 'DirectionsCar', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.ACTIVITY, labelKey: 'navigation.activityLog', icon: 'History', allowedRoles: ['admin'] },
  { path: ROUTES.ADMIN.SETTINGS, labelKey: 'navigation.systemSettings', icon: 'Tune', allowedRoles: ['admin'] },
  { path: ROUTES.RENTAL.STAFF, labelKey: 'navigation.rentalStaff', icon: 'People', allowedRoles: ['rental'] },
  { path: ROUTES.RENTAL.ACTIVITY, labelKey: 'navigation.activityLog', icon: 'History', allowedRoles: ['rental'] },
  { path: ROUTES.FLEET, labelKey: 'navigation.fleet', icon: 'DirectionsCar', allowedRoles: ['rental'] },
  { path: ROUTES.RENTAL_REQUESTS, labelKey: 'navigation.rentalRequests', icon: 'RequestQuote', allowedRoles: ['rental'] },
  { path: ROUTES.VEHICLES, labelKey: 'navigation.vehicles', icon: 'Inventory', allowedRoles: ['driver'] },
  { path: ROUTES.MY_REQUESTS, labelKey: 'navigation.myRequests', icon: 'RequestQuote', allowedRoles: ['driver'] },
  { path: ROUTES.MY_TRIPS, labelKey: 'navigation.myTrips', icon: 'Route', allowedRoles: ['driver'] },
  { path: ROUTES.LIVE_MAP, labelKey: 'navigation.liveMap', icon: 'Map', allowedRoles: ['rental', 'driver'] },
  { path: ROUTES.MAINTENANCE, labelKey: 'navigation.maintenance', icon: 'Build', allowedRoles: ['rental', 'mechanic'] },
  { path: ROUTES.MAINTENANCE_HISTORY, labelKey: 'navigation.vehicleRepair', icon: 'Build', allowedRoles: ['mechanic'] },
  { path: ROUTES.MAINTENANCE_REQUESTS, labelKey: 'navigation.myRequests', icon: 'RequestQuote', allowedRoles: ['mechanic'] },
  { path: ROUTES.NOTIFICATIONS, labelKey: 'navigation.notifications', icon: 'NotificationsActive', allowedRoles: ['admin', 'driver', 'rental', 'mechanic'] },
  { path: ROUTES.PROFILE, labelKey: 'navigation.profile', icon: 'AccountCircle', allowedRoles: ['admin', 'driver', 'rental', 'mechanic'] },
];

/**
 * The exact sidebar order shown for each role (list of paths). This is the
 * single source of truth for what each role sees and in which order.
 */
export const ROLE_NAV_ORDER: Record<AppRole, string[]> = {
  admin: [
    ROUTES.DASHBOARD,
    ROUTES.ADMIN.REGISTRATIONS,
    ROUTES.ADMIN.RENTALS,
    ROUTES.ADMIN.RENTAL_STAFF,
    ROUTES.ADMIN.DRIVERS,
    ROUTES.ADMIN.MECHANICS,
    ROUTES.ADMIN.VEHICLES_ALL,
    ROUTES.ADMIN.ACTIVITY,
    ROUTES.NOTIFICATIONS,
    ROUTES.PROFILE,
    ROUTES.ADMIN.SETTINGS,
  ],
  rental: [
    ROUTES.DASHBOARD,
    ROUTES.FLEET,
    ROUTES.RENTAL.STAFF,
    ROUTES.RENTAL.ACTIVITY,
    ROUTES.RENTAL_REQUESTS,
    ROUTES.MAINTENANCE,
    ROUTES.LIVE_MAP,
    ROUTES.NOTIFICATIONS,
    ROUTES.PROFILE,
  ],
  driver: [
    ROUTES.DASHBOARD,
    ROUTES.MY_TRIPS,
    ROUTES.VEHICLES,
    ROUTES.MY_REQUESTS,
    ROUTES.NOTIFICATIONS,
    ROUTES.LIVE_MAP,
    ROUTES.PROFILE,
  ],
  mechanic: [
    ROUTES.DASHBOARD,
    ROUTES.MAINTENANCE_HISTORY,
    ROUTES.MAINTENANCE,
    ROUTES.MAINTENANCE_REQUESTS,
    ROUTES.NOTIFICATIONS,
    ROUTES.PROFILE,
  ],
};

/**
 * Sidebar destinations a rental OWNER can grant to a staff sub-account. Excludes
 * the owner-only tools (staff management and the activity log), which staff must
 * never access, and Profile, which every staff member always keeps regardless of
 * grants. Everything else — including Dashboard and Notifications — is grantable,
 * so the owner explicitly decides which modules each staff member can see. Used
 * by every rental-staff add/edit form's menu picker.
 */
export const GRANTABLE_RENTAL_NAV: NavItem[] = NAV_ITEMS.filter(
  (item) => item.allowedRoles.includes('rental')
    && item.path !== ROUTES.RENTAL.STAFF
    && item.path !== ROUTES.RENTAL.ACTIVITY
    && item.path !== ROUTES.PROFILE,
);

/**
 * Paths a rental staff member may always reach, regardless of their grants.
 * Only Profile — it's the account's own page (needed for the first-login
 * password change and shown when suspended), not a business module. Every other
 * destination, including Dashboard and Notifications, must be explicitly granted.
 */
const STAFF_ALWAYS_ALLOWED: string[] = [ROUTES.PROFILE];

/**
 * Whether a rental STAFF member (with the given granted nav paths) may open
 * `pathname`. Used by the route guard so a staff member can't reach a section
 * they weren't granted by typing its URL directly — not just hide it in the nav.
 *
 * Rules: Profile is always allowed; the owner-only tools (staff management +
 * activity log) are never allowed; every other section — including Dashboard and
 * Notifications — must be in the staff member's grants; and a granted top-level
 * path also covers its sub-routes (granting `/fleet` allows `/fleet/add` and
 * `/fleet/edit/:id`).
 */
export function isStaffPathAllowed(allowedPaths: string[], pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  // Owner-only tools are off-limits to staff, even if somehow present in grants.
  if (path === ROUTES.RENTAL.STAFF || path.startsWith(ROUTES.RENTAL.STAFF + '/')) return false;
  if (path === ROUTES.RENTAL.ACTIVITY) return false;
  const allowed = [...STAFF_ALWAYS_ALLOWED, ...allowedPaths];
  return allowed.some((p) => path === p || path.startsWith(p + '/'));
}

function normalizeNavRole(role: string | undefined): AppRole {
  const r = (role || '').trim().toLowerCase();
  if (r === 'admin' || r === 'rental' || r === 'mechanic') return r;
  return 'driver';
}

/**
 * Returns nav items visible to the user, in the order defined by
 * `ROLE_NAV_ORDER`. Rental staff (allowed_nav_paths set) see only their granted
 * paths + Profile (always available), in the rental order; the owner-only tools
 * (staff management + activity log) are always hidden from them.
 */
export function getVisibleNavItems(user: UserForNav | null | undefined, items: NavItem[]): NavItem[] {
  const role = normalizeNavRole(user?.role);
  const byPath = new Map(items.map((item) => [item.path, item]));
  const paths = user?.allowed_nav_paths;

  // Rental staff: restricted to their granted paths (+ Profile, always allowed).
  // Dashboard and Notifications are NOT implied — they must be explicitly granted.
  // The owner-only tools (staff management + activity log) are never shown.
  if (role === 'rental' && paths && paths.length > 0) {
    const allowed = new Set([...STAFF_ALWAYS_ALLOWED, ...paths]);
    return ROLE_NAV_ORDER.rental
      .filter((p) => allowed.has(p) && p !== ROUTES.RENTAL.STAFF && p !== ROUTES.RENTAL.ACTIVITY)
      .map((p) => byPath.get(p))
      .filter((item): item is NavItem => !!item);
  }

  const ordered = ROLE_NAV_ORDER[role]
    .map((p) => byPath.get(p))
    .filter((item): item is NavItem => !!item && hasRole(role, item.allowedRoles));

  return ordered.length > 0 ? ordered : items.filter((item) => item.path === ROUTES.DASHBOARD);
}

/**
 * Whether this user may use the Notifications module — the /notifications page,
 * the header bell, and the notification poll. Rental staff need the
 * `/notifications` grant; every other user (rental owners, drivers, mechanics,
 * admins) always can.
 */
export function canUseNotifications(user: UserForNav | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const paths = user.allowed_nav_paths;
  if (role === 'rental' && paths && paths.length > 0) {
    return isStaffPathAllowed(paths, ROUTES.NOTIFICATIONS);
  }
  return true;
}

/**
 * Where a user should land after login. Rental staff go to their first visible
 * granted destination (in sidebar order) — Dashboard if granted, else the first
 * granted module, falling back to Profile when nothing else is available — so a
 * staff member without a Dashboard grant isn't dropped onto an Access-denied
 * screen. Everyone else uses their role default.
 */
export function landingPathForUser(user: UserForNav | null | undefined, roleDefault: string): string {
  const role = (user?.role || '').toLowerCase();
  const paths = user?.allowed_nav_paths;
  if (role === 'rental' && paths && paths.length > 0) {
    const items = getVisibleNavItems(user, NAV_ITEMS);
    return items.length > 0 ? items[0].path : ROUTES.PROFILE;
  }
  return roleDefault;
}
