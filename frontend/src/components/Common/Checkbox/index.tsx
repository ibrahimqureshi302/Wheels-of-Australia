import React from 'react';
import {
  FormControlLabel,
  Checkbox as MuiCheckbox,
  FormHelperText,
  Box,
  Typography,
} from '@mui/material';
import type { CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox';

export interface CheckboxProps extends Omit<MuiCheckboxProps, 'onChange'> {
  label?: string;
  helperText?: string;
  error?: boolean;
  description?: string;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  helperText,
  error = false,
  description,
  onChange,
  checked,
  ...props
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.checked, event);
  };

  const checkboxElement = (
    <MuiCheckbox
      {...props}
      checked={checked}
      onChange={handleChange}
      sx={{
        borderRadius: 1,
        '&.Mui-checked': {
          color: error ? 'error.main' : 'primary.main',
        },
        '&.MuiCheckbox-indeterminate': {
          color: error ? 'error.main' : 'primary.main',
        },
        ...props.sx,
      }}
    />
  );

  if (!label) {
    return checkboxElement;
  }

  return (
    <Box>
      <FormControlLabel
        control={checkboxElement}
        label={
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: error ? 'error.main' : 'text.primary',
                fontWeight: 500,
              }}
            >
              {label}
            </Typography>
            {description && (
              <Typography
                variant="caption"
                sx={{
                  color: error ? 'error.main' : 'text.secondary',
                  display: 'block',
                  mt: 0.5,
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        }
        sx={{
          alignItems: 'flex-start',
          ml: 0,
          '& .MuiFormControlLabel-label': {
            ml: 1,
          },
        }}
      />
      {helperText && (
        <FormHelperText error={error} sx={{ ml: 4 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
};

export default Checkbox;
