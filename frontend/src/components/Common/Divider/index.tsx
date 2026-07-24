import React from 'react';
import {
  Divider as MuiDivider,
  Typography,
  Box,
} from '@mui/material';
import type { DividerProps as MuiDividerProps } from '@mui/material/Divider';

export interface DividerProps extends MuiDividerProps {
  label?: string;
  spacing?: number;
  color?: string;
  thickness?: number;
}

const Divider: React.FC<DividerProps> = ({
  label,
  spacing = 2,
  color,
  thickness = 1,
  orientation = 'horizontal',
  variant = 'fullWidth',
  ...props
}) => {
  if (label) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: spacing,
        }}
      >
        <MuiDivider
          sx={{
            flexGrow: 1,
            borderColor: color,
            borderWidth: thickness,
          }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            px: 2,
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
        <MuiDivider
          sx={{
            flexGrow: 1,
            borderColor: color,
            borderWidth: thickness,
          }}
        />
      </Box>
    );
  }

  return (
    <MuiDivider
      {...props}
      orientation={orientation}
      variant={variant}
      sx={{
        my: orientation === 'horizontal' ? spacing : 0,
        mx: orientation === 'vertical' ? spacing : 0,
        borderColor: color,
        borderWidth: thickness,
        ...props.sx,
      }}
    />
  );
};

export default Divider;
