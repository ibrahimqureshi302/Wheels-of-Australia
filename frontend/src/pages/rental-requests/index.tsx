import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Skeleton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  IconButton,
  Divider,
  Stack,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  RequestQuote, ThumbUp, ThumbDown, DeleteOutline, HelpOutline, AssignmentTurnedIn,
  KeyboardReturn, Cancel as CancelIcon, HourglassTop,
} from '@mui/icons-material';
import {
  listIncomingRequests,
  approveRequest,
  rejectRequest,
  deleteRequest,
  requestMoreInfo,
  confirmReturn,
  requestReturn,
  cancelReturn,
  canDeleteRequests,
} from '../../services/rental/rentalRequests';
import type { RentalRequest, RentalRequestStatus } from '../../services/rental/types';
import { openDocument } from '../../services/ocr';
import { listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import Pagination from '../../components/Common/Pagination';
import { PageHero } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';
import { RENTAL_STATUS_FILTERS, matchesRentalStatusFilter } from '../../constants/rentalStatusFilters';

const statusConfig: Record<RentalRequestStatus, { labelKey: string; fallback: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }> = {
  pending: { labelKey: 'rentalRequests.statusPending', fallback: 'Pending', color: 'warning' },
  approved: { labelKey: 'rentalRequests.statusApproved', fallback: 'Approved', color: 'success' },
  running: { labelKey: 'rentalRequests.statusRunning', fallback: 'Running', color: 'success' },
  rejected: { labelKey: 'rentalRequests.statusRejected', fallback: 'Rejected', color: 'error' },
  request_info: { labelKey: 'rentalRequests.statusInfoRequested', fallback: 'Info requested', color: 'primary' },
  completed: { labelKey: 'rentalRequests.statusCompleted', fallback: 'Completed', color: 'default' },
};

/** Local YYYY-MM-DD for comparing against a booking's rental_end_date. */
function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
/** True while the booked period is still active (end date today-or-later, or open-ended). */
function withinPeriod(req: RentalRequest): boolean {
  return !req.rentalEndDate || req.rentalEndDate.slice(0, 10) >= todayStr();
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ mt: 0.25 }}>
      {value}
    </Typography>
  </Box>
);

const RentalRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Top-level tab: incoming booking requests, or early-return requests the
  // DRIVER has sent the owner (awaiting confirm/decline).
  const [tab, setTab] = useState<'requests' | 'incoming'>(searchParams.get('tab') === 'incoming' ? 'incoming' : 'requests');
  // Status filter on the main "Requests" tab — kept in the URL (?status=) so the
  // Dashboard's "Rented vehicles" card can deep-link straight to running rentals.
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [requestReturnId, setRequestReturnId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [feedback, setFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null; notes: string }>({
    open: false,
    requestId: null,
    notes: '',
  });
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ open: boolean; requestId: string | null; message: string }>({
    open: false, requestId: null, message: '',
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    listIncomingRequests()
      .then((list) => { if (active) setRequests(list); })
      .catch(() => { if (active) setRequests([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const reload = () => listIncomingRequests().then(setRequests).catch(() => {});

  // Apply the status filter to the main "Requests" tab list.
  const filteredRequests = useMemo(
    () => requests.filter((r) => matchesRentalStatusFilter(r.status, statusFilter)),
    [requests, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, page, pageSize]);

  const changeStatusFilter = (next: string) => {
    setStatusFilter(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // When opened from a notification, flash the target card and jump to its page.
  const { highlightId, isHighlighted } = useHighlightTarget(!loading);
  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = requests.findIndex((r) => r.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1);
  }, [highlightId, loading, requests, pageSize]);

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest(requestId);
      setRequests((prev) => {
        // The vehicle just got taken: approving one request auto-rejects every
        // other still-pending request for the same vehicle (mirrors the backend),
        // so the list reflects it immediately without a page reload.
        const approved = prev.find((r) => r.id === requestId);
        const vehicleId = approved?.vehicleId;
        return prev.map((r) => {
          if (r.id === requestId) return { ...r, status: 'running' as const, vehicleStatus: 'rented' as const };
          if (vehicleId && r.vehicleId === vehicleId && r.status === 'pending') {
            return { ...r, status: 'rejected' as const, notes: 'Vehicle is no longer available (rented out).' };
          }
          return r;
        });
      });
      setFeedback({ open: true, message: t('rentalRequests.feedbackApproved'), severity: 'success' });
    } catch {
      setFeedback({ open: true, message: t('rentalRequests.actionFailed'), severity: 'error' });
    }
  };

  const handleConfirmReturn = async (requestId: string) => {
    try {
      await confirmReturn(requestId);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'completed' as const, vehicleStatus: 'available' as const, returnState: '' as const } : r))
      );
      setFeedback({ open: true, message: t('rentalRequests.returnConfirmed', 'Return confirmed — the vehicle is available again.'), severity: 'success' });
      if (viewId === requestId) setViewId(null);
    } catch {
      setFeedback({ open: true, message: t('rentalRequests.actionFailed'), severity: 'error' });
    } finally {
      setConfirmReturnId(null);
    }
  };

  // Owner asks the driver to bring the vehicle back early.
  const handleRequestReturn = async (requestId: string) => {
    try {
      await requestReturn(requestId);
      await reload();
      setFeedback({ open: true, message: t('rentalRequests.returnRequested', 'Early-return request sent to the driver.'), severity: 'success' });
      if (viewId === requestId) setViewId(null);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFeedback({ open: true, message: detail || t('rentalRequests.actionFailed'), severity: 'error' });
    } finally {
      setRequestReturnId(null);
    }
  };

  // Decline a driver's early-return request, or withdraw the owner's own request.
  const handleCancelReturn = async (requestId: string) => {
    try {
      await cancelReturn(requestId);
      await reload();
      setFeedback({ open: true, message: t('rentalRequests.returnCancelled', 'Early-return request cancelled.'), severity: 'success' });
      if (viewId === requestId) setViewId(null);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFeedback({ open: true, message: detail || t('rentalRequests.actionFailed'), severity: 'error' });
    }
  };

  const openRejectDialog = (requestId: string) => {
    setRejectDialog({ open: true, requestId, notes: '' });
  };

  const closeRejectDialog = () => {
    setRejectDialog({ open: false, requestId: null, notes: '' });
  };

  const handleRejectWithNotes = async () => {
    const { requestId, notes } = rejectDialog;
    if (!requestId) return;
    const reason = notes.trim();
    try {
      await rejectRequest(requestId, reason);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: 'rejected' as const, notes: reason || undefined } : r
        )
      );
      setFeedback({ open: true, message: t('rentalRequests.feedbackRejected'), severity: 'error' });
    } catch {
      setFeedback({ open: true, message: t('rentalRequests.actionFailed'), severity: 'error' });
    }
    closeRejectDialog();
  };

  const handleRequestInfo = async () => {
    const { requestId, message } = infoDialog;
    if (!requestId || !message.trim()) {
      setFeedback({ open: true, message: 'Write what you need first.', severity: 'error' });
      return;
    }
    try {
      await requestMoreInfo(requestId, message);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'request_info' as const } : r)));
      setFeedback({ open: true, message: 'Sent — the driver has been asked for more info.', severity: 'success' });
      if (viewId === requestId) setViewId(null);
    } catch {
      setFeedback({ open: true, message: t('rentalRequests.actionFailed'), severity: 'error' });
    }
    setInfoDialog({ open: false, requestId: null, message: '' });
  };

  const allowDelete = canDeleteRequests();
  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteRequest(deleteId);
      setRequests((prev) => prev.filter((r) => r.id !== deleteId));
      setFeedback({ open: true, message: t('rentalRequests.feedbackDeleted'), severity: 'success' });
      if (viewId === deleteId) setViewId(null);
      setDeleteId(null);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not delete this request.';
      setFeedback({ open: true, message: detail, severity: 'error' });
      setDeleteId(null);
    }
  };

  const viewedRequest = useMemo(
    () => requests.find((r) => r.id === viewId) ?? null,
    [requests, viewId]
  );

  // Early-return requests the DRIVER sent the owner (awaiting confirm/decline) —
  // shown on the Incoming tab.
  const incoming = useMemo(
    () => requests.filter((r) => r.returnState === 'requested_by_driver'),
    [requests],
  );

  // Legacy bookings (pre-handshake) the owner can still confirm a return for:
  // auto-completed at period end but the vehicle is still out (pending_return),
  // and no active handshake. Most-recent per vehicle to avoid stray buttons.
  const legacyReturnIds = useMemo(() => {
    const byVehicle = new Map<string, RentalRequest>();
    for (const r of requests) {
      if (!(r.status === 'completed' && r.vehicleStatus === 'pending_return' && (r.returnState ?? '') === '')) continue;
      const cur = byVehicle.get(r.vehicleId);
      if (!cur || (r.reviewedAt ?? '') > (cur.reviewedAt ?? '')) byVehicle.set(r.vehicleId, r);
    }
    return new Set(Array.from(byVehicle.values(), (r) => r.id));
  }, [requests]);

  const switchTab = (next: 'requests' | 'incoming') => {
    setTab(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'incoming') params.set('tab', 'incoming');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  // The return-workflow control for a booking on the main "Requests" tab,
  // driven by its returnState. Returns null when there's nothing to show.
  const renderReturnControl = (req: RentalRequest): React.ReactNode => {
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    switch (req.returnState) {
      case 'requested_by_rental':
        return (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap onClick={stop}>
            <Chip icon={<HourglassTop />} size="small" color="info" variant="outlined"
              label={t('rentalRequests.returnWaitingDriver', 'Waiting for the driver to confirm return')} />
            <Button size="small" color="inherit" startIcon={<CancelIcon />}
              onClick={() => handleCancelReturn(req.id)} sx={{ borderRadius: 2, textTransform: 'none' }}>
              {t('rentalRequests.cancelRequest', 'Cancel request')}
            </Button>
          </Stack>
        );
      case 'requested_by_driver':
        return (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap onClick={stop}>
            <Chip icon={<KeyboardReturn />} size="small" color="warning"
              label={t('rentalRequests.returnRequestedByDriver', 'Driver requested an early return')} />
            <Button size="small" variant="contained"
              onClick={() => switchTab('incoming')} sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('rentalRequests.reviewRequest', 'Review request')}
            </Button>
          </Stack>
        );
      case 'period_ended':
        return (
          <Chip icon={<HourglassTop />} size="small" color="info" variant="outlined" onClick={stop}
            label={t('rentalRequests.returnWaitingComplete', 'Period ended — waiting for the driver to complete the trip')} />
        );
      case 'driver_completed':
        return (
          <Button size="small" variant="contained" startIcon={<AssignmentTurnedIn />} onClick={(e) => { stop(e); setConfirmReturnId(req.id); }}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            {t('rentalRequests.confirmReturn', 'Confirm Return')}
          </Button>
        );
      default:
        // No handshake in progress.
        if (req.status === 'running' && withinPeriod(req)) {
          return (
            <Button size="small" variant="outlined" startIcon={<KeyboardReturn />} onClick={(e) => { stop(e); setRequestReturnId(req.id); }}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('rentalRequests.returnRequest', 'Return Request')}
            </Button>
          );
        }
        if (legacyReturnIds.has(req.id)) {
          return (
            <Button size="small" variant="contained" startIcon={<AssignmentTurnedIn />} onClick={(e) => { stop(e); setConfirmReturnId(req.id); }}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('rentalRequests.confirmReturn', 'Confirm Return')}
            </Button>
          );
        }
        return null;
    }
  };

  const handleCloseSnackbar = () => setFeedback((f) => ({ ...f, open: false }));
  const handlePageChange = (newPage: number) => setPage(newPage);
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <PageHero title={t('rentalRequests.title')} subtitle={t('rentalRequests.subtitle')}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <ToggleButtonGroup
        value={tab} exclusive size="small"
        onChange={(_, v) => { if (v) switchTab(v); }}
        sx={{ mb: 2, flexWrap: 'wrap', display: 'flex', width: 'fit-content' }}
      >
        <ToggleButton value="requests" sx={{ textTransform: 'none', px: 2 }}>
          {t('rentalRequests.tabRequests', 'Requests')}
        </ToggleButton>
        <ToggleButton value="incoming" sx={{ textTransform: 'none', px: 2 }}>
          {t('rentalRequests.tabIncoming', 'Incoming requests')}
          {incoming.length > 0 && (
            <Chip label={incoming.length} size="small" color="warning" sx={{ ml: 1, height: 18, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
          )}
        </ToggleButton>
      </ToggleButtonGroup>

      {tab === 'incoming' ? (
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="inc-skeleton" variants={fadeVariants} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 2.5 }} />)}
            </motion.div>
          ) : incoming.length === 0 ? (
            <motion.div key="inc-empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <Card variant="outlined" sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 2.5, borderColor: 'divider' }}>
                <CardContent>
                  <KeyboardReturn sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                    {t('rentalRequests.incomingEmptyTitle', 'No incoming requests')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('rentalRequests.incomingEmptyMessage', 'When a driver asks to return a vehicle early, it will appear here.')}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.ul key="incoming-list"
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
              variants={listVariants} initial="initial" animate="animate" exit="exit">
              {incoming.map((req) => (
                <motion.li key={req.id} variants={listItemVariants}>
                  <Card variant="outlined" {...highlightAttrProps(isHighlighted(req.id))}
                    sx={{
                      borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
                      ...(isHighlighted(req.id) ? (highlightSx as object) : {}),
                    }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2.5 } }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                          {req.vehicleMake} {req.vehicleModel}
                        </Typography>
                        <Chip icon={<KeyboardReturn />} color="warning" size="small"
                          label={t('rentalRequests.incomingChip', 'Early return requested')} sx={{ fontWeight: 600 }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">{req.driverName} · {req.driverEmail}</Typography>
                      {req.rentalStartDate && req.rentalEndDate && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {t('rentalRequests.rentalPeriodRange', {
                            start: new Date(req.rentalStartDate).toLocaleDateString(),
                            end: new Date(req.rentalEndDate).toLocaleDateString(),
                          })}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {t('rentalRequests.incomingPrompt', 'The driver asked to return this vehicle early. Confirm to take it back now, or decline to keep the rental running.')}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="contained" startIcon={<AssignmentTurnedIn />}
                          onClick={() => setConfirmReturnId(req.id)}
                          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
                          {t('rentalRequests.confirmReturn', 'Confirm Return')}
                        </Button>
                        <Button size="small" color="inherit" startIcon={<CancelIcon />}
                          onClick={() => handleCancelReturn(req.id)}
                          sx={{ borderRadius: 2, textTransform: 'none' }}>
                          {t('common.cancel')}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      ) : (
      <>
      <ToggleButtonGroup
        value={statusFilter} exclusive size="small"
        onChange={(_, v) => { if (v) changeStatusFilter(v); }}
        sx={{ mb: 2, flexWrap: 'wrap', display: 'flex', width: 'fit-content' }}
      >
        {RENTAL_STATUS_FILTERS.map((f) => (
          <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 1.75 }}>
            {t(f.labelKey, f.fallback)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={140}
                sx={{ borderRadius: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              />
            ))}
          </motion.div>
        ) : requests.length === 0 ? (
          <motion.div
            key="empty"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card
              variant="outlined"
              sx={{
                textAlign: 'center',
                py: 6,
                px: 3,
                borderRadius: 2.5,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: (theme) =>
                  theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.12)',
              }}
            >
              <CardContent>
                <RequestQuote sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                  {t('rentalRequests.noRentalRequests')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('rentalRequests.noRentalRequestsMessage')}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        ) : filteredRequests.length === 0 ? (
          <motion.div key="no-match" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {t('rentalRequests.noMatchingStatus', 'No requests with this status.')}
            </Typography>
          </motion.div>
        ) : (
          <motion.ul
            // Key by status filter AND page so the list remounts and re-runs its
            // entry animation on every filter change or Next/Previous — otherwise
            // framer-motion's parent→child variant propagation never re-fires and
            // the new items stay at their initial opacity:0 (blank until a manual
            // refresh). Switching filter resets to page 1, so without the filter
            // in the key the key would stay "list-1" and the cards never appear.
            key={`list-${statusFilter}-${page}`}
            style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {paginatedRequests.map((req) => {
              const config = statusConfig[req.status];
              return (
                <motion.li key={req.id} variants={listItemVariants}>
                  <Card
                    variant="outlined"
                    onClick={() => setViewId(req.id)}
                    {...highlightAttrProps(isHighlighted(req.id))}
                    sx={{
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      boxShadow: (theme) =>
                        theme.palette.mode === 'light'
                          ? '0 2px 8px rgba(0,0,0,0.06)'
                          : '0 2px 8px rgba(0,0,0,0.12)',
                      transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                      '&:hover': {
                        boxShadow: (theme) =>
                          theme.palette.mode === 'light'
                            ? '0 4px 20px rgba(0,0,0,0.08)'
                            : '0 4px 20px rgba(0,0,0,0.2)',
                        borderColor: 'primary.main',
                      },
                      ...(isHighlighted(req.id) ? (highlightSx as object) : {}),
                    }}
                  >
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2.5 } }}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 1.5,
                          mb: 1.5,
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                          {req.vehicleMake} {req.vehicleModel}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Chip
                            label={t(config.labelKey, config.fallback)}
                            color={config.color}
                            size="small"
                            sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1.25 } }}
                          />
                          {allowDelete && (
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(req.id);
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {req.driverName} · {req.driverEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {t('rentalRequests.requestedAt', { date: new Date(req.requestedAt).toLocaleDateString() })}
                      </Typography>
                      {req.rentalStartDate && req.rentalEndDate && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {t('rentalRequests.rentalPeriodRange', {
                            start: new Date(req.rentalStartDate).toLocaleDateString(),
                            end: new Date(req.rentalEndDate).toLocaleDateString(),
                          })}
                        </Typography>
                      )}
                    </CardContent>
                    {req.status === 'pending' && (
                      <CardActions sx={{ gap: 1, flexWrap: 'wrap', px: { xs: 2, sm: 2.5 }, pb: 2 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<ThumbUp />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(req.id);
                          }}
                          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                        >
                          {t('rentalRequests.approve')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<ThumbDown />}
                          onClick={(e) => {
                            e.stopPropagation();
                            openRejectDialog(req.id);
                          }}
                          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                        >
                          {t('rentalRequests.rejectWithNotes')}
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<HelpOutline />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfoDialog({ open: true, requestId: req.id, message: '' });
                          }}
                          sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                        >
                          Request more info
                        </Button>
                      </CardActions>
                    )}
                    {req.status !== 'pending' && renderReturnControl(req) && (
                      <CardActions sx={{ gap: 1, flexWrap: 'wrap', px: { xs: 2, sm: 2.5 }, pb: 2 }}>
                        {renderReturnControl(req)}
                      </CardActions>
                    )}
                  </Card>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      {!loading && filteredRequests.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredRequests.length}
          pageSize={pageSize}
          onChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
      </>
      )}

      {/* Owner requests an early return from the driver */}
      <Dialog open={requestReturnId != null} onClose={() => setRequestReturnId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('rentalRequests.returnRequestTitle', 'Request an early return?')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('rentalRequests.returnRequestMessage', 'Ask the driver to bring the vehicle back before the end date. They will confirm or decline your request.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRequestReturnId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" startIcon={<KeyboardReturn />}
            onClick={() => requestReturnId && handleRequestReturn(requestReturnId)}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            {t('rentalRequests.returnRequest', 'Return Request')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewId != null} onClose={() => setViewId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('rentalRequests.detailsTitle')}</DialogTitle>
        {viewedRequest && (
          <>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  {viewedRequest.vehicleMake} {viewedRequest.vehicleModel}
                </Typography>
                <Chip
                  label={t(statusConfig[viewedRequest.status].labelKey, statusConfig[viewedRequest.status].fallback)}
                  color={statusConfig[viewedRequest.status].color}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Stack spacing={2} divider={<Divider flexItem />}>
                <DetailRow label={t('rentalRequests.driver')} value={viewedRequest.driverName} />
                <DetailRow label={t('rentalRequests.email')} value={viewedRequest.driverEmail} />
                <DetailRow
                  label={t('rentalRequests.requestedOn')}
                  value={new Date(viewedRequest.requestedAt).toLocaleDateString()}
                />
                {viewedRequest.rentalStartDate && viewedRequest.rentalEndDate && (
                  <DetailRow
                    label={t('rentalRequests.rentalPeriod')}
                    value={`${new Date(viewedRequest.rentalStartDate).toLocaleDateString()} – ${new Date(
                      viewedRequest.rentalEndDate
                    ).toLocaleDateString()}`}
                  />
                )}
                {viewedRequest.notes && (
                  <DetailRow label={t('rentalRequests.notesLabel')} value={viewedRequest.notes} />
                )}
                {viewedRequest.verifiedDetails && (
                  <DetailRow
                    label="Verified identity"
                    value={`${viewedRequest.verifiedDetails.fullName}${viewedRequest.verifiedDetails.dateOfBirth ? ` · DOB ${viewedRequest.verifiedDetails.dateOfBirth}` : ''} · ${viewedRequest.verifiedDetails.documentNumber} · exp ${viewedRequest.verifiedDetails.expiryDate}`}
                  />
                )}
                {viewedRequest.idDocuments && viewedRequest.idDocuments.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Documents
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {viewedRequest.idDocuments.map((d, i) => (
                        <Box key={i} component="button" type="button" onClick={() => openDocument(d.image)}
                          sx={{ fontSize: 14, color: 'primary.main', textTransform: 'capitalize',
                            background: 'none', border: 'none', p: 0, textAlign: 'left', cursor: 'pointer',
                            textDecoration: 'underline', '&:hover': { opacity: 0.85 } }}>
                          {d.docType}: {d.name}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
                {viewedRequest.infoRequestMessage && (
                  <DetailRow label="You requested" value={viewedRequest.infoRequestMessage} />
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              {viewedRequest.status === 'pending' && (
                <Button
                  startIcon={<HelpOutline />}
                  onClick={() => setInfoDialog({ open: true, requestId: viewedRequest.id, message: '' })}
                  sx={{ borderRadius: 2, textTransform: 'none', mr: 'auto' }}
                >
                  Request more info
                </Button>
              )}
              {viewedRequest.status !== 'pending' && renderReturnControl(viewedRequest) && (
                <Box sx={{ mr: 'auto' }}>{renderReturnControl(viewedRequest)}</Box>
              )}
              {allowDelete && (
                <Button
                  color="error"
                  startIcon={<DeleteOutline />}
                  onClick={() => setDeleteId(viewedRequest.id)}
                  sx={{ borderRadius: 2, textTransform: 'none', mr: 'auto' }}
                >
                  {t('common.delete')}
                </Button>
              )}
              <Button onClick={() => setViewId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                {t('common.close')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={deleteId != null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('rentalRequests.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('rentalRequests.deleteMessage')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutline />}
            onClick={handleDeleteConfirm}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmReturnId != null} onClose={() => setConfirmReturnId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm vehicle return</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Confirm that the driver has physically returned the vehicle? This completes the
            booking and makes the vehicle available to rent again.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmReturnId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AssignmentTurnedIn />}
            onClick={() => confirmReturnId && handleConfirmReturn(confirmReturnId)}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            Yes, confirm return
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectDialog.open} onClose={closeRejectDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('rentalRequests.rejectWithNotesTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('rentalRequests.rejectWithNotesDescription')}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t('rentalRequests.rejectionNotesLabel')}
            placeholder={t('rentalRequests.rejectionNotesPlaceholder')}
            value={rejectDialog.notes}
            onChange={(e) => setRejectDialog((prev) => ({ ...prev, notes: e.target.value }))}
            variant="outlined"
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeRejectDialog} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRejectWithNotes}
            startIcon={<ThumbDown />}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {t('rentalRequests.confirmReject')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={infoDialog.open} onClose={() => setInfoDialog({ open: false, requestId: null, message: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Request more information</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Tell the driver what extra document or detail you need. They'll be asked to upload it, then the request returns to you for review.
          </DialogContentText>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            label="What do you need?"
            placeholder="e.g. Please upload a clearer photo of your driver licence."
            value={infoDialog.message}
            onChange={(e) => setInfoDialog((prev) => ({ ...prev, message: e.target.value }))}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInfoDialog({ open: false, requestId: null, message: '' })} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" startIcon={<HelpOutline />} onClick={handleRequestInfo}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
            Send request
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={feedback.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={feedback.severity}>
          {feedback.message}
        </Alert>
      </Snackbar>
      </Box>
    </PageHero>
  );
};

export default RentalRequestsPage;
