/**
 * Rental fleet data access — the single entry point the Fleet pages (and the
 * dashboard / maintenance) use.
 *
 * Backed by the Django `fleet` API (persists to the DB, so a rental's vehicles
 * become visible to drivers on the Browse-rentals page). All functions are async.
 */
import { fleetApi } from './fleetApi';
import type { Vehicle } from './types';

export async function listFleet(): Promise<Vehicle[]> {
  return fleetApi.list();
}

export async function getFleetVehicle(id: string): Promise<Vehicle | null> {
  return fleetApi.get(id);
}

export async function addFleetVehicle(input: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  return fleetApi.add(input);
}

export async function updateFleetVehicle(id: string, patch: Partial<Vehicle>): Promise<void> {
  await fleetApi.update(id, patch);
}

export async function removeFleetVehicle(id: string): Promise<void> {
  await fleetApi.remove(id);
}
