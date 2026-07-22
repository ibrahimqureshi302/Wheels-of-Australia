/**
 * Activity-log (audit-trail) data access.
 *
 * Records who did what within a rental owner's account — every action by the
 * owner or one of their staff. The backend scopes the list automatically:
 *   - rental OWNER → their account's activity (own + all staff)
 *   - admin        → all activity across every rental (rentalName populated)
 */
import { apiClient } from '../../lib/api/client';

/** One audit-trail entry: who did what, when. */
export interface ActivityEntry {
  id: string;
  /** Machine code, e.g. 'request.approved' / 'vehicle.created'. */
  action: string;
  /** Human-readable summary, phrased as "<did something>". */
  summary: string;
  /** In-app deep link to where the action happened. */
  link: string;
  /** True when a staff sub-account (not the owner) performed it. */
  byStaff: boolean;
  actorId: string | null;
  actorName: string;
  /** Owning rental (only meaningful in the admin, cross-rental view). */
  rentalId: string | null;
  rentalName: string;
  createdAt: string;
}

interface ApiActivity {
  id: number;
  action: string;
  summary: string;
  link: string;
  by_staff: boolean;
  actor_id: number | null;
  actor_name: string;
  rental_id: number | null;
  rental_name: string;
  created_at: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function mapEntry(a: ApiActivity): ActivityEntry {
  return {
    id: String(a.id),
    action: a.action,
    summary: a.summary,
    link: a.link || '',
    byStaff: Boolean(a.by_staff),
    actorId: a.actor_id != null ? String(a.actor_id) : null,
    actorName: a.actor_name || '',
    rentalId: a.rental_id != null ? String(a.rental_id) : null,
    rentalName: a.rental_name || '',
    createdAt: a.created_at,
  };
}

/** The activity log visible to the current user (owner: their account; admin: all). */
export async function listActivity(): Promise<ActivityEntry[]> {
  const res = await apiClient.get('/activity/');
  return unwrapList<ApiActivity>(res.data).map(mapEntry);
}
