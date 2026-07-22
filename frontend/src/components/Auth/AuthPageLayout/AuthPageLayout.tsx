import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { cardVariants } from '../../../lib/animations';
import { theme as authTheme } from '../../../assets/styles/theme';

const cardBackground = 'rgba(255, 255, 255, 0.98)';

/** Hex to rgba with alpha */
function hexToRgba(hex: string, alpha: number): string {
  const match = hex.replace(/^#/, '').match(/(..?)(..?)(..?)/);
  if (!match) return hex;
  const [r, g, b] = match.map((x) => parseInt(x.length === 1 ? x + x : x, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface AuthPageLayoutProps {
  children: React.ReactNode;
  /** Optional branded banner rendered fixed at the very top of the card (above the icon/title). */
  header?: React.ReactNode;
  /** Optional icon or logo above title */
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: number;
  /** When true, card has fixed max height and content scrolls inside (signup pages). When false, card grows with content (login). */
  fixedCardHeight?: boolean;
  /** When fixedCardHeight is true, this is rendered fixed at the bottom of the card (e.g. "Already have an account? Sign In"). */
  footer?: React.ReactNode;
}

const AuthPageLayout: React.FC<AuthPageLayoutProps> = ({
  children,
  header,
  icon,
  title,
  subtitle,
  maxWidth = 450,
  fixedCardHeight = false,
  footer,
}) => {
  // Auth screens always use the light theme so text stays readable on the white
  // card even when the rest of the app is in dark mode (BrandingContext).
  const isFixedHeight = fixedCardHeight;
  const primary = authTheme.palette.primary.main;

  const authBackgroundSx = React.useMemo(
    () => ({
      backgroundColor: primary,
      backgroundAttachment: 'fixed',
    }),
    [primary]
  );

  const headerSlot = header ? <Box sx={{ flexShrink: 0 }}>{header}</Box> : null;

  const headerBlock = (icon || title || subtitle) ? (
    <Box
      sx={{
        textAlign: 'center',
        mb: 4,
        flexShrink: 0,
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 88,
            height: 88,
            borderRadius: '50%',
            backgroundColor: primary,
            boxShadow: `0 4px 12px ${hexToRgba(primary, 0.4)}`,
            mb: 2,
          }}
        >
          {icon}
        </Box>
      )}
      {title && (
        <Typography
          component="h1"
          variant="h5"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            mb: 1,
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' }, lineHeight: 1.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  ) : null;

  return (
    <ThemeProvider theme={authTheme}>
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        p: { xs: 1.5, sm: 2 },
        ...authBackgroundSx,
        overflow: isFixedHeight ? 'hidden' : 'auto',
        boxSizing: 'border-box',
      }}
    >
    <Box
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', sm: maxWidth },
        position: 'relative',
        zIndex: 1,
        ...(isFixedHeight
          ? { maxHeight: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }
          : { py: { xs: 2, sm: 0 } }),
      }}
    >
      <motion.div
        variants={cardVariants}
        initial="initial"
        animate="animate"
        style={
          isFixedHeight
            ? { width: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
            : { width: '100%' }
        }
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 4, md: 5 },
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            background: cardBackground,
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: 4,
            boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.04)',
            // Keep browser autofill from painting input text in an unreadable colour.
            '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus': {
              WebkitTextFillColor: '#111827',
              transition: 'background-color 9999s ease-out 0s',
            },
            ...(isFixedHeight && {
              // Cap the card at the viewport (minus the outer padding) using vh so
              // the limit always resolves — percentage heights don't propagate
              // reliably through a flex chain. Shorter forms stay content-sized and
              // centered; taller forms hit this cap and scroll inside (below).
              maxHeight: { xs: 'calc(100vh - 24px)', sm: 'calc(100vh - 32px)' },
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }),
          }}
        >
          {isFixedHeight ? (
            <>
              {headerSlot}
              {headerBlock}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  // Give floating outlined-input labels room so the first row
                  // isn't clipped by the top of the scroll area.
                  pt: 1,
                  px: '2px',
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { width: 0, display: 'none' },
                }}
              >
                {children}
              </Box>
              {footer ? (
                <Box sx={{ flexShrink: 0, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
                  {footer}
                </Box>
              ) : null}
            </>
          ) : (
            <>
              {headerSlot}
              {headerBlock}
              {children}
            </>
          )}
        </Paper>
      </motion.div>
    </Box>
  </Box>
  </ThemeProvider>
  );
};

export default AuthPageLayout;
