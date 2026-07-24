import type { RegistrationDocument } from '../registrations/api';

/** Rental staff (admin CRUD) – fields aligned with rental signup */
export type RentalType = 'company' | 'individual';

export type RentalStatus = 'active' | 'inactive';

/** A staff account belonging to a rental owner. */
export interface RentalStaffMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: RentalStatus;
  /** Pages this staff member is allowed to access. */
  allowedNavPaths: string[];
}

export interface Rental {
  id: string;
  rentalType: RentalType;
  companyName?: string;
  abn?: string;
  contactName: string;
  email: string;
  phone: string;
  certificateFileName?: string;
  status: RentalStatus;
  /** Reason shown to the user when their account is set inactive/suspended. */
  suspensionReason?: string;
  /** Minimum rental duration in days (e.g. 3 = min 3 days). Set by rental. */
  minimumRentalDays?: number;
  /** Map location for driver dashboard live map (e.g. office / pickup point). */
  latitude?: number;
  longitude?: number;
  /** Staff accounts belonging to this rental owner. */
  staff: RentalStaffMember[];
  /** Documents uploaded at registration (shown to the admin). */
  documents: RegistrationDocument[];
}
