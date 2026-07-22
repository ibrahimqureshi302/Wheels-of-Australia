// Route constants - All route paths in one place
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_OTP: '/verify-otp',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  NOTIFICATIONS: '/notifications',
  NOT_FOUND: '/404',

  // Rental & fleet (Phase D / EPIC 3)
  RENTAL_REGISTER: '/rental/register',
  MECHANIC_REGISTER: '/mechanic/register',
  FLEET: '/fleet',
  FLEET_ADD: '/fleet/add',
  FLEET_EDIT: '/fleet/edit/:id',
  VEHICLES: '/vehicles',
  /** Vehicles offered by a specific rental (rentalId in params). */
  VEHICLES_RENTAL: '/vehicles/rental/:rentalId',
  RENTAL_REQUESTS: '/rental/requests',
  /** Driver: their own booking requests (all statuses). */
  MY_REQUESTS: '/my-requests',
  /** Driver: their trips (approved bookings). */
  MY_TRIPS: '/my-trips',

  // GPS & maintenance (Phase E / EPIC 4 & 5)
  LIVE_MAP: '/map',
  DISTANCE_SUMMARY: '/rental/distance',
  MAINTENANCE: '/maintenance',
  /** Mechanic: their sent quotes (cancel/delete). */
  MAINTENANCE_REQUESTS: '/maintenance/requests',
  /** Mechanic: repair history (accepted + completed jobs). */
  MAINTENANCE_HISTORY: '/maintenance/history',

  // Rental portal (main rental manages their staff)
  RENTAL: {
    STAFF: '/rental/staff',
    STAFF_ADD: '/rental/staff/add',
    STAFF_EDIT: '/rental/staff/edit/:id',
    /** Owner-only audit trail: which staff member did what. */
    ACTIVITY: '/rental/activity',
  },

  // Admin routes
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    SETTINGS: '/admin/settings',
    REGISTRATIONS: '/admin/registrations',
    DRIVERS: '/admin/drivers',
    DRIVERS_ADD: '/admin/drivers/add',
    DRIVERS_EDIT: '/admin/drivers/edit/:id',
    RENTALS: '/admin/rentals',
    RENTALS_ADD: '/admin/rentals/add',
    RENTALS_EDIT: '/admin/rentals/edit/:id',
    MECHANICS: '/admin/mechanics',
    MECHANICS_ADD: '/admin/mechanics/add',
    MECHANICS_EDIT: '/admin/mechanics/edit/:id',
    VEHICLES_ALL: '/admin/vehicles',
    VEHICLES_ADD: '/admin/vehicles/add',
    VEHICLES_EDIT: '/admin/vehicles/edit/:id',
    RENTAL_STAFF: '/admin/rental-staff',
    RENTAL_STAFF_ADD: '/admin/rental-staff/add',
    RENTAL_STAFF_EDIT: '/admin/rental-staff/edit/:id',
    /** System-wide audit trail across every rental. */
    ACTIVITY: '/admin/activity',
  },

  // Fleet path helpers (for edit link)
  FLEET_EDIT_BASE: '/fleet/edit',
  DRIVERS_EDIT_BASE: '/admin/drivers/edit',
  RENTALS_EDIT_BASE: '/admin/rentals/edit',
  MECHANICS_EDIT_BASE: '/admin/mechanics/edit',
  VEHICLES_EDIT_BASE: '/admin/vehicles/edit',
  RENTAL_STAFF_EDIT_BASE: '/rental/staff/edit',
  ADMIN_RENTAL_STAFF_EDIT_BASE: '/admin/rental-staff/edit',
} as const;

// Route labels for navigation
export const ROUTE_LABELS = {
  [ROUTES.HOME]: 'Home',
  [ROUTES.LOGIN]: 'Login',
  [ROUTES.REGISTER]: 'Driver sign up',
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.PROFILE]: 'Profile',
  [ROUTES.VERIFY_OTP]: 'Verify OTP',
  [ROUTES.RENTAL_REGISTER]: 'Rental registration',
  [ROUTES.FLEET]: 'Vehicle',
  [ROUTES.FLEET_ADD]: 'Add vehicle',
  [ROUTES.VEHICLES]: 'Rent a vehicle',
  [ROUTES.RENTAL_REQUESTS]: 'Rental requests',
  [ROUTES.MY_REQUESTS]: 'My requests',
  [ROUTES.MY_TRIPS]: 'My trips',
  [ROUTES.LIVE_MAP]: 'Live map',
  [ROUTES.DISTANCE_SUMMARY]: 'Distance & summary',
  [ROUTES.MAINTENANCE]: 'Maintenance',

  // Admin labels
  [ROUTES.ADMIN.DASHBOARD]: 'Admin Dashboard',
  [ROUTES.ADMIN.SETTINGS]: 'Settings',
  [ROUTES.ADMIN.REGISTRATIONS]: 'Registration requests',
  [ROUTES.ADMIN.DRIVERS]: 'Drivers',
  [ROUTES.ADMIN.DRIVERS_ADD]: 'Add driver',
  [ROUTES.ADMIN.DRIVERS_EDIT]: 'Edit driver',
  [ROUTES.ADMIN.RENTALS]: 'Rentals',
  [ROUTES.ADMIN.RENTALS_ADD]: 'Add rental',
  [ROUTES.ADMIN.RENTALS_EDIT]: 'Edit rental',
  [ROUTES.ADMIN.MECHANICS]: 'Mechanics',
  [ROUTES.ADMIN.MECHANICS_ADD]: 'Add mechanic',
  [ROUTES.ADMIN.MECHANICS_EDIT]: 'Edit mechanic',
  [ROUTES.ADMIN.VEHICLES_ALL]: 'Vehicles',
  [ROUTES.ADMIN.VEHICLES_ADD]: 'Add vehicle',
  [ROUTES.ADMIN.VEHICLES_EDIT]: 'Edit vehicle',
  [ROUTES.RENTAL.STAFF]: 'Rental staff',
  [ROUTES.RENTAL.STAFF_ADD]: 'Add staff',
  [ROUTES.RENTAL.STAFF_EDIT]: 'Edit staff',
  [ROUTES.RENTAL.ACTIVITY]: 'Activity log',
  [ROUTES.ADMIN.ACTIVITY]: 'Activity log',
} as const;

// Helper function to get route label
export const getRouteLabel = (route: string): string => {
  return ROUTE_LABELS[route as keyof typeof ROUTE_LABELS] || route;
};

/** Default dashboard/landing route per role after login. */
export function getDefaultRouteForRole(role: string | undefined): string {
  const r = role?.toLowerCase();
  if (r === 'admin') return ROUTES.ADMIN.DASHBOARD;
  // Mechanics, drivers and rentals all land on their dashboard.
  return ROUTES.DASHBOARD;
}

/**
 * The single role a path is gated to (mirrors `requiredRole` in AppRoutes),
 * or undefined when any authenticated user may access it.
 */
function requiredRoleForPath(pathname: string): string | undefined {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/vehicles') || pathname === ROUTES.MY_REQUESTS || pathname === ROUTES.MY_TRIPS) {
    return 'driver';
  }
  if (pathname.startsWith('/rental/staff') || pathname === ROUTES.RENTAL.ACTIVITY) return 'rental';
  if (pathname === ROUTES.MAINTENANCE_REQUESTS || pathname === ROUTES.MAINTENANCE_HISTORY) return 'mechanic';
  return undefined;
}

/**
 * Whether the user role may access this path. Used to decide if a post-login
 * `from` redirect is safe — prevents bouncing a user onto a role-restricted
 * page (e.g. a rental user onto a driver-only or admin route) which would
 * land them on the "Access denied" screen.
 */
export function isPathAllowedForRole(pathname: string | undefined, role: string | undefined): boolean {
  if (!pathname) return false;
  const r = role?.toLowerCase();
  if (r === 'admin') return true;
  const required = requiredRoleForPath(pathname);
  if (!required) return true;
  return r === required;
}

// Type for route paths
export type RoutePath = typeof ROUTES[keyof typeof ROUTES] |
  typeof ROUTES.ADMIN[keyof typeof ROUTES.ADMIN] |
  typeof ROUTES.RENTAL[keyof typeof ROUTES.RENTAL];
