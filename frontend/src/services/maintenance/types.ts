import type { IdDocument, VerifiedDetails } from '../ocr';

/** Maintenance jobs (rental flags a vehicle → mechanic quotes → rental accepts). */
export type MaintenanceStatus =
  | 'pending' | 'quoted' | 'running' | 'accepted' | 'declined' | 'cancelled'
  | 'pending_return' | 'completed' | 'info_requested';

export type DurationUnit = 'hours' | 'days';

export interface MaintenanceRequest {
  id: string;
  vehicleId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRego: string;
  vehicleImage?: string;
  vehicleStatus: string;
  /** Stable id of the rental provider (company OR individual owner) who owns the
   * vehicle. Use this to count/group distinct rentals — display names can be
   * blank or duplicated, especially for individual owners. */
  rentalId: string;
  rentalName: string;
  mechanicId?: string;
  mechanicName?: string;
  mechanicEmail?: string;
  mechanicPhone?: string;
  mechanicShop?: string;
  mechanicShopAddress?: string;
  mechanicAbn?: string;
  /** Work the rental needs done (written by the rental owner). */
  workDescription: string;
  status: MaintenanceStatus;
  statusDisplay: string;
  /** Mechanic's quote. */
  quotedPrice?: number;
  estimatedValue?: number;
  estimatedUnit?: DurationUnit | '';
  mechanicNotes?: string;
  /** Rental's reason when declining. */
  decisionReason?: string;
  /** Identity documents the mechanic attached when quoting. */
  idDocuments: IdDocument[];
  /** OCR-confirmed identity details. */
  verifiedDetails: VerifiedDetails | null;
  /** The rental's note when they request more information. */
  infoRequestMessage: string;
  quotedAt?: string;
  decidedAt?: string;
  workCompletedAt?: string;
  completedAt?: string;
  createdAt: string;
}

/** Mechanic's quote payload. */
export interface QuotePayload {
  quotedPrice: number;
  estimatedValue: number;
  estimatedUnit: DurationUnit;
  mechanicNotes?: string;
  idDocuments: IdDocument[];
  verifiedDetails: VerifiedDetails;
}
