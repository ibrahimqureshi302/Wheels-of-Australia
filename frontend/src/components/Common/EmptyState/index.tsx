import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Inbox, SearchOff, ErrorOutline } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { fadeVariants } from '../../../lib/animations';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'contained' | 'outlined' | 'text';
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  };
  type?: 'empty' | 'search' | 'error';
  size?: 'small' | 'medium' | 'large';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  type = 'empty',
  size = 'medium',
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'search':
        return <SearchOff />;
      case 'error':
        return <ErrorOutline />;
      default:
        return <Inbox />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'search':
        return 'No results found';
      case 'error':
        return 'Something went wrong';
      default:
        return 'No data available';
    }
  };

  const getDefaultDescription = () => {
    switch (type) {
      case 'search':
        return 'Try adjusting your search criteria or filters';
      case 'error':
        return 'Please try again or contact support if the problem persists';
      default:
        return 'There are no items to display at the moment';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 48;
      case 'large': return 96;
      default: return 64;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small': return 3;
      case 'large': return 6;
      default: return 4;
    }
  };

  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      style={{ width: '100%' }}
    >
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: getPadding(),
        px: 2,
      }}
    >
      <Box
        sx={{
          color: 'text.disabled',
          mb: 2,
          '& > svg': {
            fontSize: getIconSize(),
          },
        }}
      >
        {icon || getDefaultIcon()}
      </Box>
      
      <Typography
        variant={size === 'large' ? 'h5' : size === 'small' ? 'body1' : 'h6'}
        color="text.secondary"
        sx={{
          fontWeight: 600,
          mb: 1,
        }}
      >
        {title || getDefaultTitle()}
      </Typography>
      
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          maxWidth: 400,
          mb: action ? 3 : 0,
          lineHeight: 1.6,
        }}
      >
        {description || getDefaultDescription()}
      </Typography>
      
      {action && (
        <Button
          variant={action.variant || 'contained'}
          color={action.color || 'primary'}
          onClick={action.onClick}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {action.label}
        </Button>
      )}
    </Box>
    </motion.div>
  );
};

export default EmptyState;
