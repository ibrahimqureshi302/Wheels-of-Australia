import React from 'react';
import {
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Close } from '@mui/icons-material';
import Button from '../Button';

export interface DialogProps extends Omit<MuiDialogProps, 'onClose'> {
  title?: string;
  subtitle?: string;
  closable?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  loading?: boolean;
  showActions?: boolean;
  customActions?: React.ReactNode;
  dividers?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  title,
  subtitle,
  closable = true,
  onClose,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  loading = false,
  showActions = true,
  customActions,
  dividers = true,
  children,
  maxWidth = 'sm',
  fullWidth = true,
  ...props
}) => {
  const theme = useTheme();
  // On phones, render dialogs as a full-screen sheet instead of a cramped
  // centered card, so long forms/detail views don't overflow or clip.
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const handleClose = () => {
    if (!loading) {
      onClose?.();
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onCancel?.();
      onClose?.();
    }
  };

  const handleConfirm = () => {
    if (!loading) {
      onConfirm?.();
    }
  };

  return (
    <MuiDialog
      {...props}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : 3,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          ...props.PaperProps?.sx,
        },
        ...props.PaperProps,
      }}
    >
      {(title || closable) && (
        <>
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pb: subtitle ? 1 : 2,
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
            
            {closable && (
              <IconButton
                onClick={handleClose}
                disabled={loading}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Close />
              </IconButton>
            )}
          </DialogTitle>
          {dividers && <Divider />}
        </>
      )}

      <DialogContent
        dividers={dividers}
        sx={{
          py: 3,
          px: 3,
        }}
      >
        {children}
      </DialogContent>

      {(showActions || customActions) && (
        <>
          {dividers && <Divider />}
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              gap: 1,
            }}
          >
            {customActions || (
              <>
                {onCancel && (
                  <Button
                    onClick={handleCancel}
                    disabled={loading}
                    variant="outlined"
                    color="inherit"
                  >
                    {cancelText}
                  </Button>
                )}
                {onConfirm && (
                  <Button
                    onClick={handleConfirm}
                    loading={loading}
                    variant="contained"
                    color={confirmColor}
                  >
                    {confirmText}
                  </Button>
                )}
              </>
            )}
          </DialogActions>
        </>
      )}
    </MuiDialog>
  );
};

export default Dialog;
