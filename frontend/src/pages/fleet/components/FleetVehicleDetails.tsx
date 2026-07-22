import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Field, SectionTitle } from '../../../components/Common';
import type { Vehicle } from '../../../services/rental/types';

// Predefined cover-type codes → translatable labels. A custom provider name
// won't be in here, so it's shown verbatim (see the fallback below).
const INSURANCE_LABEL_KEYS: Record<string, string> = {
  ctp: 'fleet.insuranceCtp',
  third_party_property: 'fleet.insuranceThirdPartyProperty',
  third_party_fire_theft: 'fleet.insuranceThirdPartyFireTheft',
  comprehensive: 'fleet.insuranceComprehensive',
};

const statusColor = (status: Vehicle['status']): 'success' | 'info' | 'warning' | 'default' => {
  if (status === 'available') return 'success';
  if (status === 'rented') return 'info';
  if (status === 'maintenance') return 'warning';
  return 'default';
};

/** Read-only details view of a vehicle, shown when a row is clicked. */
const FleetVehicleDetails: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
  const { t } = useTranslation();
  const images = vehicle.imageUrls && vehicle.imageUrls.length > 0
    ? vehicle.imageUrls
    : vehicle.imageUrl
      ? [vehicle.imageUrl]
      : [];

  const statusKey =
    vehicle.status === 'available'
      ? 'fleet.statusAvailable'
      : vehicle.status === 'rented'
        ? 'fleet.statusRented'
        : 'fleet.statusMaintenance';

  return (
    <Box>
      {/* Image gallery */}
      {images.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
          {images.map((src, i) => (
            <Box
              key={i}
              component="img"
              src={src}
              alt=""
              sx={{
                width: 140,
                height: 105,
                borderRadius: 1.5,
                objectFit: 'cover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          ))}
        </Box>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {vehicle.make} {vehicle.model}
        </Typography>
        <Chip
          label={t(statusKey)}
          color={statusColor(vehicle.status)}
          size="small"
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      <SectionTitle>{t('fleet.title')}</SectionTitle>
      <Stack spacing={1.25} sx={{ mt: 0.5 }}>
        <Field label={t('fleet.year')} value={vehicle.year} />
        <Field label={t('fleet.registrationRego')} value={vehicle.rego} />
        <Field
          label={t('fleet.insuranceType')}
          value={
            vehicle.insuranceType
              ? (INSURANCE_LABEL_KEYS[vehicle.insuranceType]
                  ? t(INSURANCE_LABEL_KEYS[vehicle.insuranceType])
                  : vehicle.insuranceType)
              : '—'
          }
        />
        <Field
          label={t('fleet.rentPricePerDay')}
          value={vehicle.rentPricePerDay != null ? `$${vehicle.rentPricePerDay}` : '—'}
        />
        <Field
          label={t('fleet.minimumRentalDaysLabel')}
          value={vehicle.minimumRentalDays != null ? vehicle.minimumRentalDays : '—'}
        />
        <Field
          label={t('distance.totalDistance')}
          value={vehicle.totalDistanceKm != null ? `${vehicle.totalDistanceKm.toLocaleString()} km` : '—'}
        />
        <Field label={t('distance.trips')} value={vehicle.trips != null ? vehicle.trips : '—'} />
      </Stack>

      <SectionTitle>Service &amp; registration</SectionTitle>
      <Stack spacing={1.25} sx={{ mt: 0.5 }}>
        <Field label="Odometer" value={vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString()} km` : '—'} />
        <Field label="Last oil change" value={vehicle.lastOilChangeDate || '—'} />
        <Field label="Last rego payment" value={vehicle.lastRegoPaymentDate || '—'} />
        <Field label="Rego expiry" value={vehicle.regoDueDate || '—'} />
      </Stack>

      {vehicle.status === 'rented' && vehicle.renter && (
        <Box sx={{ mt: 3 }}>
          <SectionTitle>Rented by</SectionTitle>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Field label="Driver" value={vehicle.renter.driverName} />
            <Field label="Email" value={vehicle.renter.driverEmail} />
            {vehicle.renter.driverPhone && <Field label="Phone" value={vehicle.renter.driverPhone} />}
            {(vehicle.renter.startDate || vehicle.renter.endDate) && (
              <Field label="Period" value={`${vehicle.renter.startDate || '—'} → ${vehicle.renter.endDate || '—'}`} />
            )}
          </Stack>
        </Box>
      )}

      {vehicle.status === 'maintenance' && !vehicle.maintenance && vehicle.maintenanceNote && (
        <Box sx={{ mt: 3 }}>
          <SectionTitle>In maintenance</SectionTitle>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Field label="Work needed" value={vehicle.maintenanceNote} />
          </Stack>
        </Box>
      )}

      {vehicle.status === 'maintenance' && vehicle.maintenance && (
        <Box sx={{ mt: 3 }}>
          <SectionTitle>In maintenance</SectionTitle>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Field label="Mechanic" value={vehicle.maintenance.mechanicName || '—'} />
            {vehicle.maintenance.shopName && <Field label="Shop" value={vehicle.maintenance.shopName} />}
            {vehicle.maintenance.mechanicEmail && <Field label="Email" value={vehicle.maintenance.mechanicEmail} />}
            <Field label="Work" value={vehicle.maintenance.workDescription} />
            <Field label="Price" value={vehicle.maintenance.quotedPrice != null ? `$${vehicle.maintenance.quotedPrice.toFixed(2)}` : '—'} />
            {vehicle.maintenance.estimatedValue != null && (
              <Field label="Estimated time" value={`${vehicle.maintenance.estimatedValue} ${vehicle.maintenance.estimatedUnit || ''}`} />
            )}
            {vehicle.maintenance.mechanicNotes && <Field label="Notes" value={vehicle.maintenance.mechanicNotes} />}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default FleetVehicleDetails;
