import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import type { ThemeMode } from '../assets/styles/theme';
import { createAppTheme } from '../assets/styles/theme';
import { getBranding, updateBranding } from '../services/branding';

// Local cache key. The server (`/system/branding/`) is the source of truth for
// the GLOBAL, app-wide branding — this cache only avoids a default-theme flash
// on first paint before the server value loads.
const STORAGE_KEY = 'woa_branding';

export interface BrandingState {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
}

const DEFAULT_PRIMARY = '#6366f1';
const DEFAULT_SECONDARY = '#f59e0b';

function loadBranding(): BrandingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrandingState>;
      return {
        mode: parsed.mode === 'dark' ? 'dark' : 'light',
        primaryColor: typeof parsed.primaryColor === 'string' ? parsed.primaryColor : DEFAULT_PRIMARY,
        secondaryColor: typeof parsed.secondaryColor === 'string' ? parsed.secondaryColor : DEFAULT_SECONDARY,
        logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : '',
      };
    }
  } catch {
    // ignore
  }
  return {
    mode: 'light',
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    logoUrl: '',
  };
}

function saveBranding(state: BrandingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface BrandingContextType extends BrandingState {
  setMode: (mode: ThemeMode) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setLogoUrl: (url: string) => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const [state, setState] = useState<BrandingState>(loadBranding);

  // Load the GLOBAL branding from the server on app start so every user (any
  // role) sees the same look the admin configured. The local cache above gives
  // an instant first paint; this overrides it with the authoritative value.
  useEffect(() => {
    let cancelled = false;
    getBranding()
      .then((remote) => {
        if (cancelled) return;
        saveBranding(remote);
        setState(remote);
      })
      .catch(() => {
        // Server unreachable — keep the cached/default theme.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persisting to the server is debounced: the colour picker fires `onChange`
  // continuously while dragging, so we save locally/optimistically on every
  // change but only PATCH the server ~500ms after the last one. Only admins
  // reach these setters (the Settings page is admin-only) and the backend
  // rejects writes from anyone else.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = useCallback((next: BrandingState) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      updateBranding(next).catch(() => {
        // Errors (e.g. a non-admin somehow calling this) surface via the global
        // toast; nothing extra to do here.
      });
    }, 500);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setState((prev) => {
      const next = { ...prev, mode };
      saveBranding(next);
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const setPrimaryColor = useCallback((primaryColor: string) => {
    setState((prev) => {
      const next = { ...prev, primaryColor: primaryColor || DEFAULT_PRIMARY };
      saveBranding(next);
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const setSecondaryColor = useCallback((secondaryColor: string) => {
    setState((prev) => {
      const next = { ...prev, secondaryColor: secondaryColor || DEFAULT_SECONDARY };
      saveBranding(next);
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const setLogoUrl = useCallback((logoUrl: string) => {
    setState((prev) => {
      const next = { ...prev, logoUrl };
      saveBranding(next);
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const resetBranding = useCallback(() => {
    const next: BrandingState = {
      mode: 'light',
      primaryColor: DEFAULT_PRIMARY,
      secondaryColor: DEFAULT_SECONDARY,
      logoUrl: '',
    };
    saveBranding(next);
    schedulePersist(next);
    setState(next);
  }, [schedulePersist]);

  const appTheme = useMemo(
    () =>
      createAppTheme({
        mode: state.mode,
        primaryColor: state.primaryColor,
        secondaryColor: state.secondaryColor,
      }),
    [state.mode, state.primaryColor, state.secondaryColor]
  );

  const value = useMemo<BrandingContextType>(
    () => ({
      ...state,
      setMode,
      setPrimaryColor,
      setSecondaryColor,
      setLogoUrl,
      resetBranding,
    }),
    [state, setMode, setPrimaryColor, setSecondaryColor, setLogoUrl, resetBranding]
  );

  return (
    <BrandingContext.Provider value={value}>
      <ThemeProvider theme={appTheme}>
        {children}
      </ThemeProvider>
    </BrandingContext.Provider>
  );
};

export function useBranding(): BrandingContextType {
  const ctx = React.useContext(BrandingContext);
  if (ctx === undefined) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return ctx;
}

export { BrandingContext };
