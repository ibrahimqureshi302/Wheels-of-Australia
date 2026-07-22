import React, { useState, useCallback } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudUpload, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { fadeVariants } from '../../../lib/animations';

export type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

export interface DocumentUploadZoneProps {
  accept?: string;
  maxSizeMb?: number;
  onFileSelect?: (file: File) => void | Promise<void>;
  /** Controlled status (optional). If not provided, internal state is used. */
  status?: UploadStatus;
  /** Progress 0–100 when status is 'uploading' */
  progress?: number;
  errorMessage?: string;
  disabled?: boolean;
}

const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({
  accept = 'image/*,.pdf',
  maxSizeMb = 10,
  onFileSelect,
  status: controlledStatus,
  progress: controlledProgress,
  errorMessage,
  disabled = false,
}) => {
  const [internalStatus, setInternalStatus] = useState<UploadStatus>('idle');
  const [internalProgress, setInternalProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const status = controlledStatus ?? internalStatus;
  const progress = controlledProgress ?? internalProgress;

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setInternalStatus('error');
        return;
      }
      setInternalStatus('uploading');
      setInternalProgress(0);
      const interval = setInterval(() => {
        setInternalProgress((p) => (p >= 90 ? p : p + 10));
      }, 150);
      try {
        await onFileSelect?.(file);
        clearInterval(interval);
        setInternalProgress(100);
        setInternalStatus('success');
      } catch {
        clearInterval(interval);
        setInternalStatus('error');
      }
    },
    [maxSizeMb, onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      handleFile(file || null);
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      handleFile(file || null);
      e.target.value = '';
    },
    [handleFile]
  );

  const isActive = status === 'idle' || status === 'dragging';
  const showDrop = isActive && (dragOver || status === 'dragging');

  return (
    <motion.div variants={fadeVariants} initial="initial" animate="animate">
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        sx={{
          border: '2px dashed',
          borderColor: showDrop ? 'primary.main' : status === 'error' ? 'error.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: showDrop ? 'action.hover' : status === 'error' ? 'error.light' : 'transparent',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          transition: 'background-color 0.2s, border-color 0.2s',
        }}
      >
        <AnimatePresence mode="wait">
          {status === 'idle' || status === 'dragging' ? (
            <motion.label
              key="idle"
              htmlFor="document-upload-input"
              style={{ cursor: disabled ? 'default' : 'pointer', display: 'block' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <input
                id="document-upload-input"
                type="file"
                accept={accept}
                onChange={handleInputChange}
                style={{ display: 'none' }}
                disabled={disabled}
              />
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {showDrop ? 'Drop file here' : 'Drag and drop or click to upload'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {accept} (max {maxSizeMb} MB)
              </Typography>
            </motion.label>
          ) : status === 'uploading' ? (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Uploading…
              </Typography>
              <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 8 }} />
            </motion.div>
          ) : status === 'success' ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="body1" color="success.dark">Upload complete</Typography>
            </motion.div>
          ) : (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ErrorIcon sx={{ fontSize: 48, color: 'error.main', mb: 1 }} />
              <Typography variant="body1" color="error.dark">{errorMessage || 'Upload failed'}</Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </motion.div>
  );
};

export default DocumentUploadZone;
