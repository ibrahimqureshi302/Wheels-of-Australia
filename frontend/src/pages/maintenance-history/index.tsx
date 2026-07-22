import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Paper, Button, Stack, CircularProgress } from '@mui/material';
import { Build } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { PageHero, Dialog, useToast, Field, SectionTitle } from '../../components/Common';
import { listVariants, listItemVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import {
  listMaintenanceRequests,
  completeMaintenance,
  maintenanceAvailable,
} from '../../services/maintenance';
import type { MaintenanceRequest } from '../../services/maintenance/types';
import { JobCard, money, duration } from '../maintenance/shared';

// The active (in-progress) states a mechanic's repair can be in. 'running' is
// current; 'accepted' is kept for legacy rows; 'pending_return' is work the
// mechanic finished that the rental hasn't confirmed returned yet. All three
// show under "Running" — the repair isn't closed until the rental confirms.
const RUNNING_STATES = ['running', 'accepted', 'pending_return'];
// States where the mechanic can still click "Complete work".
const COMPLETABLE_STATES = ['running', 'accepted'];

/**
 * Mechanic's Vehicle repair page — shows their repairs in two sections:
 *   - Running: jobs the rental accepted and the mechanic is working on (plus any
 *     finished work still awaiting the rental's return confirmation).
 *   - Completed: jobs the rental confirmed returned; vehicle back to available.
 * Only these two statuses are shown. Click a card for full detail.
 */
const MaintenanceHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const available = maintenanceAvailable();

  const load = useCallback(() => {
    if (!available) { setJobs([]); setLoading(false); return; }
    setLoading(true);
    listMaintenanceRequests().then(setJobs).catch(() => setJobs([])).finally(() => setLoading(false));
  }, [available]);

  // Initial load shows a spinner; then poll every 30s so a job that becomes
  // running or completed appears in real time, without re-flashing the spinner.
  useEffect(() => {
    load();
    if (!available) return;
    const timer = setInterval(() => {
      listMaintenanceRequests().then(setJobs).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [load, available]);

  const myId = String(user?.id ?? '');
  const running = useMemo(
    () => jobs.filter((j) => j.mechanicId === myId && RUNNING_STATES.includes(j.status)),
    [jobs, myId],
  );
  const completed = useMemo(
    () => jobs.filter((j) => j.mechanicId === myId && j.status === 'completed'),
    [jobs, myId],
  );

  const markComplete = async (id: string) => {
    setBusy(true);
    try {
      await completeMaintenance(id);
      showSuccess('Work marked complete — the rental will confirm the return.');
      setSelected(null);
      setConfirmId(null);
      load();
    } catch (err) {
      showError((err as { message?: string })?.message || 'Action failed.');
    } finally { setBusy(false); }
  };

  const empty = running.length === 0 && completed.length === 0;

  return (
    <PageHero title="Vehicle repair" subtitle="Vehicles you're repairing and those you've finished.">
      {!available ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Typography color="text.secondary">Sign in as a mechanic account to see your repairs.</Typography>
        </Paper>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : empty ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, mt: 1 }}>
          <Build sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>No repairs yet</Typography>
          <Typography variant="body2" color="text.secondary">
            When a rental accepts your quote, the job appears here under Running.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={4} sx={{ mt: 1 }}>
          {/* Running repairs */}
          <Box>
            <SectionTitle>Running ({running.length})</SectionTitle>
            {running.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No repairs in progress.
              </Typography>
            ) : (
              <motion.div variants={listVariants} initial="initial" animate="animate">
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {running.map((job) => (
                    <motion.div key={job.id} variants={listItemVariants}>
                      <JobCard job={job} showRental showQuote onClick={() => setSelected(job)}>
                        {COMPLETABLE_STATES.includes(job.status) ? (
                          <Button variant="contained" size="small" color="success" disableElevation
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); setConfirmId(job.id); }}
                            sx={{ borderRadius: 2, textTransform: 'none', mt: 1 }}>
                            Complete work
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Work done — waiting for the rental to confirm the return.
                          </Typography>
                        )}
                      </JobCard>
                    </motion.div>
                  ))}
                </Stack>
              </motion.div>
            )}
          </Box>

          {/* Completed repairs */}
          <Box>
            <SectionTitle>Completed ({completed.length})</SectionTitle>
            {completed.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Jobs the rental confirms returned show here.
              </Typography>
            ) : (
              <motion.div variants={listVariants} initial="initial" animate="animate">
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {completed.map((job) => (
                    <motion.div key={job.id} variants={listItemVariants}>
                      <JobCard job={job} showRental showQuote onClick={() => setSelected(job)} />
                    </motion.div>
                  ))}
                </Stack>
              </motion.div>
            )}
          </Box>
        </Stack>
      )}

      {/* Detail */}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.vehicleMake} ${selected.vehicleModel}` : undefined}
        maxWidth="sm"
        showActions={false}
        customActions={
          selected && COMPLETABLE_STATES.includes(selected.status) ? (
            <Button variant="contained" color="success" disabled={busy} onClick={() => setConfirmId(selected.id)}>
              Complete work
            </Button>
          ) : undefined
        }
      >
        {selected && (
          <Box>
            <SectionTitle>Vehicle</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label="Make & model" value={`${selected.vehicleMake} ${selected.vehicleModel}`} />
              <Field label="Rego" value={selected.vehicleRego} />
              <Field label="Rental" value={selected.rentalName} />
              <Field label="Status" value={selected.statusDisplay} />
            </Stack>
            <SectionTitle>Job</SectionTitle>
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Field label="Work" value={selected.workDescription} />
              <Field label="Price" value={money(selected.quotedPrice)} />
              {duration(selected) && <Field label="Estimated time" value={duration(selected)} />}
              {selected.mechanicNotes && <Field label="Notes" value={selected.mechanicNotes} />}
            </Stack>
          </Box>
        )}
      </Dialog>

      {/* Confirm completing the work */}
      <Dialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title="Mark this vehicle's work complete?"
        subtitle="Confirm the repair is finished. The rental is notified that the vehicle is ready and asked to confirm its return before it becomes available again."
        confirmText="Complete work"
        confirmColor="success"
        loading={busy}
        onConfirm={() => { if (confirmId) markComplete(confirmId); }}
      />
    </PageHero>
  );
};

export default MaintenanceHistoryPage;
