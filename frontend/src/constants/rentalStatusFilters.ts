import type { RentalRequestStatus } from '../services/rental/types';

/** A single status-filter option for rental booking requests. `match` lists the
 *  raw statuses the option covers (e.g. "Running" also covers legacy `approved`).
 *  `all` matches everything (empty `match`). Shared by the Rental Dashboard feed
 *  and the Rental Requests page so both filter identically. */
export interface RentalStatusFilter {
  value: string;
  labelKey: string;
  fallback: string;
  match: RentalRequestStatus[];
}

export const RENTAL_STATUS_FILTERS: RentalStatusFilter[] = [
  { value: 'all', labelKey: 'rentalRequests.filterAll', fallback: 'All', match: [] },
  { value: 'pending', labelKey: 'rentalRequests.statusPending', fallback: 'Pending', match: ['pending'] },
  { value: 'request_info', labelKey: 'rentalRequests.statusInfoRequested', fallback: 'Info requested', match: ['request_info'] },
  { value: 'running', labelKey: 'rentalRequests.statusRunning', fallback: 'Running', match: ['running', 'approved'] },
  { value: 'completed', labelKey: 'rentalRequests.statusCompleted', fallback: 'Completed', match: ['completed'] },
  { value: 'rejected', labelKey: 'rentalRequests.statusRejected', fallback: 'Rejected', match: ['rejected'] },
];

/** True when a request's status is shown under the given filter value. */
export function matchesRentalStatusFilter(status: RentalRequestStatus, filter: string): boolean {
  if (filter === 'all') return true;
  const def = RENTAL_STATUS_FILTERS.find((f) => f.value === filter);
  return def ? def.match.includes(status) : true;
}
