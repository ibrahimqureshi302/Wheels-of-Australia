/**
 * Document OCR for the identity-verification step.
 *
 * The actual reading happens on the SERVER: we upload the document image to the
 * backend `/ocr/extract/` endpoint, which calls Google Gemini (a vision model)
 * with the server-side API key to (a) classify the document — passport, CNIC or
 * driving licence — and (b) extract the holder's name, date of birth, document
 * number and expiry for the user to review and confirm. The Gemini key is never
 * exposed to the browser.
 *
 * If the OCR call fails, callers get a permissive "couldn't check" result so the
 * manual-entry flow still works.
 */
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../lib/api/client';

export type IdDocType = 'passport' | 'licence' | 'cnic';

export interface IdDocument {
  docType: IdDocType;
  name: string;
  /** Data URL of the uploaded image. */
  image: string;
}

export interface VerifiedDetails {
  fullName: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  documentNumber: string;
  expiryDate: string; // ISO yyyy-mm-dd
}

export const ID_DOC_LABELS: Record<IdDocType, string> = {
  passport: 'Passport',
  licence: 'Driving licence',
  cnic: 'CNIC',
};

/** Read a File into a data URL (so images can be stored/shown without a server). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Open an uploaded identity document (an ID scan / PDF) in a new browser tab.
 *
 * Documents are stored as `data:` URLs. Browsers BLOCK top-level navigation to
 * `data:` URLs as an anti-phishing measure, so a plain
 * `<a href={dataUrl} target="_blank">` silently does nothing when clicked —
 * which is why the rental/mechanic couldn't open the driver's document. We
 * convert the data URL to a Blob and open its `blob:` object URL instead, which
 * browsers allow. Anything that isn't a data URL (e.g. a hosted file URL) is
 * opened directly. Must be called from a user gesture (click) so the popup
 * isn't blocked.
 */
export function openDocument(image: string): void {
  if (!image) return;
  if (!image.startsWith('data:')) {
    window.open(image, '_blank', 'noopener');
    return;
  }
  try {
    const [meta, base64 = ''] = image.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    window.open(url, '_blank', 'noopener');
    // Revoke once the new tab has had time to load; revoking immediately would
    // break the still-loading document.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    // Last resort — try the raw data URL (may be blocked, but better than nothing).
    window.open(image, '_blank', 'noopener');
  }
}

/** Shape returned by the backend `/ocr/extract/` endpoint. */
interface ApiOcrResult {
  doc_type: 'passport' | 'licence' | 'cnic' | 'unknown';
  looks_like_id: boolean;
  full_name: string;
  date_of_birth: string;
  document_number: string;
  expiry_date: string;
  nationality: string;
}

export interface DocReadResult {
  details: VerifiedDetails;
  /** True when the upload looks like a real ID document. */
  looksLikeId: boolean;
  /** False when we couldn't run the check (OCR unavailable / call failed). */
  checked: boolean;
  /** True when the OCR call was attempted but failed (so the UI can prompt manual entry). */
  error?: boolean;
  /** The document type Gemini detected, if it recognised one. */
  detectedType?: IdDocType;
  /** Nationality / issuing country, when read. */
  nationality?: string;
}

/** POST the image to the backend OCR endpoint. Returns null on any failure. */
async function callOcr(file: File): Promise<ApiOcrResult | null> {
  try {
    const image = await fileToDataUrl(file);
    const res = await apiClient.post<ApiOcrResult>(
      '/ocr/extract/',
      { image },
      // A Gemini vision call plus server-side retries can take well over the
      // shared 10s default, so give this request a generous timeout. The
      // component surfaces its own messaging, so suppress the global toast.
      { timeout: 60000, suppressErrorToast: true } as AxiosRequestConfig & { suppressErrorToast: boolean },
    );
    return res.data;
  } catch {
    return null;
  }
}

function detectedTypeOf(r: ApiOcrResult): IdDocType | undefined {
  return r.doc_type === 'unknown' ? undefined : r.doc_type;
}

/**
 * Read an uploaded document via the backend Gemini OCR. `fallbackName` (the
 * logged-in user's name) is used only when no name could be read. If the OCR
 * call fails, details come back blank and `checked` is false so the user simply
 * types the details in.
 */
export async function readDocument(
  file: File,
  _docType?: IdDocType,
  fallbackName = '',
): Promise<DocReadResult> {
  const blank: VerifiedDetails = { fullName: fallbackName, dateOfBirth: '', documentNumber: '', expiryDate: '' };
  const r = await callOcr(file);
  if (!r) {
    return { details: blank, looksLikeId: true, checked: false, error: true };
  }
  return {
    details: {
      fullName: r.full_name || fallbackName,
      dateOfBirth: r.date_of_birth || '',
      documentNumber: r.document_number || '',
      expiryDate: r.expiry_date || '',
    },
    looksLikeId: r.looks_like_id,
    checked: true,
    detectedType: detectedTypeOf(r),
    nationality: r.nationality || undefined,
  };
}

/**
 * Lightweight check for forms that only need a yes/no (e.g. registration):
 * does this uploaded image look like an ID document? Returns `checked: false`
 * (don't warn) when the OCR call fails.
 */
export async function looksLikeIdDocument(
  file: File,
): Promise<{ looksLikeId: boolean; checked: boolean; detectedType?: IdDocType }> {
  const r = await callOcr(file);
  if (!r) return { looksLikeId: true, checked: false };
  return { looksLikeId: r.looks_like_id, checked: true, detectedType: detectedTypeOf(r) };
}
