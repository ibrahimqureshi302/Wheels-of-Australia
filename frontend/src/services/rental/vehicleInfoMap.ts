/** Shared API → frontend mappers for the embedded renter / maintenance detail
 * returned on vehicle serializers (fleet + admin vehicles). */
import type { VehicleRenterInfo, VehicleMaintenanceInfo } from './types';

export interface ApiRenter {
  driver_name: string;
  driver_email: string;
  driver_phone?: string;
  start_date?: string | null;
  end_date?: string | null;
  since?: string | null;
}

export interface ApiMaintenance {
  id: number;
  mechanic_name: string;
  mechanic_email: string;
  shop_name: string;
  work_description: string;
  quoted_price?: string | number | null;
  estimated_value?: number | null;
  estimated_unit?: string;
  mechanic_notes?: string;
  since?: string | null;
}

export function mapRenter(r: ApiRenter | null | undefined): VehicleRenterInfo | null {
  if (!r) return null;
  return {
    driverName: r.driver_name,
    driverEmail: r.driver_email,
    driverPhone: r.driver_phone || undefined,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    since: r.since || undefined,
  };
}

export function mapMaintenance(m: ApiMaintenance | null | undefined): VehicleMaintenanceInfo | null {
  if (!m) return null;
  return {
    id: m.id,
    mechanicName: m.mechanic_name,
    mechanicEmail: m.mechanic_email,
    shopName: m.shop_name,
    workDescription: m.work_description,
    quotedPrice: m.quoted_price != null ? Number(m.quoted_price) : undefined,
    estimatedValue: m.estimated_value ?? undefined,
    estimatedUnit: m.estimated_unit || undefined,
    mechanicNotes: m.mechanic_notes || undefined,
    since: m.since || undefined,
  };
}
