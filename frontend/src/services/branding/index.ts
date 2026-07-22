import { apiClient } from '../../lib/api/client';

/**
 * App-wide branding (theme mode, colours, logo). This is a SINGLE global record
 * served by the backend at `/system/branding/`:
 *   - GET is open to everyone, so every user loads the same look on app start.
 *   - PATCH is admin-only, so only an admin can change it — and the change then
 *     applies to the whole application for all users (not just one browser).
 */

export type ThemeModeValue = 'light' | 'dark';

export interface BrandingPayload {
  mode: ThemeModeValue;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
}

interface BrandingApiShape {
  mode: ThemeModeValue;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  updated_at?: string;
}

const DEFAULT_PRIMARY = '#6366f1';
const DEFAULT_SECONDARY = '#f59e0b';

function fromApi(d: Partial<BrandingApiShape>): BrandingPayload {
  return {
    mode: d.mode === 'dark' ? 'dark' : 'light',
    primaryColor: typeof d.primary_color === 'string' ? d.primary_color : DEFAULT_PRIMARY,
    secondaryColor: typeof d.secondary_color === 'string' ? d.secondary_color : DEFAULT_SECONDARY,
    logoUrl: typeof d.logo_url === 'string' ? d.logo_url : '',
  };
}

function toApi(b: Partial<BrandingPayload>): Partial<BrandingApiShape> {
  const out: Partial<BrandingApiShape> = {};
  if (b.mode !== undefined) out.mode = b.mode;
  if (b.primaryColor !== undefined) out.primary_color = b.primaryColor;
  if (b.secondaryColor !== undefined) out.secondary_color = b.secondaryColor;
  if (b.logoUrl !== undefined) out.logo_url = b.logoUrl;
  return out;
}

/** Read the global branding (any user, even unauthenticated). */
export const getBranding = async (): Promise<BrandingPayload> => {
  const res = await apiClient.get('/system/branding/');
  return fromApi(res.data as BrandingApiShape);
};

/** Persist a branding change (admin only — backend enforces it). */
export const updateBranding = async (
  b: Partial<BrandingPayload>
): Promise<BrandingPayload> => {
  const res = await apiClient.patch('/system/branding/', toApi(b));
  return fromApi(res.data as BrandingApiShape);
};
