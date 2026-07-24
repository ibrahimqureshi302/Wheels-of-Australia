import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Block as BlockIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import { fadeVariants } from '../../lib/animations';

const NoAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        px: 2,
        textAlign: 'center',
      }}
    >
      <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'error.light',
              color: 'error.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BlockIcon sx={{ fontSize: 48 }} />
          </Box>
        </motion.div>
        <Typography variant="h5" fontWeight={600} color="text.primary">
          {t('errors.noAccess')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
          {t('errors.noAccessDescription')}
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate(ROUTES.DASHBOARD)}
          sx={{ mt: 2 }}
        >
          {t('navigation.dashboard')}
        </Button>
      </motion.div>
    </Box>
  );
};

export default NoAccessPage;
