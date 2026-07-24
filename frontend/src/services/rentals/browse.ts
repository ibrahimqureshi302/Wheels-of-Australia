/**
 * Driver "Browse rentals" data access.
 *
 * Backed by the Django `browse/rentals` API (active rentals that have available
 * vehicles, and each rental's available vehicles). All functions are async.
 */
import { apiClient } from '../../lib/api/client';
import type { Rental } from './types';
import type { Vehicle } from '../rental/types';

interface ApiBrowseRental {
  id: number;
  rental_type: 'company' | 'individual' | '';
  company_name: string;
  contact_name: string;
  email: string;
  phone_number: string;
  minimum_rental_days: number | null;
  latitude: number | null;
  longitude: number | null;
  available_vehicle_count: number;
}

interface ApiVehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  rego: string;
  status: 'available' | 'rented' | 'pending_return' | 'maintenance';
  image_url: string;
  rent_price_per_day: string | number | null;
  minimum_rental_days: number | null;
  total_distance_km: number;
  trips: number;
  oil_due_date: string | null;
  rego_due_date: string | null;
  last_oil_change_date: string | null;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapRental(r: ApiBrowseRental): Rental {
  return {
    id: String(r.id),
    rentalType: r.rental_type === 'individual' ? 'individual' : 'company',
    companyName: r.company_name || undefined,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone_number,
    status: 'active',
    minimumRentalDays: r.minimum_rental_days ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    staff: [],
  };
}

function mapVehicle(v: ApiVehicle): Vehicle {
  return {
    id: String(v.id),
    make: v.make,
    model: v.model,
    year: v.year ?? 0,
    rego: v.rego,
    status: v.status,
    imageUrl: v.image_url || undefined,
    rentPricePerDay: v.rent_price_per_day != null ? Number(v.rent_price_per_day) : undefined,
    minimumRentalDays: v.minimum_rental_days ?? undefined,
    totalDistanceKm: v.total_distance_km,
    trips: v.trips,
    oilDueDate: v.oil_due_date ?? undefined,
    regoDueDate: v.rego_due_date ?? undefined,
    lastOilChangeDate: v.last_oil_change_date ?? undefined,
  };
}

/** Active rentals to browse, plus a count of available vehicles per rental. */
export async function browseListRentals(): Promise<{
  rentals: Rental[];
  countByRental: Map<string, number>;
}> {
  const res = await apiClient.get('/browse/rentals/');
  const apiRentals = unwrapList<ApiBrowseRental>(res.data);
  const countByRental = new Map<string, number>();
  apiRentals.forEach((r) => countByRental.set(String(r.id), r.available_vehicle_count));
  return { rentals: apiRentals.map(mapRental), countByRental };
}

/** A single rental by id (or null if not found / has no available vehicles). */
export async function browseGetRental(rentalId: string): Promise<Rental | null> {
  try {
    const res = await apiClient.get(`/browse/rentals/${rentalId}/`);
    return mapRental(res.data as ApiBrowseRental);
  } catch {
    return null;
  }
}

/** Available vehicles for one rental. */
export async function browseListVehicles(rentalId: string): Promise<Vehicle[]> {
  const res = await apiClient.get(`/browse/rentals/${rentalId}/vehicles/`);
  return unwrapList<ApiVehicle>(res.data).map(mapVehicle);
}
