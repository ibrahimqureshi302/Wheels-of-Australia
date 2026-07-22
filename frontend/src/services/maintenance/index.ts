/**
 * Maintenance jobs data access.
 *
 * Backed by the Django `maintenance-requests` API. Used by rental/mechanic
 * accounts (created by the admin).
 */
import { apiClient } from '../../lib/api/client';
import type { IdDocument, VerifiedDetails } from '../ocr';
import type { MaintenanceRequest, MaintenanceStatus, QuotePayload, DurationUnit } from './types';

interface ApiMaintenanceRequest {
  id: number;
  vehicle: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_rego: string;
  vehicle_image: string;
  vehicle_status: string;
  rental: number;
  rental_name: string;
  mechanic: number | null;
  mechanic_name: string;
  mechanic_email: string;
  mechanic_phone: string;
  mechanic_shop: string;
  mechanic_shop_address: string;
  mechanic_abn: string;
  work_description: string;
  status: string;
  status_display: string;
  quoted_price: string | number | null;
  estimated_value: number | null;
  estimated_unit: string;
  mechanic_notes: string;
  decision_reason: string;
  id_documents: IdDocument[];
  verified_details: VerifiedDetails | null;
  info_request_message: string;
  quoted_at: string | null;
  decided_at: string | null;
  work_completed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function map(r: ApiMaintenanceRequest): MaintenanceRequest {
  return {
    id: String(r.id),
    vehicleId: String(r.vehicle),
    vehicleMake: r.vehicle_make,
    vehicleModel: r.vehicle_model,
    vehicleRego: r.vehicle_rego,
    vehicleImage: r.vehicle_image || undefined,
    vehicleStatus: r.vehicle_status,
    rentalId: String(r.rental),
    rentalName: r.rental_name,
    mechanicId: r.mechanic != null ? String(r.mechanic) : undefined,
    mechanicName: r.mechanic_name || undefined,
    mechanicEmail: r.mechanic_email || undefined,
    mechanicPhone: r.mechanic_phone || undefined,
    mechanicShop: r.mechanic_shop || undefined,
    mechanicShopAddress: r.mechanic_shop_address || undefined,
    mechanicAbn: r.mechanic_abn || undefined,
    workDescription: r.work_description,
    status: r.status as MaintenanceStatus,
    statusDisplay: r.status_display,
    quotedPrice: r.quoted_price != null ? Number(r.quoted_price) : undefined,
    estimatedValue: r.estimated_value ?? undefined,
    estimatedUnit: (r.estimated_unit || '') as DurationUnit | '',
    mechanicNotes: r.mechanic_notes || undefined,
    decisionReason: r.decision_reason || undefined,
    idDocuments: Array.isArray(r.id_documents) ? r.id_documents : [],
    verifiedDetails: r.verified_details ?? null,
    infoRequestMessage: r.info_request_message ?? '',
    quotedAt: r.quoted_at || undefined,
    decidedAt: r.decided_at || undefined,
    workCompletedAt: r.work_completed_at || undefined,
    completedAt: r.completed_at || undefined,
    createdAt: r.created_at,
  };
}

/** Whether the maintenance feature is usable in the current session. */
export function maintenanceAvailable(): boolean {
  return true;
}

/** All maintenance jobs visible to the current user (role-scoped by the API). */
export async function listMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const res = await apiClient.get('/maintenance-requests/');
  return unwrapList<ApiMaintenanceRequest>(res.data).map(map);
}

/** Rental flags a vehicle for maintenance and describes the work. */
export async function createMaintenanceRequest(
  vehicleId: string,
  workDescription: string,
): Promise<MaintenanceRequest> {
  const res = await apiClient.post('/maintenance-requests/', {
    vehicle: Number(vehicleId),
    work_description: workDescription,
  });
  return map(res.data as ApiMaintenanceRequest);
}

/** Mechanic submits a quote (price + estimated duration). */
export async function submitQuote(id: string, payload: QuotePayload): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/quote/`, {
    quoted_price: payload.quotedPrice,
    estimated_value: payload.estimatedValue,
    estimated_unit: payload.estimatedUnit,
    mechanic_notes: payload.mechanicNotes || '',
    id_documents: payload.idDocuments,
    verified_details: payload.verifiedDetails,
  });
  return map(res.data as ApiMaintenanceRequest);
}

/** Rental asks the mechanic for more information about their quote. */
export async function requestMaintenanceInfo(id: string, message: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/request-info/`, { message });
  return map(res.data as ApiMaintenanceRequest);
}

/** Mechanic supplies the requested documents/details → back to 'quoted'. */
export async function provideMaintenanceInfo(
  id: string,
  idDocuments: IdDocument[],
  verifiedDetails: VerifiedDetails,
): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/provide-info/`, {
    id_documents: idDocuments,
    verified_details: verifiedDetails,
  });
  return map(res.data as ApiMaintenanceRequest);
}

/** Rental accepts the quote → vehicle moves to maintenance. */
export async function acceptQuote(id: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/accept/`, {});
  return map(res.data as ApiMaintenanceRequest);
}

/** Rental declines the quote, with an optional reason. */
export async function declineQuote(id: string, reason = ''): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/decline/`, { reason });
  return map(res.data as ApiMaintenanceRequest);
}

/** Mark an accepted job done → vehicle returns to available. */
export async function completeMaintenance(id: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/complete/`, {});
  return map(res.data as ApiMaintenanceRequest);
}

/** Owning rental confirms the return after the mechanic finished → vehicle available. */
export async function confirmMaintenanceReturn(id: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/confirm-return/`, {});
  return map(res.data as ApiMaintenanceRequest);
}

/** Mechanic withdraws their quote (only while the rental hasn't decided). */
export async function cancelQuote(id: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/cancel/`, {});
  return map(res.data as ApiMaintenanceRequest);
}

/** Owning rental cancels a request before it is accepted (pending/quoted/info). */
export async function cancelMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  const res = await apiClient.post(`/maintenance-requests/${id}/cancel/`, {});
  return map(res.data as ApiMaintenanceRequest);
}

/** Permanently delete a maintenance request (declined/cancelled only). */
export async function deleteMaintenanceRequest(id: string): Promise<void> {
  await apiClient.delete(`/maintenance-requests/${id}/`);
}

export type { MaintenanceRequest, MaintenanceStatus, QuotePayload, DurationUnit } from './types';
