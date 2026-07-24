/**
 * Shared types for a rental owner's staff (the DRF `rental-staff` viewset).
 */

/** Account state of a staff member. The backend returns 'pending' (awaiting
 * admin approval), 'active', or 'inactive'. */
export type RentalStaffStatus = 'pending' | 'active' | 'inactive';

export interface RentalPortalStaffEntry {
  id: string;
  userId: number;
  parentRentalUserId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  allowedNavPaths: string[];
  status: RentalStaffStatus;
}

export interface AddRentalPortalStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  allowedNavPaths: string[];
}
