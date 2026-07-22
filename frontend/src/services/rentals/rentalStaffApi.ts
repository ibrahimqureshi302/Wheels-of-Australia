import { apiClient } from '../../lib/api/client';
import type {
  RentalPortalStaffEntry,
  RentalStaffStatus,
  AddRentalPortalStaffInput,
} from './rentalStaffTypes';

/**
 * Real backend client for a rental owner's staff (DRF `rental-staff` viewset).
 *
 * Each item id is prefixed ('u<userId>'). Creating a staff member creates the
 * account immediately (no admin approval): the owner sets the login password,
 * so the staff member can sign in straight away.
 */
interface ApiStaffItem {
  id: string;
  kind: 'staff' | 'request';
  user_id: number | null;
  request_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  allowed_nav_paths: string[];
  status: RentalStaffStatus;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapStaff(s: ApiStaffItem): RentalPortalStaffEntry {
  return {
    id: s.id,
    userId: s.user_id ?? 0,
    parentRentalUserId: 0, // backend scopes by the authenticated owner; not needed client-side
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email,
    phone: s.phone_number,
    allowedNavPaths: Array.isArray(s.allowed_nav_paths) ? s.allowed_nav_paths : [],
    status: s.status,
  };
}

export interface UpdateRentalStaffInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  allowedNavPaths?: string[];
}

function toUpdatePayload(patch: UpdateRentalStaffInput): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (patch.firstName !== undefined) p.first_name = patch.firstName;
  if (patch.lastName !== undefined) p.last_name = patch.lastName;
  if (patch.phone !== undefined) p.phone_number = patch.phone;
  if (patch.allowedNavPaths !== undefined) p.allowed_nav_paths = patch.allowedNavPaths;
  return p;
}

export const rentalStaffApi = {
  /** List the owner's staff (active accounts + pending requests). */
  list: async (): Promise<RentalPortalStaffEntry[]> => {
    const res = await apiClient.get('/rental-staff/');
    return unwrapList<ApiStaffItem>(res.data).map(mapStaff);
  },

  /** Create a staff account directly. The owner-set password lets the staff log in immediately. */
  add: async (input: AddRentalPortalStaffInput): Promise<RentalPortalStaffEntry> => {
    const res = await apiClient.post('/rental-staff/', {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email.trim(),
      phone_number: input.phone.trim(),
      password: input.password,
      allowed_nav_paths: input.allowedNavPaths,
    });
    return mapStaff(res.data as ApiStaffItem);
  },

  /** Edit a staff member's allowed pages / name / phone (works for active and pending). */
  update: async (id: string, patch: UpdateRentalStaffInput): Promise<RentalPortalStaffEntry> => {
    const res = await apiClient.patch(`/rental-staff/${id}/`, toUpdatePayload(patch));
    return mapStaff(res.data as ApiStaffItem);
  },

  /** Remove a staff account, or cancel a pending request. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/rental-staff/${id}/`);
  },
};
