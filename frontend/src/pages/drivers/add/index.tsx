import React, { useState } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { driversApi } from '../../../services/drivers/api';
import { useToast, PasswordField } from '../../../components/Common';
import type { DriverStatus } from '../../../services/drivers/types';

const DriversAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    status: 'active' as DriverStatus,
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await driversApi.create({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        licenseNumber: formData.licenseNumber,
        status: formData.status,
        password: formData.password,
      });
      showSuccess('Driver created.');
      navigate(ROUTES.ADMIN.DRIVERS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to create driver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>
          {t('drivers.addDriverTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('drivers.addDriverSubtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <TextField fullWidth label={t('drivers.fullName')} name="fullName" value={formData.fullName} onChange={handleChange} required />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <TextField fullWidth type="email" label={t('drivers.email')} name="email" value={formData.email} onChange={handleChange} required />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <TextField fullWidth label={t('drivers.phone')} name="phone" value={formData.phone} onChange={handleChange} required />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <TextField fullWidth label={t('drivers.licenseNumber')} name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} />
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <TextField fullWidth select label={t('drivers.status')} name="status" value={formData.status} onChange={handleChange}>
                <MenuItem value="active">{t('drivers.statusActive')}</MenuItem>
                <MenuItem value="inactive">{t('drivers.statusInactive')}</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <PasswordField
                fullWidth
                showLockIcon={false}
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                helperText="Initial login password for this driver"
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.DRIVERS)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : t('drivers.addDriver')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default DriversAddPage;
