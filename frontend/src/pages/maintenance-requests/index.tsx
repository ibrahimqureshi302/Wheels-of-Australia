import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Stack, CircularProgress,
  ToggleButtonGroup, ToggleButton, IconButton, Tooltip,
} from '@mui/material';
import { Assignment, DeleteOutline } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { PageHero, Dialog, useToast } from '../../components/Common';
import { listVariants, listItemVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import {
  listMaintenanceRequests,
  cancelQuote,
  deleteMaintenanceRequest,
  completeMaintenance,
  provideMaintenanceInfo,
  maintenanceAvailable,
} from '../../services/maintenance';
import type { MaintenanceRequest, MaintenanceStatus } from '../../services/maintenance/types';
import IdentityVerification, {
  emptyVerification,
  isVerificationComplete,
  type VerificationResult,
} from '../../components/Requests/IdentityVerification';
import { JobCard } from '../maintenance/shared';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';

type StatusFilter = 'all' | MaintenanceStatus;
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'info_requested', label: 'Info requested' },
  { value: 'running', label: 'Running' },
  { value: 'pending_return', label: 'Awaiting return' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Mechanic's "My requests" — every quote they've sent, with real status.
 * Cancel withdraws a quote the rental hasn't decided on yet; delete removes a
 * declined or cancelled request (a pending one must be cancelled first).
 */
const MaintenanceRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; kind: 'cancel' | 'delete' | 'complete' } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [provideJob, setProvideJob] = useState<MaintenanceRequest | null>(null);
  const [verification, setVerification] = useState<VerificationResult>(emptyVerification());
  const available = maintenanceAvailable();

  const load = useCallback(() => {
    if (!available) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    listMaintenanceRequests().then(setJobs).catch(() => setJobs([])).finally(() => setLoading(false));
  }, [available]);

  // Initial load shows the spinner; then poll every 30s (like the rental +
  // Active-rentals pages) so quote decisions made by the rental — accept /
  // decline / cancel — surface here without a manual refresh, and a stale card
  // can't offer an action the server will reject.
  useEffect(() => {
    load();
    if (!available) return undefined;
    const timer = setInterval(() => {
      listMaintenanceRequests().then(setJobs).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [load, available]);

  const mine = useMemo(
    () => jobs.filter((j) => j.mechanicId && j.mechanicId === String(user?.id ?? '')),
    [jobs, user],
  );
  const visible = useMemo(
    () => (filter === 'all' ? mine : mine.filter((j) => j.status === filter)),
    [mine, filter],
  );
  // Flash the job a notification deep-linked to (?highlight=<id>).
  const { isHighlighted } = useHighlightTarget(mine.length > 0);

  const submitProvide = async () => {
    if (!provideJob) return;
    if (!isVerificationComplete(verification)) {
      showError('Upload at least one document and confirm the details.');
      return;
    }
    setBusyId(provideJob.id);
    try {
      await provideMaintenanceInfo(provideJob.id, verification.documents, verification.details);
      showSuccess('Information sent — the rental will review your quote again.');
      setProvideJob(null); setVerification(emptyVerification()); load();
    } catch (err) {
      showError((err as { message?: string })?.message || 'Could not send the information.');
    } finally { setBusyId(null); }
  };

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try { await fn(); showSuccess(ok); load(); }
    // Refresh on failure too: a 400 usually means the rental already decided on
    // this quote (accepted/declined) or it was already cancelled, so reload to
    // drop the now-stale card instead of leaving an action that keeps failing.
    catch (err) { showError((err as { message?: string })?.message || 'Action failed.'); load(); }
    finally { setBusyId(null); setConfirm(null); }
  };

  return (
    <PageHero title="My requests" subtitle="Quotes you've sent and their current status.">
      {!available ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Typography color="text.secondary">Sign in as a mechanic account to see your requests.</Typography>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : mine.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Assignment sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No quotes yet</Typography>
          <Typography variant="body2" color="text.secondary">Quotes you send from Active rentals appear here.</Typography>
        </Paper>
      ) : (
        <Box sx={{ mt: 1 }}>
          <ToggleButtonGroup
            value={filter} exclusive size="small"
            onChange={(_, v) => v && setFilter(v)}
            sx={{ mb: 2, flexWrap: 'wrap' }}
          >
            {FILTERS.map((f) => (
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
                <JobCard job={job} showRental showQuote highlighted={isHighlighted(job.id)}>
                  {job.status === 'info_requested' && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {job.infoRequestMessage && (
                        <Typography variant="body2" color="warning.main">
                          Rental asked: {job.infoRequestMessage}
                        </Typography>
                      )}
                      <Box>
                        <Button variant="contained" size="small"
                          onClick={() => { setProvideJob(job); setVerification(emptyVerification()); }}
                          sx={{ borderRadius: 2, textTransform: 'none' }}>
                          Provide info
                        </Button>
                      </Box>
                    </Stack>
                  )}
                  {job.status === 'quoted' && (
                    <Button variant="outlined" size="small" color="warning" disabled={busyId === job.id}
                      onClick={() => setConfirm({ id: job.id, kind: 'cancel' })}
                      sx={{ borderRadius: 2, textTransform: 'none', mt: 1 }}>
                      Cancel quote
                    </Button>
                  )}
                  {(job.status === 'running' || job.status === 'accepted') && (
                    <Button variant="contained" size="small" color="success" disableElevation disabled={busyId === job.id}
                      onClick={() => setConfirm({ id: job.id, kind: 'complete' })}
                      sx={{ borderRadius: 2, textTransform: 'none', mt: 1 }}>
                      Complete work
                    </Button>
                  )}
                  {job.status === 'pending_return' && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Work done — waiting for the rental to confirm the return.
                    </Typography>
                  )}
                  {(job.status === 'declined' || job.status === 'cancelled' || job.status === 'completed') && (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                      {job.status === 'declined' && job.decisionReason && (
                        <Typography variant="body2" color="text.secondary">Declined: {job.decisionReason}</Typography>
                      )}
                      <Tooltip title="Delete request">
                        <span style={{ marginLeft: 'auto' }}>
                          <IconButton size="small" disabled={busyId === job.id}
                            aria-label="Delete request"
                            onClick={() => setConfirm({ id: job.id, kind: 'delete' })}
                            sx={{ color: 'text.secondary' }}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  )}
                </JobCard>
              </motion.div>
            ))}
          </Stack>
          </motion.div>
          )}
        </Box>
      )}

      {/* Provide the info the rental asked for (re-upload + OCR confirm) */}
      <Dialog
        open={provideJob !== null}
        onClose={() => setProvideJob(null)}
        title="Provide more information"
        subtitle={provideJob?.infoRequestMessage ? `Rental asked: ${provideJob.infoRequestMessage}` : undefined}
        confirmText="Send information"
        loading={busyId === provideJob?.id}
        onConfirm={submitProvide}
      >
        <Box sx={{ pt: 1 }}>
          <IdentityVerification value={verification} onChange={setVerification} title="Upload the requested document" />
        </Box>
      </Dialog>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'cancel'
          ? 'Cancel this quote?'
          : confirm?.kind === 'complete'
            ? 'Mark this job complete?'
            : 'Delete this request?'}
        subtitle={confirm?.kind === 'cancel'
          ? 'You can cancel only while the rental has not accepted or declined it.'
          : confirm?.kind === 'complete'
            ? 'Confirm the work is finished. The rental is then asked to confirm the vehicle\'s return before it becomes available.'
            : 'This permanently removes the request.'}
        confirmText={confirm?.kind === 'cancel' ? 'Cancel quote' : confirm?.kind === 'complete' ? 'Complete work' : 'Delete'}
        confirmColor={confirm?.kind === 'cancel' ? 'warning' : confirm?.kind === 'complete' ? 'success' : 'error'}
        loading={busyId === confirm?.id}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'cancel') run(confirm.id, () => cancelQuote(confirm.id), 'Quote cancelled.');
          else if (confirm.kind === 'complete') run(confirm.id, () => completeMaintenance(confirm.id), 'Marked done — the rental will confirm the return.');
          else run(confirm.id, () => deleteMaintenanceRequest(confirm.id), 'Request deleted.');
        }}
      />
    </PageHero>
  );
};

export default MaintenanceRequestsPage;
