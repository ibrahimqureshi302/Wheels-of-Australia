import React from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';
import { Add, DirectionsCar } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface FleetEmptyStateProps {
  onAddVehicle: () => void;
}

const FleetEmptyState: React.FC<FleetEmptyStateProps> = ({ onAddVehicle }) => {
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
        <DirectionsCar sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
          {t('fleet.noVehiclesYet')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('fleet.noVehiclesMessage')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAddVehicle}
          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
        >
          {t('fleet.addVehicle')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default FleetEmptyState;
