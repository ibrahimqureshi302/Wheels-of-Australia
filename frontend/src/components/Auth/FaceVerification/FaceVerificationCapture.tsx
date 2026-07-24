import React, { useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { CameraAlt } from '@mui/icons-material';
import Webcam from 'react-webcam';
import { fadeVariants } from '../../../lib/animations';

const videoConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  facingMode: 'user' as const,
};

export interface FaceVerificationCaptureProps {
  onCapture: () => void;
  loading?: boolean;
  /** Optional preview area (e.g. custom video); if not provided, react-webcam is used */
  preview?: React.ReactNode;
}

const FaceVerificationCapture: React.FC<FaceVerificationCaptureProps> = ({
  onCapture,
  loading = false,
  preview: previewProp,
}) => {
  const webcamRef = useRef<Webcam>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const handleUserMedia = useCallback(() => {
    setCameraReady(true);
    setCameraError(null);
  }, []);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    setCameraReady(false);
    const message = typeof error === 'string' ? error : error?.message ?? 'Could not access camera.';
    if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
      setCameraError('Camera permission denied. Please allow camera access and try again.');
    } else if (message.toLowerCase().includes('notfound') || message.toLowerCase().includes('no camera')) {
      setCameraError('No camera found.');
    } else {
      setCameraError('Camera access failed. Use HTTPS or localhost.');
    }
  }, []);

  const preview =
    previewProp !== undefined ? (
      previewProp
    ) : (
      <Box
        sx={{
          width: 240,
          height: 240,
          mx: 'auto',
          mb: 3,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'grey.200',
        }}
      >
        <Webcam
          ref={webcamRef}
          audio={false}
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          screenshotFormat="image/jpeg"
          style={{
            width: 240,
            height: 240,
            objectFit: 'cover',
            display: 'block',
          }}
          mirrored
        />
        {/* Overlay placeholder until stream is ready or on error */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.200',
            visibility: cameraReady && !cameraError ? 'hidden' : 'visible',
            pointerEvents: 'none',
          }}
        >
          {cameraError ? (
            <Typography variant="caption" color="error" sx={{ px: 2, textAlign: 'center' }}>
              {cameraError}
            </Typography>
          ) : (
            <CameraAlt sx={{ fontSize: 80, color: 'grey.400' }} />
          )}
        </Box>
      </Box>
    );

  return (
    <motion.div variants={fadeVariants} initial="initial" animate="animate">
      <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
        {preview}
        {cameraError && (
          <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
            You can still continue without camera; the capture will be simulated.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Position your face in the frame and ensure good lighting.
        </Typography>
        <Button
          variant="contained"
          fullWidth
          disabled={loading || (!cameraReady && !cameraError)}
          onClick={() => {
            if (webcamRef.current?.getScreenshot) {
              webcamRef.current.getScreenshot();
            }
            onCapture();
          }}
          startIcon={<CameraAlt />}
          sx={{ py: 1.5 }}
        >
          {loading ? 'Verifying…' : 'Capture'}
        </Button>
      </Box>
    </motion.div>
  );
};

export default FaceVerificationCapture;
