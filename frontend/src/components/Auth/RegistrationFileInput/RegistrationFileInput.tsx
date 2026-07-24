import React, { useId, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { CloudUpload, CheckCircle, InsertDriveFile } from '@mui/icons-material';

export interface RegistrationFileInputProps {
  label: string;
  /** Accept attribute, e.g. 'image/*,.pdf' */
  accept?: string;
  maxSizeMb?: number;
  required?: boolean;
  /** Currently selected file (controlled). */
  value?: File | null;
  onSelect: (file: File | null) => void;
  /** External error message (e.g. backend validation). */
  error?: string;
}

/**
 * A compact, self-contained file picker for registration forms.
 *
 * Unlike DocumentUploadZone (which uses a fixed element id and can't be used
 * more than once per page), this generates a unique input id so several can
 * coexist on a single form (license + passport + CNIC, etc.).
 */
const RegistrationFileInput: React.FC<RegistrationFileInputProps> = ({
  label,
  accept = 'image/*,.pdf',
  maxSizeMb = 10,
  required = false,
  value,
  onSelect,
  error,
}) => {
  const inputId = useId();
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (file && file.size > maxSizeMb * 1024 * 1024) {
      setSizeError(`File is too large (max ${maxSizeMb} MB).`);
      return;
    }
    setSizeError(null);
    onSelect(file);
  };

  const shownError = error || sizeError;
  const selected = Boolean(value);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.75 }}>
        {label}
        {required && <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>}
      </Typography>

      <input
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <Button
        component="label"
        htmlFor={inputId}
        variant="outlined"
        fullWidth
        startIcon={selected ? <CheckCircle color="success" /> : <CloudUpload />}
        sx={{
          justifyContent: 'flex-start',
          textTransform: 'none',
          py: 1.25,
          borderRadius: 2,
          borderColor: shownError ? 'error.main' : selected ? 'success.main' : 'divider',
          color: 'text.primary',
        }}
      >
        {selected ? 'Change file' : 'Choose file'}
      </Button>

      {selected && value && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
          <InsertDriveFile sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" noWrap>
            {value.name}
          </Typography>
        </Box>
      )}

      {shownError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {shownError}
        </Typography>
      )}
    </Box>
  );
};

export default RegistrationFileInput;
