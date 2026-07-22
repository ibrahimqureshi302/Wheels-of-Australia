import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Business, Person, Email, Phone, Badge } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import DocumentUploadZone from '../../../components/Auth/DocumentUploadZone';
import { rentalsApi } from '../../../services/rentals/api';
import { useToast, PasswordField } from '../../../components/Common';
import { isValidAbn, ABN_ERROR } from '../../../utils/abn';
import type { RentalType, RentalStatus } from '../../../services/rentals/types';

const RentalsAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [abnError, setAbnError] = useState(false);
  const [formData, setFormData] = useState({
    rentalType: 'company' as RentalType,
    companyName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: '',
    certificateFile: null as File | null,
    certificateFileName: '',
    minimumRentalDays: '',
    status: 'active' as RentalStatus,
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRentalTypeChange = (_: React.ChangeEvent<HTMLInputElement>, value: string) => {
    setFormData((prev) => ({
      ...prev,
      rentalType: value as RentalType,
      companyName: value === 'company' ? prev.companyName : '',
      abn: value === 'company' ? prev.abn : '',
    }));
  };

  const handleCertificateSelect = (file: File) => {
    setFormData((prev) => ({ ...prev, certificateFile: file, certificateFileName: file.name }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.rentalType === 'company' && !isValidAbn(formData.abn)) {
      setAbnError(true);
      showError(ABN_ERROR);
      return;
    }
    setSaving(true);
    try {
      await rentalsApi.create({
        rentalType: formData.rentalType,
        companyName: formData.rentalType === 'company' ? formData.companyName : '',
        abn: formData.rentalType === 'company' ? formData.abn : '',
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        minimumRentalDays: formData.minimumRentalDays ? Number(formData.minimumRentalDays) : undefined,
        status: formData.status,
        password: formData.password,
      });
      showSuccess('Rental created.');
      navigate(ROUTES.ADMIN.RENTALS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to create rental.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>
          {t('rentals.addRentalTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('rentals.addRentalSubtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl component="fieldset" sx={{ mb: 2, display: 'block' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
              {t('rental.registrationType')}
            </FormLabel>
            <RadioGroup row name="rentalType" value={formData.rentalType} onChange={handleRentalTypeChange}>
              <FormControlLabel
                value="company"
                control={<Radio />}
                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Business fontSize="small" /> {t('rental.company')}</Box>}
              />
              <FormControlLabel
                value="individual"
                control={<Radio />}
                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Person fontSize="small" /> {t('rental.individual')}</Box>}
              />
            </RadioGroup>
          </FormControl>

          <AnimatePresence mode="wait">
            {formData.rentalType === 'company' && (
              <motion.div key="company-fields" variants={fadeVariants} initial="initial" animate="animate" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ marginBottom: 16 }}>
                <TextField fullWidth label={t('rental.companyName')} name="companyName" value={formData.companyName} onChange={handleChange} required={formData.rentalType === 'company'}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><Business color="action" /></InputAdornment>) }} sx={{ mb: 2 }} />
                <TextField fullWidth label={t('rental.abn')} name="abn" value={formData.abn}
                  onChange={(e) => { handleChange(e); if (abnError) setAbnError(false); }}
                  placeholder={t('rental.abnPlaceholder')} required error={abnError}
                  helperText={abnError ? ABN_ERROR : '11 digits'}
                  inputProps={{ inputMode: 'numeric', maxLength: 14 }}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><Badge color="action" /></InputAdornment>) }} sx={{ mb: 2 }} />
              </motion.div>
            )}
          </AnimatePresence>

          <TextField fullWidth label={t('rental.contactName')} name="contactName" value={formData.contactName} onChange={handleChange} required
            InputProps={{ startAdornment: (<InputAdornment position="start"><Person color="action" /></InputAdornment>) }} sx={{ mb: 2 }} />
          <TextField fullWidth type="email" label={t('rental.email')} name="email" value={formData.email} onChange={handleChange} required
            InputProps={{ startAdornment: (<InputAdornment position="start"><Email color="action" /></InputAdornment>) }} sx={{ mb: 2 }} />
          <TextField fullWidth label={t('rental.phone')} name="phone" value={formData.phone} onChange={handleChange} required inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><Phone color="action" /></InputAdornment>) }} sx={{ mb: 2 }} />
          <PasswordField fullWidth label="Password" name="password" value={formData.password} onChange={handleChange} required
            helperText="Initial login password for this rental" sx={{ mb: 2 }} />

          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'text.primary', mt: 1, mb: 1 }}>
            {t('rental.certificateUpload')}
          </Typography>
          <DocumentUploadZone accept="image/*,.pdf" maxSizeMb={10} onFileSelect={handleCertificateSelect} />
          {formData.certificateFileName && (
            <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
              {t('rental.certificateSelected', { name: formData.certificateFileName })}
            </Typography>
          )}

          <TextField fullWidth type="number" label={t('fleet.minimumRentalDaysLabel', 'Minimum rental days')} name="minimumRentalDays" value={formData.minimumRentalDays}
            onChange={handleChange} inputProps={{ min: 1, step: 1 }} placeholder="e.g. 3" helperText="Default minimum booking length for this rental's vehicles" sx={{ mt: 2 }} />

          <TextField fullWidth select label={t('rentals.status')} name="status" value={formData.status} onChange={handleChange} sx={{ mt: 2 }}>
            <MenuItem value="active">{t('rentals.statusActive')}</MenuItem>
            <MenuItem value="inactive">{t('rentals.statusInactive')}</MenuItem>
          </TextField>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.RENTALS)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : t('rentals.addRental')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default RentalsAddPage;
