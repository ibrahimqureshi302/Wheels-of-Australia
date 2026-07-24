import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SxProps, Theme } from '@mui/material';

/**
 * Data attribute the highlighted row/card stamps onto its DOM node so the hook
 * can locate and scroll to it once it has rendered.
 */
export const HIGHLIGHT_ATTR = 'data-record-highlight';

/** Props a list row/card spreads onto its element when it is the highlighted one. */
export function highlightAttrProps(active: boolean): Record<string, string> {
  return active ? { [HIGHLIGHT_ATTR]: 'on' } : {};
}

/**
 * The temporary flash applied to the record a notification points at. A short
 * pulsing ring + background tint that reads clearly on both table rows and
 * cards, then fades. Works as an MUI `sx` value.
 */
export const highlightSx: SxProps<Theme> = {
  animation: 'recordHighlightPulse 0.9s ease-in-out 3',
  '@keyframes recordHighlightPulse': {
    '0%, 100%': {
      backgroundColor: 'transparent',
      boxShadow: '0 0 0 0 rgba(37,99,235,0)',
    },
    '50%': {
      backgroundColor: 'rgba(37,99,235,0.16)',
      boxShadow: '0 0 0 3px rgba(37,99,235,0.5)',
    },
  },
};

/**
 * Drives the "flash the record a notification points at" behaviour, used
 * consistently by every list/section page.
 *
 * Reads the `?highlight=<id>` deep-link param that {@link resolveNotificationTarget}
 * sets, and once `ready` (the page's records have loaded) flashes the matching
 * row/card and scrolls it into view. A list marks its matching element with
 * `isHighlighted(id)` (for the {@link highlightSx} flash) and spreads
 * {@link highlightAttrProps} (so this hook can find it to scroll). The flash
 * clears after a few seconds.
 *
 * @param ready pass the page's "data loaded" flag so we scroll only after the
 *   target row/card has actually rendered (lists fetch asynchronously).
 */
export function useHighlightTarget(ready: boolean = true) {
  const [params] = useSearchParams();
  const highlightId = params.get('highlight');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightId || !ready) return;
    setActiveId(highlightId);
    // Let React paint the flagged row/card, then bring it into view.
    const scrollTimer = setTimeout(() => {
      const el = document.querySelector(`[${HIGHLIGHT_ATTR}="on"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
    const clearTimer = setTimeout(() => setActiveId(null), 2800);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightId, ready]);

  const isHighlighted = (id: string | number): boolean =>
    activeId != null && String(id) === activeId;

  return { highlightId, activeId, isHighlighted };
}
