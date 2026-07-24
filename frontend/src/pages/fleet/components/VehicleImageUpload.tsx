import React from 'react';
import { Box, Typography, IconButton, FormHelperText } from '@mui/material';
import { AddPhotoAlternate, Close } from '@mui/icons-material';

export interface VehicleImageUploadProps {
  /** Current images as data URLs. */
  value: string[];
  onChange: (images: string[]) => void;
  /** Show the validation error state + message. */
  error?: boolean;
}

/** Reads a File into a base64 data URL. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Lets the rental upload one or more vehicle photos from their device. Images
 * are stored as data URLs. At least 1 image is required (enforced by the form);
 * the rental can add more if they want.
 */
const VehicleImageUpload: React.FC<VehicleImageUploadProps> = ({ value, onChange, error }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const dataUrls = await Promise.all(imageFiles.map(readAsDataUrl));
    onChange([...value, ...dataUrls]);
    // Reset so selecting the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Vehicle photos
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Add at least one photo. You can add more if you like.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {value.map((src, index) => (
          <Box
            key={src}
            sx={{
              position: 'relative',
              width: 120,
              height: 90,
              borderRadius: 1.5,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              component="img"
              src={src}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <IconButton
              size="small"
              aria-label="Remove photo"
              onClick={() => handleRemove(index)}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
              }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}

        {/* Add-images tile */}
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            width: 120,
            height: 90,
            borderRadius: 1.5,
            border: '2px dashed',
            borderColor: error ? 'error.main' : 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
        >
          <AddPhotoAlternate sx={{ fontSize: 26 }} />
          <Typography variant="caption" sx={{ mt: 0.5 }}>
            Add photos
          </Typography>
        </Box>
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <FormHelperText error>Add at least one photo.</FormHelperText>}
    </Box>
  );
};

export default VehicleImageUpload;
