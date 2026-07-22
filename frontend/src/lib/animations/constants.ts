/**
 * Shared animation timing and easing.
 * Use these so we can later respect prefers-reduced-motion in one place.
 */

export const TRANSITION = {
  /** Fast: buttons, chips, toasts */
  fast: { duration: 0.15 },
  /** Normal: cards, modals, list items */
  normal: { duration: 0.25 },
  /** Page/route transitions */
  page: { duration: 0.35 },
  /** Slow: complex layout or emphasis */
  slow: { duration: 0.5 },
} as const;

export const EASING = {
  /** Default smooth ease */
  easeOut: [0.33, 1, 0.68, 1] as [number, number, number, number],
  /** Slight overshoot for playful feel */
  easeOutBack: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  /** Snappy */
  easeInOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
} as const;
