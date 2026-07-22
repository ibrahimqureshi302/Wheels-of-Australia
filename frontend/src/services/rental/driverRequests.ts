/**
 * Driver booking-request data access.
 *
 * Backed by the Django `rental-requests` API (create a booking; list the
 * driver's own requests; cancel / delete via the viewset actions).
 */
import { apiClient } from '../../lib/api/client';
import type { IdDocument, VerifiedDetails } from '../ocr';
import type { ReturnState } from './types';

/** A booking request the driver has sent (the pending-requests view). */
export interface DriverSentRequest {
  id: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  rentalId: string;
  rentalName: string;
  startDate: string;
  endDate: string;
  requestedAt: string;
  status: 'pending';
}

export interface SubmitBookingInput {
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  rentalId: string;
  rentalName: string;
  startDate: string;
  endDate: string;
  /** Identity documents + OCR-confirmed details captured before submit. */
  idDocuments: IdDocument[];
  verifiedDetails: VerifiedDetails;
}

interface ApiRentalRequest {
  id: number;
  vehicle: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_rego?: string;
  rental_name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  status_display?: string;
  decision_reason?: string;
  reviewed_at?: string | null;
  return_state?: string;
  return_requested_at?: string | null;
  created_at: string;
  id_documents?: IdDocument[];
  verified_details?: VerifiedDetails | null;
  info_request_message?: string;
}

export type DriverRequestStatus = 'pending' | 'approved' | 'running' | 'rejected' | 'cancelled' | 'info_requested' | 'completed';

/** A driver's booking request in any status, with the rental owner's response. */
export interface DriverRequest {
  id: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRego: string;
  rentalName: string;
  startDate: string;
  endDate: string;
  status: DriverRequestStatus;
  statusDisplay: string;
  /** Owner's note when approving/rejecting (the "response"). */
  decisionReason: string;
  /** When the owner decided (ISO), or null while pending. */
  reviewedAt: string | null;
  /** Return-handshake state on a running booking (see ReturnState). */
  returnState: ReturnState;
  /** When an early return was requested (ISO), or null. */
  returnRequestedAt: string | null;
  createdAt: string;
  /** Identity documents the driver attached. */
  idDocuments: IdDocument[];
  /** OCR-confirmed identity details. */
  verifiedDetails: VerifiedDetails | null;
  /** The rental's note when they request more information. */
  infoRequestMessage: string;
}

const STATUS_LABELS: Record<DriverRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  running: 'Running',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  info_requested: 'Info requested',
  completed: 'Completed',
};

function normalizeStatus(s: string): DriverRequestStatus {
  return (['pending', 'approved', 'running', 'rejected', 'cancelled', 'info_requested', 'completed'].includes(s) ? s : 'pending') as DriverRequestStatus;
}

function mapToRequest(r: ApiRentalRequest): DriverRequest {
  const status = normalizeStatus(r.status);
  return {
    id: String(r.id),
    vehicleId: String(r.vehicle),
    vehicleMake: r.vehicle_make,
    vehicleModel: r.vehicle_model,
    vehicleRego: r.vehicle_rego ?? '',
    rentalName: r.rental_name,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? '',
    status,
    statusDisplay: r.status_display || STATUS_LABELS[status],
    decisionReason: r.decision_reason ?? '',
    reviewedAt: r.reviewed_at ?? null,
    returnState: (r.return_state ?? '') as ReturnState,
    returnRequestedAt: r.return_requested_at ?? null,
    createdAt: r.created_at,
    idDocuments: Array.isArray(r.id_documents) ? r.id_documents : [],
    verifiedDetails: r.verified_details ?? null,
    infoRequestMessage: r.info_request_message ?? '',
  };
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapToSent(r: ApiRentalRequest): DriverSentRequest {
  return {
    id: String(r.id),
    vehicleId: String(r.vehicle),
    vehicleMake: r.vehicle_make,
    vehicleModel: r.vehicle_model,
    rentalId: '',
    rentalName: r.rental_name,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? '',
    requestedAt: r.created_at,
    status: 'pending',
  };
}

/** The driver's still-pending booking requests. */
export async function listSentRequests(): Promise<DriverSentRequest[]> {
  const res = await apiClient.get('/rental-requests/');
  return unwrapList<ApiRentalRequest>(res.data)
    .filter((r) => r.status === 'pending')
    .map(mapToSent);
}

/** Send a booking request for a vehicle. */
export async function submitBookingRequest(input: SubmitBookingInput): Promise<void> {
  await apiClient.post('/rental-requests/', {
    vehicle: Number(input.vehicleId),
    start_date: input.startDate,
    end_date: input.endDate,
    id_documents: input.idDocuments,
    verified_details: input.verifiedDetails,
  });
}

/** Supply the documents/details the rental asked for; returns to 'pending'. */
export async function provideBookingInfo(
  id: string,
  idDocuments: IdDocument[],
  verifiedDetails: VerifiedDetails,
): Promise<void> {
  await apiClient.post(`/rental-requests/${id}/provide-info/`, {
    id_documents: idDocuments,
    verified_details: verifiedDetails,
  });
}

/** Cancel a sent request while it is still pending (marks it 'cancelled'). */
export async function cancelSentRequest(id: string): Promise<boolean> {
  await apiClient.post(`/rental-requests/${id}/cancel/`);
  return true;
}

/** Whether the UI should offer a "Cancel" action for sent requests. */
export function canCancelSentRequests(): boolean {
  return true;
}

/** All of the driver's booking requests, any status (newest first). */
export async function listMyRequests(): Promise<DriverRequest[]> {
  const res = await apiClient.get('/rental-requests/');
  return unwrapList<ApiRentalRequest>(res.data).map(mapToRequest);
}

/**
 * The state of a vehicle from the current driver's point of view:
 * - 'pending'        — a request is awaiting the rental's response
 * - 'info_requested' — the rental asked for more info; the driver must update
 *                      the existing request rather than send a new one
 * - 'none'           — no open request; the driver may send one
 */
export type VehicleRequestState = 'none' | 'pending' | 'info_requested';

/**
 * Map each vehicle the driver has an OPEN request on → that request. "Open"
 * means awaiting the rental's response ('pending') or the rental asked for more
 * info ('info_requested'). Rejected/cancelled/completed leave the vehicle free
 * for a fresh request, so they are excluded. Newest open request per vehicle wins.
 */
export async function getOpenRequestsByVehicle(): Promise<Record<string, DriverRequest>> {
  const all = await listMyRequests(); // newest first (backend orders by -created_at)
  const map: Record<string, DriverRequest> = {};
  for (const r of all) {
    if (r.status !== 'pending' && r.status !== 'info_requested') continue;
    if (!map[r.vehicleId]) map[r.vehicleId] = r;
  }
  return map;
}

/** A single request by id, or null if not found. */
export async function getMyRequest(id: string): Promise<DriverRequest | null> {
  const all = await listMyRequests();
  return all.find((r) => r.id === id) ?? null;
}

/**
 * The driver's trips = running (in-progress) and completed (finished) bookings.
 * A booking becomes 'running' the moment the rental approves it, and
 * auto-completes when the rental period ends. Pending/declined/cancelled
 * requests are not trips and stay on the My Requests page.
 */
export async function listMyTrips(): Promise<DriverRequest[]> {
  return (await listMyRequests()).filter((r) => r.status === 'running' || r.status === 'completed');
}

/**
 * Cancel a request (mark it 'cancelled', keeping the record). Returns true on
 * success. Works for any status.
 */
export async function cancelRequest(id: string): Promise<boolean> {
  await apiClient.post(`/rental-requests/${id}/cancel/`);
  return true;
}

/** Permanently delete one of the driver's own requests (not allowed while approved). */
export async function deleteMyRequest(id: string): Promise<boolean> {
  await apiClient.delete(`/rental-requests/${id}/`);
  return true;
}

/** Driver asks the rental to take the vehicle back early (before the end date).
 * The rental then confirms or declines from their Incoming requests. */
export async function requestReturn(id: string): Promise<DriverRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/request-return/`, {});
  return mapToRequest(res.data as ApiRentalRequest);
}

/** Decline (or withdraw) an outstanding early-return request; the rental keeps
 * running as normal. */
export async function cancelReturn(id: string): Promise<DriverRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/cancel-return/`, {});
  return mapToRequest(res.data as ApiRentalRequest);
}

/** End-of-period: driver marks the trip complete; the rental is then asked to
 * confirm the physical return. */
export async function completeTrip(id: string): Promise<DriverRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/complete-trip/`, {});
  return mapToRequest(res.data as ApiRentalRequest);
}

/** Driver confirms an early return the RENTAL requested — completes the booking
 * immediately and returns the vehicle. */
export async function confirmReturn(id: string): Promise<DriverRequest> {
  const res = await apiClient.post(`/rental-requests/${id}/confirm-return/`, {});
  return mapToRequest(res.data as ApiRentalRequest);
}
