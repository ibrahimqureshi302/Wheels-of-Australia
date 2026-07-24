import { CssBaseline, Box } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/react-query/client';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';
import { LocationTrackingProvider } from './context/LocationTrackingContext';
import { ToastProvider, useToast } from './components/Common';
import { AppRoutes } from './routes';
import { setGlobalToast } from './lib/api/client';
import { useEffect } from 'react';

// Component to set up global toast
const GlobalToastSetup: React.FC = () => {
  const { showToast } = useToast();

  useEffect(() => {
    // Set the global toast function for the API client
    setGlobalToast(showToast);
  }, [showToast]);

  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <LocationTrackingProvider>
            <NotificationProvider>
            <ToastProvider>
              <GlobalToastSetup />
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                width: '100%',
                maxWidth: '100vw',
                margin: 0,
                padding: 0,
                boxSizing: 'border-box',
                overflowX: 'hidden',
              }}>
                <Box
                  component="main"
                  sx={{
                    flexGrow: 1,
                    width: '100%',
                    maxWidth: '100vw',
                    margin: 0,
                    padding: 0,
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                  }}
                >
                  <AppRoutes />
                </Box>
              </Box>
            </ToastProvider>
            </NotificationProvider>
            </LocationTrackingProvider>
          </AuthProvider>
        </BrowserRouter>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
