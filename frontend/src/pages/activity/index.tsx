import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Paper, Chip, Stack, CircularProgress, useTheme } from '@mui/material';
import {
  DirectionsCar,
  RequestQuote,
  Build,
  People,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '../../components/Common';
import Pagination from '../../components/Common/Pagination';
import { listVariants, listItemVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import { normalizeRole } from '../../constants/roles';
import { listActivity, type ActivityEntry } from '../../services/activity/api';

/** Compact "time ago" label. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Map an action code's category to an icon + accent colour. */
function visualFor(action: string): { Icon: typeof DirectionsCar; color: string } {
  const cat = action.split('.')[0];
  switch (cat) {
    case 'vehicle': return { Icon: DirectionsCar, color: 'primary.main' };
    case 'request': return { Icon: RequestQuote, color: 'warning.main' };
    case 'maintenance': return { Icon: Build, color: 'error.main' };
    case 'staff': return { Icon: People, color: 'secondary.main' };
    default: return { Icon: HistoryIcon, color: 'text.secondary' };
  }
}

/**
 * Activity log — a durable audit trail of who did what.
 *  - Rental owner: every action in their account (their own + each staff member's),
 *    so they can see exactly which staff member made each change.
 *  - Admin: the same trail across every rental (the rental name is shown per row).
 * Polls every 30s so new actions appear in real time.
 */
const ActivityPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = normalizeRole(user?.role) === 'admin';
  // A rental STAFF sub-account (role rental + granted paths) must not see the
  // owner's oversight trail — only the owner (and admin) may.
  const isStaff = normalizeRole(user?.role) === 'rental' && !!user?.allowed_nav_paths?.length;

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Initial load shows a spinner; then poll every 30s without re-flashing it.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const refresh = () =>
      listActivity()
        .then((list) => { if (active) setEntries(list); })
        .catch(() => { if (active) setEntries([]); })
        .finally(() => { if (active) setLoading(false); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (isStaff) {
    return (
      <PageHero title={t('activity.title', 'Activity log')}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Typography color="text.secondary">
            {t('activity.ownerOnly', 'Only the rental owner can view the activity log.')}
          </Typography>
        </Paper>
      </PageHero>
    );
  }

  return (
    <PageHero
      title={t('activity.title', 'Activity log')}
      subtitle={
        isAdmin
          ? t('activity.subtitleAdmin', 'Every action taken across all rentals, and who performed it.')
          : t('activity.subtitle', 'Every change made in your account — and which staff member made it.')
      }
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : entries.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>{t('activity.emptyTitle', 'No activity yet')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('activity.emptyMessage', 'Actions like adding a vehicle or approving a booking will appear here.')}
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Key by page so the list remounts and re-animates on Next/Previous;
              without it the staggered children stay at opacity:0 on page change. */}
          <motion.div key={`activity-${page}`} variants={listVariants} initial="initial" animate="animate">
            <Stack spacing={1.25} sx={{ mt: 1 }}>
              {paginated.map((e) => {
                const { Icon, color } = visualFor(e.action);
                const clickable = Boolean(e.link);
                return (
                  <motion.div key={e.id} variants={listItemVariants}>
                    <Paper
                      elevation={0}
                      onClick={clickable ? () => navigate(e.link) : undefined}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': clickable ? { borderColor: 'primary.main', boxShadow: 2 } : {},
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: `${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'action.hover'}`,
                        }}
                      >
                        <Icon sx={{ color, fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {e.actorName || t('activity.someone', 'Someone')}
                          </Typography>
                          <Chip
                            label={e.byStaff ? t('activity.staffTag', 'Rental Staff') : t('activity.ownerTag', 'Rental Owner')}
                            size="small"
                            color={e.byStaff ? 'secondary' : 'default'}
                            variant="outlined"
                            sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                          />
                          {isAdmin && e.rentalName && (
                            <Chip
                              label={e.rentalName}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {e.summary}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap', mt: 0.25 }}>
                        {timeAgo(e.createdAt)}
                      </Typography>
                    </Paper>
                  </motion.div>
                );
              })}
            </Stack>
          </motion.div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={entries.length}
            pageSize={pageSize}
            onChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      )}
    </PageHero>
  );
};

export default ActivityPage;
