import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { adminVehiclesApi } from '../../../services/vehicles/api';
import { rentalsApi } from '../../../services/rentals/api';
import { useToast } from '../../../components/Common';
import VehicleImageUpload from '../../fleet/components/VehicleImageUpload';
import InsuranceField from '../../fleet/components/InsuranceField';
import type { VehicleStatus } from '../../../services/vehicles/api';
import type { Rental } from '../../../services/rentals/types';

const MIN_IMAGES = 1;

const cell = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 } as const;
const full = { flex: '1 1 100%', minWidth: 0 } as const;

const rentalLabel = (r: Rental) => (r.rentalType === 'company' && r.companyName ? r.companyName : r.contactName);

const VehiclesAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imagesError, setImagesError] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    rego: '',
    insuranceType: 'comprehensive' as string,
    status: 'available' as VehicleStatus,
    rentPricePerDay: '',
    minimumRentalDays: '',
    odometerKm: '',
    lastOilChangeDate: '',
    lastRegoPaymentDate: '',
    regoDueDate: '',
    maintenanceNote: '',
    rentalId: '',
  });

  useEffect(() => {
    let active = true;
    rentalsApi
      .list()
      .then((data) => { if (active) setRentals(data); })
      .catch(() => { if (active) showError('Failed to load rentals for the picker.'); });
    return () => { active = false; };
  }, [showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'maintenanceNote' && maintenanceError) setMaintenanceError(false);
    setErrors((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
  };

  // Every field is mandatory. Trim text so blank/whitespace-only entries are
  // rejected, and require a value for the number, date and select fields too.
  const validate = (): boolean => {
    const next: Record<string, boolean> = {};
    if (!formData.make.trim()) next.make = true;
    if (!formData.model.trim()) next.model = true;
    if (!formData.year.trim()) next.year = true;
    if (!formData.rego.trim()) next.rego = true;
    if (!formData.insuranceType) next.insuranceType = true;
    if (!formData.rentPricePerDay.trim()) next.rentPricePerDay = true;
    if (!formData.minimumRentalDays.trim()) next.minimumRentalDays = true;
    if (!formData.status) next.status = true;
    if (!formData.rentalId) next.rentalId = true;
    if (!formData.odometerKm.trim()) next.odometerKm = true;
    if (!formData.lastOilChangeDate) next.lastOilChangeDate = true;
    if (!formData.lastRegoPaymentDate) next.lastRegoPaymentDate = true;
    if (!formData.regoDueDate) next.regoDueDate = true;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleImagesChange = (next: string[]) => {
    setImages(next);
    if (next.length >= MIN_IMAGES) setImagesError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsOk = validate();
    const imagesOk = images.length >= MIN_IMAGES;
    if (!imagesOk) setImagesError(true);
    const maintOk = !(formData.status === 'maintenance' && !formData.maintenanceNote.trim());
    if (!maintOk) setMaintenanceError(true);
    if (!fieldsOk || !imagesOk || !maintOk) {
      showError('Please fill in all fields before adding the vehicle.');
      return;
    }
    setSaving(true);
    try {
      await adminVehiclesApi.create({
        make: formData.make.trim(),
        model: formData.model.trim(),
        year: Number(formData.year),
        rego: formData.rego.trim(),
        insuranceType: formData.insuranceType,
        status: formData.status,
        rentPricePerDay: Number(formData.rentPricePerDay),
        minimumRentalDays: Number(formData.minimumRentalDays),
        odometerKm: Number(formData.odometerKm),
        lastOilChangeDate: formData.lastOilChangeDate,
        lastRegoPaymentDate: formData.lastRegoPaymentDate,
        regoDueDate: formData.regoDueDate,
        maintenanceNote: formData.status === 'maintenance' ? formData.maintenanceNote.trim() : '',
        imageUrls: images,
        imageUrl: images[0],
        rentalId: formData.rentalId,
      });
      showSuccess('Vehicle created.');
      navigate(ROUTES.ADMIN.VEHICLES_ALL);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to create vehicle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>Add vehicle</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create a vehicle and assign it to a rental.</Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={cell}><TextField fullWidth label="Make" name="make" value={formData.make} onChange={handleChange} required error={!!errors.make} /></Box>
            <Box sx={cell}><TextField fullWidth label="Model" name="model" value={formData.model} onChange={handleChange} required error={!!errors.model} /></Box>
            <Box sx={cell}><TextField fullWidth type="number" label="Year" name="year" value={formData.year} onChange={handleChange} required error={!!errors.year} /></Box>
            <Box sx={cell}><TextField fullWidth label="Rego" name="rego" value={formData.rego} onChange={handleChange} required error={!!errors.rego} /></Box>
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
            <Box sx={cell}><TextField fullWidth type="number" label="Price / day" name="rentPricePerDay" value={formData.rentPricePerDay} onChange={handleChange} required error={!!errors.rentPricePerDay} inputProps={{ min: 0, step: 1 }} /></Box>
            <Box sx={cell}><TextField fullWidth type="number" label={t('fleet.minimumRentalDaysLabel', 'Minimum rental days')} name="minimumRentalDays" value={formData.minimumRentalDays} onChange={handleChange} required error={!!errors.minimumRentalDays} inputProps={{ min: 1, step: 1 }} /></Box>
            <Box sx={cell}>
              <TextField fullWidth select label="Status" name="status" value={formData.status} onChange={handleChange} required error={!!errors.status}>
                <MenuItem value="available">Available</MenuItem>
                <MenuItem value="rented">Rented</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
              </TextField>
            </Box>
            <Box sx={cell}>
              <TextField fullWidth select label="Owning rental" name="rentalId" value={formData.rentalId} onChange={handleChange} required error={!!errors.rentalId}>
                {rentals.length === 0 ? (
                  <MenuItem value="" disabled>No rentals available</MenuItem>
                ) : (
                  rentals.map((r) => (
                    <MenuItem key={r.id} value={r.id}>{rentalLabel(r)}</MenuItem>
                  ))
                )}
              </TextField>
            </Box>
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1.5, fontWeight: 700 }}>Service &amp; registration</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={cell}><TextField fullWidth type="number" label="Odometer (km)" name="odometerKm" value={formData.odometerKm} onChange={handleChange} required error={!!errors.odometerKm} inputProps={{ min: 0, step: 1 }} /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Last oil change date" name="lastOilChangeDate" value={formData.lastOilChangeDate} onChange={handleChange} required error={!!errors.lastOilChangeDate} InputLabelProps={{ shrink: true }} /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Last rego payment date" name="lastRegoPaymentDate" value={formData.lastRegoPaymentDate} onChange={handleChange} required error={!!errors.lastRegoPaymentDate} InputLabelProps={{ shrink: true }} /></Box>
            <Box sx={cell}><TextField fullWidth type="date" label="Rego expiry date" name="regoDueDate" value={formData.regoDueDate} onChange={handleChange} required error={!!errors.regoDueDate} InputLabelProps={{ shrink: true }} /></Box>
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
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.VEHICLES_ALL)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : 'Add vehicle'}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default VehiclesAddPage;
