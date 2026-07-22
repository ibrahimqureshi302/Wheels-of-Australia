import React from 'react';
import {
  Button as MuiButton,
  CircularProgress,
} from '@mui/material';
import type { BaseComponentProps } from '../../../types';

interface ButtonProps extends BaseComponentProps {
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'inherit';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  sx?: any; // Using any for now to avoid import issues
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  className,
  type = 'button',
  fullWidth = false,
  startIcon,
  endIcon,
  sx,
  ...props
}) => {
  return (
    <MuiButton
      variant={variant}
      color={color}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      type={type}
      fullWidth={fullWidth}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      endIcon={endIcon}
      sx={sx}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;
