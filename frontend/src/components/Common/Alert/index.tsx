import React from 'react';
import {
  Alert as MuiAlert,
  AlertTitle,
  Collapse,
  IconButton,
  Box,
} from '@mui/material';
import type { AlertProps as MuiAlertProps } from '@mui/material/Alert';
import { Close, ExpandMore, ExpandLess } from '@mui/icons-material';

export interface AlertProps extends Omit<MuiAlertProps, 'onClose'> {
  title?: string;
  closable?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onClose?: () => void;
  actions?: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({
  title,
  closable = false,
  collapsible = false,
  defaultExpanded = true,
  onClose,
  actions,
  children,
  severity = 'info',
  variant = 'filled',
  ...props
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [visible, setVisible] = React.useState(true);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  if (!visible) {
    return null;
  }

  const actionElements = [];

  // Add collapse/expand button
  if (collapsible) {
    actionElements.push(
      <IconButton
        key="expand"
        size="small"
        onClick={handleToggleExpand}
        sx={{ color: 'inherit' }}
      >
        {expanded ? <ExpandLess /> : <ExpandMore />}
      </IconButton>
    );
  }

  // Add custom actions
  if (actions) {
    actionElements.push(
      <Box key="actions" sx={{ display: 'flex', gap: 1 }}>
        {actions}
      </Box>
    );
  }

  // Add close button
  if (closable) {
    actionElements.push(
      <IconButton
        key="close"
        size="small"
        onClick={handleClose}
        sx={{ color: 'inherit' }}
      >
        <Close />
      </IconButton>
    );
  }

  return (
    <MuiAlert
      {...props}
      severity={severity}
      variant={variant}
      action={actionElements.length > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actionElements}
        </Box>
      ) : undefined}
      sx={{
        borderRadius: 2,
        '& .MuiAlert-message': {
          width: '100%',
        },
        ...props.sx,
      }}
    >
      {title && <AlertTitle sx={{ fontWeight: 600 }}>{title}</AlertTitle>}
      
      {collapsible ? (
        <Collapse in={expanded} timeout="auto">
          <Box sx={{ mt: title ? 1 : 0 }}>
            {children}
          </Box>
        </Collapse>
      ) : (
        <Box sx={{ mt: title ? 1 : 0 }}>
          {children}
        </Box>
      )}
    </MuiAlert>
  );
};

export default Alert;
