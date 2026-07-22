import { apiClient } from '../../lib/api/client';
import type { RegistrationDocument } from '../registrations/api';

/** Role-specific profile details returned by `GET /auth/me/`. Only the keys
 *  relevant to the user's role are present; `null` for admins / rental staff. */
export interface RoleProfile {
  // driver
  license_number?: string;
  // rental owner
  rental_type?: string;
  company_name?: string;
  abn?: string;
  minimum_rental_days?: number | null;
  // mechanic
  shop_name?: string;
  shop_address?: string;
}

/** Primary admin's contact details, shown to non-admin users. */
export interface AdminContact {
  full_name: string;
  email: string;
  /** True when this contact is the staff member's rental owner (not the admin). */
  is_owner?: boolean;
}

/** The current user's full profile (`GET /auth/me/`). */
export interface MyProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  roleDisplay: string;
  dateJoined: string;
  isActive: boolean;
  /** True when the account is suspended (locked to this Profile page). */
  isSuspended: boolean;
  /** Message explaining the suspension (admin reason or GPS message). */
  suspensionReason: string;
  phoneNumber?: string;
  /** Set for rental staff only. */
  allowedNavPaths?: string[];
  /** True when the user is a rental staff member (role 'rental' + nav paths). */
  isRentalStaff: boolean;
  profile: RoleProfile | null;
  adminContact: AdminContact | null;
  /** Documents the user uploaded at registration (empty for admins / staff). */
  documents: RegistrationDocument[];
}

export const profileApi = {
  me: async (): Promise<MyProfile> => {
    const { data } = await apiClient.get<Record<string, unknown>>('/auth/me/');
    const allowedNavPaths = Array.isArray(data.allowed_nav_paths)
      ? (data.allowed_nav_paths as string[])
      : undefined;
    const role = String(data.role ?? 'driver');
    return {
      id: Number(data.id),
      email: String(data.email ?? ''),
      firstName: String(data.first_name ?? ''),
      lastName: String(data.last_name ?? ''),
      fullName: String(data.full_name ?? ''),
      role,
      roleDisplay: String(data.role_display ?? ''),
      dateJoined: String(data.date_joined ?? ''),
      isActive: Boolean(data.is_active),
      isSuspended: Boolean(data.is_suspended),
      suspensionReason: data.suspension_reason != null ? String(data.suspension_reason) : '',
      phoneNumber: data.phone_number != null ? String(data.phone_number) : undefined,
      allowedNavPaths,
      isRentalStaff: role === 'rental' && !!allowedNavPaths && allowedNavPaths.length > 0,
      profile: (data.profile as RoleProfile | null) ?? null,
      adminContact: (data.admin_contact as AdminContact | null) ?? null,
      documents: Array.isArray(data.documents) ? (data.documents as RegistrationDocument[]) : [],
    };
  },
};
