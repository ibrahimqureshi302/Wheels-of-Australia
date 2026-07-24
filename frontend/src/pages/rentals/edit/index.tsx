import React, { useState, useEffect } from 'react';
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
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import DocumentUploadZone from '../../../components/Auth/DocumentUploadZone';
import { rentalsApi } from '../../../services/rentals/api';
import { useToast, PasswordField } from '../../../components/Common';
import { isValidAbn, ABN_ERROR } from '../../../utils/abn';
import type { RentalType, RentalStatus } from '../../../services/rentals/types';

const RentalsEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
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
    suspensionReason: '',
    password: '',
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    rentalsApi
      .get(id)
      .then((rental) => {
        if (!active) return;
        setFormData({
          rentalType: rental.rentalType,
          companyName: rental.companyName ?? '',
          abn: rental.abn ?? '',
          contactName: rental.contactName,
          email: rental.email,
          phone: rental.phone,
          certificateFile: null,
          certificateFileName: rental.certificateFileName ?? '',
          minimumRentalDays: rental.minimumRentalDays != null ? String(rental.minimumRentalDays) : '',
          status: rental.status,
          suspensionReason: rental.suspensionReason ?? '',
          password: '',
        });
      })
      .catch(() => { if (active) showError('Failed to load rental.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, showError]);

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
    if (!id) return;
    if (formData.rentalType === 'company' && !isValidAbn(formData.abn)) {
      setAbnError(true);
      showError(ABN_ERROR);
      return;
    }
    if (formData.status === 'inactive' && !formData.suspensionReason.trim()) {
      showError('Please enter a reason for setting this account to inactive.');
      return;
    }
    setSaving(true);
    try {
      await rentalsApi.update(id, {
        rentalType: formData.rentalType,
        companyName: formData.rentalType === 'company' ? formData.companyName : '',
        abn: formData.rentalType === 'company' ? formData.abn : '',
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        minimumRentalDays: formData.minimumRentalDays ? Number(formData.minimumRentalDays) : undefined,
        status: formData.status,
        suspensionReason: formData.status === 'inactive' ? formData.suspensionReason : '',
        password: formData.password || undefined,
      });
      showSuccess('Rental updated.');
      navigate(ROUTES.ADMIN.RENTALS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to update rental.');
    } finally {
      setSaving(false);
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>
          {t('rentals.editRentalTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('rentals.editRentalSubtitle')}
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
          <PasswordField fullWidth label="New password" name="password" value={formData.password} onChange={handleChange}
            placeholder="Leave blank to keep current" helperText="Set a new login password (optional)" sx={{ mb: 2 }} />

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

          {formData.status === 'inactive' && (
            <TextField fullWidth multiline minRows={2} required label="Reason for inactivity" name="suspensionReason"
              value={formData.suspensionReason} onChange={handleChange} sx={{ mt: 2 }}
              placeholder="Shown to the user on their profile so they know why and can contact you."
              helperText="The user can still log in but will only see their profile with this message." />
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.RENTALS)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : t('common.saveChanges')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default RentalsEditPage;
