import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { fadeVariants } from '../../../lib/animations';

export interface PageHeroProps {
  /** Main heading shown in the gradient banner. */
  title: React.ReactNode;
  /** Optional supporting line beneath the title. */
  subtitle?: React.ReactNode;
  /**
   * Optional content rendered on the right of the banner (e.g. an action
   * button). Style it for a coloured background — the banner uses the
   * primary→secondary gradient with light text.
   */
  actions?: React.ReactNode;
  /**
   * Page body. Rendered in a padded container that overlaps the bottom of the
   * banner (matching the dashboard's stat cards). Omit to render the banner
   * only.
   */
  children?: React.ReactNode;
  /** Horizontal padding for the content area. Defaults to the standard page gutter. */
  disableContentGutter?: boolean;
}

/**
 * Shared page header: a flat, full-width gradient banner (same as the
 * dashboard / profile) with the page title and an optional subtitle, followed
 * by the page content tucked just under the banner. Use on every main
 * list/content page so the whole app shares one header design.
 */
const PageHero: React.FC<PageHeroProps> = ({
  title,
  subtitle,
  actions,
  children,
  disableContentGutter = false,
}) => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;

  return (
    <Box sx={{ width: '100%', minHeight: '100%', maxWidth: '100%' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 0,
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
            color: 'primary.contrastText',
            boxShadow: `0 4px 20px ${primary}40`,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              fontWeight={700}
              sx={{ mb: subtitle ? 0.5 : 0, letterSpacing: '-0.02em' }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" sx={{ opacity: 0.95 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
        </Box>
      </motion.div>

      {children != null && (
        <Box
          sx={{
            px: disableContentGutter ? 0 : { xs: 2, sm: 3 },
            pt: { xs: 2.5, sm: 3 },
            pb: { xs: 3, sm: 4 },
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
};

export default PageHero;
