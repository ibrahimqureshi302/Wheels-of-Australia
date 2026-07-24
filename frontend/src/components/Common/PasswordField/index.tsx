import React, { useState } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import { Lock, Visibility, VisibilityOff } from '@mui/icons-material';

export type PasswordFieldProps = TextFieldProps & {
  /** Show the leading lock icon (default true). */
  showLockIcon?: boolean;
};

/**
 * A password TextField with a built-in show/hide (eye) toggle, so whoever is
 * typing can verify the password. Drop-in replacement for a
 * `<TextField type="password" />`.
 */
const PasswordField: React.FC<PasswordFieldProps> = ({ showLockIcon = true, InputProps, ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      InputProps={{
        ...InputProps,
        startAdornment: showLockIcon
          ? (
            <InputAdornment position="start">
              <Lock color="action" />
            </InputAdornment>
          )
          : InputProps?.startAdornment,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow((s) => !s)}
              edge="end"
              tabIndex={-1}
            >
              {show ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

export default PasswordField;
