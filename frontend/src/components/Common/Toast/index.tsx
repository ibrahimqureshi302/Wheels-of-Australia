import React, { useState, useCallback } from 'react';
import {
  Alert,
  Snackbar,
  Box,
} from '@mui/material';
import type { AlertColor } from '@mui/material';
import { ToastContext } from './ToastContext';
import type { ToastContextType } from './ToastContext';

interface ToastState {
  open: boolean;
  message: string | object;
  severity: AlertColor;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showToast = useCallback((
    message: string | object, 
    severity: AlertColor = 'info'
  ) => {
    setToast({
      open: true,
      message,
      severity,
    });
  }, []);

  const showSuccess = useCallback((message: string | object) => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message: string | object) => {
    showToast(message, 'error');
  }, [showToast]);

  const showWarning = useCallback((message: string | object) => {
    showToast(message, 'warning');
  }, [showToast]);

  const showInfo = useCallback((message: string | object) => {
    showToast(message, 'info');
  }, [showToast]);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  // Format message - handle both string and object
  const formatMessage = (msg: string | object): string => {
    if (typeof msg === 'string') {
      return msg;
    }
    
    if (typeof msg === 'object' && msg !== null) {
      // Handle API error objects with 'message' field
      if ('message' in msg) {
        return (msg as { message: string }).message;
      }
      
      // Handle Django/API non_field_errors format
      if ('non_field_errors' in msg) {
        const errors = (msg as { non_field_errors: string[] }).non_field_errors;
        return Array.isArray(errors) ? errors.join(', ') : String(errors);
      }
      
      // Handle validation errors object
      if ('errors' in msg) {
        const errors = (msg as { errors: Record<string, string[]> }).errors;
        const errorMessages = Object.values(errors).flat();
        return errorMessages.join(', ');
      }
      
      // Handle field-specific errors (common API format)
      const errorMessages: string[] = [];
      Object.entries(msg).forEach(([, value]) => {
        if (Array.isArray(value)) {
          errorMessages.push(...value);
        } else if (typeof value === 'string') {
          errorMessages.push(value);
        }
      });
      
      if (errorMessages.length > 0) {
        return errorMessages.join(', ');
      }
      
      // Handle other object structures
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return 'An error occurred';
      }
    }
    
    return 'Unknown error';
  };

  const contextValue: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast UI - Always rendered */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={hideToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            padding: 0,
          },
        }}
      >
        <Alert
          onClose={hideToast}
          severity={toast.severity}
          variant="filled"
          sx={{
            minWidth: '300px',
            maxWidth: '500px',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: 2,
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
            '& .MuiAlert-icon': {
              fontSize: '1.25rem',
              color: toast.severity === 'success' ? 'white' : undefined,
            },
            '& .MuiAlert-action': {
              padding: '4px 8px 4px 0',
            },
            // Make success text white
            ...(toast.severity === 'success' && {
              color: 'white',
              '& .MuiAlert-message': {
                color: 'white',
              },
            }),
          }}
        >
          <Box component="span" sx={{ 
            wordBreak: 'break-word',
            color: toast.severity === 'success' ? 'white' : 'inherit',
          }}>
            {formatMessage(toast.message)}
          </Box>
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

// Re-export the hook for convenience

export default ToastProvider;
