import React, { useRef, useEffect } from 'react';
import {
  Box,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/hooks';
import { normalizeRole } from '../../constants/roles';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const location = useLocation();
  const { user } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Suspended users are locked to their Profile page — hide all navigation so
  // there is nothing for them to do but read the suspension reason and log out.
  const suspended = !!user?.is_suspended && normalizeRole(user?.role) !== 'admin';
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // Scroll main content to top when route changes
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  const drawerWidth = 280;
  const collapsedDrawerWidth = 64;

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar - sticky on desktop. Hidden entirely for suspended users. */}
      {suspended ? null : isMobile ? (
        // Mobile: Temporary drawer
        <Sidebar
          open={mobileOpen}
          onClose={handleDrawerClose}
          variant="temporary"
          width={drawerWidth}
          collapsed={false}
        />
      ) : (
        // Desktop: Permanent drawer (sticky)
        <Sidebar
          open={true}
          variant="permanent"
          width={sidebarCollapsed ? collapsedDrawerWidth : drawerWidth}
          collapsed={sidebarCollapsed}
        />
      )}

      {/* Main Content Area - navbar sticky, only this area scrolls */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          backgroundColor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Navbar - sticky header */}
        <Box sx={{ flexShrink: 0 }}>
          <Navbar
            onMenuClick={handleDrawerToggle}
            showMenuButton={isMobile && !suspended}
            onSidebarToggle={!isMobile && !suspended ? handleSidebarToggle : undefined}
          />
        </Box>

        {/* Page Content - only this scrolls */}
        <motion.div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            overflow: 'auto',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
        >
          <Box sx={{ flexGrow: 1, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {children}
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Layout;
