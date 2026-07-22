import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Skeleton,
} from '@mui/material';

export interface LoadingProps {
  type?: 'circular' | 'linear' | 'skeleton';
  size?: 'small' | 'medium' | 'large' | number;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  rows?: number; // For skeleton
  height?: number | string; // For skeleton
}

const Loading: React.FC<LoadingProps> = ({
  type = 'circular',
  size = 'medium',
  text,
  fullScreen = false,
  overlay = false,
  rows = 3,
  height = 40,
}) => {
  const getSize = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'small': return 24;
      case 'large': return 64;
      default: return 40;
    }
  };

  const renderLoading = () => {
    switch (type) {
      case 'linear':
        return (
          <Box sx={{ width: '100%' }}>
            <LinearProgress />
            {text && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                {text}
              </Typography>
            )}
          </Box>
        );
      
      case 'skeleton':
        return (
          <Box sx={{ width: '100%' }}>
            {Array.from({ length: rows }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                height={height}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  '&:last-child': { mb: 0 },
                }}
              />
            ))}
          </Box>
        );
      
      default: // circular
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={getSize()} />
            {text && (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {text}
              </Typography>
            )}
          </Box>
        );
    }
  };

  const containerSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(fullScreen && {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: overlay ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
      zIndex: 9999,
    }),
    ...(overlay && !fullScreen && {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      zIndex: 1,
    }),
    ...(!fullScreen && !overlay && {
      py: 4,
    }),
  };

  return (
    <Box sx={containerSx}>
      {renderLoading()}
    </Box>
  );
};

export default Loading;
