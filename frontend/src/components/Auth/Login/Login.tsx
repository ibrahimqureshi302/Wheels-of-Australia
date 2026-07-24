import React, { useState } from 'react';
import {
  TextField,
  Typography,
  Box,
  Link,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Email } from '@mui/icons-material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/hooks';
import { useToast } from '../../../components/Common';
import Button from '../../Common/Button';
import AuthPageLayout from '../AuthPageLayout';
import BrandHeader from '../BrandHeader';
import { ROUTES, getDefaultRouteForRole, isPathAllowedForRole } from '../../../constants/routes';
import { isStaffPathAllowed, landingPathForUser } from '../../../constants/nav';
import { fadeVariants } from '../../../lib/animations';

const formStagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const signUpLinkSx = {
  color: 'primary.main',
  textDecoration: 'none',
  fontWeight: 600,
  '&:hover': { textDecoration: 'underline', opacity: 0.9 },
};

const Login: React.FC = () => {
  const { login, loading } = useAuth();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login(formData.email, formData.password);
      showSuccess(t('auth.loginSuccess') || 'Login successful!');
      // Only use `from` if the user's role can actually access that path
      // (e.g. don't send a rental user back to a driver-only page). For rental
      // staff, `from` must also be within their granted modules, and the default
      // landing is their first granted page (not a Dashboard they may not have).
      const role = data.user.role;
      const staffPaths = role?.toLowerCase() === 'rental' ? data.user.allowed_nav_paths : undefined;
      const isStaff = Array.isArray(staffPaths) && staffPaths.length > 0;
      const useFrom =
        !!from &&
        isPathAllowedForRole(from, role) &&
        (!isStaff || isStaffPathAllowed(staffPaths as string[], from));
      const redirectTo = useFrom
        ? from
        : landingPathForUser(data.user, getDefaultRouteForRole(role));
      // Navigate immediately so this is the single redirect — a delayed
      // navigate here races with PublicRoute (which also redirects once auth
      // flips), producing a double render and bouncing the user onto a stale
      // `from` route after they've already landed on their dashboard.
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) showError(err.message);
      else if (typeof err === 'object' && err !== null) showError(err as Parameters<typeof showError>[0]);
      else showError(t('auth.loginError') || 'Login failed. Please try again.');
    }
  };

  return (
    <AuthPageLayout
      header={<BrandHeader />}
      title={t('app.welcome') || 'Welcome back'}
      subtitle={t('auth.enterCredentials')}
    >
      <motion.div variants={formStagger} initial="initial" animate="animate">
        <Box component="form" onSubmit={handleSubmit}>
          <motion.div variants={fadeVariants}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label={t('auth.email')}
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleInputChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              loading={loading}
              sx={{
                py: 1.5,
                mb: 2,
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4)',
                '&:hover': { boxShadow: '0 20px 25px -5px rgba(99, 102, 241, 0.4)' },
              }}
            >
              {t('auth.signIn')}
            </Button>
          </motion.div>

          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              {t('auth.dontHaveAccount')} Register as
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Link component="button" type="button" variant="body2" onClick={() => navigate(ROUTES.REGISTER)} sx={signUpLinkSx}>
                Driver
              </Link>
              <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
              <Link component={RouterLink} to={ROUTES.RENTAL_REGISTER} variant="body2" sx={signUpLinkSx}>
                Rental
              </Link>
              <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
              <Link component={RouterLink} to={ROUTES.MECHANIC_REGISTER} variant="body2" sx={signUpLinkSx}>
                Mechanic
              </Link>
            </Box>
          </Box>
        </Box>
      </motion.div>
    </AuthPageLayout>
  );
};

export default Login;
