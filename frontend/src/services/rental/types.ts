/** Rental registration (EPIC 3.1) */
export type RentalType = 'company' | 'individual';

export interface RentalRegistrationForm {
  rentalType: RentalType;
  companyName?: string;
  abn?: string;
  contactName: string;
  email: string;
  phone: string;
  address?: string;
  certificateFile?: File | null;
}

/** Australian vehicle insurance cover types offered as quick-pick suggestions.
 * The stored value is not limited to these — a custom provider name may be typed
 * instead — so `Vehicle.insuranceType` is a plain `string`. */
export type InsuranceType =
  | 'ctp'
  | 'third_party_property'
  | 'third_party_fire_theft'
  | 'comprehensive';

/** The driver currently renting a vehicle (shown to admin/rental on a rented vehicle). */
export interface VehicleRenterInfo {
  driverName: string;
  driverEmail: string;
  driverPhone?: string;
  startDate?: string;
  endDate?: string;
  since?: string;
}

/** The accepted maintenance job for a vehicle (shown on a maintenance vehicle). */
export interface VehicleMaintenanceInfo {
  id: number;
  mechanicName: string;
  mechanicEmail: string;
  shopName: string;
  workDescription: string;
  quotedPrice?: number;
  estimatedValue?: number;
  estimatedUnit?: string;
  mechanicNotes?: string;
  since?: string;
}

/** Vehicle / fleet (EPIC 3.2) – distance/summary per vehicle */
export interface Vehicle {
  id: string;
  /** Rental company this vehicle belongs to (for "Rent a vehicle" browse by rental) */
  rentalId?: string;
  make: string;
  model: string;
  year: number;
  rego: string;
  insuranceExpiry?: string;
  /** Insurance cover type code (see InsuranceType) or a custom provider name. */
  insuranceType?: string;
  /** Primary/thumbnail image (kept in sync with imageUrls[0]). */
  imageUrl?: string;
  /** All vehicle photos (data URLs). At least 2 are required when registering. */
  imageUrls?: string[];
  status: 'available' | 'rented' | 'pending_return' | 'maintenance';
  /** What maintenance is needed (set when status is changed to maintenance). */
  maintenanceNote?: string;
  /** Total distance (km) for this vehicle */
  totalDistanceKm?: number;
  /** Number of trips for this vehicle */
  trips?: number;
  /** Next oil service due date (e.g. "2025-03-15") */
  oilDueDate?: string;
  /** Rego renewal/expiry due date (e.g. "2025-04-20"). Drives the rego-expiry reminder. */
  regoDueDate?: string;
  /** Current odometer reading in km. */
  odometerKm?: number;
  /** Date of the last oil change (drives the oil-change-due reminder). */
  lastOilChangeDate?: string;
  /** Date rego was last paid (drives the rego-payment-due reminder). */
  lastRegoPaymentDate?: string;
  /** Rent price per day in AUD (e.g. 85) */
  rentPricePerDay?: number;
  /** Minimum rental duration in days (e.g. 3). Overrides rental company default when set. */
  minimumRentalDays?: number;
  /** Driver currently renting this vehicle (present when status === 'rented'). */
  renter?: VehicleRenterInfo | null;
  /** Accepted maintenance job (present when status === 'maintenance'). */
  maintenance?: VehicleMaintenanceInfo | null;
}

/** Rental request (EPIC 3.3) */
export type RentalRequestStatus = 'pending' | 'approved' | 'running' | 'rejected' | 'request_info' | 'completed';

/**
 * Return-handshake state on an active booking (orthogonal to `status`, which
 * stays 'running' until the final confirm-return). Drives every return button:
 * - ''                    running normally within period
 * - requested_by_rental   rental asked the driver to return early (driver acts)
 * - requested_by_driver   driver asked the rental to return early (rental acts)
 * - period_ended          end date passed; driver clicks Complete Trip
 * - driver_completed       driver completed; rental clicks Confirm Return
 */
export type ReturnState =
  | ''
  | 'requested_by_rental'
  | 'requested_by_driver'
  | 'period_ended'
  | 'driver_completed';

export interface RentalRequest {
  id: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  driverName: string;
  driverEmail: string;
  requestedAt: string;
  status: RentalRequestStatus;
  /** Current status of the booked vehicle — used to know a car is still out
   * (rented/pending_return) and must be released, even after the trip
   * auto-completed at the end of its rental period. */
  vehicleStatus?: 'available' | 'rented' | 'pending_return' | 'maintenance';
  /** When the owner approved/decided (ISO), used to pick the current booking
   * among a vehicle's history. */
  reviewedAt?: string | null;
  /** Return-handshake state (see ReturnState). */
  returnState?: ReturnState;
  /** When an early return was requested (ISO). */
  returnRequestedAt?: string | null;
  notes?: string;
  /** Requested rental period start (ISO date string) */
  rentalStartDate?: string;
  /** Requested rental period end (ISO date string) */
  rentalEndDate?: string;
  /** Identity documents the driver attached (data URLs). */
  idDocuments?: Array<{ docType: string; name: string; image: string }>;
  /** OCR-confirmed identity details. */
  verifiedDetails?: { fullName: string; dateOfBirth?: string; documentNumber: string; expiryDate: string } | null;
  /** The note shown to the driver when the rental requests more info. */
  infoRequestMessage?: string;
}

/** Payload when submitting a rental request (vehicle + dates) */
export interface RentalRequestPayload {
  vehicleId: string;
  startDate: string;
  endDate: string;
}
