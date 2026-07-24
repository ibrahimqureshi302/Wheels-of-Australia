import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { mechanicsApi } from '../../../services/mechanics/api';
import { useToast, PasswordField } from '../../../components/Common';
import { isValidAbn, ABN_ERROR } from '../../../utils/abn';
import type { MechanicStatus } from '../../../services/mechanics/types';

const cell = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 } as const;

const MechanicsEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [abnError, setAbnError] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    shopName: '',
    shopAddress: '',
    abn: '',
    status: 'active' as MechanicStatus,
    suspensionReason: '',
    password: '',
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    mechanicsApi
      .get(id)
      .then((m) => {
        if (!active) return;
        setFormData({
          fullName: m.fullName,
          email: m.email,
          phone: m.phone,
          shopName: m.shopName ?? '',
          shopAddress: m.shopAddress ?? '',
          abn: m.abn ?? '',
          status: m.status,
          suspensionReason: m.suspensionReason ?? '',
          password: '',
        });
      })
      .catch(() => { if (active) showError('Failed to load mechanic.'); })
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
    if (!isValidAbn(formData.abn)) {
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
      await mechanicsApi.update(id, {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        shopName: formData.shopName,
        shopAddress: formData.shopAddress,
        abn: formData.abn,
        status: formData.status,
        suspensionReason: formData.status === 'inactive' ? formData.suspensionReason : '',
        password: formData.password || undefined,
      });
      showSuccess('Mechanic updated.');
      navigate(ROUTES.ADMIN.MECHANICS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to update mechanic.');
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>Edit mechanic</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Update mechanic details.</Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={cell}><TextField fullWidth label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} required /></Box>
            <Box sx={cell}><TextField fullWidth type="email" label="Email" name="email" value={formData.email} onChange={handleChange} required /></Box>
            <Box sx={cell}><TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleChange} /></Box>
            <Box sx={cell}><TextField fullWidth label="Shop name" name="shopName" value={formData.shopName} onChange={handleChange} /></Box>
            <Box sx={cell}><TextField fullWidth label="Shop address" name="shopAddress" value={formData.shopAddress} onChange={handleChange} /></Box>
            <Box sx={cell}><TextField fullWidth label="ABN" name="abn" value={formData.abn}
              onChange={(e) => { handleChange(e); if (abnError) setAbnError(false); }}
              required error={abnError} helperText={abnError ? ABN_ERROR : '11 digits'}
              inputProps={{ inputMode: 'numeric', maxLength: 14 }} /></Box>
            <Box sx={cell}>
              <TextField fullWidth select label="Status" name="status" value={formData.status} onChange={handleChange}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Box>
            {formData.status === 'inactive' && (
              <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
                <TextField fullWidth multiline minRows={2} required label="Reason for inactivity" name="suspensionReason"
                  value={formData.suspensionReason} onChange={handleChange}
                  placeholder="Shown to the user on their profile so they know why and can contact you."
                  helperText="The user can still log in but will only see their profile with this message." />
              </Box>
            )}
            <Box sx={cell}><PasswordField fullWidth showLockIcon={false} label="New password" name="password" value={formData.password} onChange={handleChange} placeholder="Leave blank to keep current" helperText="Set a new login password (optional)" /></Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.MECHANICS)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : 'Save changes'}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default MechanicsEditPage;
