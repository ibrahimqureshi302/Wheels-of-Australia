import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { DirectionsCar } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const VehiclesEmptyState: React.FC = () => {
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
          theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      <CardContent>
        <DirectionsCar sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
          {t('vehicles.noVehiclesAvailable')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('vehicles.noVehiclesMessage')}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default VehiclesEmptyState;
