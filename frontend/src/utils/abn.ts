/** Australian Business Number helpers. An ABN is exactly 11 digits. */

export const ABN_ERROR = 'ABN must be exactly 11 digits.';

/** Strip spaces from an ABN as typed (ABNs are often shown space-separated). */
export function normalizeAbn(value: string): string {
  return (value || '').replace(/\s/g, '');
}

/** True when the value is exactly 11 digits (spaces allowed in input). */
export function isValidAbn(value: string): boolean {
  return /^\d{11}$/.test(normalizeAbn(value));
}
