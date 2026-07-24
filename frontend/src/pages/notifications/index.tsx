import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
} from '@mui/material';
import { DeleteOutline, DoneAll, NotificationsNone } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHero, Dialog, useToast } from '../../components/Common';
import { listVariants, listItemVariants } from '../../lib/animations';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/hooks';
import { resolveNotificationTarget } from '../../services/notifications/target';
import type { Notification } from '../../services/notifications/types';
import {
  NOTIFICATION_ICON_MAP,
  NOTIFICATION_COLOR_MAP,
  relativeTime,
} from '../../components/Notifications/notificationDisplay';

const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { user } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // The notification the user arrived on (from the bell) gets scrolled into
  // view and briefly highlighted so it's obvious which one they tapped.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusId) return;
    const el = itemRefs.current[focusId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(focusId);
    const timer = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(timer);
  }, [focusId, notifications]);

  const handleOpen = (n: Notification) => {
    if (!n.read) markAsRead(n.id);
    // Deep-link to the affected record (role-aware), else the plain link.
    const target = resolveNotificationTarget(n, user?.role) || n.link;
    if (target) navigate(target);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteNotification(deleteId);
    setDeleteId(null);
    showSuccess('Notification deleted.');
  };

  return (
    <PageHero
      title="Notifications"
      subtitle="Everything happening across the platform."
      actions={
        unreadCount > 0 ? (
          <Button
            variant="contained"
            startIcon={<DoneAll />}
            onClick={markAllAsRead}
            sx={{
              borderRadius: 2, px: 2.5, py: 1.25, fontWeight: 600, textTransform: 'none',
              bgcolor: 'common.white', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
            }}
          >
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ mt: 1 }}>
        {notifications.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
            <NotificationsNone sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>You're all caught up</Typography>
            <Typography variant="body2" color="text.secondary">
              New activity will show up here.
            </Typography>
          </Paper>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <AnimatePresence>
                {notifications.map((n) => {
                  const Icon = NOTIFICATION_ICON_MAP[n.type];
                  const color = NOTIFICATION_COLOR_MAP[n.type];
                  return (
                    <motion.div
                      key={n.id}
                      ref={(el) => { itemRefs.current[n.id] = el; }}
                      variants={listItemVariants}
                      layout
                      exit={{ opacity: 0, x: 24 }}
                    >
                      <Paper
                        variant="outlined"
                        onClick={() => handleOpen(n)}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                          cursor: 'pointer',
                          borderLeft: '4px solid',
                          borderLeftColor: n.read ? 'transparent' : `${color}.main`,
                          bgcolor: n.read ? 'background.paper' : 'action.hover',
                          transition: 'background-color 0.2s, box-shadow 0.2s',
                          ...(highlightId === n.id && {
                            boxShadow: (theme) => `0 0 0 2px ${theme.palette[color].main}`,
                          }),
                        }}
                      >
                        <Box
                          sx={{
                            width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: `${color}.main`, color: '#fff',
                          }}
                        >
                          <Icon fontSize="small" />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography fontWeight={n.read ? 500 : 700}>{n.title}</Typography>
                            {!n.read && <Chip size="small" color={color} label="New" sx={{ height: 18, fontSize: '0.65rem' }} />}
                          </Box>
                          {n.message && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {n.message}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {relativeTime(n.createdAt)}
                          </Typography>
                        </Box>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(n.id); }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Paper>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Box>
          </motion.div>
        )}
      </Box>

      <Dialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete notification?"
        subtitle="This removes the notification permanently."
        confirmText="Delete"
        confirmColor="error"
        onConfirm={confirmDelete}
      />
    </PageHero>
  );
};

export default NotificationsPage;
