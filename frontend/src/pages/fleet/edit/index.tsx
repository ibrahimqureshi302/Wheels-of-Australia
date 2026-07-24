import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { getFleetVehicle, updateFleetVehicle } from '../../../services/rental/fleet';
import VehicleImageUpload from '../components/VehicleImageUpload';
import InsuranceField from '../components/InsuranceField';
import { useToast } from '../../../components/Common';

const MIN_IMAGES = 1;

const cell = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 } as const;
const full = { flex: '1 1 100%', minWidth: 0 } as const;

const FleetEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    rego: '',
    insuranceType: 'comprehensive' as string,
    rentPricePerDay: '',
    minimumRentalDays: '',
    odometerKm: '',
    lastOilChangeDate: '',
    lastRegoPaymentDate: '',
    regoDueDate: '',
    status: 'available' as 'available' | 'rented' | 'maintenance',
    maintenanceNote: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [imagesError, setImagesError] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    getFleetVehicle(id)
      .then((vehicle) => {
        if (!active || !vehicle) return;
        setFormData({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          rego: vehicle.rego,
          insuranceType: vehicle.insuranceType ?? 'comprehensive',
          rentPricePerDay: vehicle.rentPricePerDay != null ? String(vehicle.rentPricePerDay) : '',
          minimumRentalDays: vehicle.minimumRentalDays != null ? String(vehicle.minimumRentalDays) : '',
          odometerKm: vehicle.odometerKm != null ? String(vehicle.odometerKm) : '',
          lastOilChangeDate: vehicle.lastOilChangeDate ?? '',
          lastRegoPaymentDate: vehicle.lastRegoPaymentDate ?? '',
          regoDueDate: vehicle.regoDueDate ?? '',
          status: vehicle.status,
          maintenanceNote: vehicle.maintenanceNote ?? '',
        });
        setImages(vehicle.imageUrls ?? (vehicle.imageUrl ? [vehicle.imageUrl] : []));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'year' ? parseInt(value, 10) || prev.year : value,
    }));
    if (name === 'maintenanceNote' && maintenanceError) setMaintenanceError(false);
    setErrors((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
  };

  const handleImagesChange = (next: string[]) => {
    setImages(next);
    if (next.length >= MIN_IMAGES) setImagesError(false);
  };

  // Every field is mandatory. Trim text so blank/whitespace-only entries are
  // rejected, and require a value for the number, date and select fields too.
  const validate = (): boolean => {
    const next: Record<string, boolean> = {};
    if (!formData.make.trim()) next.make = true;
    if (!formData.model.trim()) next.model = true;
    if (!formData.year) next.year = true;
    if (!formData.rego.trim()) next.rego = true;
    if (!formData.insuranceType) next.insuranceType = true;
    if (!String(formData.rentPricePerDay).trim()) next.rentPricePerDay = true;
    if (!String(formData.minimumRentalDays).trim()) next.minimumRentalDays = true;
    if (!formData.status) next.status = true;
    if (!String(formData.odometerKm).trim()) next.odometerKm = true;
    if (!formData.lastOilChangeDate) next.lastOilChangeDate = true;
    if (!formData.lastRegoPaymentDate) next.lastRegoPaymentDate = true;
    if (!formData.regoDueDate) next.regoDueDate = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submitting) return;
    const fieldsOk = validate();
    const imagesOk = images.length >= MIN_IMAGES;
    if (!imagesOk) setImagesError(true);
    const maintOk = !(formData.status === 'maintenance' && !formData.maintenanceNote.trim());
    if (!maintOk) setMaintenanceError(true);
    if (!fieldsOk || !imagesOk || !maintOk) {
      showError(t('fleet.fillAllFields', 'Please fill in all fields before saving.'));
      return;
    }
    setSubmitting(true);
    try {
      await updateFleetVehicle(id, {
        make: formData.make.trim(),
        model: formData.model.trim(),
        year: formData.year,
        rego: formData.rego.trim(),
        insuranceType: formData.insuranceType,
        rentPricePerDay: Number(formData.rentPricePerDay),
        minimumRentalDays: Number(formData.minimumRentalDays),
        odometerKm: Number(formData.odometerKm),
        lastOilChangeDate: formData.lastOilChangeDate,
        lastRegoPaymentDate: formData.lastRegoPaymentDate,
        regoDueDate: formData.regoDueDate,
        status: formData.status,
        // Only carry a note while in maintenance; clear it otherwise.
        maintenanceNote: formData.status === 'maintenance' ? formData.maintenanceNote.trim() : '',
        imageUrls: images,
        imageUrl: images[0],
      });
      navigate(ROUTES.FLEET);
    } catch {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>{t('fleet.editVehicleTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('fleet.editVehicleSubtitle')}</Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={cell}><TextField fullWidth label={t('fleet.make')} name="make" value={formData.make} onChange={handleChange} required error={!!errors.make} /></Box>
            <Box sx={cell}><TextField fullWidth label={t('fleet.model')} name="model" value={formData.model} onChange={handleChange} required error={!!errors.model} /></Box>
            <Box sx={cell}><TextField fullWidth type="number" label={t('fleet.year')} name="year" value={formData.year} onChange={handleChange} required error={!!errors.year} inputProps={{ min: 1990, max: new Date().getFullYear() + 1 }} /></Box>
            <Box sx={cell}><TextField fullWidth label={t('fleet.registrationRego')} name="rego" value={formData.rego} onChange={handleChange} required error={!!errors.rego} /></Box>
            <Box sx={cell}>
              <InsuranceField
                value={formData.insuranceType}
                onChange={(v) => {
                  setFormData((prev) => ({ ...prev, insuranceType: v }));
                  setErrors((prev) => (prev.insuranceType ? { ...prev, insuranceType: false } : prev));
                }}
                error={!!errors.insuranceType}
              />
            </Box>
            <Box sx={cell}><TextField fullWidth type="number" label={t('fleet.rentPricePerDay')} name="rentPricePerDay" value={formData.rentPricePerDay} onChange={handleChange} required error={!!errors.rentPricePerDay} inputProps={{ min: 0, step: 1 }} placeholder="e.g. 85" /></Box>
            <Box sx={cell}><TextField fullWidth type="number" label={t('fleet.minimumRentalDaysLabel')} name="minimumRentalDays" value={formData.minimumRentalDays} onChange={handleChange} required error={!!errors.minimumRentalDays} inputProps={{ min: 1, step: 1 }} placeholder="e.g. 3" /></Box>
            <Box sx={cell}>
              <TextField fullWidth select label={t('fleet.status')} name="status" value={formData.status} onChange={handleChange} required error={!!errors.status}>
                <MenuItem value="available">{t('fleet.statusAvailable')}</MenuItem>
                <MenuItem value="rented">{t('fleet.statusRented')}</MenuItem>
                <MenuItem value="maintenance">{t('fleet.statusMaintenance')}</MenuItem>
              </TextField>
            </Box>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1.5, fontWeight: 700 }}>Service &amp; registration</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={cell}><TextField fullWidth type="number" label="Odometer (km)" name="odometerKm" value={formData.odometerKm} onChange={handleChange} required error={!!errors.odometerKm} inputProps={{ min: 0, step: 1 }} placeholder="e.g. 45000" /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Last oil change date" name="lastOilChangeDate" value={formData.lastOilChangeDate} onChange={handleChange} required error={!!errors.lastOilChangeDate} InputLabelProps={{ shrink: true }} helperText="Used to remind the driver when the next oil change is due." /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Last rego payment date" name="lastRegoPaymentDate" value={formData.lastRegoPaymentDate} onChange={handleChange} required error={!!errors.lastRegoPaymentDate} InputLabelProps={{ shrink: true }} helperText="Used to remind the driver when the rego payment is due." /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Rego expiry date" name="regoDueDate" value={formData.regoDueDate} onChange={handleChange} required error={!!errors.regoDueDate} InputLabelProps={{ shrink: true }} helperText="Used to remind the driver when rego is about to expire." /></Box>
          </Box>

          <Box sx={{ mt: 3 }}>
            <VehicleImageUpload value={images} onChange={handleImagesChange} error={imagesError} />
          </Box>

          {formData.status === 'maintenance' && (
            <Box sx={{ ...full, mt: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="What maintenance is needed?"
                name="maintenanceNote"
                value={formData.maintenanceNote}
                onChange={handleChange}
                required
                error={maintenanceError}
                helperText={maintenanceError ? 'Describe the maintenance needed.' : 'e.g. Oil change, brake check'}
                placeholder="Describe the maintenance needed"
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.FLEET)} disabled={submitting}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={submitting}>{t('fleet.saveChanges')}</Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default FleetEditPage;
