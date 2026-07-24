import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Button, Chip, useTheme } from '@mui/material';
import { Build, Business, RequestQuote, Notifications, ChevronRight, DirectionsCar } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/hooks';
import { useNotifications } from '../../context/NotificationContext';
import { ROUTES } from '../../constants/routes';
import { listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import { listMaintenanceRequests, maintenanceAvailable } from '../../services/maintenance';
import type { MaintenanceRequest } from '../../services/maintenance/types';

type ChipColor = 'default' | 'success' | 'warning' | 'error' | 'info';
function statusColor(status: string): ChipColor {
  if (status === 'completed') return 'success';
  if (['running', 'accepted', 'quoted', 'pending_return'].includes(status)) return 'info';
  if (['pending', 'info_requested'].includes(status)) return 'warning';
  if (['declined', 'cancelled'].includes(status)) return 'error';
  return 'default';
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const LiveBadge: React.FC = () => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: 'success.main',
        animation: 'woaPulse 1.6s ease-in-out infinite',
        '@keyframes woaPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
      }}
    />
    <Typography variant="caption" color="success.main" fontWeight={700}>
      Live
    </Typography>
  </Box>
);

/** Driver-style dashboard for the mechanic: repairs, active rentals to quote,
 * sent quotes and notifications — each card opens its sidebar page. */
const MechanicDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || '';
  const myId = String(user?.id ?? '');

  useEffect(() => {
    if (!maintenanceAvailable()) { setJobs([]); return; }
    let active = true;
    const refresh = () => listMaintenanceRequests().then((d) => { if (active) setJobs(d); }).catch(() => { if (active) setJobs([]); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  // "Vehicles repaired" = finished (completed) jobs only. Accepted jobs still in
  // progress are not counted here; they show under My requests until completed.
  const repairs = useMemo(
    () => jobs.filter((j) => j.mechanicId === myId && j.status === 'completed').length,
    [jobs, myId],
  );
  // "Active rentals" = distinct rental providers with a pending (un-quoted) job.
  // Both rental companies and individual owners are rentals, so we dedupe by the
  // stable rental id — display names can be blank/duplicated (e.g. an individual
  // owner with no company name), which previously collapsed them into one.
  const activeRentals = useMemo(
    () => new Set(jobs.filter((j) => j.status === 'pending').map((j) => j.rentalId)).size,
    [jobs],
  );
  const pendingQuotes = useMemo(
    () => jobs.filter((j) => j.mechanicId === myId && j.status === 'quoted').length,
    [jobs, myId],
  );
  const recentJobs = useMemo(
    () => [...jobs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5),
    [jobs],
  );

  // My repairs over the last 6 calendar months — completed jobs bucketed by
  // completion date (falling back to when the job was created). Rolls forward
  // automatically: it's always the 6 months ending with the current one.
  const repairsByMonth = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.toLocaleString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, count: 0 };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    jobs
      .filter((j) => j.mechanicId === myId && j.status === 'completed')
      .forEach((j) => {
        const d = new Date(j.completedAt || j.workCompletedAt || j.createdAt);
        if (Number.isNaN(d.getTime())) return;
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i !== undefined) buckets[i].count += 1;
      });
    return buckets;
  }, [jobs, myId]);

  // A breakdown of the mechanic's own quotes by status (right-side chart).
  const myRequestsByStatus = useMemo(() => {
    const mine = jobs.filter((j) => j.mechanicId === myId);
    const count = (...ss: string[]) => mine.filter((j) => ss.includes(j.status)).length;
    return [
      // 'running' is current; 'accepted' is legacy; 'pending_return' is finished
      // work still awaiting the rental's return confirmation — all count as running.
      { label: 'Running', value: count('running', 'accepted', 'pending_return'), color: 'secondary.main', href: ROUTES.MAINTENANCE_HISTORY },
      { label: 'Quoted', value: count('quoted', 'info_requested'), color: 'warning.main', href: ROUTES.MAINTENANCE_REQUESTS },
      { label: 'Completed', value: count('completed'), color: 'success.main', href: ROUTES.MAINTENANCE_HISTORY },
      { label: 'Declined', value: count('declined', 'cancelled'), color: 'error.main', href: ROUTES.MAINTENANCE_REQUESTS },
    ];
  }, [jobs, myId]);

  const cards = [
    { key: 'repairs', label: 'Vehicles repaired', value: repairs, icon: Build, path: ROUTES.MAINTENANCE_HISTORY, color: theme.palette.primary.main },
    { key: 'active', label: 'Active rentals', value: activeRentals, icon: Business, path: ROUTES.MAINTENANCE, color: theme.palette.secondary.main },
    { key: 'pending', label: 'Pending requests', value: pendingQuotes, icon: RequestQuote, path: ROUTES.MAINTENANCE_REQUESTS, color: theme.palette.warning.main },
    { key: 'notifications', label: 'Notifications', value: unreadCount, icon: Notifications, path: ROUTES.NOTIFICATIONS, color: theme.palette.info.main },
  ];

  return (
    <Box sx={{ width: '100%', minHeight: '100%', maxWidth: '100%' }}>
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'primary.contrastText',
            boxShadow: `0 4px 20px ${theme.palette.primary.main}40`,
          }}
        >
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            Welcome{firstName ? `, ${firstName}` : ''}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.95 }}>
            Quote new jobs, track your repairs and stay on top of notifications.
          </Typography>
        </Box>
      </motion.div>

      <Box sx={{ px: { xs: 2, sm: 3 }, mt: -2, position: 'relative', zIndex: 1 }}>
        <motion.div variants={listVariants} initial="initial" animate="animate" style={{ width: '100%' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {cards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Box key={stat.key} sx={{ flex: '1 1 0', minWidth: { xs: '100%', sm: 220 }, maxWidth: { sm: '25%' } }}>
                  <motion.div variants={listItemVariants} style={{ width: '100%', minWidth: 0, height: '100%' }}>
                    <Paper
                      elevation={0}
                      onClick={() => navigate(stat.path)}
                      sx={{
                        p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider',
                        width: '100%', maxWidth: '100%', height: 160, minHeight: 160,
                        cursor: 'pointer', transition: 'box-shadow 0.25s ease',
                        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                        '&:hover': { boxShadow: theme.shadows[4], '& .stat-action': { opacity: 1 } },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1, flexShrink: 0 }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${stat.color}18` }}>
                          <Icon sx={{ color: stat.color, fontSize: 28 }} />
                        </Box>
                        <ChevronRight className="stat-action" sx={{ opacity: 0.5, fontSize: 20, mt: 0.5 }} />
                      </Box>
                      <Typography variant="h4" fontWeight={700} color="text.primary">{stat.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                    </Paper>
                  </motion.div>
                </Box>
              );
            })}
          </Box>
        </motion.div>
      </Box>

      {/* Charts: repairs per month + my requests by status */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {/* My repairs per month (last 6 months) — half-width bar chart */}
          <motion.div variants={fadeVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>My repairs per month</Typography>
              {repairsByMonth.every((d) => d.count === 0) ? (
                <Box sx={{ height: 140, mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, height: 140 }}>
                  {repairsByMonth.map((item) => {
                    const maxCount = Math.max(...repairsByMonth.map((d) => d.count), 1);
                    const heightPct = (item.count / maxCount) * 100;
                    return (
                      <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, opacity: item.count > 0 ? 1 : 0 }}>{item.count}</Typography>
                        <Box sx={{ width: '100%', maxWidth: 32, height: `${heightPct}%`, minHeight: item.count > 0 ? 8 : 0, borderRadius: '4px 4px 0 0', bgcolor: 'primary.main', transition: 'height 0.5s ease' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{item.month}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </motion.div>

          {/* My requests by status — half-width horizontal bar chart */}
          <motion.div variants={fadeVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>My requests by status</Typography>
              {myRequestsByStatus.every((d) => d.value === 0) ? (
                <Box sx={{ height: 140, mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                  {myRequestsByStatus.map((item) => {
                    const maxVal = Math.max(...myRequestsByStatus.map((d) => d.value), 1);
                    const pct = (item.value / maxVal) * 100;
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
      </Box>

      {/* Recent maintenance jobs — real, auto-refreshing feed */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 3 }}>
        <motion.div variants={fadeVariants} initial="initial" animate="animate">
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>Recent maintenance jobs</Typography>
                <LiveBadge />
              </Box>
              <Button size="small" onClick={() => navigate(ROUTES.MAINTENANCE)} sx={{ textTransform: 'none' }}>
                View all
              </Button>
            </Box>

            {recentJobs.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Build sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No maintenance jobs yet.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {recentJobs.map((job) => (
                  <Box
                    key={job.id}
                    onClick={() => navigate(ROUTES.MAINTENANCE)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1, borderRadius: 1.5,
                      cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                      transition: 'background-color 0.2s ease',
                      '&:last-of-type': { borderBottom: 'none' }, '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${theme.palette.primary.main}14` }}>
                      <DirectionsCar sx={{ color: 'primary.main', fontSize: 22 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {`${job.vehicleMake} ${job.vehicleModel}`.trim() || 'Vehicle'}{job.vehicleRego ? ` · ${job.vehicleRego}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {job.rentalName}{job.createdAt ? ` · ${timeAgo(job.createdAt)}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      label={job.statusDisplay || job.status}
                      size="small"
                      color={statusColor(job.status)}
                      variant="outlined"
                      sx={{ textTransform: 'capitalize', flexShrink: 0 }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </motion.div>
      </Box>
    </Box>
  );
};

export default MechanicDashboard;
