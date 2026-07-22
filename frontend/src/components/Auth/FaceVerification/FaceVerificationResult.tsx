import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { Block, Refresh } from '@mui/icons-material';
import { fadeVariants } from '../../../lib/animations';

export type ResultType = 'retry' | 'lock';

export interface FaceVerificationResultProps {
  type: ResultType;
  attemptCount?: number;
  maxAttempts?: number;
  onRetry?: () => void;
  /** Lock message when type is 'lock' */
  lockMessage?: string;
}

const FaceVerificationResult: React.FC<FaceVerificationResultProps> = ({
  type,
  attemptCount = 0,
  maxAttempts = 3,
  onRetry,
  lockMessage = 'Too many failed attempts. Your account has been locked for review. Please contact support.',
}) => (
  <motion.div variants={fadeVariants} initial="initial" animate="animate">
    <Box sx={{ maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
      {type === 'lock' ? (
        <>
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
              mx: 'auto',
              mb: 2,
            }}
          >
            <Block sx={{ fontSize: 48 }} />
          </Box>
          <Typography variant="h6" color="error.dark" sx={{ mb: 1 }}>
            Account locked
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {lockMessage}
          </Typography>
        </>
      ) : (
        <>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Verification didn’t match. You have {Math.max(0, maxAttempts - attemptCount)} attempt(s) left.
          </Typography>
          {onRetry && (
            <Button
              variant="contained"
              fullWidth
              startIcon={<Refresh />}
              onClick={onRetry}
              sx={{ py: 1.5 }}
            >
              Try again
            </Button>
          )}
        </>
      )}
    </Box>
  </motion.div>
);

export default FaceVerificationResult;
