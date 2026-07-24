import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Autocomplete,
  Stack,
  CircularProgress,
  MenuItem,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Add, Build, DeleteOutline, CancelOutlined, LockClock, ArrowBack, Storefront } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageHero, Dialog, useToast, Field, SectionTitle } from '../../components/Common';
import { listVariants, listItemVariants, cardVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import { normalizeRole } from '../../constants/roles';
import { listFleet } from '../../services/rental/fleet';
import type { Vehicle } from '../../services/rental/types';
import {
  listMaintenanceRequests,
  createMaintenanceRequest,
  submitQuote,
  acceptQuote,
  declineQuote,
  confirmMaintenanceReturn,
  deleteMaintenanceRequest,
  cancelMaintenanceRequest,
  requestMaintenanceInfo,
  maintenanceAvailable,
} from '../../services/maintenance';
import type { MaintenanceRequest, MaintenanceStatus, DurationUnit } from '../../services/maintenance/types';
import IdentityVerification, {
  emptyVerification,
  isVerificationComplete,
  type VerificationResult,
} from '../../components/Requests/IdentityVerification';
import { ID_DOC_LABELS, openDocument } from '../../services/ocr';
import { JobCard } from './shared';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';

// Shared sizing for the row of per-card action buttons. Compact but comfortable
// — a consistent height/padding so Confirm return, Accept quote, Decline, etc.
// all read as the same size instead of looking cramped.
const COMPACT_BTN = {
  borderRadius: 1.5, textTransform: 'none', fontWeight: 600,
  py: 0.5, px: 1.75, fontSize: '0.8125rem', minHeight: 34, lineHeight: 1.5,
  whiteSpace: 'nowrap',
} as const;

// Status filter for the rental's maintenance list. Each entry matches one or
// more statuses ('running' covers the legacy 'accepted' alias).
type RentalFilter = 'all' | 'pending' | 'quoted' | 'info_requested' | 'running' | 'pending_return' | 'completed' | 'cancelled';
const RENTAL_FILTERS: { value: RentalFilter; label: string; match: MaintenanceStatus[] }[] = [
  { value: 'all', label: 'All', match: [] },
  { value: 'pending', label: 'Awaiting quote', match: ['pending'] },
  { value: 'quoted', label: 'Quoted', match: ['quoted'] },
  { value: 'info_requested', label: 'Info requested', match: ['info_requested'] },
  { value: 'running', label: 'In progress', match: ['running', 'accepted'] },
  { value: 'pending_return', label: 'Awaiting return', match: ['pending_return'] },
  { value: 'completed', label: 'Completed', match: ['completed'] },
  { value: 'cancelled', label: 'Cancelled', match: ['cancelled', 'declined'] },
];

// --- rental cancel/delete gating --------------------------------------------
/** When an accepted job's work window ends = decidedAt + the mechanic's estimate.
 * While inside that window the rental's cancel/delete buttons stay locked. */
function acceptedUnlockMs(job: MaintenanceRequest): number | null {
  if (!['running', 'accepted'].includes(job.status) || !job.decidedAt || !job.estimatedValue || !job.estimatedUnit) return null;
  const base = new Date(job.decidedAt).getTime();
  if (Number.isNaN(base)) return null;
  const perUnit = job.estimatedUnit === 'hours' ? 3_600_000 : 86_400_000;
  return base + job.estimatedValue * perUnit;
}
/** Rental may cancel only while the request is still pending (before any quote). */
function rentalCanCancel(job: MaintenanceRequest): boolean {
  return job.status === 'pending';
}
/** Rental may delete only a closed request — cancelled or completed. */
function rentalCanDelete(job: MaintenanceRequest): boolean {
  return ['cancelled', 'completed'].includes(job.status);
}
/** Tooltip explaining why Cancel is disabled. */
function cancelDisabledReason(job: MaintenanceRequest): string {
  if (['quoted', 'info_requested'].includes(job.status))
    return 'A mechanic has quoted — decline the quote instead of cancelling.';
  if (['running', 'accepted', 'pending_return'].includes(job.status))
    return 'Work is under way — this can no longer be cancelled.';
  return 'This request is already closed.';
}
/** Tooltip explaining why Delete is disabled. */
function deleteDisabledReason(job: MaintenanceRequest): string {
  if (job.status === 'pending') return 'Cancel the request first, then you can delete it.';
  return 'Only a cancelled or completed request can be deleted.';
}

// --- page -------------------------------------------------------------------
const MaintenancePage: React.FC = () => {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isRental = role === 'rental';
  const isMechanic = role === 'mechanic';
  const { showSuccess, showError } = useToast();

  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const available = maintenanceAvailable();

  const load = useCallback(() => {
    if (!available) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    listMaintenanceRequests().then(setJobs).catch(() => setJobs([])).finally(() => setLoading(false));
  }, [available]);

  // Initial load shows a spinner; then poll every 30s so quote / decline /
  // accept transitions surface in real time on both the rental and mechanic
  // sides without re-flashing the spinner.
  useEffect(() => {
    load();
    if (!available) return;
    const timer = setInterval(() => {
      listMaintenanceRequests().then(setJobs).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [load, available]);

  return (
    <PageHero
      title={isMechanic ? 'Active rentals' : 'Maintenance'}
      subtitle={
        isMechanic
          ? 'Rentals with vehicles waiting for a quote — send your price and time.'
          : 'Send a vehicle for maintenance and review mechanic quotes.'
      }
    >
      {!available ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Build sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>Maintenance runs on a real account</Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in as a rental or mechanic account (created by the admin) to use maintenance.
          </Typography>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isMechanic ? (
        <ActiveRentalsView jobs={jobs} reload={load} showSuccess={showSuccess} showError={showError} />
      ) : isRental ? (
        <RentalView jobs={jobs} reload={load} showSuccess={showSuccess} showError={showError} />
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Typography color="text.secondary">Maintenance is for rental and mechanic accounts.</Typography>
        </Paper>
      )}
    </PageHero>
  );
};

interface ViewProps {
  jobs: MaintenanceRequest[];
  reload: () => void;
  showSuccess: (m: string) => void;
  showError: (m: string | object) => void;
}

// ============================================================================
// Rental view: send a vehicle for maintenance + accept/decline quotes
// ============================================================================
const RentalView: React.FC<ViewProps> = ({ jobs, reload, showSuccess, showError }) => {
  const { isHighlighted } = useHighlightTarget(jobs.length > 0);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [work, setWork] = useState('');
  const [saving, setSaving] = useState(false);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [infoId, setInfoId] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Job details dialog (opened by clicking any maintenance card).
  const [detailsJob, setDetailsJob] = useState<MaintenanceRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null);
  // Status filter, mirrored in the URL so a dashboard card can deep-link to a
  // filtered maintenance list (e.g. `/maintenance?status=pending`).
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: RentalFilter =
    (RENTAL_FILTERS.find((f) => f.value === searchParams.get('status'))?.value) ?? 'all';
  const setFilter = (next: RentalFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => { listFleet().then(setFleet).catch(() => setFleet([])); }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return jobs;
    const match = RENTAL_FILTERS.find((f) => f.value === filter)?.match ?? [];
    return jobs.filter((j) => match.includes(j.status));
  }, [jobs, filter]);

  const openVehicleIds = useMemo(
    () => new Set(jobs.filter((j) => ['pending', 'quoted', 'running', 'accepted', 'pending_return'].includes(j.status)).map((j) => j.vehicleId)),
    [jobs],
  );
  const selectable = fleet.filter((v) => v.status === 'available' && !openVehicleIds.has(v.id));

  const submitSend = async () => {
    if (!vehicle || !work.trim()) { showError('Pick a vehicle and describe the work.'); return; }
    setSaving(true);
    try {
      await createMaintenanceRequest(vehicle.id, work.trim());
      showSuccess('Vehicle sent for maintenance. A mechanic can now quote.');
      setSendOpen(false); setVehicle(null); setWork(''); reload();
    } catch (err) {
      showError((err as { message?: string })?.message || 'Could not send for maintenance.');
    } finally { setSaving(false); }
  };

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try { await fn(); showSuccess(ok); reload(); }
    catch (err) { showError((err as { message?: string })?.message || 'Action failed.'); }
    finally { setBusyId(null); }
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setSendOpen(true)}
          sx={{ borderRadius: 2, px: 2.5, py: 1.25, fontWeight: 600, textTransform: 'none' }}>
          Send vehicle to maintenance
        </Button>
      </Box>

      {jobs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Build sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No maintenance jobs yet</Typography>
          <Typography variant="body2" color="text.secondary">Send one of your vehicles for maintenance and write the work needed.</Typography>
        </Paper>
      ) : (
        <>
          <ToggleButtonGroup
            value={filter} exclusive size="small"
            onChange={(_, v) => v && setFilter(v)}
            sx={{ mb: 2, flexWrap: 'wrap' }}
          >
            {RENTAL_FILTERS.map((f) => (
              <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 1.75 }}>
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {visible.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No requests with this status.
            </Typography>
          ) : (
          <motion.div key={filter} variants={listVariants} initial="initial" animate="animate">
          <Stack spacing={2}>
            {visible.map((job) => (
              <motion.div key={job.id} variants={listItemVariants}>
                <JobCard job={job} onClick={() => setDetailsJob(job)} highlighted={isHighlighted(job.id)}>
                  {/* One short status line, then the details link, then actions. */}
                  {job.status === 'pending' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Open for quotes — any mechanic can send one. Each quote appears as its own
                      card here; accept one to start the repair (the rest are then declined
                      automatically).
                    </Typography>
                  )}
                  {job.status === 'info_requested' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Waiting for the mechanic to provide more information.
                    </Typography>
                  )}
                  {['running', 'accepted'].includes(job.status) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      In progress — the mechanic is working on this and will mark it complete.
                    </Typography>
                  )}
                  {job.status === 'pending_return' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      The mechanic marked the work done. Confirm the return to make the vehicle available again.
                    </Typography>
                  )}
                  {job.status === 'declined' && job.decisionReason && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{job.decisionReason}</Typography>
                  )}
                  <Typography variant="body2" color="primary.main"
                    sx={{ display: 'inline-block', fontWeight: 600, mt: 0.75, '&:hover': { textDecoration: 'underline' } }}>
                    {job.mechanicName ? 'View mechanic & quote details →' : 'View details →'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} alignItems="center">
                    {job.status === 'quoted' && (
                      <>
                        <Button variant="contained" size="small" disableElevation disabled={busyId === job.id}
                          onClick={(e) => { e.stopPropagation(); act(job.id, () => acceptQuote(job.id), 'Quote accepted — vehicle moved to maintenance.'); }}
                          sx={COMPACT_BTN}>Accept quote</Button>
                        <Button variant="outlined" size="small" color="error" disabled={busyId === job.id}
                          onClick={(e) => { e.stopPropagation(); setDeclineId(job.id); setDeclineReason(''); }}
                          sx={COMPACT_BTN}>Decline</Button>
                        <Button variant="text" size="small" disabled={busyId === job.id}
                          onClick={(e) => { e.stopPropagation(); setInfoId(job.id); setInfoMessage(''); }}
                          sx={COMPACT_BTN}>Request more info</Button>
                      </>
                    )}
                    {job.status === 'pending_return' && (
                      <Button variant="contained" size="small" disableElevation color="success" disabled={busyId === job.id}
                        onClick={(e) => { e.stopPropagation(); setConfirmReturnId(job.id); }}
                        sx={COMPACT_BTN}>Confirm return</Button>
                    )}
                    <Box sx={{ flex: 1 }} />

                    {/* Cancel: enabled only while the request is still pending. */}
                    {rentalCanCancel(job) ? (
                      <Button variant="text" size="small" color="warning" startIcon={<CancelOutlined />} disabled={busyId === job.id}
                        onClick={(e) => { e.stopPropagation(); setCancelId(job.id); }}
                        sx={COMPACT_BTN}>Cancel</Button>
                    ) : (
                      <Tooltip title={cancelDisabledReason(job)}>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button variant="text" size="small" color="warning" startIcon={<LockClock />} disabled
                            sx={COMPACT_BTN}>Cancel</Button>
                        </span>
                      </Tooltip>
                    )}

                    {/* Delete: enabled only once the request is cancelled or completed. */}
                    {rentalCanDelete(job) ? (
                      <Button variant="text" size="small" color="error" startIcon={<DeleteOutline />} disabled={busyId === job.id}
                        onClick={(e) => { e.stopPropagation(); setDeleteId(job.id); }}
                        sx={COMPACT_BTN}>Delete</Button>
                    ) : (
                      <Tooltip title={deleteDisabledReason(job)}>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button variant="text" size="small" color="error" startIcon={<LockClock />} disabled
                            sx={COMPACT_BTN}>Delete</Button>
                        </span>
                      </Tooltip>
                    )}
                  </Stack>
                </JobCard>
              </motion.div>
            ))}
          </Stack>
          </motion.div>
          )}
        </>
      )}

      <Dialog open={sendOpen} onClose={() => setSendOpen(false)}
        title="Send a vehicle for maintenance"
        subtitle="Pick an available vehicle and describe the work needed. A mechanic will quote a price and time."
        onConfirm={submitSend} confirmText="Send for maintenance" loading={saving}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete options={selectable} value={vehicle} onChange={(_, v) => setVehicle(v)}
            getOptionLabel={(v) => `${v.make} ${v.model} (${v.rego})`}
            isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="No available vehicles to send"
            renderInput={(params) => <TextField {...params} label="Vehicle" placeholder="Choose a vehicle" />} />
          <TextField label="Work needed" placeholder="e.g. Oil change and full service; check brakes"
            value={work} onChange={(e) => setWork(e.target.value)} multiline minRows={3} fullWidth />
        </Stack>
      </Dialog>

      <Dialog open={declineId !== null} onClose={() => setDeclineId(null)}
        title="Decline this quote"
        subtitle="This rejects the mechanic's quote and reopens the job for new quotes. The vehicle's status is unchanged."
        confirmText="Decline quote" confirmColor="error" loading={busyId === declineId}
        onConfirm={() => { const id = declineId; if (!id) return; setDeclineId(null); act(id, () => declineQuote(id, declineReason.trim()), 'Quote declined — the job is open for new quotes.'); }}>
        <TextField label="Reason (optional)" placeholder="Let the mechanic know why"
          value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} multiline minRows={2} fullWidth sx={{ mt: 1 }} />
      </Dialog>

      {/* Full details for the selected job (clickable from any card) */}
      <Dialog open={detailsJob !== null} onClose={() => setDetailsJob(null)}
        title="Maintenance details" showActions={false}
        subtitle={detailsJob ? `${detailsJob.vehicleMake} ${detailsJob.vehicleModel} (${detailsJob.vehicleRego})` : ''}>
        {detailsJob && (
          <Box>
            <SectionTitle>Job</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 2, mt: 0.5 }}>
              <Field label="Status" value={detailsJob.statusDisplay} />
              <Field label="Work requested" value={detailsJob.workDescription} />
              {['running', 'accepted'].includes(detailsJob.status) && acceptedUnlockMs(detailsJob) && (
                <Field label="Estimated completion" value={new Date(acceptedUnlockMs(detailsJob) as number).toLocaleString()} />
              )}
              {detailsJob.status === 'pending_return' && detailsJob.workCompletedAt && (
                <Field label="Work marked done" value={new Date(detailsJob.workCompletedAt).toLocaleString()} />
              )}
              {detailsJob.status === 'declined' && detailsJob.decisionReason && (
                <Field label="Decline reason" value={detailsJob.decisionReason} />
              )}
            </Stack>
            {detailsJob.mechanicName ? (
              <>
                <SectionTitle>Mechanic</SectionTitle>
                <Stack spacing={1.25} sx={{ mb: 2, mt: 0.5 }}>
                  <Field label="Name" value={detailsJob.mechanicName || '—'} />
                  <Field label="Shop" value={detailsJob.mechanicShop || '—'} />
                  <Field label="Shop address" value={detailsJob.mechanicShopAddress || '—'} />
                  <Field label="Email" value={detailsJob.mechanicEmail || '—'} />
                  <Field label="Phone" value={detailsJob.mechanicPhone || '—'} />
                  <Field label="ABN" value={detailsJob.mechanicAbn || '—'} />
                </Stack>
                <SectionTitle>Quote</SectionTitle>
                <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                  <Field label="Price" value={detailsJob.quotedPrice != null ? `$${detailsJob.quotedPrice.toFixed(2)}` : '—'} />
                  <Field label="Estimated time" value={detailsJob.estimatedValue ? `${detailsJob.estimatedValue} ${detailsJob.estimatedUnit}` : '—'} />
                  {detailsJob.mechanicNotes && <Field label="Mechanic notes" value={detailsJob.mechanicNotes} />}
                </Stack>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No mechanic has quoted yet. You'll be notified when a quote arrives.
              </Typography>
            )}
            {(detailsJob.idDocuments.length > 0 || detailsJob.verifiedDetails) && (
              <>
                <SectionTitle>Identity verification</SectionTitle>
                <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                  {detailsJob.verifiedDetails && (
                    <>
                      <Field label="Verified name" value={detailsJob.verifiedDetails.fullName || '—'} />
                      <Field label="Date of birth" value={detailsJob.verifiedDetails.dateOfBirth || '—'} />
                      <Field label="Document number" value={detailsJob.verifiedDetails.documentNumber || '—'} />
                      <Field label="Expiry" value={detailsJob.verifiedDetails.expiryDate || '—'} />
                    </>
                  )}
                  {detailsJob.idDocuments.map((d, i) => (
                    <Box key={i} component="button" type="button" onClick={() => openDocument(d.image)}
                      sx={{ display: 'block', fontSize: 14, color: 'primary.main', background: 'none',
                        border: 'none', p: 0, textAlign: 'left', cursor: 'pointer',
                        textDecoration: 'underline', '&:hover': { opacity: 0.85 } }}>
                      {ID_DOC_LABELS[d.docType] || d.docType}: {d.name}
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Box>
        )}
      </Dialog>

      {/* Cancel a maintenance request (before it is accepted) */}
      <Dialog open={cancelId !== null} onClose={() => setCancelId(null)}
        title="Cancel this maintenance request?" subtitle="The request is withdrawn and the vehicle returns to available. This keeps a cancelled record you can delete later."
        confirmText="Cancel request" confirmColor="error" loading={busyId === cancelId}
        onConfirm={() => { const id = cancelId; if (!id) return; setCancelId(null); act(id, () => cancelMaintenanceRequest(id), 'Request cancelled — the vehicle is available again.'); }} />

      {/* Confirm the vehicle's return after the mechanic finished */}
      <Dialog open={confirmReturnId !== null} onClose={() => setConfirmReturnId(null)}
        title="Confirm the vehicle's return?"
        subtitle="Confirm only once the vehicle is physically back from the mechanic. This closes the job and makes the vehicle available to rent again."
        confirmText="Confirm return" loading={busyId === confirmReturnId}
        onConfirm={() => { const id = confirmReturnId; if (!id) return; setConfirmReturnId(null); act(id, () => confirmMaintenanceReturn(id), 'Return confirmed — vehicle is available again.'); }} />

      {/* Request more info from the mechanic */}
      <Dialog open={infoId !== null} onClose={() => setInfoId(null)}
        title="Request more information" subtitle="Tell the mechanic what extra detail or document you need."
        confirmText="Send request" loading={busyId === infoId}
        onConfirm={() => {
          const id = infoId; const msg = infoMessage.trim();
          if (!id || !msg) { showError('Write what you need first.'); return; }
          setInfoId(null);
          act(id, () => requestMaintenanceInfo(id, msg), 'Sent — the mechanic has been asked for more info.');
        }}>
        <TextField label="What do you need?" placeholder="e.g. Please share a photo of your trade certificate"
          value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} multiline minRows={2} fullWidth sx={{ mt: 1 }} />
      </Dialog>

      {/* Delete a maintenance request */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}
        title="Delete this maintenance request?" subtitle="This permanently removes the request. This cannot be undone."
        confirmText="Delete" confirmColor="error" loading={busyId === deleteId}
        onConfirm={() => { const id = deleteId; if (!id) return; setDeleteId(null); act(id, () => deleteMaintenanceRequest(id), 'Maintenance request deleted.'); }} />
    </Box>
  );
};

// ============================================================================
// Mechanic view: open pool grouped by rental, with quote submission
// ============================================================================
const ActiveRentalsView: React.FC<ViewProps> = ({ jobs, reload, showSuccess, showError }) => {
  const { user } = useAuth();
  const myId = String(user?.id ?? '');
  const { isHighlighted } = useHighlightTarget(jobs.length > 0);
  // This mechanic's own quotes that are still awaiting the rental's response.
  // They stay visible as "Pending request" so the mechanic can't re-quote the
  // same vehicle while one is outstanding. (Backend scoping already limits
  // non-pending jobs to this mechanic, but we double-check the owner.)
  const myPending = useMemo(
    () => jobs.filter((j) => j.mechanicId === myId && ['quoted', 'info_requested'].includes(j.status)),
    [jobs, myId],
  );
  // Vehicles I've already quoted (awaiting a decision) — the shared 'pending'
  // pool row for these stays open for OTHER mechanics, but I mustn't see it as
  // quotable again while my own quote is live.
  const myActiveVehicleIds = useMemo(
    () => new Set(myPending.map((j) => j.vehicleId)),
    [myPending],
  );
  // Vehicles still open for a quote (quotable by anyone) — every rental's open
  // pool, minus the ones I already have a live quote on.
  const openJobs = useMemo(
    () => jobs.filter((j) => j.status === 'pending' && !myActiveVehicleIds.has(j.vehicleId)),
    [jobs, myActiveVehicleIds],
  );
  const relevant = useMemo(() => [...openJobs, ...myPending], [openJobs, myPending]);
  // Group everything shown here by rental name.
  const byRental = useMemo(() => {
    const map = new Map<string, MaintenanceRequest[]>();
    relevant.forEach((j) => {
      const list = map.get(j.rentalName) || [];
      list.push(j);
      map.set(j.rentalName, list);
    });
    return Array.from(map.entries());
  }, [relevant]);

  // Two-level browse (like the driver's Rent-a-vehicle flow): pick a rental →
  // see its vehicles → open a vehicle for details → send a quote.
  const [selectedRental, setSelectedRental] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<MaintenanceRequest | null>(null);
  const selectedList = useMemo(
    () => byRental.find(([name]) => name === selectedRental)?.[1] ?? [],
    [byRental, selectedRental],
  );
  // If the selected rental's pool empties (e.g. after quoting), drop back to the list.
  useEffect(() => {
    if (selectedRental && selectedList.length === 0) setSelectedRental(null);
  }, [selectedRental, selectedList]);

  const [quoteJob, setQuoteJob] = useState<MaintenanceRequest | null>(null);
  const [price, setPrice] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<DurationUnit>('days');
  const [notes, setNotes] = useState('');
  const [verification, setVerification] = useState<VerificationResult>(emptyVerification());
  const [saving, setSaving] = useState(false);

  const openQuote = (job: MaintenanceRequest) => {
    setDetailJob(null);
    setQuoteJob(job); setPrice(''); setValue(''); setUnit('days'); setNotes('');
    setVerification(emptyVerification());
  };

  const submit = async () => {
    if (!quoteJob) return;
    const priceNum = Number(price);
    const valueNum = Number(value);
    if (!price || Number.isNaN(priceNum) || priceNum < 0) { showError('Enter a valid price.'); return; }
    if (!value || Number.isNaN(valueNum) || valueNum <= 0) { showError('Enter how long it will take.'); return; }
    if (!isVerificationComplete(verification)) {
      showError('Upload at least one identity document and confirm the details.');
      return;
    }
    setSaving(true);
    try {
      await submitQuote(quoteJob.id, {
        quotedPrice: priceNum, estimatedValue: valueNum, estimatedUnit: unit, mechanicNotes: notes.trim(),
        idDocuments: verification.documents, verifiedDetails: verification.details,
      });
      showSuccess('Quote sent to the rental.');
      setQuoteJob(null); reload();
    } catch (err) {
      showError((err as { message?: string })?.message || 'Could not send quote.');
    } finally { setSaving(false); }
  };

  if (relevant.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
        <Build sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" gutterBottom>No vehicles waiting for a quote</Typography>
        <Typography variant="body2" color="text.secondary">When a rental flags a vehicle for maintenance, it shows here.</Typography>
      </Paper>
    );
  }

  const gridSx = {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
    gap: { xs: 2, sm: 2.5, md: 3 },
    width: '100%',
  } as const;

  return (
    <Box sx={{ mt: 1 }}>
      {selectedRental === null ? (
        // Level 1 — rentals with vehicles waiting (shown as company cards).
        <Box sx={gridSx}>
          {byRental.map(([rentalName, list], index) => (
            <motion.div key={rentalName} variants={cardVariants} initial="initial" animate="animate"
              transition={{ delay: Math.min(index * 0.04, 0.2) }} style={{ minWidth: 0 }}>
              <Paper variant="outlined" onClick={() => setSelectedRental(rentalName)}
                sx={{
                  p: 2.5, borderRadius: 2, cursor: 'pointer', height: '100%',
                  display: 'flex', flexDirection: 'column', gap: 1.5,
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  '&:hover': { boxShadow: 3, borderColor: 'primary.main' },
                }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Storefront />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{rentalName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {list.length} vehicle{list.length === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ alignSelf: 'flex-end' }}>
                  View vehicles →
                </Typography>
              </Paper>
            </motion.div>
          ))}
        </Box>
      ) : (
        // Level 2 — the selected rental's vehicles; click one for details.
        <Box>
          <Button startIcon={<ArrowBack />} onClick={() => setSelectedRental(null)}
            sx={{ borderRadius: 2, textTransform: 'none', mb: 2 }}>All rentals</Button>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
            {selectedRental} <Typography component="span" color="text.secondary">({selectedList.length})</Typography>
          </Typography>
          <motion.div variants={listVariants} initial="initial" animate="animate">
            <Stack spacing={2}>
              {selectedList.map((job) => (
                <motion.div key={job.id} variants={listItemVariants}>
                  <JobCard job={job} showQuote onClick={() => setDetailJob(job)} highlighted={isHighlighted(job.id)}>
                    {job.status === 'pending' ? (
                      <Typography variant="body2" color="primary.main"
                        sx={{ display: 'inline-block', fontWeight: 600, mt: 1, '&:hover': { textDecoration: 'underline' } }}>
                        View details & send quote →
                      </Typography>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap">
                        <Chip size="small" color="info" label="Pending request" sx={{ fontWeight: 600 }} />
                        <Typography variant="caption" color="text.secondary">
                          {job.status === 'info_requested'
                            ? 'The rental asked for more info — respond from My requests.'
                            : 'Waiting for the rental to respond. You can’t send another quote yet.'}
                        </Typography>
                      </Stack>
                    )}
                  </JobCard>
                </motion.div>
              ))}
            </Stack>
          </motion.div>
        </Box>
      )}

      {/* Vehicle details → send a quote */}
      <Dialog open={detailJob !== null} onClose={() => setDetailJob(null)}
        title="Vehicle details" showActions={false}
        subtitle={detailJob ? `${detailJob.vehicleMake} ${detailJob.vehicleModel} (${detailJob.vehicleRego})` : ''}>
        {detailJob && (
          <Box>
            <SectionTitle>Vehicle</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 2, mt: 0.5 }}>
              <Field label="Vehicle" value={`${detailJob.vehicleMake} ${detailJob.vehicleModel}`} />
              <Field label="Rego" value={detailJob.vehicleRego || '—'} />
              <Field label="Rental" value={detailJob.rentalName} />
              <Field label="Status" value={detailJob.statusDisplay} />
            </Stack>
            <SectionTitle>Work requested</SectionTitle>
            <Typography variant="body2" sx={{ mt: 0.5, mb: 2 }}>{detailJob.workDescription}</Typography>
            {detailJob.status === 'pending' ? (
              <Button variant="contained" startIcon={<Build />} onClick={() => openQuote(detailJob)}
                sx={{ borderRadius: 2, textTransform: 'none' }}>Send quote</Button>
            ) : (
              <>
                <SectionTitle>Your quote</SectionTitle>
                <Stack spacing={1.25} sx={{ mt: 0.5, mb: 2 }}>
                  <Field label="Price" value={detailJob.quotedPrice != null ? `$${detailJob.quotedPrice.toFixed(2)}` : '—'} />
                  <Field label="Estimated time" value={detailJob.estimatedValue ? `${detailJob.estimatedValue} ${detailJob.estimatedUnit}` : '—'} />
                  {detailJob.mechanicNotes && <Field label="Notes" value={detailJob.mechanicNotes} />}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="info" label="Pending request" sx={{ fontWeight: 600 }} />
                  <Typography variant="body2" color="text.secondary">
                    {detailJob.status === 'info_requested'
                      ? 'The rental asked for more information — respond from My requests.'
                      : 'Waiting for the rental to accept or decline. You can’t send another quote for this vehicle until then.'}
                  </Typography>
                </Stack>
              </>
            )}
          </Box>
        )}
      </Dialog>

      <Dialog open={quoteJob !== null} onClose={() => setQuoteJob(null)} title="Send a quote"
        subtitle={quoteJob ? `${quoteJob.vehicleMake} ${quoteJob.vehicleModel} (${quoteJob.vehicleRego})` : ''}
        onConfirm={submit} confirmText="Send quote" loading={saving}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {quoteJob && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary">Work requested</Typography>
              <Typography variant="body2">{quoteJob.workDescription}</Typography>
            </Paper>
          )}
          <TextField label="Price (AUD)" type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label="Estimated time" type="number" value={value} onChange={(e) => setValue(e.target.value)} sx={{ flex: 1 }} />
            <TextField select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as DurationUnit)} sx={{ width: 140 }}>
              <MenuItem value="hours">Hours</MenuItem>
              <MenuItem value="days">Days</MenuItem>
            </TextField>
          </Stack>
          <TextField label="Notes (optional)" placeholder="Anything the rental should know"
            value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            <IdentityVerification value={verification} onChange={setVerification} />
          </Box>
        </Stack>
      </Dialog>
    </Box>
  );
};

export default MaintenancePage;
