import React from 'react';
import { Box, Typography } from '@mui/material';

/** Small section heading used inside detail popups (matches the registration view). */
export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5, display: 'block' }}
  >
    {children}
  </Typography>
);

/** Labelled value row used inside detail popups. */
export const Field: React.FC<{ label: string; value?: string | number | null }> = ({
  label,
  value,
}) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
      {value === 0 || value ? value : '—'}
    </Typography>
  </Box>
);
