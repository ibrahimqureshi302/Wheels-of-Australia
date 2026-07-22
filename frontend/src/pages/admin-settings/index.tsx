import React, { useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import { DarkMode, LightMode, Image, Palette } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useBranding } from '../../context/BrandingContext';
import { fadeVariants } from '../../lib/animations';
import { PageHero } from '../../components/Common';

const HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
function normalizeHex(value: string): string {
  const v = value.trim();
  if (v.startsWith('#')) return HEX_REGEX.test(v) ? v : '';
  if (/^[A-Fa-f0-9]{6}$/.test(v)) return `#${v}`;
  if (/^[A-Fa-f0-9]{3}$/.test(v)) return `#${v}`;
  return '';
}

const AdminSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    mode,
    primaryColor,
    secondaryColor,
    logoUrl,
    setMode,
    setPrimaryColor,
    setSecondaryColor,
    setLogoUrl,
    resetBranding,
  } = useBranding();
  const [hexInput, setHexInput] = React.useState(primaryColor);
  const [hexInputSecondary, setHexInputSecondary] = React.useState(secondaryColor);
  React.useEffect(() => {
    setHexInput(primaryColor);
  }, [primaryColor]);
  React.useEffect(() => {
    setHexInputSecondary(secondaryColor);
  }, [secondaryColor]);

  const applyHex = React.useCallback(
    (value: string) => {
      const hex = normalizeHex(value);
      if (hex) setPrimaryColor(hex);
      else setHexInput(primaryColor);
    },
    [primaryColor, setPrimaryColor]
  );
  const applyHexSecondary = React.useCallback(
    (value: string) => {
      const hex = normalizeHex(value);
      if (hex) setSecondaryColor(hex);
      else setHexInputSecondary(secondaryColor);
    },
    [secondaryColor, setSecondaryColor]
  );

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <PageHero title={t('admin.themeTitle')} subtitle={t('admin.themeSubtitle')}>
      {/* Theme mode */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            {mode === 'dark' ? <DarkMode /> : <LightMode />}
            {t('admin.themeMode')}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={(_, checked) => setMode(checked ? 'dark' : 'light')}
                color="primary"
              />
            }
            label={mode === 'dark' ? t('admin.darkMode') : t('admin.lightMode')}
          />
        </Paper>
      </motion.div>

      {/* Primary colour – color picker; changes saved to localStorage */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette />
            {t('admin.primaryColour')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box
              component="label"
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: primaryColor,
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
                aria-label={t('admin.primaryColour')}
              />
            </Box>
            <TextField
              size="small"
              label={t('admin.hexCode')}
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex) setPrimaryColor(hex);
              }}
              onBlur={() => applyHex(hexInput)}
              placeholder="#6366f1"
              sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              inputProps={{ maxLength: 7 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('admin.primaryColourHint')}
          </Typography>
        </Paper>
      </motion.div>

      {/* Secondary colour – color picker; changes saved to localStorage */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette />
            {t('admin.secondaryColour')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box
              component="label"
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                cursor: 'pointer',
                bgcolor: secondaryColor,
                '&:hover': { borderColor: 'secondary.main' },
              }}
            >
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
                aria-label={t('admin.secondaryColour')}
              />
            </Box>
            <TextField
              size="small"
              label={t('admin.hexCode')}
              value={hexInputSecondary}
              onChange={(e) => {
                setHexInputSecondary(e.target.value);
                const hex = normalizeHex(e.target.value);
                if (hex) setSecondaryColor(hex);
              }}
              onBlur={() => applyHexSecondary(hexInputSecondary)}
              placeholder="#f59e0b"
              sx={{ width: 120, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              inputProps={{ maxLength: 7 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('admin.secondaryColourHint')}
          </Typography>
        </Paper>
      </motion.div>

      {/* Logo upload */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image />
            {t('admin.logo')}
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            style={{ display: 'none' }}
            aria-hidden
          />
          {logoUrl ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box
                component="img"
                src={logoUrl}
                alt="Logo"
                sx={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain' }}
              />
              <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
                {t('admin.changeLogo')}
              </Button>
              <Button variant="outlined" size="small" color="error" onClick={handleRemoveLogo}>
                {t('admin.removeLogo')}
              </Button>
            </Box>
          ) : (
            <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
              {t('admin.uploadLogo')}
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t('admin.logoHint')}
          </Typography>
        </Paper>
      </motion.div>

      {/* Reset */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Button variant="outlined" color="inherit" onClick={resetBranding}>
          {t('admin.resetBranding')}
        </Button>
      </motion.div>
    </PageHero>
  );
};

export default AdminSettingsPage;
