import React from 'react';
import {
  TextField as MuiTextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import type { TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField';
import { Visibility, VisibilityOff, HelpOutline } from '@mui/icons-material';

export interface TextFieldProps extends Omit<MuiTextFieldProps, 'variant'> {
  variant?: 'outlined' | 'filled' | 'standard';
  showPasswordToggle?: boolean;
  helpText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const TextField: React.FC<TextFieldProps> = ({
  type = 'text',
  variant = 'outlined',
  showPasswordToggle = false,
  helpText,
  startIcon,
  endIcon,
  InputProps,
  ...props
}) => {
  const [showPassword, setShowPassword] = React.useState(false);

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const isPasswordField = type === 'password';
  const inputType = isPasswordField && showPassword ? 'text' : type;

  const startAdornment = startIcon ? (
    <InputAdornment position="start">{startIcon}</InputAdornment>
  ) : undefined;

  const endAdornment = React.useMemo(() => {
    const elements = [];

    // Add help icon if helpText is provided
    if (helpText) {
      elements.push(
        <Tooltip key="help" title={helpText} arrow>
          <IconButton size="small" edge="end">
            <HelpOutline fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    }

    // Add custom end icon
    if (endIcon) {
      elements.push(
        <span key="endIcon" style={{ display: 'flex', alignItems: 'center' }}>
          {endIcon}
        </span>
      );
    }

    // Add password toggle for password fields
    if (isPasswordField && showPasswordToggle) {
      elements.push(
        <IconButton
          key="password-toggle"
          onClick={handleTogglePassword}
          edge="end"
          size="small"
        >
          {showPassword ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      );
    }

    return elements.length > 0 ? (
      <InputAdornment position="end">
        {elements.map((element, index) => (
          <React.Fragment key={index}>{element}</React.Fragment>
        ))}
      </InputAdornment>
    ) : undefined;
  }, [helpText, endIcon, isPasswordField, showPasswordToggle, showPassword]);

  return (
    <MuiTextField
      {...props}
      type={inputType}
      variant={variant}
      InputProps={{
        ...InputProps,
        startAdornment: startAdornment,
        endAdornment: endAdornment,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
          },
        },
        '& .MuiInputLabel-root': {
          fontWeight: 500,
        },
        ...props.sx,
      }}
    />
  );
};

export default TextField;
