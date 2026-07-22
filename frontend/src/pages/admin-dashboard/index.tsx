import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button, useTheme } from '@mui/material';
import {
  People,
  Business,
  Groups,
  Build,
  DirectionsCar,
  HowToReg,
  Notifications,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cardVariants, listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/hooks';
import { useNotifications } from '../../context/NotificationContext';
import { dashboardApi, type DashboardStats } from '../../services/dashboard/api';
import { resolveNotificationTarget } from '../../services/notifications/target';

const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [stats, setStats] = useState<DashboardStats | null>(null);

  const recentNotifications = notifications.slice(0, 6);
  const formatWhen = (iso: string) => {
    const diffM = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffM < 1) return t('notifications.justNow');
    if (diffM < 60) return t('notifications.minutes', { count: diffM });
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return t('notifications.hours', { count: diffH });
    return t('notifications.days', { count: Math.floor(diffH / 24) });
  };

  // Load once, then poll every 30s so the counts and the requests trend update
  // in real time as drivers/rentals/mechanics act — matching the role dashboards.
  useEffect(() => {
    let active = true;
    const refresh = () =>
      dashboardApi
        .stats()
        .then((data) => { if (active) setStats(data); })
        .catch(() => { /* keep the last good stats on a transient failure */ });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const val = (n: number | undefined) => (n ?? '—');
  const who = user?.first_name || user?.full_name || user?.email || '';

  type StatCard = {
    key: string;
    label: string;
    value: number | string;
    icon: typeof People;
    color: string;
    path?: string;
  };

  const statCards: StatCard[] = [
    { key: 'drivers', label: 'Total drivers', value: val(stats?.total_drivers), icon: People, color: theme.palette.primary.main, path: ROUTES.ADMIN.DRIVERS },
    { key: 'rentals', label: 'Total rentals', value: val(stats?.total_rentals), icon: Business, color: theme.palette.secondary.main, path: ROUTES.ADMIN.RENTALS },
    { key: 'rentalStaff', label: 'Total rental staff', value: val(stats?.total_rental_staff), icon: Groups, color: theme.palette.success.main, path: ROUTES.ADMIN.RENTAL_STAFF },
    { key: 'mechanics', label: 'Total mechanics', value: val(stats?.total_mechanics), icon: Build, color: theme.palette.warning.main, path: ROUTES.ADMIN.MECHANICS },
    { key: 'vehicles', label: 'Total vehicles', value: val(stats?.total_vehicles), icon: DirectionsCar, color: theme.palette.info.main, path: ROUTES.ADMIN.VEHICLES_ALL },
    { key: 'pendingRegistrations', label: 'Pending registration requests', value: val(stats?.pending_registrations), icon: HowToReg, color: theme.palette.warning.dark, path: ROUTES.ADMIN.REGISTRATIONS },
    { key: 'notifications', label: 'Unread notifications', value: val(stats?.unread_notifications), icon: Notifications, color: theme.palette.error.main, path: ROUTES.NOTIFICATIONS },
  ];

  const vehiclesByStatus = [
    { label: 'Available', value: stats?.vehicles_by_status.available ?? 0, color: 'success.main', href: `${ROUTES.ADMIN.VEHICLES_ALL}?status=available` },
    { label: 'Rented', value: stats?.vehicles_by_status.rented ?? 0, color: 'info.main', href: `${ROUTES.ADMIN.VEHICLES_ALL}?status=rented` },
    { label: 'Pending return', value: stats?.vehicles_by_status.pending_return ?? 0, color: 'secondary.main', href: `${ROUTES.ADMIN.VEHICLES_ALL}?status=pending_return` },
    { label: 'Maintenance', value: stats?.vehicles_by_status.maintenance ?? 0, color: 'warning.main', href: `${ROUTES.ADMIN.VEHICLES_ALL}?status=maintenance` },
  ];
  const vehiclesTotal = vehiclesByStatus.reduce((sum, s) => sum + s.value, 0);

  const requestsByStatus = [
    { label: 'Pending', value: stats?.requests_by_status.pending ?? 0, color: 'warning.main' },
    { label: 'Running (active)', value: (stats?.requests_by_status.running ?? 0) + (stats?.requests_by_status.approved ?? 0), color: 'info.main' },
    { label: 'Info requested', value: stats?.requests_by_status.info_requested ?? 0, color: 'secondary.main' },
    { label: 'Completed', value: stats?.requests_by_status.completed ?? 0, color: 'success.main' },
    { label: 'Rejected', value: stats?.requests_by_status.rejected ?? 0, color: 'error.main' },
    { label: 'Cancelled', value: stats?.requests_by_status.cancelled ?? 0, color: 'text.disabled' },
  ];
  const requestsTotal = requestsByStatus.reduce((sum, s) => sum + s.value, 0);

  const trend = stats?.rental_requests_trend ?? [];
  const topRentals = stats?.top_rentals ?? [];

  return (
    <Box sx={{ width: '100%', minHeight: '100%', maxWidth: '100%' }}>
      {/* Welcome hero */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'primary.contrastText',
            boxShadow: `0 4px 20px ${theme.palette.primary.main}40`,
          }}
        >
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            {t('dashboard.welcome')}{who ? `, ${who}` : ''}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.95 }}>
            {t('adminDashboard.subtitle')}
          </Typography>
        </Box>
      </motion.div>

      {/* Stat cards */}
      <Box sx={{ px: { xs: 2, sm: 3 }, mt: -3, position: 'relative', zIndex: 1 }}>
        <motion.div variants={listVariants} initial="initial" animate="animate" style={{ width: '100%' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2.5,
            }}
          >
            {statCards.map((stat) => {
              const Icon = stat.icon;
              const clickable = Boolean(stat.path);
              return (
                <motion.div key={stat.key} variants={listItemVariants} style={{ height: '100%' }}>
                  <Paper
                    elevation={0}
                    onClick={clickable ? () => navigate(stat.path as string) : undefined}
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      p: 2.75,
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: 'divider',
                      minHeight: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      bgcolor: 'background.paper',
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'transform 0.2s ease, box-shadow 0.25s ease, border-color 0.2s ease',
                      '&:hover': clickable
                        ? {
                            transform: 'translateY(-4px)',
                            boxShadow: `0 18px 32px -16px ${stat.color}99`,
                            borderColor: `${stat.color}66`,
                          }
                        : {},
                    }}
                  >
                    {/* Faint watermark icon for visual interest */}
                    <Icon
                      sx={{
                        position: 'absolute',
                        right: -12,
                        bottom: -12,
                        fontSize: 104,
                        color: stat.color,
                        opacity: 0.07,
                        pointerEvents: 'none',
                      }}
                    />
                    {/* Gradient icon tile */}
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 1.5,
                        color: '#fff',
                        background: `linear-gradient(135deg, ${stat.color} 0%, ${stat.color}B3 100%)`,
                        boxShadow: `0 8px 16px -6px ${stat.color}80`,
                      }}
                    >
                      <Icon sx={{ fontSize: 26, color: '#fff' }} />
                    </Box>
                    <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1, mb: 0.5 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      {stat.label}
                    </Typography>
                  </Paper>
                </motion.div>
              );
            })}
          </Box>
        </motion.div>
      </Box>

      {/* Charts / panels */}
      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 3 }}>
        {/* Row A — status breakdowns */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* Vehicles by status */}
          <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Vehicles by status</Typography>
                <Typography variant="caption" color="text.secondary">{vehiclesTotal} total</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                {vehiclesByStatus.map((item) => {
                  const pct = vehiclesTotal > 0 ? (item.value / vehiclesTotal) * 100 : 0;
                  return (
                    <Box
                      key={item.label}
                      onClick={() => item.href && navigate(item.href)}
                      sx={{
                        cursor: item.href ? 'pointer' : 'default',
                        borderRadius: 1,
                        p: 0.5,
                        mx: -0.5,
                        transition: 'background-color 0.2s ease',
                        '&:hover': item.href ? { bgcolor: 'action.hover' } : {},
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {item.value}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                            {Math.round(pct)}%
                          </Typography>
                        </Typography>
                      </Box>
                      <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 1, transition: 'width 0.5s ease' }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </motion.div>

          {/* Booking requests by status */}
          <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" fontWeight={600}>Booking requests by status</Typography>
                <Typography variant="caption" color="text.secondary">{requestsTotal} total</Typography>
              </Box>
              {requestsTotal === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No booking requests yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                  {requestsByStatus.map((item) => {
                    const pct = requestsTotal > 0 ? (item.value / requestsTotal) * 100 : 0;
                    return (
                      <Box key={item.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                          <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                        </Box>
                        <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 1, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </motion.div>
        </Box>

        {/* Row B — rental requests trend (full width, last 6 months) */}
        <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ marginTop: 16 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Rental requests — last 6 months
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, sm: 2 }, mt: 3, height: 180 }}>
              {trend.map((item) => {
                const maxCount = Math.max(...trend.map((d) => d.count), 1);
                const heightPct = (item.count / maxCount) * 100;
                return (
                  <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <Typography variant="caption" fontWeight={700} color={item.count > 0 ? 'text.primary' : 'text.disabled'} sx={{ mb: 0.5 }}>
                      {item.count}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 56,
                        height: `${heightPct}%`,
                        minHeight: item.count > 0 ? 8 : 4,
                        borderRadius: '6px 6px 0 0',
                        background: (th) => `linear-gradient(180deg, ${th.palette.primary.main} 0%, ${th.palette.primary.light} 100%)`,
                        opacity: item.count > 0 ? 1 : 0.25,
                        transition: 'height 0.5s ease',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                      {item.month}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </motion.div>

        {/* Row C — top rentals table + recent notifications */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
          {/* Top rentals by fleet size */}
          <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Top rentals by fleet size
              </Typography>
              {topRentals.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>No rentals with vehicles yet.</Typography>
              ) : (
                <Box sx={{ mt: 1.5 }}>
                  {topRentals.map((r, i) => {
                    const maxFleet = Math.max(...topRentals.map((x) => x.vehicles), 1);
                    const pct = (r.vehicles / maxFleet) * 100;
                    return (
                      <Box key={r.name} onClick={() => navigate(ROUTES.ADMIN.RENTALS)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, px: 0.5, mx: -0.5, borderRadius: 1, cursor: 'pointer', transition: 'background-color 0.2s ease', '&:hover': { bgcolor: 'action.hover' }, borderBottom: i < topRentals.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                        <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ width: 18 }}>{i + 1}</Typography>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
                          <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden', mt: 0.5 }}>
                            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'info.main', borderRadius: 1, transition: 'width 0.5s ease' }} />
                          </Box>
                        </Box>
                        <Typography variant="body2" fontWeight={700} sx={{ ml: 1 }}>
                          {r.vehicles}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            {r.vehicles === 1 ? 'vehicle' : 'vehicles'}
                          </Typography>
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </motion.div>

          {/* Recent notifications (real, from the backend) */}
          <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('adminDashboard.recentNotifications')}
              </Typography>
              {unreadCount > 0 && (
                <Button size="small" onClick={markAllAsRead}>
                  {t('notifications.markAllRead')}
                </Button>
              )}
            </Box>
            {recentNotifications.length === 0 ? (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Notifications sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  {t('notifications.noNotifications')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {recentNotifications.map((n) => (
                  <Box
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markAsRead(n.id);
                      // Deep-link to the affected record (flashing it on arrival),
                      // matching the Notifications page + bell behaviour.
                      const target = resolveNotificationTarget(n, user?.role) || n.link;
                      if (target) navigate(target);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      py: 1.5,
                      px: 1,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: n.read ? 'transparent' : 'action.hover',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-of-type': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ mt: 0.5, width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: n.read ? 'transparent' : 'error.main', border: n.read ? '1px solid' : 'none', borderColor: 'divider' }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={n.read ? 500 : 700}>
                        {n.title}
                      </Typography>
                      {n.message && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {n.message}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatWhen(n.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </motion.div>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminDashboardPage;
