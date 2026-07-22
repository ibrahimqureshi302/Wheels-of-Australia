import { apiClient } from '../../lib/api/client';
import type { Driver } from './types';
import type { RegistrationDocument } from '../registrations/api';

/** Shape returned by the backend admin drivers endpoint. */
interface ApiDriver {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  license_number: string;
  status: 'active' | 'inactive';
  suspension_reason?: string;
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

function mapDriver(d: ApiDriver): Driver {
  return {
    id: String(d.id),
    fullName: d.full_name,
    email: d.email,
    phone: d.phone,
    licenseNumber: d.license_number || undefined,
    status: d.status,
    suspensionReason: d.suspension_reason || '',
    documents: Array.isArray(d.documents) ? d.documents : [],
  };
}

/** Fields the admin can set when creating/editing a driver. */
export interface DriverInput {
  fullName: string;
  email: string;
  phone?: string;
  licenseNumber?: string;
  status: 'active' | 'inactive';
  /** Reason shown to the user; required by the backend when status is 'inactive'. */
  suspensionReason?: string;
  /** Required on create; leave undefined on edit to keep the current password. */
  password?: string;
}

function toPayload(input: Partial<DriverInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.fullName !== undefined) p.full_name = input.fullName;
  if (input.email !== undefined) p.email = input.email;
  if (input.phone !== undefined) p.phone = input.phone;
  if (input.licenseNumber !== undefined) p.license_number = input.licenseNumber;
  if (input.status !== undefined) p.status = input.status;
  if (input.suspensionReason !== undefined) p.suspension_reason = input.suspensionReason;
  if (input.password) p.password = input.password;
  return p;
}

export const driversApi = {
  /** List all drivers (admin only). */
  list: async (): Promise<Driver[]> => {
    const res = await apiClient.get('/admin/drivers/');
    return unwrapList<ApiDriver>(res.data).map(mapDriver);
  },
  /** Fetch a single driver by id. */
  get: async (id: string): Promise<Driver> => {
    const res = await apiClient.get(`/admin/drivers/${id}/`);
    return mapDriver(res.data as ApiDriver);
  },
  /** Create a new driver account (admin sets the password). */
  create: async (input: DriverInput): Promise<Driver> => {
    const res = await apiClient.post('/admin/drivers/', toPayload(input));
    return mapDriver(res.data as ApiDriver);
  },
  /** Update an existing driver. */
  update: async (id: string, input: Partial<DriverInput>): Promise<Driver> => {
    const res = await apiClient.patch(`/admin/drivers/${id}/`, toPayload(input));
    return mapDriver(res.data as ApiDriver);
  },
  /** Permanently delete a driver. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/drivers/${id}/`);
  },
};
