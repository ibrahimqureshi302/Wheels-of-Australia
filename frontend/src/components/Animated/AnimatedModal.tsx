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
} from '@mui/material';
import type { DialogProps as MuiDialogProps } from '@mui/material/Dialog';
import { Close } from '@mui/icons-material';
import { motion } from 'framer-motion';
import Button from '../Common/Button';
import { modalVariants } from '../../lib/animations';

export interface AnimatedModalProps extends Omit<MuiDialogProps, 'onClose'> {
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

const DialogTransition = React.forwardRef<
  HTMLDivElement,
  { in?: boolean; children: React.ReactElement }
>(function DialogTransition({ in: inProp, children, ...rest }, ref) {
  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate={inProp ? 'animate' : 'exit'}
      variants={modalVariants}
      style={{ display: 'inline-block' }}
      {...rest}
    >
      {children}
    </motion.div>
  );
});

const AnimatedModal: React.FC<AnimatedModalProps> = ({
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
  open,
  maxWidth = 'sm',
  fullWidth = true,
  ...props
}) => {
  const handleClose = () => {
    if (!loading) onClose?.();
  };

  const handleCancel = () => {
    if (!loading) {
      onCancel?.();
      onClose?.();
    }
  };

  return (
    <MuiDialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={DialogTransition}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      }}
      {...props}
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
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                <Close />
              </IconButton>
            )}
          </DialogTitle>
          {dividers && <Divider />}
        </>
      )}

      <DialogContent dividers={dividers} sx={{ py: 3, px: 3 }}>
        {children}
      </DialogContent>

      {(showActions || customActions) && (
        <>
          {dividers && <Divider />}
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            {customActions || (
              <>
                {onCancel && (
                  <Button
                    onClick={handleCancel}
                    disabled={loading}
                    variant="outlined"
                  >
                    {cancelText}
                  </Button>
                )}
                {onConfirm && (
                  <Button
                    onClick={onConfirm}
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

export default AnimatedModal;
