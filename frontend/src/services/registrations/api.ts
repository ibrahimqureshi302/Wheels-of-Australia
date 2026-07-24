import { apiClient } from '../../lib/api/client';

/** Roles that can self-register through the public site. */
export type RegistrationRole = 'driver' | 'rental' | 'mechanic';

/** Files that may accompany a registration, keyed by the backend document field name. */
export interface RegistrationFiles {
  license?: File | null;
  passport?: File | null;
  cnic?: File | null;
  certificate?: File | null;
  shop_image?: File | null;
}

export interface RegistrationPayload {
  role: RegistrationRole;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  // rental
  rental_type?: 'company' | 'individual';
  company_name?: string;
  abn?: string;
  // mechanic
  shop_name?: string;
  shop_address?: string;
  // anything else
  extra?: Record<string, unknown>;
  files?: RegistrationFiles;
}

export interface RegistrationResponse {
  id: number;
  status: string;
  detail: string;
}

/** A parsed validation error from the registration endpoint. */
export interface RegistrationError {
  message: string;
  /** field name -> first error message (e.g. { email: 'An account ... already exists.' }) */
  fieldErrors: Record<string, string>;
}

const FILE_KEYS: (keyof RegistrationFiles)[] = [
  'license',
  'passport',
  'cnic',
  'certificate',
  'shop_image',
];

const SCALAR_KEYS: (keyof RegistrationPayload)[] = [
  'role',
  'email',
  'first_name',
  'last_name',
  'phone_number',
  'rental_type',
  'company_name',
  'abn',
  'shop_name',
  'shop_address',
];

function buildFormData(payload: RegistrationPayload): FormData {
  const form = new FormData();

  for (const key of SCALAR_KEYS) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  }

  if (payload.extra && Object.keys(payload.extra).length > 0) {
    form.append('extra', JSON.stringify(payload.extra));
  }

  if (payload.files) {
    for (const key of FILE_KEYS) {
      const file = payload.files[key];
      if (file) form.append(key, file, file.name);
    }
  }

  return form;
}

/** Turn an axios error into a friendly RegistrationError with per-field messages. */
function parseError(error: unknown): RegistrationError {
  const fieldErrors: Record<string, string> = {};
  let message = 'Registration failed. Please try again.';

  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (typeof obj.detail === 'string') message = obj.detail;
      for (const [field, value] of Object.entries(obj)) {
        if (field === 'detail') continue;
        const first = Array.isArray(value) ? value[0] : value;
        if (first != null) fieldErrors[field] = String(first);
      }
      // Surface the most relevant field error as the main message.
      const firstField = Object.values(fieldErrors)[0];
      if (firstField) message = firstField;
    }
  }

  return { message, fieldErrors };
}

/** Status of a registration request in the admin review workflow. */
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

/** An uploaded document attached to a registration (ID, certificate, shop photo, ...). */
export interface RegistrationDocument {
  id: number;
  doc_type: string;
  doc_type_display: string;
  file_url: string | null;
  original_name: string;
  uploaded_at: string;
}

/** Full registration request as seen by an admin reviewer. */
export interface RegistrationDetail {
  id: number;
  role: RegistrationRole;
  role_display: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  rental_type: string;
  company_name: string;
  abn: string;
  shop_name: string;
  shop_address: string;
  extra: Record<string, unknown> | null;
  status: RegistrationStatus;
  status_display: string;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
  documents: RegistrationDocument[];
}

/** DRF list endpoints may be paginated ({results: [...]}) or return a bare array. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export const registrationApi = {
  /**
   * Submit a pending registration (driver / rental / mechanic) with optional
   * document uploads. No account is created until an admin approves it.
   */
  submit: async (payload: RegistrationPayload): Promise<RegistrationResponse> => {
    try {
      const form = buildFormData(payload);
      const response = await apiClient.post<RegistrationResponse>(
        '/auth/registrations/',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (error) {
      throw parseError(error);
    }
  },
};

/** Admin-only registration review API (list / approve / reject). */
export const adminRegistrationApi = {
  /** List registration requests, optionally filtered by status. */
  list: async (status?: RegistrationStatus): Promise<RegistrationDetail[]> => {
    try {
      const response = await apiClient.get('/auth/registrations/admin/', {
        params: status ? { status } : undefined,
      });
      return unwrapList<RegistrationDetail>(response.data);
    } catch (error) {
      throw parseError(error);
    }
  },

  /** Approve a request: creates the account, generates a password, emails the applicant. */
  approve: async (id: number): Promise<RegistrationDetail> => {
    try {
      const response = await apiClient.post<RegistrationDetail>(
        `/auth/registrations/admin/${id}/approve/`
      );
      return response.data;
    } catch (error) {
      throw parseError(error);
    }
  },

  /** Reject a request with a reason, which is emailed to the applicant. */
  reject: async (id: number, reason: string): Promise<RegistrationDetail> => {
    try {
      const response = await apiClient.post<RegistrationDetail>(
        `/auth/registrations/admin/${id}/reject/`,
        { reason }
      );
      return response.data;
    } catch (error) {
      throw parseError(error);
    }
  },

  /** Permanently delete a registration request (and its uploaded documents). */
  remove: async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/auth/registrations/admin/${id}/`);
    } catch (error) {
      throw parseError(error);
    }
  },
};
