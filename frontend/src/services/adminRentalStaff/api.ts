import { apiClient } from '../../lib/api/client';
import type { AdminRentalStaff, AdminRentalStaffInput } from './types';
import type { RegistrationDocument } from '../registrations/api';

/** Shape returned by the backend admin rental-staff endpoint. */
interface ApiRentalStaff {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  suspension_reason?: string;
  allowed_nav_paths: string[];
  rental_id: number | null;
  rental_name: string;
  documents?: RegistrationDocument[];
}

/** DRF list responses may be paginated ({results}) or a bare array. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapStaff(s: ApiRentalStaff): AdminRentalStaff {
  return {
    id: String(s.id),
    fullName: s.full_name,
    email: s.email,
    phone: s.phone,
    status: s.status,
    suspensionReason: s.suspension_reason || '',
    allowedNavPaths: Array.isArray(s.allowed_nav_paths) ? s.allowed_nav_paths : [],
    rentalId: s.rental_id != null ? String(s.rental_id) : null,
    rentalName: s.rental_name || '',
    documents: Array.isArray(s.documents) ? s.documents : [],
  };
}

function toPayload(input: Partial<AdminRentalStaffInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.fullName !== undefined) p.full_name = input.fullName;
  if (input.email !== undefined) p.email = input.email;
  if (input.phone !== undefined) p.phone = input.phone;
  if (input.status !== undefined) p.status = input.status;
  if (input.suspensionReason !== undefined) p.suspension_reason = input.suspensionReason;
  if (input.allowedNavPaths !== undefined) p.allowed_nav_paths = input.allowedNavPaths;
  if (input.rentalId !== undefined) p.rental = Number(input.rentalId);
  if (input.password) p.password = input.password;
  return p;
}

export const adminRentalStaffApi = {
  /** List every rental's staff (admin only). */
  list: async (): Promise<AdminRentalStaff[]> => {
    const res = await apiClient.get('/admin/rental-staff/');
    return unwrapList<ApiRentalStaff>(res.data).map(mapStaff);
  },
  /** Fetch a single staff member by id. */
  get: async (id: string): Promise<AdminRentalStaff> => {
    const res = await apiClient.get(`/admin/rental-staff/${id}/`);
    return mapStaff(res.data as ApiRentalStaff);
  },
  /** Create a staff member assigned to a rental (admin sets the password). */
  create: async (input: AdminRentalStaffInput): Promise<AdminRentalStaff> => {
    const res = await apiClient.post('/admin/rental-staff/', toPayload(input));
    return mapStaff(res.data as ApiRentalStaff);
  },
  /** Update an existing staff member. */
  update: async (id: string, input: Partial<AdminRentalStaffInput>): Promise<AdminRentalStaff> => {
    const res = await apiClient.patch(`/admin/rental-staff/${id}/`, toPayload(input));
    return mapStaff(res.data as ApiRentalStaff);
  },
  /** Permanently delete a staff member. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/rental-staff/${id}/`);
  },
};
