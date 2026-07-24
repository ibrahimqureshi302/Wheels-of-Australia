import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { driversApi } from '../../../services/drivers/api';
import { useToast, PasswordField } from '../../../components/Common';
import type { DriverStatus } from '../../../services/drivers/types';

const DriversEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    status: 'active' as DriverStatus,
    suspensionReason: '',
    password: '',
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    driversApi
      .get(id)
      .then((driver) => {
        if (!active) return;
        setFormData({
          fullName: driver.fullName,
          email: driver.email,
          phone: driver.phone,
          licenseNumber: driver.licenseNumber ?? '',
          status: driver.status,
          suspensionReason: driver.suspensionReason ?? '',
          password: '',
        });
      })
      .catch(() => { if (active) showError('Failed to load driver.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, showError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (formData.status === 'inactive' && !formData.suspensionReason.trim()) {
      showError('Please enter a reason for setting this account to inactive.');
      return;
    }
    setSaving(true);
    try {
      await driversApi.update(id, {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        licenseNumber: formData.licenseNumber,
        status: formData.status,
        suspensionReason: formData.status === 'inactive' ? formData.suspensionReason : '',
        password: formData.password || undefined,
      });
      showSuccess('Driver updated.');
      navigate(ROUTES.ADMIN.DRIVERS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to update driver.');
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
          {t('drivers.editDriverTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('drivers.editDriverSubtitle')}
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
            {formData.status === 'inactive' && (
              <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  required
                  label="Reason for inactivity"
                  name="suspensionReason"
                  value={formData.suspensionReason}
                  onChange={handleChange}
                  placeholder="Shown to the user on their profile so they know why and can contact you."
                  helperText="The user can still log in but will only see their profile with this message."
                />
              </Box>
            )}
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 }}>
              <PasswordField
                fullWidth
                showLockIcon={false}
                label="New password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current"
                helperText="Set a new login password (optional)"
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.DRIVERS)} disabled={saving}>
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

export default DriversEditPage;
