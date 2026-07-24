import React, { useRef, useCallback } from 'react';
import { Box, TextField } from '@mui/material';
import { motion } from 'framer-motion';

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  /** Only allow digits */
  digitsOnly?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  digitsOnly = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.padEnd(length, ' ').split('').slice(0, length);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/\s/g, '');
      if (digitsOnly) v = v.replace(/\D/g, '');
      v = v.slice(0, length);
      onChange(v);
      if (v.length === length) onComplete?.(v);
    },
    [length, digitsOnly, onChange, onComplete]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && value.length > 0 && !(e.target as HTMLInputElement).value) {
        onChange(value.slice(0, -1));
      }
    },
    [value, onChange]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        error={error}
        inputProps={{
          maxLength: length,
          'aria-label': 'One-time password',
          style: {
            textAlign: 'center',
            letterSpacing: '0.5em',
            fontSize: 'clamp(1.125rem, 4vw, 1.5rem)',
            fontWeight: 600,
          },
        }}
        sx={{
          width: '100%',
          maxWidth: length <= 6 ? 200 : 280,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            '& fieldset': {
              borderWidth: 2,
              borderColor: error ? 'error.main' : 'divider',
            },
            '&:hover fieldset': {
              borderColor: error ? 'error.main' : 'primary.main',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'primary.main',
              borderWidth: 2,
            },
          },
        }}
      />
      {/* Visual digit boxes (optional) – hidden, we use single input for a11y */}
      <Box sx={{ display: 'none' }} aria-hidden>
        {digits.map((d, i) => (
          <motion.span
            key={i}
            animate={{ scale: value.length === i ? 1.05 : 1 }}
            transition={{ duration: 0.15 }}
          >
            {d === ' ' ? '·' : d}
          </motion.span>
        ))}
      </Box>
    </Box>
  );
};

export default OTPInput;
