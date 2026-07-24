import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Link,
} from '@mui/material';
import { motion } from 'framer-motion';
import { Person, Email, Badge, Store, CheckCircle } from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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

const formStagger = { animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };

const MechanicRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    abn: '',
    shopName: '',
    shopAddress: '',
  });
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [shopImage, setShopImage] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.contactName.trim()) next.contactName = 'Contact name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    else if (!isValidPhoneNumber(form.phone)) next.phone = PHONE_LENGTH_ERROR;
    if (!isValidAbn(form.abn)) next.abn = ABN_ERROR;
    if (!form.shopName.trim()) next.shopName = 'Shop name is required.';
    if (!form.shopAddress.trim()) next.shopAddress = 'Shop address is required.';
    if (!shopImage) next.shopImage = 'Upload a photo of your shop.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await registrationApi.submit({
        role: 'mechanic',
        email: form.email.trim(),
        first_name: form.contactName.trim(),
        phone_number: `${dialCodeFor(countryIso)} ${form.phone.trim()}`,
        abn: form.abn.trim(),
        shop_name: form.shopName.trim(),
        shop_address: form.shopAddress.trim(),
        files: { shop_image: shopImage },
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
        Sign in
      </Link>
    </Typography>
  );

  if (submitted) {
    return (
      <AuthPageLayout
        icon={<CheckCircle sx={{ fontSize: 40, color: 'white' }} />}
        title="Registration submitted"
        subtitle="Your mechanic registration is now awaiting admin approval. Once approved, you'll receive an email with your login details."
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
      title="Mechanic sign up"
      subtitle="Register your workshop. Upload a shop photo — an admin will review and email your login details."
      maxWidth={480}
      fixedCardHeight
      footer={SignInFooter}
    >
      <motion.div variants={formStagger} initial="initial" animate="animate">
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              label="Contact name"
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
              label="Email"
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
              label="Phone number"
              name="phone"
              countryIso={countryIso}
              onCountryChange={setCountryIso}
              phone={form.phone}
              onChange={handleChange}
              required
              error={!!errors.phone}
              helperText={errors.phone}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              label="Shop name"
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              required
              error={!!errors.shopName}
              helperText={errors.shopName}
              InputProps={{ startAdornment: (<InputAdornment position="start"><Store color="action" /></InputAdornment>) }}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              label="ABN"
              name="abn"
              value={form.abn}
              onChange={handleChange}
              required
              error={!!errors.abn}
              helperText={errors.abn || '11 digits'}
              inputProps={{ inputMode: 'numeric', maxLength: 14 }}
              placeholder="e.g. 12 345 678 901"
              InputProps={{ startAdornment: (<InputAdornment position="start"><Badge color="action" /></InputAdornment>) }}
              sx={{ mb: 2 }}
            />
          </motion.div>
          <motion.div variants={fadeVariants}>
            <TextField
              fullWidth
              label="Shop address"
              name="shopAddress"
              value={form.shopAddress}
              onChange={handleChange}
              required
              error={!!errors.shopAddress}
              helperText={errors.shopAddress}
              multiline
              minRows={2}
              sx={{ mb: 3 }}
            />
          </motion.div>

          <motion.div variants={fadeVariants}>
            <RegistrationFileInput
              label="Shop photo"
              accept="image/*"
              required
              value={shopImage}
              onSelect={(f) => { setShopImage(f); setErrors((p) => ({ ...p, shopImage: '' })); }}
              error={errors.shopImage}
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

export default MechanicRegisterPage;
