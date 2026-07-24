import { useContext } from 'react';
import { ToastContext } from './ToastContext';
import type { ToastContextType } from './ToastContext';

// Hook to use toast - moved here to satisfy React Fast Refresh
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
