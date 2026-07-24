import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Route as RouteIcon,
  DeleteForever,
  KeyboardReturn,
  AssignmentTurnedIn,
  Cancel as CancelIcon,
  HourglassTop,
} from '@mui/icons-material';
import {
  listMyTrips,
  deleteMyRequest,
  requestReturn,
  cancelReturn,
  completeTrip,
  type DriverRequest,
} from '../../services/rental/driverRequests';
import { listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import Pagination from '../../components/Common/Pagination';
import { PageHero } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString() : '—');

/** Local YYYY-MM-DD for comparing against a booking's end_date (date-only). */
function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** True while the booked period is still active (end date today-or-later, or open-ended). */
function withinPeriod(trip: DriverRequest): boolean {
  return !trip.endDate || trip.endDate >= todayStr();
}

/** A trip is "running" while the rental is in progress (approved, not yet
 * ended). It auto-completes to 'completed' once the rental period is over. */
function isRunning(trip: DriverRequest): boolean {
  return trip.status === 'running';
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

const MyTripsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Section filter, mirrored in the URL so a dashboard card/chart can deep-link
  // straight to the Running or Completed trips (e.g. `/my-trips?status=running`).
  const rawStatus = searchParams.get('status');
  const statusFilter: 'all' | 'running' | 'completed' =
    rawStatus === 'running' ? 'running' : rawStatus === 'completed' ? 'completed' : 'all';
  const changeStatus = (next: 'all' | 'running' | 'completed') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
    setPage(1);
  };
  const [trips, setTrips] = useState<DriverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Confirmation dialog for an early-return request or an end-of-period trip completion.
  const [actionDialog, setActionDialog] = useState<{ id: string; kind: 'request' | 'complete' } | null>(null);
  const [feedback, setFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const refreshTrips = () => listMyTrips().then(setTrips).catch(() => {});

  // Load once with a spinner, then poll every 30s so a trip appears the moment
  // the rental confirms its return — without flashing the spinner each refresh.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const refresh = () =>
      listMyTrips()
        .then((list) => { if (active) setTrips(list); })
        .catch(() => { if (active) setTrips([]); })
        .finally(() => { if (active) setLoading(false); });
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  // Running trips show in full at the top (there are only ever a few active at
  // once); completed trips are the history and get paginated below.
  const runningTrips = useMemo(() => trips.filter(isRunning), [trips]);
  const completedTrips = useMemo(() => trips.filter((r) => r.status === 'completed'), [trips]);

  const totalPages = Math.max(1, Math.ceil(completedTrips.length / pageSize));
  const paginatedCompleted = useMemo(() => {
    const start = (page - 1) * pageSize;
    return completedTrips.slice(start, start + pageSize);
  }, [completedTrips, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // When arriving from a notification / dashboard row, flash the target trip and
  // (if it's in the paginated completed history) jump to the page holding it.
  const { highlightId, isHighlighted } = useHighlightTarget(!loading);
  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = completedTrips.findIndex((r) => r.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1);
  }, [highlightId, loading, completedTrips, pageSize]);

  const showRunning = statusFilter !== 'completed';
  const showCompleted = statusFilter !== 'running';

  const viewedTrip = useMemo(() => trips.find((r) => r.id === viewId) ?? null, [trips, viewId]);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await deleteMyRequest(deleteId);
      setTrips((prev) => prev.filter((r) => r.id !== deleteId));
      if (viewId === deleteId) setViewId(null);
      setFeedback({ open: true, message: t('myTrips.deleteSuccess', 'Trip removed.'), severity: 'success' });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFeedback({ open: true, message: detail || t('myTrips.deleteFailed', 'Could not remove this trip.'), severity: 'error' });
    } finally {
      setBusy(false);
      setDeleteId(null);
    }
  };

  // Cancel/withdraw an outstanding early-return request the driver initiated (no
  // confirm dialog needed — it just reverts to running).
  const handleCancelReturn = async (id: string) => {
    setBusy(true);
    try {
      await cancelReturn(id);
      await refreshTrips();
      setFeedback({ open: true, message: t('myTrips.returnCancelled', 'Early-return request cancelled.'), severity: 'success' });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFeedback({ open: true, message: detail || t('common.actionFailed', 'Something went wrong. Please try again.'), severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Confirm the dialog action — either send an early-return request or complete
  // the trip at the end of the period.
  const handleActionConfirm = async () => {
    if (!actionDialog) return;
    const { id, kind } = actionDialog;
    setBusy(true);
    try {
      if (kind === 'request') {
        await requestReturn(id);
        setFeedback({ open: true, message: t('myTrips.returnRequested', 'Early-return request sent to the owner.'), severity: 'success' });
      } else {
        await completeTrip(id);
        setFeedback({ open: true, message: t('myTrips.tripCompleted', 'Trip completed — waiting for the owner to confirm the return.'), severity: 'success' });
      }
      await refreshTrips();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFeedback({ open: true, message: detail || t('common.actionFailed', 'Something went wrong. Please try again.'), severity: 'error' });
    } finally {
      setBusy(false);
      setActionDialog(null);
    }
  };

  // The return-workflow control for a running trip, driven by its returnState.
  const renderReturnControls = (trip: DriverRequest) => {
    const stop = (e: React.MouseEvent) => e.stopPropagation();
    switch (trip.returnState) {
      case 'requested_by_driver':
        return (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap onClick={stop}>
            <Chip icon={<HourglassTop />} size="small" color="info" variant="outlined"
              label={t('myTrips.returnWaitingOwner', 'Early return requested — waiting for owner')} />
            <Button size="small" color="inherit" startIcon={<CancelIcon />} disabled={busy}
              onClick={() => handleCancelReturn(trip.id)} sx={{ borderRadius: 2, textTransform: 'none' }}>
              {t('myTrips.cancelRequest', 'Cancel request')}
            </Button>
          </Stack>
        );
      case 'requested_by_rental':
        return (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap onClick={stop}>
            <Chip icon={<KeyboardReturn />} size="small" color="warning"
              label={t('myTrips.returnRequestedByOwner', 'Owner requested an early return')} />
            <Button size="small" variant="contained" disabled={busy}
              onClick={() => navigate('/my-requests?tab=incoming')}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('myTrips.reviewRequest', 'Review request')}
            </Button>
          </Stack>
        );
      case 'period_ended':
        return (
          <Box onClick={stop}>
            <Button size="small" variant="contained" startIcon={<AssignmentTurnedIn />} disabled={busy}
              onClick={() => setActionDialog({ id: trip.id, kind: 'complete' })}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('myTrips.completeTrip', 'Complete Trip')}
            </Button>
          </Box>
        );
      case 'driver_completed':
        return (
          <Chip icon={<HourglassTop />} size="small" color="info" variant="outlined" onClick={stop}
            label={t('myTrips.completedWaitingOwner', 'Trip completed — waiting for owner to confirm return')} />
        );
      default:
        // No return in progress: offer an early-return request while in period.
        if (!withinPeriod(trip)) return null;
        return (
          <Box onClick={stop}>
            <Button size="small" variant="outlined" startIcon={<KeyboardReturn />} disabled={busy}
              onClick={() => setActionDialog({ id: trip.id, kind: 'request' })}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('myTrips.returnRequest', 'Return Request')}
            </Button>
          </Box>
        );
    }
  };

  const renderTripCard = (trip: DriverRequest) => {
    const running = isRunning(trip);
    return (
      <motion.li key={trip.id} variants={listItemVariants}>
        <Card
          variant="outlined"
          onClick={() => setViewId(trip.id)}
          {...highlightAttrProps(isHighlighted(trip.id))}
          sx={{
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
            ...(isHighlighted(trip.id) ? (highlightSx as object) : {}),
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                {trip.vehicleMake} {trip.vehicleModel}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip
                  label={running ? t('myTrips.statusRunning', 'Running') : t('myTrips.statusCompleted')}
                  color={running ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1.25 } }}
                />
                <Tooltip title={t('myTrips.deleteTrip', 'Delete trip')}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(trip.id); }}
                  >
                    <DeleteForever fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {trip.rentalName}
            </Typography>
            {trip.startDate && trip.endDate && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {t('myTrips.rentalPeriodRange', { start: fmtDate(trip.startDate), end: fmtDate(trip.endDate) })}
              </Typography>
            )}
            {running && (
              <Box sx={{ mt: 1.5 }}>{renderReturnControls(trip)}</Box>
            )}
          </CardContent>
        </Card>
      </motion.li>
    );
  };

  const SectionHeading: React.FC<{ label: string; count: number }> = ({ label, count }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Chip label={count} size="small" sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: 12 } }} />
    </Box>
  );

  return (
    <PageHero title={t('myTrips.title')} subtitle={t('myTrips.subtitle')}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {!loading && trips.length > 0 && (
        <ToggleButtonGroup
          value={statusFilter} exclusive size="small"
          onChange={(_, v) => { if (v) changeStatus(v); }}
          sx={{ mb: 2, flexWrap: 'wrap', display: 'flex', width: 'fit-content' }}
        >
          <ToggleButton value="all" sx={{ textTransform: 'none', px: 1.75 }}>
            {t('myTrips.filterAll', 'All')}
          </ToggleButton>
          <ToggleButton value="running" sx={{ textTransform: 'none', px: 1.75 }}>
            {t('myTrips.statusRunning', 'Running')}
          </ToggleButton>
          <ToggleButton value="completed" sx={{ textTransform: 'none', px: 1.75 }}>
            {t('myTrips.statusCompleted')}
          </ToggleButton>
        </ToggleButtonGroup>
      )}
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
              <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: 2.5 }} />
            ))}
          </motion.div>
        ) : trips.length === 0 ? (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Card variant="outlined" sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 2.5, borderColor: 'divider' }}>
              <CardContent>
                <RouteIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                  {t('myTrips.emptyTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('myTrips.emptyMessage')}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="sections" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            {/* No trips match the active section filter. */}
            {((showRunning ? runningTrips.length : 0) + (showCompleted ? completedTrips.length : 0)) === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {t('myTrips.noneForFilter', 'No trips with this status.')}
              </Typography>
            )}
            {/* Running trips — shown in full (active rentals are always few). */}
            {showRunning && runningTrips.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <SectionHeading label={t('myTrips.runningSection', 'Running')} count={runningTrips.length} />
                <motion.ul
                  key="running-list"
                  style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
                  variants={listVariants}
                  initial="initial"
                  animate="animate"
                >
                  {runningTrips.map(renderTripCard)}
                </motion.ul>
              </Box>
            )}

            {/* Completed trips — the paginated history. */}
            {showCompleted && completedTrips.length > 0 && (
              <Box>
                <SectionHeading label={t('myTrips.completedSection', 'Completed')} count={completedTrips.length} />
                <motion.ul
                  key={`completed-list-${page}`}
                  style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
                  variants={listVariants}
                  initial="initial"
                  animate="animate"
                >
                  {paginatedCompleted.map(renderTripCard)}
                </motion.ul>
              </Box>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && showCompleted && completedTrips.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={completedTrips.length}
          pageSize={pageSize}
          onChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}

      <Dialog open={viewId != null} onClose={() => setViewId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('myTrips.detailsTitle')}</DialogTitle>
        {viewedTrip && (
          <>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  {viewedTrip.vehicleMake} {viewedTrip.vehicleModel}
                </Typography>
                <Chip
                  label={isRunning(viewedTrip) ? t('myTrips.statusRunning', 'Running') : t('myTrips.statusCompleted')}
                  color={isRunning(viewedTrip) ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Stack spacing={2} divider={<Divider flexItem />}>
                <DetailRow label={t('myTrips.rentalCompany')} value={viewedTrip.rentalName} />
                {viewedTrip.vehicleRego && (
                  <DetailRow label={t('myTrips.rego')} value={viewedTrip.vehicleRego} />
                )}
                {viewedTrip.startDate && viewedTrip.endDate && (
                  <DetailRow
                    label={t('myTrips.rentalPeriod')}
                    value={`${fmtDate(viewedTrip.startDate)} – ${fmtDate(viewedTrip.endDate)}`}
                  />
                )}
                <DetailRow label={t('myTrips.requestedOn')} value={fmtDate(viewedTrip.createdAt)} />
                {viewedTrip.reviewedAt && (
                  <DetailRow label={t('myTrips.approvedOn')} value={fmtDate(viewedTrip.reviewedAt)} />
                )}
                {viewedTrip.decisionReason && (
                  <DetailRow label={t('myTrips.ownerNote')} value={viewedTrip.decisionReason} />
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
              {isRunning(viewedTrip) ? (
                <Box sx={{ mr: 'auto' }}>{renderReturnControls(viewedTrip)}</Box>
              ) : (
                <Button
                  color="error"
                  startIcon={<DeleteForever />}
                  onClick={() => setDeleteId(viewedTrip.id)}
                  sx={{ borderRadius: 2, textTransform: 'none', mr: 'auto' }}
                >
                  {t('myTrips.deleteTrip', 'Delete trip')}
                </Button>
              )}
              <Button onClick={() => setViewId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                {t('common.close')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Early-return request / complete-trip confirm */}
      <Dialog open={actionDialog != null} onClose={() => setActionDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {actionDialog?.kind === 'complete'
            ? t('myTrips.completeTripTitle', 'Complete this trip?')
            : t('myTrips.returnRequestTitle', 'Request an early return?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionDialog?.kind === 'complete'
              ? t('myTrips.completeTripMessage', 'Confirm you have returned the vehicle. The owner will then confirm the return to finish the trip.')
              : t('myTrips.returnRequestMessage', 'Ask the owner to take the vehicle back before the end date. They will confirm or decline your request.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setActionDialog(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            startIcon={actionDialog?.kind === 'complete' ? <AssignmentTurnedIn /> : <KeyboardReturn />}
            onClick={handleActionConfirm}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {actionDialog?.kind === 'complete'
              ? t('myTrips.completeTrip', 'Complete Trip')
              : t('myTrips.returnRequest', 'Return Request')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId != null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('myTrips.deleteTitle', 'Delete this trip?')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('myTrips.deleteMessage', 'This permanently removes the trip from your history. This cannot be undone.')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteForever />}
            disabled={busy}
            onClick={handleDeleteConfirm}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {t('myTrips.deleteTrip', 'Delete trip')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={feedback.open}
        autoHideDuration={4000}
        onClose={() => setFeedback((f) => ({ ...f, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setFeedback((f) => ({ ...f, open: false }))} severity={feedback.severity}>
          {feedback.message}
        </Alert>
      </Snackbar>
      </Box>
    </PageHero>
  );
};

export default MyTripsPage;
