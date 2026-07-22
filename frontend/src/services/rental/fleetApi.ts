import { apiClient } from '../../lib/api/client';
import type { Vehicle } from './types';
import { mapRenter, mapMaintenance } from './vehicleInfoMap';
import type { ApiRenter, ApiMaintenance } from './vehicleInfoMap';

/** Real backend client for a rental owner's own fleet (DRF `fleet` viewset,
 * scoped server-side to the logged-in rental). */
interface ApiVehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  rego: string;
  insurance_expiry: string | null;
  insurance_type: string;
  image_url: string;
  image_urls: string[];
  status: 'available' | 'rented' | 'maintenance';
  maintenance_note: string;
  total_distance_km: number;
  trips: number;
  oil_due_date: string | null;
  rego_due_date: string | null;
  odometer_km: number | null;
  last_oil_change_date: string | null;
  last_rego_payment_date: string | null;
  rent_price_per_day: string | number | null;
  minimum_rental_days: number | null;
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

function mapVehicle(v: ApiVehicle): Vehicle {
  return {
    id: String(v.id),
    make: v.make,
    model: v.model,
    year: v.year ?? 0,
    rego: v.rego,
    insuranceExpiry: v.insurance_expiry ?? undefined,
    insuranceType: v.insurance_type || undefined,
    imageUrl: v.image_url || undefined,
    imageUrls: Array.isArray(v.image_urls) ? v.image_urls : [],
    status: v.status,
    maintenanceNote: v.maintenance_note || undefined,
    totalDistanceKm: v.total_distance_km,
    trips: v.trips,
    oilDueDate: v.oil_due_date ?? undefined,
    regoDueDate: v.rego_due_date ?? undefined,
    odometerKm: v.odometer_km ?? undefined,
    lastOilChangeDate: v.last_oil_change_date ?? undefined,
    lastRegoPaymentDate: v.last_rego_payment_date ?? undefined,
    rentPricePerDay: v.rent_price_per_day != null ? Number(v.rent_price_per_day) : undefined,
    minimumRentalDays: v.minimum_rental_days ?? undefined,
    renter: mapRenter(v.renter),
    maintenance: mapMaintenance(v.maintenance),
  };
}

function toPayload(input: Partial<Vehicle>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (input.make !== undefined) p.make = input.make;
  if (input.model !== undefined) p.model = input.model;
  if (input.year !== undefined) p.year = input.year || null;
  if (input.rego !== undefined) p.rego = input.rego;
  if (input.insuranceExpiry !== undefined) p.insurance_expiry = input.insuranceExpiry || null;
  if (input.insuranceType !== undefined) p.insurance_type = input.insuranceType ?? '';
  if (input.imageUrls !== undefined) p.image_urls = input.imageUrls;
  if (input.imageUrl !== undefined) p.image_url = input.imageUrl ?? '';
  if (input.status !== undefined) p.status = input.status;
  if (input.maintenanceNote !== undefined) p.maintenance_note = input.maintenanceNote ?? '';
  if (input.totalDistanceKm !== undefined) p.total_distance_km = input.totalDistanceKm;
  if (input.trips !== undefined) p.trips = input.trips;
  if (input.oilDueDate !== undefined) p.oil_due_date = input.oilDueDate || null;
  if (input.regoDueDate !== undefined) p.rego_due_date = input.regoDueDate || null;
  if (input.odometerKm !== undefined) p.odometer_km = input.odometerKm ?? null;
  if (input.lastOilChangeDate !== undefined) p.last_oil_change_date = input.lastOilChangeDate || null;
  if (input.lastRegoPaymentDate !== undefined) p.last_rego_payment_date = input.lastRegoPaymentDate || null;
  if (input.rentPricePerDay !== undefined) p.rent_price_per_day = input.rentPricePerDay ?? null;
  if (input.minimumRentalDays !== undefined) p.minimum_rental_days = input.minimumRentalDays ?? null;
  return p;
}

export const fleetApi = {
  list: async (): Promise<Vehicle[]> => {
    const res = await apiClient.get('/fleet/');
    return unwrapList<ApiVehicle>(res.data).map(mapVehicle);
  },
  get: async (id: string): Promise<Vehicle | null> => {
    try {
      const res = await apiClient.get(`/fleet/${id}/`);
      return mapVehicle(res.data as ApiVehicle);
    } catch {
      return null;
    }
  },
  add: async (input: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
    const res = await apiClient.post('/fleet/', toPayload(input));
    return mapVehicle(res.data as ApiVehicle);
  },
  update: async (id: string, patch: Partial<Vehicle>): Promise<void> => {
    await apiClient.patch(`/fleet/${id}/`, toPayload(patch));
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/fleet/${id}/`);
  },
};
