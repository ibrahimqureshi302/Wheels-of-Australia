/**
 * Rental OWNER incoming booking-requests data access.
 *
 * Backed by the Django `rental-requests` API (list scoped to the owner's fleet;
 * approve / reject / confirm-return via the viewset actions; DELETE to remove).
 */
import { apiClient } from '../../lib/api/client';
import type { RentalRequest, RentalRequestStatus, ReturnState } from './types';

interface ApiRentalRequest {
  id: number;
  vehicle: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_status?: string;
  driver_name: string;
  driver_email: string;
  rental_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  decision_reason: string;
  reviewed_at?: string | null;
  return_state?: string;
  return_requested_at?: string | null;
  created_at: string;
  id_documents?: Array<{ docType: string; name: string; image: string }>;
  verified_details?: { fullName: string; dateOfBirth?: string; documentNumber: string; expiryDate: string } | null;
  info_request_message?: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapStatus(status: string): RentalRequestStatus {
  if (status === 'running') return 'running';
  if (status === 'approved') return 'approved';
  if (status === 'completed') return 'completed';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  if (status === 'info_requested') return 'request_info';
  return 'pending';
}

function mapRequest(r: ApiRentalRequest): RentalRequest {
  return {
    id: String(r.id),
    vehicleId: String(r.vehicle),
    vehicleMake: r.vehicle_make,
    vehicleModel: r.vehicle_model,
    driverName: r.driver_name,
    driverEmail: r.driver_email,
    requestedAt: r.created_at,
    status: mapStatus(r.status),
    vehicleStatus: (r.vehicle_status as RentalRequest['vehicleStatus']) ?? undefined,
    reviewedAt: r.reviewed_at ?? null,
    returnState: (r.return_state ?? '') as ReturnState,
    returnRequestedAt: r.return_requested_at ?? null,
    notes: r.decision_reason || undefined,
    rentalStartDate: r.start_date || undefined,
    rentalEndDate: r.end_date || undefined,
    idDocuments: Array.isArray(r.id_documents) ? r.id_documents : [],
    verifiedDetails: r.verified_details ?? null,
    infoRequestMessage: r.info_request_message || undefined,
  };
}

/** Booking requests for the owner's fleet (newest first). */
export async function listIncomingRequests(): Promise<RentalRequest[]> {
  const res = await apiClient.get('/rental-requests/');
  return unwrapList<ApiRentalRequest>(res.data).map(mapRequest);
}

/** Number of still-pending requests (for the dashboard card). */
export async function countPendingRequests(): Promise<number> {
  const all = await listIncomingRequests();
  return all.filter((r) => r.status === 'pending').length;
}

/** Approve a request. Returns the updated request. */
export async function approveRequest(id: string): Promise<RentalRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/approve/`, {});
  return mapRequest(res.data as ApiRentalRequest);
}

/** Reject a request with an optional note for the driver. Returns the updated request. */
export async function rejectRequest(id: string, notes: string): Promise<RentalRequest> {
  const reason = notes.trim();
  const res = await apiClient.post(`/rental-requests/${id}/reject/`, { reason });
  return mapRequest(res.data as ApiRentalRequest);
}

/** Ask the driver for more information (the "Other" option). Moves the request
 * to 'request_info' and notifies the driver with the message. */
export async function requestMoreInfo(id: string, message: string): Promise<RentalRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/request-info/`, { message: message.trim() });
  return mapRequest(res.data as ApiRentalRequest);
}

/** Confirm the driver has returned the vehicle. Completes the booking and
 * releases the vehicle back to 'available'. Owner/admin only. */
export async function confirmReturn(id: string): Promise<RentalRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/confirm-return/`, {});
  return mapRequest(res.data as ApiRentalRequest);
}

/** Owner asks the driver to return the vehicle early (before the end date).
 * The driver then confirms or declines from their Incoming requests. */
export async function requestReturn(id: string): Promise<RentalRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/request-return/`, {});
  return mapRequest(res.data as ApiRentalRequest);
}

/** Decline (or withdraw) an outstanding early-return request; the rental keeps
 * running as normal. */
export async function cancelReturn(id: string): Promise<RentalRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/cancel-return/`, {});
  return mapRequest(res.data as ApiRentalRequest);
}

/** Permanently remove a booking request (backend DELETE). The backend blocks
 * deleting an approved booking (reject/cancel it first). */
export async function deleteRequest(id: string): Promise<boolean> {
  await apiClient.delete(`/rental-requests/${id}/`);
  return true;
}

/** Whether the UI should offer a "Delete" action for requests. */
export function canDeleteRequests(): boolean {
  return true;
}
