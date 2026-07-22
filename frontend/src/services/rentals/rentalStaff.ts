/**
 * Rental staff data access — the single entry point the rental-staff pages use.
 *
 * Backed by the Django `rental-staff` API. Every function is async.
 */
import { rentalStaffApi, type UpdateRentalStaffInput } from './rentalStaffApi';
import type { RentalPortalStaffEntry, AddRentalPortalStaffInput } from './rentalStaffTypes';

export type { RentalPortalStaffEntry, AddRentalPortalStaffInput, UpdateRentalStaffInput };

export async function listRentalStaff(_parentRentalUserId: number): Promise<RentalPortalStaffEntry[]> {
  return rentalStaffApi.list();
}

export async function addRentalStaff(
  _parentRentalUserId: number,
  input: AddRentalPortalStaffInput
): Promise<RentalPortalStaffEntry> {
  return rentalStaffApi.add(input);
}

export async function updateRentalStaff(id: string, patch: UpdateRentalStaffInput): Promise<void> {
  await rentalStaffApi.update(id, patch);
}

export async function deleteRentalStaff(id: string): Promise<void> {
  await rentalStaffApi.remove(id);
}

export async function getRentalStaffById(id: string): Promise<RentalPortalStaffEntry | undefined> {
  const all = await rentalStaffApi.list();
  return all.find((s) => s.id === id);
}
