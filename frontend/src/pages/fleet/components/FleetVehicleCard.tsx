import React from 'react';
import { Card, CardContent, CardActionArea, Box, Typography, Chip } from '@mui/material';
import { Route, Straighten, OilBarrel, Assignment, EditOutlined, DirectionsCar, AttachMoney } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../../../services/rental/types';

export interface FleetVehicleCardProps {
  vehicle: Vehicle;
  onEdit: (id: string) => void;
}

const getStatusColor = (status: Vehicle['status']): 'success' | 'info' | 'warning' | 'default' => {
  switch (status) {
    case 'available':
      return 'success';
    case 'rented':
      return 'info';
    case 'maintenance':
      return 'warning';
    default:
      return 'default';
  }
};

const FleetVehicleCard: React.FC<FleetVehicleCardProps> = ({ vehicle, onEdit }) => {
  const { t } = useTranslation();
  const [imgError, setImgError] = React.useState(false);
  const showImg = Boolean(vehicle.imageUrl) && !imgError;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? '0 2px 8px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 4px 20px rgba(0,0,0,0.08)'
              : '0 4px 20px rgba(0,0,0,0.25)',
          borderColor: 'primary.main',
        },
      }}
    >
      <CardActionArea
        onClick={() => onEdit(vehicle.id)}
        sx={{ display: 'block', textAlign: 'left' }}
        disableRipple
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {showImg ? (
                  <Box
                    component="img"
                    src={vehicle.imageUrl}
                    alt=""
                    onError={() => setImgError(true)}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <DirectionsCar sx={{ fontSize: 28, color: 'text.secondary' }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    color: 'text.primary',
                    lineHeight: 1.3,
                  }}
                >
                  {vehicle.make} {vehicle.model}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.8125rem' }}>
                  {vehicle.year} · {t('fleet.rego')}: {vehicle.rego}
                  {vehicle.insuranceExpiry && ` · ${t('fleet.insurance')}: ${vehicle.insuranceExpiry}`}
                </Typography>
                {(vehicle.totalDistanceKm != null || vehicle.trips != null || vehicle.rentPricePerDay != null) && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}>
                    {vehicle.rentPricePerDay != null && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <AttachMoney sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          ${vehicle.rentPricePerDay} / {t('fleet.perDay', 'day')}
                        </Typography>
                      </Box>
                    )}
                    {vehicle.totalDistanceKm != null && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Straighten sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {vehicle.totalDistanceKm.toLocaleString()} km
                        </Typography>
                      </Box>
                    )}
                    {vehicle.trips != null && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: 'action.hover',
                        }}
                      >
                        <Route sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {vehicle.trips} {t('distance.trips')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
                {(vehicle.oilDueDate != null || vehicle.regoDueDate != null) && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {vehicle.oilDueDate && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'warning.dark',
                          fontWeight: 500,
                        }}
                      >
                        <OilBarrel sx={{ fontSize: 14 }} />
                        {t('maintenance.oilDueDate', { date: new Date(vehicle.oilDueDate).toLocaleDateString() })}
                      </Typography>
                    )}
                    {vehicle.regoDueDate && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'warning.dark',
                          fontWeight: 500,
                        }}
                      >
                        <Assignment sx={{ fontSize: 14 }} />
                        {t('maintenance.regoDueDate', { date: new Date(vehicle.regoDueDate).toLocaleDateString() })}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Chip
                label={t(
                  vehicle.status === 'available'
                    ? 'fleet.statusAvailable'
                    : vehicle.status === 'rented'
                      ? 'fleet.statusRented'
                      : 'fleet.statusMaintenance'
                )}
                color={getStatusColor(vehicle.status)}
                size="small"
                sx={{
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  '& .MuiChip-label': { px: 1.25 },
                }}
              />
              <EditOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default FleetVehicleCard;
