import React from 'react';
import {
  Paper as MuiPaper,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import type { PaperProps as MuiPaperProps } from '@mui/material/Paper';

export interface PaperProps extends MuiPaperProps {
  title?: string;
  subtitle?: string;
  padding?: number | string;
  noPadding?: boolean;
  bordered?: boolean;
  headerAction?: React.ReactNode;
  showDivider?: boolean;
}

const Paper: React.FC<PaperProps> = ({
  title,
  subtitle,
  padding = 3,
  noPadding = false,
  bordered = false,
  headerAction,
  showDivider = true,
  children,
  elevation = 1,
  ...props
}) => {
  const hasHeader = title || subtitle || headerAction;

  return (
    <MuiPaper
      {...props}
      elevation={elevation}
      sx={{
        borderRadius: 2,
        border: bordered ? '1px solid' : 'none',
        borderColor: bordered ? 'divider' : undefined,
        overflow: 'hidden',
        ...props.sx,
      }}
    >
      {hasHeader && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: padding,
              pb: showDivider ? padding : 0,
            }}
          >
            <Box>
              {title && (
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {headerAction && (
              <Box sx={{ flexShrink: 0 }}>
                {headerAction}
              </Box>
            )}
          </Box>
          {showDivider && <Divider />}
        </>
      )}
      
      <Box sx={{ p: noPadding ? 0 : hasHeader ? `0 ${typeof padding === 'number' ? `${padding * 8}px` : padding} ${typeof padding === 'number' ? `${padding * 8}px` : padding}` : padding }}>
        {children}
      </Box>
    </MuiPaper>
  );
};

export default Paper;
