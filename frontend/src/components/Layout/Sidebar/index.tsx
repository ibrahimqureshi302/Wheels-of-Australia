import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import {
  Dashboard,
  Settings,
  AdminPanelSettings,
  Tune,
  Badge,
  Business,
  DirectionsCar,
  Inventory,
  RequestQuote,
  Map,
  Route,
  Build,
  People,
  HowToReg,
  AccountCircle,
  NotificationsActive,
  History,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS, getVisibleNavItems } from '../../../constants/nav';
import { useAuth } from '../../../context/hooks';
import { useBranding } from '../../../context/BrandingContext';

const ICON_MAP: Record<string, React.ComponentType<{ sx?: object }>> = {
  Dashboard,
  Settings,
  AdminPanelSettings,
  Tune,
  Badge,
  Business,
  DirectionsCar,
  Inventory,
  RequestQuote,
  Map,
  Route,
  Build,
  People,
  HowToReg,
  AccountCircle,
  NotificationsActive,
  History,
};

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
  variant?: 'permanent' | 'temporary';
  width?: number;
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  variant = 'permanent',
  width = 280,
  collapsed = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logoUrl } = useBranding();

  const visibleItems = React.useMemo(
    () => getVisibleNavItems(user ?? undefined, NAV_ITEMS),
    [user?.role, user?.allowed_nav_paths, user]
  );

  // Exactly one item is active: the most specific (longest) path that matches
  // the current location. This stops a parent like /maintenance from also
  // lighting up when we're on its child /maintenance/requests.
  const activePath = React.useMemo(() => {
    let best = '';
    for (const item of visibleItems) {
      const matches =
        location.pathname === item.path ||
        (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
      if (matches && item.path.length > best.length) best = item.path;
    }
    return best;
  }, [visibleItems, location.pathname]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (variant === 'temporary' && onClose) {
      onClose();
    }
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sidebar Header */}
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          borderBottom: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          overflow: 'hidden',
        }}
      >
        {logoUrl ? (
          <Box
            component="img"
            src={logoUrl}
            alt="Logo"
            sx={{
              maxHeight: collapsed ? 32 : 40,
              maxWidth: collapsed ? 32 : 180,
              objectFit: 'contain',
            }}
          />
        ) : (
          <Typography
            variant={collapsed ? 'body2' : 'h6'}
            sx={{
              fontWeight: 600,
              color: 'primary.contrastText',
              fontSize: collapsed ? '0.75rem' : undefined,
              textAlign: collapsed ? 'center' : 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {collapsed ? 'WoA' : 'Wheels of Australia'}
          </Typography>
        )}
      </Box>

      {/* Menu Items */}
      <Box sx={{ flexGrow: 1 }}>
        <List sx={{ py: 1 }}>
          {visibleItems.map((item) => {
            const IconComponent = ICON_MAP[item.icon] ?? Dashboard;
            const isActive = item.path === activePath;

            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={isActive}
                  sx={{
                    borderRadius: collapsed ? 0 : 2,
                    mx: collapsed ? 0 : 1,
                    my: 0.5,
                    minHeight: 48,
                    justifyContent: collapsed ? 'center' : 'initial',
                    px: collapsed ? 0 : 2,
                    color: 'primary.contrastText',
                    transition: 'all 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: 0,
                      mr: collapsed ? 0 : 2,
                      justifyContent: 'center',
                      transition: 'margin-right 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
                    }}
                  >
                    <IconComponent />
                  </ListItemIcon>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}
                      >
                        <ListItemText
                          primary={t(item.labelKey)}
                          sx={{
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            '& .MuiListItemText-primary': {
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            },
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Footer */}
      {!collapsed && (
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            align="center"
            display="block"
          >
            © {new Date().getFullYear()} Wheels of Australia
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: width,
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
        '& .MuiDrawer-paper': {
          width: width,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'rgba(0, 0, 0, 0.12)',
          backgroundColor: 'primary.main',
          borderRadius: 0,
          transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
          overflowX: 'hidden',
          ...(variant === 'permanent' && {
            position: 'sticky',
            top: 0,
            height: '100vh',
            flexShrink: 0,
          }),
        },
      }}
      ModalProps={{
        keepMounted: true,
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
