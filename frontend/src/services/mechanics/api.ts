import { apiClient } from '../../lib/api/client';
import type { Mechanic } from './types';
import type { RegistrationDocument } from '../registrations/api';

interface ApiMechanic {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  shop_name: string;
  shop_address: string;
  abn: string;
  status: 'active' | 'inactive';
  suspension_reason?: string;
  documents?: RegistrationDocument[];
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapMechanic(m: ApiMechanic): Mechanic {
  return {
    id: String(m.id),
    fullName: m.full_name,
    email: m.email,
    phone: m.phone,
    shopName: m.shop_name,
    shopAddress: m.shop_address || undefined,
    abn: m.abn || undefined,
    status: m.status,
    suspensionReason: m.suspension_reason || '',
    documents: Array.isArray(m.documents) ? m.documents : [],
  };
}

/** Fields the admin can set when creating/editing a mechanic. */
export interface MechanicInput {
  fullName: string;
  email: string;
  phone?: string;
  shopName?: string;
  shopAddress?: string;
  abn?: string;
  status: 'active' | 'inactive';
  /** Reason shown to the user; required by the backend when status is 'inactive'. */
  suspensionReason?: string;
  /** Required on create; leave undefined on edit to keep the current password. */
  password?: string;
}

function toPayload(input: Partial<MechanicInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.fullName !== undefined) p.full_name = input.fullName;
  if (input.email !== undefined) p.email = input.email;
  if (input.phone !== undefined) p.phone = input.phone;
  if (input.shopName !== undefined) p.shop_name = input.shopName;
  if (input.shopAddress !== undefined) p.shop_address = input.shopAddress;
  if (input.abn !== undefined) p.abn = input.abn;
  if (input.status !== undefined) p.status = input.status;
  if (input.suspensionReason !== undefined) p.suspension_reason = input.suspensionReason;
  if (input.password) p.password = input.password;
  return p;
}

export const mechanicsApi = {
  /** List all mechanics (admin only). */
  list: async (): Promise<Mechanic[]> => {
    const res = await apiClient.get('/admin/mechanics/');
    return unwrapList<ApiMechanic>(res.data).map(mapMechanic);
  },
  /** Fetch a single mechanic by id. */
  get: async (id: string): Promise<Mechanic> => {
    const res = await apiClient.get(`/admin/mechanics/${id}/`);
    return mapMechanic(res.data as ApiMechanic);
  },
  /** Create a new mechanic account (admin sets the password). */
  create: async (input: MechanicInput): Promise<Mechanic> => {
    const res = await apiClient.post('/admin/mechanics/', toPayload(input));
    return mapMechanic(res.data as ApiMechanic);
  },
  /** Update an existing mechanic. */
  update: async (id: string, input: Partial<MechanicInput>): Promise<Mechanic> => {
    const res = await apiClient.patch(`/admin/mechanics/${id}/`, toPayload(input));
    return mapMechanic(res.data as ApiMechanic);
  },
  /** Permanently delete a mechanic. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/mechanics/${id}/`);
  },
};
