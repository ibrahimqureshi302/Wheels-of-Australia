/**
 * Notification display types. Reminder/decision types (oil, rego, payment,
 * rental_decision, location_disabled, suspension) plus backend events
 * 'registration' (new sign-up), 'staff' (rental added staff) and a 'system' fallback.
 */
export type NotificationType =
  | 'oil'
  | 'rego'
  | 'payment'
  | 'rental_decision'
  | 'location_disabled'
  | 'location_warning'
  | 'suspension'
  | 'registration'
  | 'staff'
  | 'vehicle_rented'
  | 'maintenance'
  | 'system';

/** The kind of record a notification points at, used to resolve the right
 * detail/edit page per the recipient's role. */
export type NotificationEntityType =
  | 'vehicle'
  | 'driver'
  | 'rental'
  | 'mechanic'
  | 'rental_staff'
  | 'booking'
  | 'maintenance'
  | 'registration'
  | '';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  createdAt: string; // ISO
  read: boolean;
  /** The record this notification is about (used for role-aware deep-linking). */
  entityType?: NotificationEntityType;
  /** Optional entity reference (e.g. vehicle id) */
  entityId?: string;
  /** What happened to the record: 'created' | 'updated' | 'deleted' | 'approved' … */
  action?: string;
  /** Who performed the action (snapshot), e.g. 'John Smith (driver)'. */
  actorName?: string;
  /** Optional in-app path to navigate to when the notification is clicked.
   * Fallback for when entityType can't be resolved to a page. */
  link?: string;
}
