import { createContext } from 'react';
import type { AlertColor } from '@mui/material';

export interface ToastContextType {
  showToast: (message: string | object, severity?: AlertColor) => void;
  showSuccess: (message: string | object) => void;
  showError: (message: string | object) => void;
  showWarning: (message: string | object) => void;
  showInfo: (message: string | object) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
