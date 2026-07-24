/**
 * RBAC roles aligned with requirement.md (EPIC 1).
 * API may return role with different casing; normalize to lowercase for comparison.
 */
export type AppRole = 'admin' | 'driver' | 'rental' | 'mechanic';

export const ROLES: Record<AppRole, string> = {
  admin: 'Admin',
  driver: 'Driver',
  rental: 'Rental',
  mechanic: 'Mechanic',
};

/** Normalize API role string to AppRole (lowercase). Returns undefined if not a known role. */
export function normalizeRole(role: string | undefined): AppRole | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'driver' || r === 'rental' || r === 'mechanic') return r as AppRole;
  return undefined;
}

/** Check if user has at least one of the given roles. */
export function hasRole(userRole: string | undefined, allowedRoles: AppRole[]): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  return allowedRoles.includes(normalized);
}

/** Admin has access to everything. */
export function canAccess(userRole: string | undefined, allowedRoles: AppRole[]): boolean {
  const normalized = normalizeRole(userRole);
  if (!normalized) return false;
  if (normalized === 'admin') return true;
  return allowedRoles.includes(normalized);
}
