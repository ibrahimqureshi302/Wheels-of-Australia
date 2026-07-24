import {
  OilBarrel,
  Assignment,
  Payment,
  ThumbUp,
  LocationOff,
  Warning,
  HowToReg,
  People,
  NotificationsActive,
  DirectionsCar,
  Build,
} from '@mui/icons-material';
import type React from 'react';
import type { NotificationType } from '../../services/notifications/types';

/** Icon + accent colour per notification type, shared by the bell and the page. */
export const NOTIFICATION_ICON_MAP: Record<
  NotificationType,
  React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' }>
> = {
  oil: OilBarrel,
  rego: Assignment,
  payment: Payment,
  rental_decision: ThumbUp,
  location_disabled: LocationOff,
  location_warning: LocationOff,
  suspension: Warning,
  registration: HowToReg,
  staff: People,
  vehicle_rented: DirectionsCar,
  maintenance: Build,
  system: NotificationsActive,
};

export const NOTIFICATION_COLOR_MAP: Record<
  NotificationType,
  'warning' | 'info' | 'success' | 'error' | 'primary'
> = {
  oil: 'warning',
  rego: 'info',
  payment: 'primary',
  rental_decision: 'success',
  location_disabled: 'warning',
  location_warning: 'warning',
  suspension: 'error',
  registration: 'info',
  staff: 'primary',
  vehicle_rented: 'success',
  maintenance: 'warning',
  system: 'info',
};

/** Short "x minutes ago" style label from an ISO timestamp. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return 'just now';
  if (diffM < 60) return `${diffM} min ago`;
  if (diffH < 24) return `${diffH} hr ago`;
  if (diffD < 30) return `${diffD} day${diffD === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}
