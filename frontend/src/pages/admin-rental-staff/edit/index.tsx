import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, FormControlLabel, Checkbox, FormGroup,
  FormLabel, Alert, MenuItem,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
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

const AdminRentalStaffEditPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess } = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [rentalId, setRentalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    rentalsApi.list().then((list) => { if (active) setRentals(list); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!id) { setNotFound(true); setLoaded(true); return; }
    adminRentalStaffApi
      .get(id)
      .then((s) => {
        if (!active) return;
        setFullName(s.fullName);
        setEmail(s.email);
        setPhone(s.phone);
        setStatus(s.status);
        setSuspensionReason(s.suspensionReason ?? '');
        setAllowedPaths(s.allowedNavPaths);
        setRentalId(s.rentalId ?? '');
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [id]);

  const togglePath = (path: string) => {
    setAllowedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || submitting) return;
    if (status === 'inactive' && !suspensionReason.trim()) {
      setError('Please enter a reason for setting this account to inactive.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminRentalStaffApi.update(id, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status,
        suspensionReason: status === 'inactive' ? suspensionReason : '',
        rentalId: rentalId || undefined,
        allowedNavPaths: allowedPaths.length ? allowedPaths : [ROUTES.DASHBOARD],
        ...(password ? { password } : {}),
      });
      showSuccess(t('adminRentalStaff.saved'));
      navigate(ROUTES.ADMIN.RENTAL_STAFF);
    } catch (err) {
      setError((err as { message?: string })?.message || t('adminRentalStaff.saveError'));
      setSubmitting(false);
    }
  };

  if (loaded && notFound) {
    navigate(ROUTES.ADMIN.RENTAL_STAFF, { replace: true });
    return null;
  }

  const fieldSx = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>{t('adminRentalStaff.editStaffTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('adminRentalStaff.editStaffSubtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={fieldSx}>
              <TextField select fullWidth label={t('adminRentalStaff.rental')} value={rentalId} onChange={(e) => setRentalId(e.target.value)} required>
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
              <TextField select fullWidth label={t('drivers.status', 'Status')} value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}>
                <MenuItem value="active">{t('rentalPortal.statusActive')}</MenuItem>
                <MenuItem value="inactive">{t('rentalPortal.statusInactive')}</MenuItem>
              </TextField>
            </Box>
            {status === 'inactive' && (
              <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
                <TextField fullWidth multiline minRows={2} required label="Reason for inactivity"
                  value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Shown to the user on their profile so they know why and can contact you."
                  helperText="The user can still log in but will only see their profile with this message." />
              </Box>
            )}
            <Box sx={fieldSx}>
              <PasswordField
                fullWidth
                showLockIcon={false}
                label={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText={t('adminRentalStaff.passwordEditHint')}
              />
            </Box>
          </Box>

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
              {t('common.saveChanges')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default AdminRentalStaffEditPage;
