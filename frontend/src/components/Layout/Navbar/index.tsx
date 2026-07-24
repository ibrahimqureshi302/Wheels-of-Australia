import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Badge,
  Avatar,
  ListItemIcon,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  AccountCircle,
  Logout,
  Menu as MenuIcon,
  Notifications,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/hooks';
import { useNotifications } from '../../../context/NotificationContext';
import { useToggle } from '../../../hooks';
import { ROUTES } from '../../../constants/routes';
import { canUseNotifications } from '../../../constants/nav';
import { NotificationCentre } from '../../Notifications';
import { resolveNotificationTarget } from '../../../services/notifications/target';

interface NavbarProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  onSidebarToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  onMenuClick,
  showMenuButton = true,
  onSidebarToggle,
}) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Rental staff only see the bell when granted the /notifications module.
  const showNotifications = canUseNotifications(user);
  const { value: anchorEl, setTrue: openMenu, setFalse: closeMenu } = useToggle();
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = React.useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
    openMenu();
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    closeMenu();
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
    handleMenuClose();
  };

  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] }}
      style={{ width: '100%' }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          width: '100%',
          marginTop: -0.1,
          boxShadow: 'none',
          '&.MuiAppBar-root': {
            boxShadow: 'none',
          },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
        {/* Sidebar Toggle Button for Desktop */}
        {onSidebarToggle && (
          <IconButton
            aria-label="toggle sidebar"
            edge="start"
            onClick={onSidebarToggle}
            sx={{
              mr: 2,
              color: 'primary.main',
              display: { xs: 'none', md: 'flex' },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Menu Button for Mobile */}
        {showMenuButton && (
          <IconButton
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{
              mr: 1,
              display: { md: 'none' },
              color: 'primary.main',
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Spacer to push content to the right */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right Side Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Notifications — hidden for rental staff without the /notifications grant */}
          {showNotifications && (
            <>
              <IconButton
                size="large"
                aria-label="notifications"
                sx={{ color: 'primary.main' }}
                onClick={(e) => setNotificationAnchor(e.currentTarget)}
              >
                <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error">
                  <Notifications />
                </Badge>
              </IconButton>
              <NotificationCentre
                anchorEl={notificationAnchor}
                open={Boolean(notificationAnchor)}
                onClose={() => setNotificationAnchor(null)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onViewAll={() => navigate(ROUTES.NOTIFICATIONS)}
                onOpenNotification={(n) => {
                  // Prefer deep-linking to the record (role-aware); fall back to the
                  // notification's plain link, then to the notifications page.
                  const target =
                    resolveNotificationTarget(n, user?.role) ||
                    n.link ||
                    `${ROUTES.NOTIFICATIONS}?focus=${n.id}`;
                  navigate(target);
                }}
              />
            </>
          )}

          {/* User Profile */}
          <IconButton
            size="large"
            onClick={handleProfileMenuOpen}
            sx={{ ml: { xs: 0.5, sm: 1 }, color: 'primary.main' }}
            aria-label="account menu"
          >
            {user?.first_name ? (
              <Avatar
                sx={{
                  width: { xs: 28, sm: 32 },
                  height: { xs: 28, sm: 32 },
                  bgcolor: 'primary.main',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              >
                {user.first_name.charAt(0)}{user.last_name?.charAt(0)}
              </Avatar>
            ) : (
              <AccountCircle />
            )}
          </IconButton>

          {/* Profile Menu */}
          <Menu
            anchorEl={menuAnchor}
            open={anchorEl}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                minWidth: 200,
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            {/* User Info */}
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.full_name || `${user?.first_name} ${user?.last_name}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>

            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Logout sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <Typography variant="body2">{t('auth.logout')}</Typography>
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
    </motion.div>
  );
};

export default Navbar;
