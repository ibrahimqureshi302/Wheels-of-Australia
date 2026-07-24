import React, { useState } from 'react';
import { Box, Typography, Checkbox, FormControlLabel, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { fadeVariants } from '../../../lib/animations';

export interface FaceVerificationConsentProps {
  onConsent: () => void;
  loading?: boolean;
  /** Short consent text */
  consentText?: string;
  /** Checkbox label */
  checkboxLabel?: string;
}

const FaceVerificationConsent: React.FC<FaceVerificationConsentProps> = ({
  onConsent,
  loading = false,
  consentText = 'We need to verify your identity using a quick selfie. Your biometric data is encrypted and handled in line with our privacy policy.',
  checkboxLabel = 'I consent to biometric verification and understand how my data will be used.',
}) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <motion.div variants={fadeVariants} initial="initial" animate="animate">
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {consentText}
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              color="primary"
            />
          }
          label={checkboxLabel}
          sx={{ display: 'block', mb: 3 }}
        />
        <Button
          variant="contained"
          fullWidth
          disabled={!agreed || loading}
          onClick={onConsent}
          sx={{ py: 1.5 }}
        >
          {loading ? 'Please wait…' : 'I agree, continue'}
        </Button>
      </Box>
    </motion.div>
  );
};

export default FaceVerificationConsent;
