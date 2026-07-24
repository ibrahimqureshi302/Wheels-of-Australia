import { apiClient } from '../../lib/api/client';
import type { Rental, RentalStaffMember } from './types';
import type { RegistrationDocument } from '../registrations/api';

interface ApiRentalStaff {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  allowed_nav_paths: string[];
}

interface ApiRental {
  id: number;
  rental_type: 'company' | 'individual' | '';
  company_name: string;
  abn: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  suspension_reason?: string;
  minimum_rental_days: number | null;
  latitude: number | null;
  longitude: number | null;
  staff: ApiRentalStaff[];
  documents?: RegistrationDocument[];
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapStaff(s: ApiRentalStaff): RentalStaffMember {
  return {
    id: String(s.id),
    fullName: s.full_name,
    email: s.email,
    phone: s.phone,
    status: s.status,
    allowedNavPaths: Array.isArray(s.allowed_nav_paths) ? s.allowed_nav_paths : [],
  };
}

function mapRental(r: ApiRental): Rental {
  return {
    id: String(r.id),
    rentalType: r.rental_type === 'individual' ? 'individual' : 'company',
    companyName: r.company_name || undefined,
    abn: r.abn || undefined,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    status: r.status,
    suspensionReason: r.suspension_reason || '',
    minimumRentalDays: r.minimum_rental_days ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    staff: Array.isArray(r.staff) ? r.staff.map(mapStaff) : [],
    documents: Array.isArray(r.documents) ? r.documents : [],
  };
}

/** Fields the admin can set when creating/editing a rental. */
export interface RentalInput {
  rentalType: 'company' | 'individual';
  companyName?: string;
  abn?: string;
  contactName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  /** Reason shown to the user; required by the backend when status is 'inactive'. */
  suspensionReason?: string;
  minimumRentalDays?: number;
  /** Required on create; leave undefined on edit to keep the current password. */
  password?: string;
}

function toPayload(input: Partial<RentalInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.rentalType !== undefined) p.rental_type = input.rentalType;
  if (input.companyName !== undefined) p.company_name = input.companyName;
  if (input.abn !== undefined) p.abn = input.abn;
  if (input.contactName !== undefined) p.contact_name = input.contactName;
  if (input.email !== undefined) p.email = input.email;
  if (input.phone !== undefined) p.phone = input.phone;
  if (input.status !== undefined) p.status = input.status;
  if (input.suspensionReason !== undefined) p.suspension_reason = input.suspensionReason;
  if (input.minimumRentalDays !== undefined) p.minimum_rental_days = input.minimumRentalDays;
  if (input.password) p.password = input.password;
  return p;
}

export const rentalsApi = {
  /** List all rental owners (admin only). */
  list: async (): Promise<Rental[]> => {
    const res = await apiClient.get('/admin/rentals/');
    return unwrapList<ApiRental>(res.data).map(mapRental);
  },
  /** Fetch a single rental by id. */
  get: async (id: string): Promise<Rental> => {
    const res = await apiClient.get(`/admin/rentals/${id}/`);
    return mapRental(res.data as ApiRental);
  },
  /** Create a new rental account (admin sets the password). */
  create: async (input: RentalInput): Promise<Rental> => {
    const res = await apiClient.post('/admin/rentals/', toPayload(input));
    return mapRental(res.data as ApiRental);
  },
  /** Update an existing rental. */
  update: async (id: string, input: Partial<RentalInput>): Promise<Rental> => {
    const res = await apiClient.patch(`/admin/rentals/${id}/`, toPayload(input));
    return mapRental(res.data as ApiRental);
  },
  /** Permanently delete a rental. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/rentals/${id}/`);
  },
};
