/**
 * GPS tracking data access (Phase 5).
 *
 * Drivers with an active rental report their browser-GPS position to the backend
 * (`/driver/location/report/`); rental owners and admins read the latest vehicle
 * positions for the live map (`/tracking/locations/`). All calls suppress the
 * global error toast — the tracking UI surfaces its own messaging.
 */
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../lib/api/client';

type QuietConfig = AxiosRequestConfig & { suppressErrorToast: boolean };
const QUIET: QuietConfig = { suppressErrorToast: true } as QuietConfig;

export interface LocationReportResult {
  /** True when the driver has an active trip and the position was stored. */
  tracking: boolean;
  /** The driver's current strike count. */
  warnings: number;
}

export interface UnavailableResult {
  tracking: boolean;
  warnings: number;
  maxStrikes: number;
}

/** A vehicle's latest reported position, for the live map. */
export interface TrackedVehicle {
  vehicleId: number;
  vehicleLabel: string;
  rego: string;
  driverName: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
  /** True when the position is older than the staleness threshold. */
  stale: boolean;
}

/** Report the driver's current position. Returns null on any failure. */
export async function reportLocation(
  latitude: number,
  longitude: number,
  accuracy?: number | null,
): Promise<LocationReportResult | null> {
  try {
    const res = await apiClient.post<LocationReportResult>(
      '/driver/location/report/',
      { latitude, longitude, accuracy: accuracy ?? null },
      QUIET,
    );
    return res.data;
  } catch {
    return null;
  }
}

/** Tell the backend the driver's location is unavailable; returns the strike count. */
export async function reportLocationUnavailable(): Promise<UnavailableResult | null> {
  try {
    const res = await apiClient.post<UnavailableResult>('/driver/location/unavailable/', {}, QUIET);
    return res.data;
  } catch {
    return null;
  }
}

interface ApiTrackedVehicle {
  vehicle_id: number;
  vehicle_label: string;
  rego: string;
  driver_name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  stale: boolean;
}

/** Latest vehicle positions visible to the current rental owner / admin. */
export async function fetchTrackedLocations(): Promise<TrackedVehicle[]> {
  try {
    const res = await apiClient.get<ApiTrackedVehicle[]>('/tracking/locations/', QUIET);
    const rows = Array.isArray(res.data) ? res.data : [];
    return rows.map((r) => ({
      vehicleId: r.vehicle_id,
      vehicleLabel: r.vehicle_label,
      rego: r.rego,
      driverName: r.driver_name,
      latitude: r.latitude,
      longitude: r.longitude,
      accuracy: r.accuracy,
      recordedAt: r.recorded_at,
      stale: r.stale,
    }));
  } catch {
    return [];
  }
}
