import type { RegistrationDocument } from '../registrations/api';

/** Driver (admin CRUD) */
export type DriverStatus = 'active' | 'inactive';

export interface Driver {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber?: string;
  status: DriverStatus;
  /** Reason shown to the driver when their account is set inactive/suspended. */
  suspensionReason?: string;
  /** Documents uploaded at registration (shown to the admin). */
  documents: RegistrationDocument[];
}
