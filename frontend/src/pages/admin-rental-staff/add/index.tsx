import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, FormControlLabel, Checkbox, FormGroup,
  FormLabel, Alert, MenuItem,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { adminRentalStaffApi } from '../../../services/adminRentalStaff/api';
import { rentalsApi } from '../../../services/rentals/api';
import type { Rental } from '../../../services/rentals/types';
import { useToast, PasswordField } from '../../../components/Common';
import { GRANTABLE_RENTAL_NAV } from '../../../constants/nav';

const RENTAL_MENU_OPTIONS = GRANTABLE_RENTAL_NAV;

const rentalLabel = (r: Rental) =>
  r.rentalType === 'company' && r.companyName ? r.companyName : r.contactName;

const AdminRentalStaffAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalId, setRentalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rentalsApi
      .list()
      .then((list) => { if (active) setRentals(list.filter((r) => r.status === 'active')); })
      .catch(() => { if (active) showError(t('adminRentalStaff.loadRentalsError')); });
    return () => { active = false; };
  }, [showError, t]);

  const togglePath = (path: string) => {
    setAllowedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!rentalId) { setError(t('adminRentalStaff.selectRental')); return; }
    setSubmitting(true);
    setError(null);
    try {
      await adminRentalStaffApi.create({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        rentalId,
        status: 'active',
        allowedNavPaths: allowedPaths.length ? allowedPaths : [ROUTES.DASHBOARD],
      });
      showSuccess(t('adminRentalStaff.created'));
      navigate(ROUTES.ADMIN.RENTAL_STAFF);
    } catch (err) {
      setError((err as { message?: string })?.message || t('adminRentalStaff.createError'));
      setSubmitting(false);
    }
  };

  const fieldSx = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>{t('adminRentalStaff.addStaffTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('adminRentalStaff.addStaffSubtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={fieldSx}>
              <TextField
                select
                fullWidth
                label={t('adminRentalStaff.rental')}
                value={rentalId}
                onChange={(e) => setRentalId(e.target.value)}
                required
              >
                {rentals.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{rentalLabel(r)}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={fieldSx}>
              <TextField fullWidth label={t('rentalPortal.name')} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Box>
            <Box sx={fieldSx}>
              <TextField fullWidth type="email" label={t('rental.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Box>
            <Box sx={fieldSx}>
              <TextField fullWidth label={t('rental.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} inputProps={{ inputMode: 'tel' }} />
            </Box>
            <Box sx={fieldSx}>
              <PasswordField fullWidth showLockIcon={false} label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Box>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>{t('adminRentalStaff.staffLoginNote')}</Alert>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

          <FormLabel component="legend" sx={{ mb: 1, mt: 3, fontWeight: 600, color: 'text.primary', display: 'block' }}>
            {t('rentalPortal.allowedMenus')}
          </FormLabel>
          <FormGroup sx={{ mb: 3 }}>
            {RENTAL_MENU_OPTIONS.map((item) => (
              <FormControlLabel
                key={item.path}
                control={<Checkbox checked={allowedPaths.includes(item.path)} onChange={() => togglePath(item.path)} />}
                label={t(item.labelKey)}
              />
            ))}
          </FormGroup>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.RENTAL_STAFF)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {t('adminRentalStaff.addStaff')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default AdminRentalStaffAddPage;
