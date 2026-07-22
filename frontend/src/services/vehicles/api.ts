import { apiClient } from '../../lib/api/client';
import { mapRenter, mapMaintenance } from '../rental/vehicleInfoMap';
import type { ApiRenter, ApiMaintenance } from '../rental/vehicleInfoMap';
import type { VehicleRenterInfo, VehicleMaintenanceInfo } from '../rental/types';

export type VehicleStatus = 'available' | 'rented' | 'maintenance';

/** A vehicle row for the admin all-vehicles list, with its owning rental's name. */
export interface AdminVehicleRow {
  id: string;
  make: string;
  model: string;
  year: number | null;
  rego: string;
  status: VehicleStatus;
  rentPricePerDay: number | null;
  imageUrl?: string;
  /** All gallery images (first is the primary thumbnail). */
  imageUrls: string[];
  insuranceType?: string;
  insuranceExpiry?: string;
  minimumRentalDays: number | null;
  /** Service & registration tracking (mirrors the rental Fleet). */
  odometerKm: number | null;
  lastOilChangeDate?: string;
  lastRegoPaymentDate?: string;
  oilDueDate?: string;
  regoDueDate?: string;
  totalDistanceKm: number;
  trips: number;
  maintenanceNote: string;
  createdAt?: string;
  /** Id of the owning rental (for the edit form's rental picker). */
  rentalId: string;
  rentalName: string;
  /** Driver currently renting this vehicle (present when status === 'rented'). */
  renter?: VehicleRenterInfo | null;
  /** Accepted maintenance job (present when status === 'maintenance'). */
  maintenance?: VehicleMaintenanceInfo | null;
}

interface ApiAdminVehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  rego: string;
  status: VehicleStatus;
  rent_price_per_day: string | number | null;
  insurance_type?: string;
  insurance_expiry?: string | null;
  minimum_rental_days?: number | null;
  odometer_km?: number | null;
  last_oil_change_date?: string | null;
  last_rego_payment_date?: string | null;
  oil_due_date?: string | null;
  rego_due_date?: string | null;
  total_distance_km?: number;
  trips?: number;
  maintenance_note?: string;
  image_url: string;
  image_urls?: string[];
  created_at?: string;
  rental_id: number;
  rental_name: string;
  renter?: ApiRenter | null;
  maintenance?: ApiMaintenance | null;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapVehicle(v: ApiAdminVehicle): AdminVehicleRow {
  return {
    id: String(v.id),
    make: v.make,
    model: v.model,
    year: v.year,
    rego: v.rego,
    status: v.status,
    rentPricePerDay: v.rent_price_per_day != null ? Number(v.rent_price_per_day) : null,
    imageUrl: v.image_url || undefined,
    imageUrls: Array.isArray(v.image_urls) ? v.image_urls : (v.image_url ? [v.image_url] : []),
    insuranceType: v.insurance_type || undefined,
    insuranceExpiry: v.insurance_expiry || undefined,
    minimumRentalDays: v.minimum_rental_days ?? null,
    odometerKm: v.odometer_km ?? null,
    lastOilChangeDate: v.last_oil_change_date || undefined,
    lastRegoPaymentDate: v.last_rego_payment_date || undefined,
    oilDueDate: v.oil_due_date || undefined,
    regoDueDate: v.rego_due_date || undefined,
    totalDistanceKm: v.total_distance_km ?? 0,
    trips: v.trips ?? 0,
    maintenanceNote: v.maintenance_note || '',
    createdAt: v.created_at || undefined,
    rentalId: v.rental_id != null ? String(v.rental_id) : '',
    rentalName: v.rental_name,
    renter: mapRenter(v.renter),
    maintenance: mapMaintenance(v.maintenance),
  };
}

/** Fields the admin can set when creating/editing a vehicle. */
export interface VehicleInput {
  make: string;
  model: string;
  year?: number | null;
  rego?: string;
  status: VehicleStatus;
  rentPricePerDay?: number | null;
  insuranceType?: string;
  minimumRentalDays?: number | null;
  odometerKm?: number | null;
  lastOilChangeDate?: string;
  lastRegoPaymentDate?: string;
  regoDueDate?: string;
  maintenanceNote?: string;
  imageUrl?: string;
  imageUrls?: string[];
  /** Id of the owning rental. */
  rentalId: string;
}

function toPayload(input: Partial<VehicleInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.make !== undefined) p.make = input.make;
  if (input.model !== undefined) p.model = input.model;
  if (input.year !== undefined) p.year = input.year;
  if (input.rego !== undefined) p.rego = input.rego;
  if (input.status !== undefined) p.status = input.status;
  if (input.rentPricePerDay !== undefined) p.rent_price_per_day = input.rentPricePerDay;
  if (input.insuranceType !== undefined) p.insurance_type = input.insuranceType ?? '';
  if (input.minimumRentalDays !== undefined) p.minimum_rental_days = input.minimumRentalDays;
  if (input.odometerKm !== undefined) p.odometer_km = input.odometerKm;
  if (input.lastOilChangeDate !== undefined) p.last_oil_change_date = input.lastOilChangeDate || null;
  if (input.lastRegoPaymentDate !== undefined) p.last_rego_payment_date = input.lastRegoPaymentDate || null;
  if (input.regoDueDate !== undefined) p.rego_due_date = input.regoDueDate || null;
  if (input.maintenanceNote !== undefined) p.maintenance_note = input.maintenanceNote;
  if (input.imageUrl !== undefined) p.image_url = input.imageUrl;
  if (input.imageUrls !== undefined) p.image_urls = input.imageUrls;
  if (input.rentalId !== undefined) p.rental = Number(input.rentalId);
  return p;
}

export const adminVehiclesApi = {
  /** List all vehicles across rentals (admin only), each with its rental name. */
  list: async (): Promise<AdminVehicleRow[]> => {
    const res = await apiClient.get('/admin/vehicles/');
    return unwrapList<ApiAdminVehicle>(res.data).map(mapVehicle);
  },
  /** Fetch a single vehicle by id. */
  get: async (id: string): Promise<AdminVehicleRow> => {
    const res = await apiClient.get(`/admin/vehicles/${id}/`);
    return mapVehicle(res.data as ApiAdminVehicle);
  },
  /** Create a new vehicle owned by the chosen rental. */
  create: async (input: VehicleInput): Promise<AdminVehicleRow> => {
    const res = await apiClient.post('/admin/vehicles/', toPayload(input));
    return mapVehicle(res.data as ApiAdminVehicle);
  },
  /** Update an existing vehicle. */
  update: async (id: string, input: Partial<VehicleInput>): Promise<AdminVehicleRow> => {
    const res = await apiClient.patch(`/admin/vehicles/${id}/`, toPayload(input));
    return mapVehicle(res.data as ApiAdminVehicle);
  },
  /** Permanently delete a vehicle. */
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/vehicles/${id}/`);
  },
};
