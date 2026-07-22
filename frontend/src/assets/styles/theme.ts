import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

/** Refined shadow scale (no duplication) – MUI requires exactly 25 elements */
const shadows: ThemeOptions['shadows'] = [
  'none',
  '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
];

const basePalette = {
  primary: {
    main: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    contrastText: '#ffffff',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    contrastText: '#ffffff',
  },
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
    contrastText: '#ffffff',
  },
  grey: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: {
    fontSize: '1.875rem',
    fontWeight: 700,
    lineHeight: 1.2,
    '@media (min-width:600px)': { fontSize: '2.5rem' },
  },
  h2: {
    fontSize: '1.5rem',
    fontWeight: 700,
    lineHeight: 1.3,
    '@media (min-width:600px)': { fontSize: '2rem' },
  },
  h3: {
    fontSize: '1.375rem',
    fontWeight: 600,
    lineHeight: 1.3,
    '@media (min-width:600px)': { fontSize: '1.75rem' },
  },
  h4: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
    '@media (min-width:600px)': { fontSize: '1.5rem' },
  },
  h5: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    '@media (min-width:600px)': { fontSize: '1.25rem' },
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.4,
    '@media (min-width:600px)': { fontSize: '1.125rem' },
  },
  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.6 },
  button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' as const },
};

/** MUI transition durations – align with lib/animations for consistency */
const transitions = {
  duration: {
    shortest: 150,
    shorter: 200,
    short: 250,
    standard: 300,
    complex: 375,
    enteringScreen: 350,
    leavingScreen: 250,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
    easeOutBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

const shape = { borderRadius: 8 };
const spacing = 8;

/** Shared button base — same metrics in light + dark. */
const buttonRootStyles = {
  textTransform: 'none' as const,
  borderRadius: 12,
  fontWeight: 600,
  fontSize: '0.875rem',
  padding: '12px 24px',
  boxShadow: 'none',
  transition: `box-shadow ${transitions.duration.short}ms ${transitions.easing.easeOut}, background-color ${transitions.duration.short}ms ${transitions.easing.easeOut}`,
  '&:hover': {
    boxShadow: shadows[3],
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${basePalette.primary.main}`,
    outlineOffset: 2,
  },
};

const componentOverridesLight = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        fontFamily: typography.fontFamily,
        backgroundColor: '#ffffff',
        color: '#111827',
      },
      /* Phase G3: visible focus for keyboard users */
      'a:focus-visible, button:focus-visible': {
        outline: `2px solid ${basePalette.primary.main}`,
        outlineOffset: 2,
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: buttonRootStyles,
      contained: {
        '&:hover': { backgroundColor: basePalette.primary.dark },
      },
      outlined: {
        borderColor: '#d1d5db',
        color: '#374151',
        '&:hover': {
          borderColor: basePalette.primary.main,
          backgroundColor: 'rgba(99, 102, 241, 0.04)',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        boxShadow: shadows[3],
        border: '1px solid #f3f4f6',
        transition: `box-shadow ${transitions.duration.short}ms ${transitions.easing.easeOut}`,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { borderRadius: 12 },
      elevation1: { boxShadow: shadows[3] },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          transition: `border-color ${transitions.duration.shorter}ms ${transitions.easing.easeOut}`,
          '& fieldset': { borderColor: '#94a3b8' },
          '&:hover fieldset': { borderColor: basePalette.primary.main },
          '&.Mui-focused fieldset': {
            borderColor: basePalette.primary.main,
            borderWidth: 2,
          },
          '&.Mui-focused.Mui-focusVisible fieldset': {
            borderColor: basePalette.primary.main,
            borderWidth: 2,
          },
        },
        '& .MuiInputLabel-root': {
          fontWeight: 500,
          color: '#6b7280',
          '&.Mui-focused': { color: basePalette.primary.main },
        },
      },
    },
  },
  // Covers standalone Select / FormControl filters (not wrapped in TextField)
  // so dropdown borders stay clearly visible in both light and dark mode.
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: basePalette.primary.main },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: basePalette.primary.main,
          borderWidth: 2,
        },
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: { backgroundColor: basePalette.primary.main, boxShadow: shadows[3] },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8, fontWeight: 500 },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 12, fontWeight: 500 },
    },
  },
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    ...basePalette,
    background: { default: '#ffffff', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#6b7280', disabled: '#9ca3af' },
  },
  typography,
  spacing,
  shape,
  shadows,
  transitions,
  components: componentOverridesLight,
});

/** Dark theme – ready for EPIC 9 (admin theme toggle) */
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    ...basePalette,
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
  },
  typography,
  spacing,
  shape,
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    ...Array(18).fill('0 25px 50px -12px rgba(0, 0, 0, 0.5)'),
  ] as ThemeOptions['shadows'],
  transitions,
  components: {
    ...componentOverridesLight,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: typography.fontFamily,
          backgroundColor: '#0f172a',
          color: '#f1f5f9',
        },
        'a:focus-visible, button:focus-visible': {
          outline: `2px solid ${basePalette.primary.light}`,
          outlineOffset: 2,
        },
        // Native date/time inputs render a near-black calendar picker icon that
        // vanishes against our dark input surface. Invert it to a light glyph so
        // it stays visible (dark theme only — light mode keeps the default icon).
        'input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator, input[type="datetime-local"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator': {
          filter: 'invert(1) brightness(1.8)',
          cursor: 'pointer',
          opacity: 1,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12, backgroundImage: 'none' },
        elevation1: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)' },
      },
    },
    // Dark mode needs palette-aware button colours — the light overrides hardcode
    // a dark-grey outlined text (#374151) that is invisible on the dark surface.
    MuiButton: {
      styleOverrides: {
        root: buttonRootStyles,
        contained: ({ ownerState, theme }: any) => {
          const c = ownerState.color && ownerState.color !== 'inherit' ? ownerState.color : 'primary';
          const pal = theme.palette[c] ?? theme.palette.primary;
          return { '&:hover': { backgroundColor: pal.dark } };
        },
        outlined: ({ ownerState, theme }: any) => {
          const c = ownerState.color;
          // Neutral (default/primary/inherit) → light text on a subtle border.
          if (!c || c === 'inherit' || c === 'primary') {
            return {
              borderColor: 'rgba(148, 163, 184, 0.5)',
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.primary.light,
                backgroundColor: 'rgba(129, 140, 248, 0.14)',
              },
            };
          }
          // Semantic colour → use the lighter shade so it stays vivid on dark.
          const pal = theme.palette[c] ?? theme.palette.primary;
          return {
            borderColor: pal.light,
            color: pal.light,
            '&:hover': {
              borderColor: pal.light,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            },
          };
        },
        text: ({ ownerState, theme }: any) => {
          const c = ownerState.color;
          if (!c || c === 'inherit' || c === 'primary') {
            return {
              color: theme.palette.primary.light,
              '&:hover': { backgroundColor: 'rgba(129, 140, 248, 0.14)' },
            };
          }
          const pal = theme.palette[c] ?? theme.palette.primary;
          return {
            color: pal.light,
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
          };
        },
      },
    },
  },
});

export type ThemeMode = 'light' | 'dark';

/** Returns theme by mode – use when adding theme switcher (EPIC 9) */
export function getTheme(mode: ThemeMode) {
  return mode === 'dark' ? darkTheme : theme;
}

export interface BrandingThemeOptions {
  mode: ThemeMode;
  /** Primary colour hex (e.g. #6366f1). If not set, uses default. */
  primaryColor?: string;
  /** Secondary colour hex (e.g. #f59e0b). If not set, uses default. */
  secondaryColor?: string;
}

/** Hex to rgba for hover overlays */
function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/(..?)(..?)(..?)/);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x.length === 1 ? x + x : x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Create theme with optional admin-set primary and secondary colours (EPIC 9) */
export function createAppTheme(options: BrandingThemeOptions) {
  const { mode, primaryColor, secondaryColor } = options;
  const base = mode === 'dark' ? darkTheme : theme;
  const primaryChanged = primaryColor && primaryColor !== base.palette.primary.main;
  const secondaryChanged = secondaryColor && secondaryColor !== base.palette.secondary.main;
  if (!primaryChanged && !secondaryChanged) {
    return base;
  }
  const resolvedPrimary = primaryChanged ? primaryColor! : base.palette.primary.main;
  const resolvedSecondary = secondaryChanged ? secondaryColor! : base.palette.secondary.main;

  return createTheme({
    ...base,
    palette: {
      ...base.palette,
      ...(primaryChanged && {
        primary: {
          ...base.palette.primary,
          main: resolvedPrimary,
        },
      }),
      ...(secondaryChanged && {
        secondary: {
          ...base.palette.secondary,
          main: resolvedSecondary,
        },
      }),
    },
    components: {
      ...base.components,
      ...(primaryChanged && {
        MuiButton: {
          ...base.components?.MuiButton,
          styleOverrides: {
            ...(typeof base.components?.MuiButton === 'object' && base.components?.MuiButton?.styleOverrides),
            contained: {
              '&:hover': { backgroundColor: resolvedPrimary },
            },
            outlined: {
              '&:hover': {
                borderColor: resolvedPrimary,
                backgroundColor: hexToRgba(resolvedPrimary, 0.04),
              },
            },
          },
        },
        MuiTextField: {
          ...base.components?.MuiTextField,
          styleOverrides: {
            root: {
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': { borderColor: resolvedPrimary },
                '&.Mui-focused fieldset': { borderColor: resolvedPrimary },
              },
              '& .MuiInputLabel-root': {
                '&.Mui-focused': { color: resolvedPrimary },
              },
            },
          },
        },
        MuiAppBar: {
          ...base.components?.MuiAppBar,
          styleOverrides: {
            root: { backgroundColor: resolvedPrimary },
          },
        },
      }),
    },
  });
}

export default theme;
