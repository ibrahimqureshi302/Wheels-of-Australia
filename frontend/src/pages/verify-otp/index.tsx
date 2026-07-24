import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import AuthPageLayout from '../../components/Auth/AuthPageLayout';
import OTPInput from '../../components/Auth/OtpInput';
import { ROUTES } from '../../constants/routes';
import { sessionUtils } from '../../utils/session';
import { fadeVariants } from '../../lib/animations';
import { Sms } from '@mui/icons-material';

const VerifyOTPPage: React.FC = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(false);

  const handleVerify = () => {
    if (otp.length !== 6) {
      setError(true);
      return;
    }
    setError(false);
    sessionUtils.clearPendingPhoneVerification();
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  return (
    <AuthPageLayout
      icon={<Sms sx={{ fontSize: 40, color: 'white' }} />}
      title="Verify your phone"
      subtitle="We sent a 6-digit code to your phone number. Enter it below."
    >
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <OTPInput
            length={6}
            value={otp}
            onChange={setOtp}
            onComplete={() => setError(false)}
            error={error}
            digitsOnly
          />
          {error && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
              Please enter the full 6-digit code.
            </Typography>
          )}
          <Button
            variant="contained"
            size="large"
            onClick={handleVerify}
            disabled={otp.length !== 6}
            sx={{ mt: 3 }}
          >
            Verify & go to dashboard
          </Button>
        </Box>
      </motion.div>
    </AuthPageLayout>
  );
};

export default VerifyOTPPage;
