import React from 'react';
import {
  Popover,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
} from '@mui/material';
import { NotificationsNone } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { Notification } from '../../services/notifications/types';
import { listItemVariants, listVariants } from '../../lib/animations';
import { NOTIFICATION_ICON_MAP, NOTIFICATION_COLOR_MAP, relativeTime } from './notificationDisplay';

interface NotificationCentreProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  /** Navigate to the full notifications page (closes the popover first). */
  onViewAll?: () => void;
  /** Navigate to the record a notification points at, or the notifications page
   * (closes the popover first). Receives the whole notification so the handler
   * can resolve the right destination per the user's role. */
  onOpenNotification?: (n: Notification) => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const NotificationCentre: React.FC<NotificationCentreProps> = ({
  anchorEl,
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
  onOpenNotification,
}) => {
  const { t } = useTranslation();
  const id = open ? 'notification-popover' : undefined;

  // The bell shows only the last day's notifications; the full set lives on the
  // notifications page ("View all").
  const recent = notifications.filter(
    (n) => Date.now() - new Date(n.createdAt).getTime() <= ONE_DAY_MS,
  );

  return (
    <Popover
      id={id}
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100vw', sm: 380 },
            maxWidth: 380,
            maxHeight: 420,
            borderRadius: 2,
            mt: 1.5,
          },
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('notifications.title')}
        </Typography>
        {unreadCount > 0 && (
          <Button size="small" onClick={onMarkAllAsRead}>
            {t('notifications.markAllRead')}
          </Button>
        )}
      </Box>
      <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
        {recent.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {t('notifications.noNotifications')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No new notifications in the last 24 hours.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            <motion.div variants={listVariants} initial="initial" animate="animate" style={{ display: 'contents' }}>
              <AnimatePresence>
                {recent.map((n) => {
                  const IconComponent = NOTIFICATION_ICON_MAP[n.type];
                  const color = NOTIFICATION_COLOR_MAP[n.type];
                  return (
                    <motion.div key={n.id} variants={listItemVariants}>
                      <ListItemButton
                        onClick={() => {
                          if (!n.read) onMarkAsRead(n.id);
                          onClose();
                          onOpenNotification?.(n);
                        }}
                        sx={{
                          py: 1.5,
                          px: 2,
                          bgcolor: n.read ? 'transparent' : 'action.hover',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <IconComponent sx={{ color: `${color}.main` }} fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={n.title}
                          secondary={
                            <React.Fragment>
                              {n.message && (
                                <Typography component="span" variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 260 }}>
                                  {n.message}
                                </Typography>
                              )}
                              <Typography component="span" variant="caption" color="text.secondary">
                                {relativeTime(n.createdAt)}
                              </Typography>
                            </React.Fragment>
                          }
                          primaryTypographyProps={{ fontWeight: n.read ? 500 : 600, fontSize: '0.875rem' }}
                        />
                      </ListItemButton>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </List>
        )}
      </Box>
      {onViewAll && (
        <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <Button size="small" fullWidth onClick={() => { onClose(); onViewAll(); }} sx={{ textTransform: 'none' }}>
            View all notifications
          </Button>
        </Box>
      )}
    </Popover>
  );
};

export default NotificationCentre;
