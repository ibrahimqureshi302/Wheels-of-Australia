import React, { useState } from 'react';
import { Box, Typography, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { fadeVariants } from '../../../lib/animations';
import { mechanicsApi } from '../../../services/mechanics/api';
import { useToast, PasswordField } from '../../../components/Common';
import { isValidAbn, ABN_ERROR } from '../../../utils/abn';
import type { MechanicStatus } from '../../../services/mechanics/types';

const cell = { flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' }, minWidth: 0 } as const;

const MechanicsAddPage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
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
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAbn(formData.abn)) {
      setAbnError(true);
      showError(ABN_ERROR);
      return;
    }
    setSaving(true);
    try {
      await mechanicsApi.create({ ...formData });
      showSuccess('Mechanic created.');
      navigate(ROUTES.ADMIN.MECHANICS);
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to create mechanic.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: { xs: '100%', sm: 560, md: 720 }, mx: 'auto' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Typography variant="h4" gutterBottom>Add mechanic</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Create a new mechanic account.</Typography>

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
            <Box sx={cell}><PasswordField fullWidth showLockIcon={false} label="Password" name="password" value={formData.password} onChange={handleChange} required helperText="Initial login password for this mechanic" /></Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(ROUTES.ADMIN.MECHANICS)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} color="inherit" /> : 'Add mechanic'}
            </Button>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default MechanicsAddPage;
