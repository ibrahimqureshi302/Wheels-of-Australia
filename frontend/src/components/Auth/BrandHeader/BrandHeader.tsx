import React from 'react';
import { Box, Typography } from '@mui/material';
import { DirectionsCar } from '@mui/icons-material';

export interface BrandHeaderProps {
  /** Small line under the brand name. Defaults to the platform tagline. */
  subtitle?: string;
}

/** Branded gradient banner shown at the top of the login and registration cards. */
const BrandHeader: React.FC<BrandHeaderProps> = ({ subtitle = 'Car Rental Digital Platform' }) => (
  <Box
    sx={{
      mb: 3,
      px: 3,
      py: 3,
      borderRadius: 3,
      textAlign: 'center',
      color: 'common.white',
      background: (theme) =>
        `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
      boxShadow: '0 12px 24px -10px rgba(99, 102, 241, 0.6)',
    }}
  >
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 60,
        height: 60,
        mb: 1,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <DirectionsCar sx={{ fontSize: 34 }} />
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
      Wheels of Australia
    </Typography>
    <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
      {subtitle}
    </Typography>
  </Box>
);

export default BrandHeader;
