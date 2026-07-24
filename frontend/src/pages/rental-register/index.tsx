import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  InputAdornment,
  Link,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Business, Person, CheckCircle, Email, Badge } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthPageLayout from '../../components/Auth/AuthPageLayout';
import BrandHeader from '../../components/Auth/BrandHeader';
import RegistrationFileInput from '../../components/Auth/RegistrationFileInput';
import Button from '../../components/Common/Button';
import PhoneNumberInput, { isValidPhoneNumber, PHONE_LENGTH_ERROR } from '../../components/Common/PhoneNumberInput';
import { useToast } from '../../components/Common';
import { ROUTES } from '../../constants/routes';
import { fadeVariants } from '../../lib/animations';
import { isValidEmail } from '../../utils';
import { isValidAbn, ABN_ERROR } from '../../utils/abn';
import { DEFAULT_COUNTRY_ISO, dialCodeFor } from '../../constants/countryCodes';
import { registrationApi, type RegistrationError } from '../../services/registrations/api';
import { looksLikeIdDocument } from '../../services/ocr';
import type { RentalType } from '../../services/rental/types';

const formStagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };

const RentalRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    rentalType: 'company' as RentalType,
    companyName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: '',
  });
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [idDocChecking, setIdDocChecking] = useState(false);
  const [idDocWarning, setIdDocWarning] = useState('');

  const isCompany = form.rentalType === 'company';

  // Pick the ID document and run a quick OCR check that it looks like an ID
  // (soft warning only — a poor scan of a real document still goes through).
  const handleIdDocSelect = async (f: File | null) => {
    setIdDocument(f);
    setErrors((p) => ({ ...p, idDocument: '' }));
    setIdDocWarning('');
    if (!f) return;
    setIdDocChecking(true);
    try {
      const { looksLikeId, checked } = await looksLikeIdDocument(f);
      if (checked && !looksLikeId) {
        setIdDocWarning(
          "This file doesn't look like an ID document (passport, CNIC or driving licence). " +
            'Please check you uploaded the right photo — a clear, well-lit scan works best.',
        );
      }
    } finally {
      setIdDocChecking(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleRentalTypeChange = (_: React.ChangeEvent<HTMLInputElement>, value: string) => {
    setForm((prev) => ({ ...prev, rentalType: value as RentalType }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.contactName.trim()) next.contactName = 'Contact name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    else if (!isValidPhoneNumber(form.phone)) next.phone = PHONE_LENGTH_ERROR;
    if (isCompany && !form.companyName.trim()) next.companyName = 'Company name is required.';
    if (isCompany && !isValidAbn(form.abn)) next.abn = ABN_ERROR;
    if (isCompany && !certificate) next.certificate = 'Upload your company certificate.';
    if (!isCompany && !idDocument) next.idDocument = 'Upload an ID document.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await registrationApi.submit({
        role: 'rental',
        email: form.email.trim(),
        first_name: form.contactName.trim(),
        phone_number: `${dialCodeFor(countryIso)} ${form.phone.trim()}`,
        rental_type: form.rentalType,
        company_name: isCompany ? form.companyName.trim() : undefined,
        abn: isCompany ? form.abn.trim() : undefined,
        files: isCompany ? { certificate } : { passport: idDocument },
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

  const SignInFooter = (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
      Already have an account?{' '}
      <Link
        component={RouterLink}
        to={ROUTES.LOGIN}
        sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none',
          '&:hover': { textDecoration: 'underline', opacity: 0.9 } }}
      >
        {t('auth.signIn')}
      </Link>
    </Typography>
  );

  if (submitted) {
    return (
      <AuthPageLayout
        icon={<CheckCircle sx={{ fontSize: 40, color: 'white' }} />}
        title={t('rental.successTitle')}
        subtitle="Your rental registration is now awaiting admin approval. Once approved, you'll receive an email with your login details."
        footer={SignInFooter}
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
      title={t('rental.title')}
      subtitle={t('rental.subtitle')}
      maxWidth={480}
      fixedCardHeight
      footer={SignInFooter}
    >
      <motion.div variants={formStagger} initial="initial" animate="animate">
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <motion.div variants={fadeVariants}>
            <FormControl component="fieldset" sx={{ mb: 2, display: 'block' }}>
              <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
                {t('rental.registrationType')}
              </FormLabel>
              <RadioGroup row name="rentalType" value={form.rentalType} onChange={handleRentalTypeChange}>
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
          </motion.div>

          <AnimatePresence mode="wait">
            {isCompany && (
              <motion.div
                key="company-fields"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <TextField
                  fullWidth
                  label={t('rental.companyName')}
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  required
                  error={!!errors.companyName}
                  helperText={errors.companyName}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><Business color="action" /></InputAdornment>) }}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  required
                  label={t('rental.abn')}
                  name="abn"
                  value={form.abn}
                  onChange={handleChange}
                  placeholder={t('rental.abnPlaceholder')}
                  error={!!errors.abn}
                  helperText={errors.abn || '11 digits'}
                  inputProps={{ inputMode: 'numeric', maxLength: 14 }}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><Badge color="action" /></InputAdornment>) }}
                  sx={{ mb: 2 }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              label={t('rental.contactName')}
              name="contactName"
              value={form.contactName}
              onChange={handleChange}
              required
              error={!!errors.contactName}
              helperText={errors.contactName}
              InputProps={{ startAdornment: (<InputAdornment position="start"><Person color="action" /></InputAdornment>) }}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              type="email"
              label={t('rental.email')}
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{ startAdornment: (<InputAdornment position="start"><Email color="action" /></InputAdornment>) }}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <PhoneNumberInput
              label={t('rental.phone')}
              name="phone"
              countryIso={countryIso}
              onCountryChange={setCountryIso}
              phone={form.phone}
              onChange={handleChange}
              required
              error={!!errors.phone}
              helperText={errors.phone}
              sx={{ mb: 3 }}
            />
          </motion.div>

          <motion.div variants={fadeVariants}>
            {isCompany ? (
              <RegistrationFileInput
                label="Company certificate"
                required
                value={certificate}
                onSelect={(f) => { setCertificate(f); setErrors((p) => ({ ...p, certificate: '' })); }}
                error={errors.certificate}
              />
            ) : (
              <Box>
                <RegistrationFileInput
                  label="ID document (passport, CNIC or driving licence)"
                  required
                  value={idDocument}
                  onSelect={handleIdDocSelect}
                  error={errors.idDocument}
                />
                {idDocChecking && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: -1, mb: 1 }}>
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Checking document…
                    </Typography>
                  </Stack>
                )}
                {!idDocChecking && idDocWarning && (
                  <Alert severity="warning" sx={{ mt: -0.5, mb: 1 }} onClose={() => setIdDocWarning('')}>
                    {idDocWarning}
                  </Alert>
                )}
              </Box>
            )}
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
              {t('rental.submitRegistration')}
            </Button>
          </motion.div>
        </Box>
      </motion.div>
    </AuthPageLayout>
  );
};

export default RentalRegisterPage;
