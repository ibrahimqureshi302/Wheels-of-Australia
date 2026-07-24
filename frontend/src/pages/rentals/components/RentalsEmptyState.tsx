import React from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';
import { Add, Business } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface RentalsEmptyStateProps {
  onAddRental: () => void;
}

const RentalsEmptyState: React.FC<RentalsEmptyStateProps> = ({ onAddRental }) => {
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
        <Business sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
          {t('rentals.noRentalsYet')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('rentals.noRentalsMessage')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAddRental}
          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
        >
          {t('rentals.addRental')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default RentalsEmptyState;
