import React from 'react';
import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import { Business, Person, DirectionsCar } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { Rental } from '../../../services/rentals/types';

function getRentalDisplayName(rental: Rental): string {
  return rental.rentalType === 'company' && rental.companyName
    ? rental.companyName
    : rental.contactName;
}

export interface RentalCardProps {
  rental: Rental;
  availableVehicleCount: number;
  onClick: () => void;
}

const RentalCard: React.FC<RentalCardProps> = ({
  rental,
  availableVehicleCount,
  onClick,
}) => {
  const { t } = useTranslation();
  const name = getRentalDisplayName(rental);
  const isCompany = rental.rentalType === 'company';

  return (
    <Card
      component="button"
      type="button"
      onClick={onClick}
      variant="outlined"
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? '0 4px 20px rgba(0,0,0,0.06)'
            : '0 4px 20px rgba(0,0,0,0.15)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) =>
            theme.palette.mode === 'light'
              ? '0 12px 40px rgba(0,0,0,0.1)'
              : '0 12px 40px rgba(0,0,0,0.25)',
          borderColor: 'primary.main',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    >
      {/* Top accent */}
      <Box
        sx={{
          height: 4,
          background: (theme) =>
            `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          opacity: 0.9,
        }}
      />
      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 3,
          '&:last-child': { pb: 3 },
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mb: 2,
          }}
        >
          {isCompany ? (
            <Business sx={{ fontSize: 32 }} />
          ) : (
            <Person sx={{ fontSize: 32 }} />
          )}
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            mb: 1,
            color: 'text.primary',
          }}
        >
          {name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto', pt: 2 }}>
          <Chip
            icon={<DirectionsCar sx={{ fontSize: 18, color: 'inherit' }} />}
            label={
              availableVehicleCount === 0
                ? t('vehicles.noVehiclesForRental')
                : t('vehicles.vehicleCount', { count: availableVehicleCount })
            }
            size="small"
            sx={{
              fontWeight: 600,
              bgcolor: 'action.hover',
              color: 'text.secondary',
              '& .MuiChip-icon': { ml: 0.5, mr: -0.25 },
            }}
          />
          <Typography
            variant="body2"
            color="primary.main"
            fontWeight={600}
            sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}
          >
            {t('vehicles.viewVehicles')}
            <Typography component="span" sx={{ fontSize: '1.25em', lineHeight: 1 }}>→</Typography>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RentalCard;
