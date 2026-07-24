import type { RegistrationDocument } from '../registrations/api';

/** Rental staff as managed by the admin (full CRUD across every rental). */
export type AdminRentalStaffStatus = 'active' | 'inactive';

export interface AdminRentalStaff {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: AdminRentalStaffStatus;
  /** Reason shown to the user when their account is set inactive/suspended. */
  suspensionReason?: string;
  /** Pages this staff member is allowed to access. */
  allowedNavPaths: string[];
  /** The owning rental (a rental owner's id), for grouping. */
  rentalId: string | null;
  /** Display name of the owning rental. */
  rentalName: string;
  /** Documents uploaded at registration (shown to the admin). */
  documents: RegistrationDocument[];
}

/** Fields the admin can set when creating/editing a rental staff member. */
export interface AdminRentalStaffInput {
  fullName: string;
  email: string;
  phone?: string;
  status?: AdminRentalStaffStatus;
  /** Reason shown to the user; required by the backend when status is 'inactive'. */
  suspensionReason?: string;
  allowedNavPaths?: string[];
  /** Owning rental id — required on create. */
  rentalId?: string;
  /** Required on create; leave undefined on edit to keep the current password. */
  password?: string;
}
