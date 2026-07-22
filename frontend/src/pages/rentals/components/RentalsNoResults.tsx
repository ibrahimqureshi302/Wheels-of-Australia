import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { SearchOff } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const RentalsNoResults: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card
      variant="outlined"
      sx={{
        textAlign: 'center',
        py: 6,
        px: 3,
        borderRadius: 2.5,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <CardContent>
        <SearchOff sx={{ fontSize: 56, color: 'text.disabled', mb: 1.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
          {t('rentals.noResults')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('rentals.noResultsHint')}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default RentalsNoResults;
