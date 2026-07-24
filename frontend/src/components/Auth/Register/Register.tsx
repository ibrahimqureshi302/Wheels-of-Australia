import React, { useState } from 'react';
import {
  TextField,
  Typography,
  Box,
  Link,
  InputAdornment,
  MenuItem,
} from '@mui/material';
import { Email, CheckCircle, Badge } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../../../components/Common';
import Button from '../../Common/Button';
import PhoneNumberInput, { isValidPhoneNumber, PHONE_LENGTH_ERROR } from '../../Common/PhoneNumberInput';
import AuthPageLayout from '../AuthPageLayout';
import BrandHeader from '../BrandHeader';
import RegistrationFileInput from '../RegistrationFileInput';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { isValidEmail } from '../../../utils';
import { DEFAULT_COUNTRY_ISO, dialCodeFor } from '../../../constants/countryCodes';
import { registrationApi, type RegistrationError } from '../../../services/registrations/api';

const formStagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };

const SignInLink: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
      Already have an account?{' '}
      <Link
        component="button"
        variant="body2"
        onClick={() => navigate(ROUTES.LOGIN)}
        type="button"
        sx={{
          color: 'primary.main',
          fontWeight: 600,
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline', opacity: 0.9 },
        }}
      >
        Sign in
      </Link>
    </Typography>
  );
};

const Register: React.FC = () => {
  const { showError } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    licenseNumber: '',
  });
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [docType, setDocType] = useState<'license' | 'passport' | 'cnic'>('license');
  const [document, setDocument] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!form.phoneNumber.trim()) next.phoneNumber = 'Phone number is required.';
    else if (!isValidPhoneNumber(form.phoneNumber)) next.phoneNumber = PHONE_LENGTH_ERROR;
    if (!form.licenseNumber.trim()) next.licenseNumber = 'License number is required.';
    if (!document) next.document = 'Upload an identity document.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await registrationApi.submit({
        role: 'driver',
        email: form.email.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone_number: `${dialCodeFor(countryIso)} ${form.phoneNumber.trim()}`,
        extra: { license_number: form.licenseNumber.trim() },
        files: {
          license: docType === 'license' ? document : null,
          passport: docType === 'passport' ? document : null,
          cnic: docType === 'cnic' ? document : null,
        },
      });
      setSubmitted(true);
    } catch (err) {
      const regErr = err as RegistrationError;
      if (regErr.fieldErrors && Object.keys(regErr.fieldErrors).length) {
        setErrors(regErr.fieldErrors);
      }
      showError(regErr.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthPageLayout
        icon={<CheckCircle sx={{ fontSize: 40, color: 'white' }} />}
        title="Registration submitted"
        subtitle="Your driver registration is now awaiting admin approval. Once approved, you'll receive an email with your login details."
        footer={<SignInLink />}
      >
        <motion.div variants={fadeVariants} initial="initial" animate="animate">
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate(ROUTES.LOGIN)}
            sx={{ py: 1.5, fontWeight: 600, borderRadius: 2 }}
          >
            Back to sign in
          </Button>
        </motion.div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      header={<BrandHeader />}
      title="Driver sign up"
      subtitle="Create a driver account. Upload your ID — an admin will review and email your login details."
      fixedCardHeight
      footer={<SignInLink />}
    >
      <motion.div variants={formStagger} initial="initial" animate="animate">
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2 }}>
            <motion.div variants={fadeVariants} style={{ flex: 1, minWidth: 0 }}>
              <TextField
                required
                fullWidth
                label="First name"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                error={!!errors.firstName}
                helperText={errors.firstName}
                autoComplete="given-name"
              />
            </motion.div>
            <motion.div variants={fadeVariants} style={{ flex: 1, minWidth: 0 }}>
              <TextField
                fullWidth
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                autoComplete="family-name"
              />
            </motion.div>
          </Box>
          <motion.div variants={fadeVariants}>
            <TextField
              required
              fullWidth
              type="email"
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Email color="action" /></InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <PhoneNumberInput
              required
              name="phoneNumber"
              countryIso={countryIso}
              onCountryChange={setCountryIso}
              phone={form.phoneNumber}
              onChange={handleChange}
              error={!!errors.phoneNumber}
              helperText={errors.phoneNumber}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              required
              fullWidth
              label="License number"
              name="licenseNumber"
              value={form.licenseNumber}
              onChange={handleChange}
              error={!!errors.licenseNumber}
              helperText={errors.licenseNumber}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Badge color="action" /></InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
          </motion.div>

          <motion.div variants={fadeVariants}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Identity document
            </Typography>
            <TextField
              select
              fullWidth
              label="Document type"
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value as 'license' | 'passport' | 'cnic');
                setErrors((p) => ({ ...p, document: '' }));
              }}
              sx={{ mb: 2 }}
            >
              <MenuItem value="license">Driving licence</MenuItem>
              <MenuItem value="passport">Passport</MenuItem>
              <MenuItem value="cnic">CNIC / National ID</MenuItem>
            </TextField>
            <RegistrationFileInput
              label="Upload document"
              required
              value={document}
              onSelect={(f) => { setDocument(f); setErrors((p) => ({ ...p, document: '' })); }}
              error={errors.document}
            />
          </motion.div>

          <motion.div variants={fadeVariants}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              loading={submitting}
              sx={{
                py: 1.5,
                mt: 1,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.4)',
                '&:hover': { boxShadow: '0 20px 25px -5px rgba(99, 102, 241, 0.4)' },
              }}
            >
              Submit registration
            </Button>
          </motion.div>
        </Box>
      </motion.div>
    </AuthPageLayout>
  );
};

export default Register;
