import type { RegistrationDocument } from '../registrations/api';

/** Mechanic (admin view) – fields aligned with the mechanic signup form. */
export type MechanicStatus = 'active' | 'inactive';

export interface Mechanic {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  shopName: string;
  shopAddress?: string;
  abn?: string;
  status: MechanicStatus;
  /** Reason shown to the user when their account is set inactive/suspended. */
  suspensionReason?: string;
  /** Documents uploaded at registration (shown to the admin). */
  documents: RegistrationDocument[];
}
