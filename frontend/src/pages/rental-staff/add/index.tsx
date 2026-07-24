import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormLabel,
  Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { useAuth } from '../../../context/hooks';
import { addRentalStaff } from '../../../services/rentals/rentalStaff';
import { PasswordField } from '../../../components/Common';
import { GRANTABLE_RENTAL_NAV } from '../../../constants/nav';

const RENTAL_MENU_OPTIONS = GRANTABLE_RENTAL_NAV;

const RentalStaffAddPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMainRental =
    user?.role?.toLowerCase() === 'rental' && !(user?.allowed_nav_paths?.length);

  useEffect(() => {
    if (!isMainRental && user) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }
  }, [isMainRental, user, navigate]);

  const togglePath = (path: string) => {
    setAllowedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const parentId = user?.id ?? 0;
      await addRentalStaff(parentId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        allowedNavPaths: allowedPaths.length ? allowedPaths : [ROUTES.DASHBOARD],
      });
      navigate(ROUTES.RENTAL.STAFF);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rentalPortal.addStaffError'));
      setSubmitting(false);
    }
  };

  if (!isMainRental) return null;

  const fieldSx = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 11px)' }, minWidth: 0 };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720, lg: 960 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>
          {t('rentalPortal.addStaffTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('rentalPortal.addStaffSubtitle')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={fieldSx}>
              <TextField
                fullWidth
                label={t('rentalPortal.firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </Box>
            <Box sx={fieldSx}>
              <TextField
                fullWidth
                label={t('rentalPortal.lastName')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </Box>
            <Box sx={fieldSx}>
              <TextField
                fullWidth
                type="email"
                label={t('rental.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Box>
            <Box sx={fieldSx}>
              <TextField
                fullWidth
                label={t('rental.phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputProps={{ inputMode: 'tel' }}
              />
            </Box>
            <Box sx={fieldSx}>
              <PasswordField
                fullWidth
                showLockIcon={false}
                label={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('rentalPortal.passwordPlaceholder')}
                required
              />
            </Box>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            {t('rentalPortal.staffLoginNote')}
          </Alert>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <FormLabel component="legend" sx={{ mb: 1, mt: 3, fontWeight: 600, color: 'text.primary', display: 'block' }}>
            {t('rentalPortal.allowedMenus')}
          </FormLabel>
          <FormGroup sx={{ mb: 3 }}>
            {RENTAL_MENU_OPTIONS.map((item) => (
              <FormControlLabel
                key={item.path}
                control={
                  <Checkbox
                    checked={allowedPaths.includes(item.path)}
                    onChange={() => togglePath(item.path)}
                  />
                }
                label={t(item.labelKey)}
              />
            ))}
          </FormGroup>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.RENTAL.STAFF)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {t('rentalPortal.addStaff')}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default RentalStaffAddPage;
