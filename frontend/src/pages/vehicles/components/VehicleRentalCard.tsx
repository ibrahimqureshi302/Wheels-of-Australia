import React from 'react';
import { Box, Card, CardContent, Typography, Button, Chip } from '@mui/material';
import { DirectionsCar, Assignment, Build, HourglassEmpty, ErrorOutline } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../../../services/rental/types';
import type { VehicleRequestState } from '../../../services/rental/driverRequests';

/** Default interval between oil services (matches the backend reminder logic). */
const OIL_CHANGE_INTERVAL_DAYS = 180;

/** Next oil change due: the stored due date if set, else last change + interval. */
function oilDueOf(vehicle: Vehicle): string | undefined {
  if (vehicle.oilDueDate) return vehicle.oilDueDate;
  if (!vehicle.lastOilChangeDate) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(vehicle.lastOilChangeDate);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + OIL_CHANGE_INTERVAL_DAYS);
  return d.toISOString().slice(0, 10);
}

export interface VehicleRentalCardProps {
  vehicle: Vehicle;
  onRequestRental: (vehicle: Vehicle) => void;
  /** Click anywhere on the card (except the action button) to view full details. */
  onViewDetails: (vehicle: Vehicle) => void;
  /**
   * The driver's open-request state for this vehicle. 'pending' shows a disabled
   * "Pending request" button; 'info_requested' shows an action prompting them to
   * update the existing request; 'none' shows the normal "Request rental" button.
   */
  requestState: VehicleRequestState;
  /** Invoked when the driver acts on an 'info_requested' vehicle (go update the request). */
  onProvideInfo: (vehicle: Vehicle) => void;
  /** Minimum rental duration in days (set by rental company). Shown when present and >= 1. */
  minimumRentalDays?: number;
}

const VehicleRentalCard: React.FC<VehicleRentalCardProps> = ({
  vehicle,
  onRequestRental,
  onViewDetails,
  requestState,
  onProvideInfo,
  minimumRentalDays,
}) => {
  const { t } = useTranslation();
  const [imgError, setImgError] = React.useState(false);
  const showImg = Boolean(vehicle.imageUrl) && !imgError;

  return (
    <Card
      variant="outlined"
      onClick={() => onViewDetails(vehicle)}
      sx={{
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? '0 2px 12px rgba(0,0,0,0.06)'
            : '0 2px 12px rgba(0,0,0,0.12)',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 12px 28px rgba(0,0,0,0.08)'
              : '0 12px 28px rgba(0,0,0,0.2)',
          borderColor: 'primary.main',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.25, md: 2.5 }, pb: 0, '&:last-child': { pb: 0 } }}>
        {/* Header: image + title + status */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
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
              <DirectionsCar sx={{ fontSize: 28, color: 'primary.main' }} />
            )}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{
                lineHeight: 1.25,
                fontSize: { xs: '1rem', sm: '1.0625rem' },
                letterSpacing: '-0.01em',
                color: 'text.primary',
              }}
            >
              {vehicle.make} {vehicle.model}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.8125rem',
                mt: 0.25,
                lineHeight: 1.4,
              }}
            >
              {vehicle.year} · {vehicle.rego}
            </Typography>
          </Box>
          <Chip
            label={t('vehicles.available')}
            color="success"
            size="small"
            sx={{
              fontWeight: 600,
              flexShrink: 0,
              borderRadius: 2,
              '& .MuiChip-label': { px: 1.25, fontSize: '0.75rem' },
            }}
          />
        </Box>

        {/* Price block: single clear unit */}
        {vehicle.rentPricePerDay != null && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  color: 'primary.main',
                }}
              >
                ${vehicle.rentPricePerDay}
              </Typography>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.875rem', fontWeight: 500 }}
              >
                /day
              </Typography>
            </Box>
            {minimumRentalDays != null && minimumRentalDays >= 1 && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem' }}
              >
                {t('vehicles.minimumRentalRequired', { count: minimumRentalDays })}
              </Typography>
            )}
          </Box>
        )}

        {/* Rego expiry: single line, no background */}
        {vehicle.regoDueDate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
            <Assignment sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
              {t('maintenance.regoDueDate', { date: new Date(vehicle.regoDueDate).toLocaleDateString() })}
            </Typography>
          </Box>
        )}

        {/* Oil change due: helps the driver judge the vehicle's service state */}
        {oilDueOf(vehicle) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
            <Build sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
              Oil change due {new Date(oilDueOf(vehicle)!).toLocaleDateString()}
            </Typography>
          </Box>
        )}
      </CardContent>

      <Box sx={{ p: { xs: 2, sm: 2.25, md: 2.5 }, pt: 0, flexShrink: 0 }}>
        {requestState === 'pending' ? (
          // A request is awaiting the rental's response — block a duplicate.
          <Button
            fullWidth
            variant="outlined"
            size="medium"
            disabled
            startIcon={<HourglassEmpty fontSize="small" />}
            onClick={(e) => e.stopPropagation()}
            sx={{
              borderRadius: 2,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9375rem',
            }}
          >
            {t('vehicles.pendingRequest')}
          </Button>
        ) : requestState === 'info_requested' ? (
          // The rental asked for more info — send the driver to update the
          // existing request rather than create a new one.
          <Button
            fullWidth
            variant="contained"
            color="info"
            size="medium"
            startIcon={<ErrorOutline fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              onProvideInfo(vehicle);
            }}
            sx={{
              borderRadius: 2,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9375rem',
            }}
          >
            {t('vehicles.infoRequested')}
          </Button>
        ) : (
          <Button
            fullWidth
            variant="contained"
            size="medium"
            onClick={(e) => {
              e.stopPropagation();
              onRequestRental(vehicle);
            }}
            sx={{
              borderRadius: 2,
              py: 1.25,
              fontWeight: 600,
              textTransform: 'none',
              fontSize: '0.9375rem',
              boxShadow: (theme) =>
                theme.palette.mode === 'light'
                  ? '0 2px 8px rgba(0,0,0,0.12)'
                  : '0 2px 8px rgba(0,0,0,0.3)',
              '&:hover': {
                boxShadow: (theme) =>
                  theme.palette.mode === 'light'
                    ? '0 4px 14px rgba(0,0,0,0.16)'
                    : '0 4px 14px rgba(0,0,0,0.4)',
              },
            }}
          >
            {t('vehicles.requestRental')}
          </Button>
        )}
      </Box>
    </Card>
  );
};

export default VehicleRentalCard;
