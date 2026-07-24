import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
import { RequestQuote, DeleteForever, Cancel, Upload, AssignmentTurnedIn, KeyboardReturn } from '@mui/icons-material';
import {
  listMyRequests,
  cancelRequest,
  deleteMyRequest,
  provideBookingInfo,
  confirmReturn,
  cancelReturn,
  type DriverRequest,
  type DriverRequestStatus,
} from '../../services/rental/driverRequests';
import { listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import Pagination from '../../components/Common/Pagination';
import { PageHero } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';
import IdentityVerification, {
  emptyVerification,
  isVerificationComplete,
  type VerificationResult,
} from '../../components/Requests/IdentityVerification';

const statusConfig: Record<DriverRequestStatus, { labelKey: string; fallback: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' }> = {
  pending: { labelKey: 'myRequests.statusPending', fallback: 'Pending', color: 'warning' },
  approved: { labelKey: 'myRequests.statusApproved', fallback: 'Approved', color: 'success' },
  running: { labelKey: 'myRequests.statusRunning', fallback: 'Running', color: 'success' },
  rejected: { labelKey: 'myRequests.statusRejected', fallback: 'Rejected', color: 'error' },
  cancelled: { labelKey: 'myRequests.statusCancelled', fallback: 'Cancelled', color: 'default' },
  info_requested: { labelKey: 'myRequests.statusInfoRequested', fallback: 'Info requested', color: 'info' },
  completed: { labelKey: 'myRequests.statusCompleted', fallback: 'Completed', color: 'primary' },
};

type Filter = 'all' | DriverRequestStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'info_requested', label: 'Info requested' },
  { value: 'running', label: 'Running' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString() : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Running booking whose rental period has ended (trip effectively complete,
 * pending the daily auto-complete sweep). */
function isTripComplete(r: DriverRequest): boolean {
  return r.status === 'running' && !!r.endDate && r.endDate < todayIso();
}
/** Cancel is offered only while the rental hasn't decided (pending / info requested). */
function canCancel(r: DriverRequest): boolean {
  return r.status === 'pending' || r.status === 'info_requested';
}
/** Delete is offered for terminal states + ended trips (never an active running booking). */
function canDelete(r: DriverRequest): boolean {
  return r.status !== 'running' || isTripComplete(r);
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

const MyRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<DriverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Top-level tab: the driver's own requests, or early-return requests the
  // rental owner has sent them (waiting for confirm/decline).
  const [tab, setTab] = useState<'mine' | 'incoming'>(searchParams.get('tab') === 'incoming' ? 'incoming' : 'mine');
  const [returnAction, setReturnAction] = useState<{ id: string; kind: 'confirm' | 'decline' } | null>(null);
  // Status filter, mirrored in the URL so a dashboard card/chart can deep-link
  // to a filtered request list (e.g. `/my-requests?status=pending`).
  const filter: Filter =
    (FILTERS.find((f) => f.value === searchParams.get('status'))?.value) ?? 'all';
  const setFilter = (next: Filter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewId, setViewId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [provideId, setProvideId] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationResult>(emptyVerification());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  const load = () => {
    setLoading(true);
    listMyRequests().then(setRequests).catch(() => setRequests([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMyRequests()
      .then((list) => { if (active) setRequests(list); })
      .catch(() => { if (active) setRequests([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  // When opened from a notification, flash the target card and jump to its page.
  const { highlightId, isHighlighted } = useHighlightTarget(!loading);
  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = filtered.findIndex((r) => r.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / pageSize) + 1);
  }, [highlightId, loading, filtered, pageSize]);

  const viewedRequest = useMemo(() => requests.find((r) => r.id === viewId) ?? null, [requests, viewId]);

  // Early-return requests the rental sent this driver (awaiting their decision).
  const incoming = useMemo(
    () => requests.filter((r) => r.returnState === 'requested_by_rental'),
    [requests],
  );

  const switchTab = (next: 'mine' | 'incoming') => {
    setTab(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'incoming') params.set('tab', 'incoming');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  };

  const toast = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setFeedback({ open: true, message, severity });

  // Confirm (accept) or decline an early-return request the rental owner sent.
  const handleReturnAction = async () => {
    if (!returnAction) return;
    const { id, kind } = returnAction;
    setBusy(true);
    try {
      if (kind === 'confirm') {
        await confirmReturn(id);
        toast(t('myRequests.returnConfirmed', 'Return confirmed — the vehicle has gone back to the owner.'));
      } else {
        await cancelReturn(id);
        toast(t('myRequests.returnDeclined', 'Early-return request declined.'));
      }
      if (viewId === id) setViewId(null);
      load();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detail || t('myRequests.actionFailed'), 'error');
    } finally { setBusy(false); setReturnAction(null); }
  };

  const handleCancelConfirm = async () => {
    if (!cancelId) return;
    setBusy(true);
    try {
      await cancelRequest(cancelId);
      toast(t('myRequests.feedbackCancelled'));
      if (viewId === cancelId) setViewId(null);
      load();
    } catch { toast(t('myRequests.actionFailed'), 'error'); }
    finally { setBusy(false); setCancelId(null); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await deleteMyRequest(deleteId);
      setRequests((prev) => prev.filter((r) => r.id !== deleteId));
      toast('Request deleted.');
      if (viewId === deleteId) setViewId(null);
    } catch (err) {
      toast((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not delete this request.', 'error');
    } finally { setBusy(false); setDeleteId(null); }
  };

  const submitProvide = async () => {
    if (!provideId) return;
    if (!isVerificationComplete(verification)) { toast('Upload at least one document and confirm the details.', 'error'); return; }
    setBusy(true);
    try {
      await provideBookingInfo(provideId, verification.documents, verification.details);
      toast('Information sent — your request is pending review again.');
      setProvideId(null); setVerification(emptyVerification());
      if (viewId === provideId) setViewId(null);
      load();
    } catch { toast('Could not send the information.', 'error'); }
    finally { setBusy(false); }
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1); };

  return (
    <PageHero title={t('myRequests.title')} subtitle={t('myRequests.subtitle')}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <ToggleButtonGroup
          value={tab} exclusive size="small"
          onChange={(_, v) => { if (v) switchTab(v); }}
          sx={{ mb: 2, flexWrap: 'wrap', display: 'flex', width: 'fit-content' }}
        >
          <ToggleButton value="mine" sx={{ textTransform: 'none', px: 2 }}>
            {t('myRequests.tabMine', 'My requests')}
          </ToggleButton>
          <ToggleButton value="incoming" sx={{ textTransform: 'none', px: 2 }}>
            {t('myRequests.tabIncoming', 'Incoming requests')}
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
                {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 2.5 }} />)}
              </motion.div>
            ) : incoming.length === 0 ? (
              <motion.div key="inc-empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
                <Card variant="outlined" sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 2.5, borderColor: 'divider' }}>
                  <CardContent>
                    <KeyboardReturn sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                      {t('myRequests.incomingEmptyTitle', 'No incoming requests')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('myRequests.incomingEmptyMessage', 'When an owner asks you to return a vehicle early, it will appear here.')}
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
                            label={t('myRequests.incomingChip', 'Early return requested')} sx={{ fontWeight: 600 }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">{req.rentalName}</Typography>
                        {req.startDate && req.endDate && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {t('myRequests.rentalPeriodRange', { start: fmtDate(req.startDate), end: fmtDate(req.endDate) })}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {t('myRequests.incomingPrompt', 'The owner asked you to return this vehicle early. Confirm to return it now, or decline to keep the rental running.')}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                          <Button size="small" variant="contained" startIcon={<AssignmentTurnedIn />} disabled={busy}
                            onClick={() => setReturnAction({ id: req.id, kind: 'confirm' })}
                            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
                            {t('myRequests.confirmReturn', 'Confirm Return')}
                          </Button>
                          <Button size="small" color="inherit" startIcon={<Cancel />} disabled={busy}
                            onClick={() => setReturnAction({ id: req.id, kind: 'decline' })}
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
        {!loading && requests.length > 0 && (
          <ToggleButtonGroup
            value={filter} exclusive size="small"
            onChange={(_, v) => { if (v) { setFilter(v); setPage(1); } }}
            sx={{ mb: 2, flexWrap: 'wrap', display: 'flex', width: 'fit-content' }}
          >
            {FILTERS.map((f) => (
              <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 1.75 }}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" variants={fadeVariants} initial="initial" animate="animate" exit="exit"
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 2.5 }} />)}
            </motion.div>
          ) : requests.length === 0 ? (
            <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <Card variant="outlined" sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: 2.5, borderColor: 'divider' }}>
                <CardContent>
                  <RequestQuote sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
                    {t('myRequests.emptyTitle')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{t('myRequests.emptyMessage')}</Typography>
                </CardContent>
              </Card>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty-filter" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No requests with this status.
              </Typography>
            </motion.div>
          ) : (
            <motion.ul key={`${filter}-${page}`}
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
              variants={listVariants} initial="initial" animate="animate" exit="exit">
              {paginatedRequests.map((req) => {
                const config = statusConfig[req.status];
                return (
                  <motion.li key={req.id} variants={listItemVariants}>
                    <Card variant="outlined" onClick={() => setViewId(req.id)}
                      {...highlightAttrProps(isHighlighted(req.id))}
                      sx={{
                        borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
                        cursor: 'pointer', transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                        '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
                        ...(isHighlighted(req.id) ? (highlightSx as object) : {}),
                      }}>
                      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2.5 } }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                          <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                            {req.vehicleMake} {req.vehicleModel}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={t(config.labelKey, config.fallback)} color={config.color} size="small" sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1.25 } }} />
                            {canCancel(req) && (
                              <Tooltip title={t('myRequests.cancelRequest')}>
                                <IconButton size="small" color="warning"
                                  onClick={(e) => { e.stopPropagation(); setCancelId(req.id); }}>
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canDelete(req) && (
                              <Tooltip title="Delete permanently">
                                <IconButton size="small" color="error"
                                  onClick={(e) => { e.stopPropagation(); setDeleteId(req.id); }}>
                                  <DeleteForever fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">{req.rentalName}</Typography>
                        {req.startDate && req.endDate && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {t('myRequests.rentalPeriodRange', { start: fmtDate(req.startDate), end: fmtDate(req.endDate) })}
                          </Typography>
                        )}
                        {req.status === 'info_requested' && (
                          <Box sx={{ mt: 1 }}>
                            {req.infoRequestMessage && (
                              <Typography variant="caption" color="info.main" display="block" sx={{ mb: 0.75 }}>
                                Rental asked: {req.infoRequestMessage}
                              </Typography>
                            )}
                            <Button size="small" variant="contained" startIcon={<Upload />}
                              onClick={(e) => { e.stopPropagation(); setProvideId(req.id); setVerification(emptyVerification()); }}
                              sx={{ borderRadius: 2, textTransform: 'none' }}>
                              Provide info
                            </Button>
                          </Box>
                        )}
                        {req.decisionReason && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75, fontStyle: 'italic' }}>
                            {t('myRequests.responseLabel')}: {req.decisionReason}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>

        {!loading && filtered.length > 0 && (
          <Pagination
            currentPage={page} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize}
            onChange={handlePageChange} onPageSizeChange={handlePageSizeChange}
          />
        )}
        </>
        )}

        {/* Confirm / decline an incoming early-return request */}
        <Dialog open={returnAction != null} onClose={() => setReturnAction(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            {returnAction?.kind === 'confirm'
              ? t('myRequests.confirmReturnTitle', 'Return this vehicle now?')
              : t('myRequests.declineReturnTitle', 'Decline the early return?')}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {returnAction?.kind === 'confirm'
                ? t('myRequests.confirmReturnMessage', 'This completes the trip and returns the vehicle to the owner right away.')
                : t('myRequests.declineReturnMessage', 'The rental will continue as normal until the end date.')}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReturnAction(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              color={returnAction?.kind === 'confirm' ? 'primary' : 'inherit'}
              disabled={busy}
              startIcon={returnAction?.kind === 'confirm' ? <AssignmentTurnedIn /> : <Cancel />}
              onClick={handleReturnAction}
              sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
            >
              {returnAction?.kind === 'confirm'
                ? t('myRequests.confirmReturn', 'Confirm Return')
                : t('myRequests.declineReturn', 'Decline')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Detail dialog */}
        <Dialog open={viewId != null} onClose={() => setViewId(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('myRequests.detailsTitle')}</DialogTitle>
          {viewedRequest && (
            <>
              <DialogContent dividers>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight={700}>
                    {viewedRequest.vehicleMake} {viewedRequest.vehicleModel}
                  </Typography>
                  <Chip label={t(statusConfig[viewedRequest.status].labelKey, statusConfig[viewedRequest.status].fallback)} color={statusConfig[viewedRequest.status].color} size="small" sx={{ fontWeight: 600 }} />
                </Box>
                <Stack spacing={2} divider={<Divider flexItem />}>
                  <DetailRow label={t('myRequests.rentalCompany')} value={viewedRequest.rentalName} />
                  {viewedRequest.vehicleRego && <DetailRow label={t('myRequests.rego')} value={viewedRequest.vehicleRego} />}
                  {viewedRequest.startDate && viewedRequest.endDate && (
                    <DetailRow label={t('myRequests.rentalPeriod')} value={`${fmtDate(viewedRequest.startDate)} – ${fmtDate(viewedRequest.endDate)}`} />
                  )}
                  {viewedRequest.infoRequestMessage && (
                    <DetailRow label="Information requested" value={viewedRequest.infoRequestMessage} />
                  )}
                  {viewedRequest.idDocuments.length > 0 && (
                    <DetailRow label="Documents submitted" value={viewedRequest.idDocuments.map((d) => d.name).join(', ')} />
                  )}
                  <DetailRow label={t('myRequests.requestedOnLabel')} value={fmtDate(viewedRequest.createdAt)} />
                  <DetailRow
                    label={t('myRequests.responseLabel')}
                    value={viewedRequest.decisionReason || (viewedRequest.status === 'pending' ? t('myRequests.awaitingResponse') : t('myRequests.noResponseNote'))}
                  />
                </Stack>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                {viewedRequest.status === 'info_requested' && (
                  <Button color="primary" variant="contained" startIcon={<Upload />}
                    onClick={() => { setProvideId(viewedRequest.id); setVerification(emptyVerification()); }}
                    sx={{ borderRadius: 2, textTransform: 'none', mr: 'auto' }}>
                    Provide info
                  </Button>
                )}
                {canCancel(viewedRequest) && (
                  <Button color="warning" startIcon={<Cancel />} onClick={() => setCancelId(viewedRequest.id)}
                    sx={{ borderRadius: 2, textTransform: 'none' }}>
                    {t('myRequests.cancelRequest')}
                  </Button>
                )}
                {canDelete(viewedRequest) && (
                  <Button color="error" startIcon={<DeleteForever />} onClick={() => setDeleteId(viewedRequest.id)}
                    sx={{ borderRadius: 2, textTransform: 'none' }}>
                    Delete
                  </Button>
                )}
                <Button onClick={() => setViewId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                  {t('common.close')}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Cancel confirm */}
        <Dialog open={cancelId != null} onClose={() => setCancelId(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('myRequests.cancelTitle')}</DialogTitle>
          <DialogContent><DialogContentText>{t('myRequests.cancelMessage')}</DialogContentText></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCancelId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>{t('common.cancel')}</Button>
            <Button variant="contained" color="warning" startIcon={<Cancel />} disabled={busy}
              onClick={handleCancelConfirm} sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              {t('myRequests.confirmCancel')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={deleteId != null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Delete this request?</DialogTitle>
          <DialogContent><DialogContentText>This permanently removes the request. This cannot be undone.</DialogContentText></DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>{t('common.cancel')}</Button>
            <Button variant="contained" color="error" startIcon={<DeleteForever />} disabled={busy}
              onClick={handleDeleteConfirm} sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Provide requested info */}
        <Dialog open={provideId != null} onClose={() => setProvideId(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Provide more information</DialogTitle>
          <DialogContent dividers>
            <IdentityVerification value={verification} onChange={setVerification} title="Upload the requested document" />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setProvideId(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>{t('common.cancel')}</Button>
            <Button variant="contained" disabled={busy || !isVerificationComplete(verification)}
              onClick={submitProvide} sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}>
              Send information
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={feedback.open} autoHideDuration={4000}
          onClose={() => setFeedback((f) => ({ ...f, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setFeedback((f) => ({ ...f, open: false }))} severity={feedback.severity}>
            {feedback.message}
          </Alert>
        </Snackbar>
      </Box>
    </PageHero>
  );
};

export default MyRequestsPage;
