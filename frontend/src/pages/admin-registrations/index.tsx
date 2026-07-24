import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Divider,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import {
  Email,
  Phone,
  CheckCircle,
  Cancel,
  HourglassEmpty,
  Description,
  DeleteForever,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { listVariants, fadeVariants } from '../../lib/animations';
import Button from '../../components/Common/Button';
import Dialog from '../../components/Common/Dialog';
import { useToast, PageHero, DocumentPreview } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import {
  adminRegistrationApi,
  type RegistrationDetail,
  type RegistrationStatus,
} from '../../services/registrations/api';

type StatusTab = RegistrationStatus | 'all';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_CHIP: Record<
  RegistrationStatus,
  { color: 'warning' | 'success' | 'error'; icon: React.ReactElement }
> = {
  pending: { color: 'warning', icon: <HourglassEmpty fontSize="small" /> },
  approved: { color: 'success', icon: <CheckCircle fontSize="small" /> },
  rejected: { color: 'error', icon: <Cancel fontSize="small" /> },
};

function fullName(r: RegistrationDetail): string {
  const name = `${r.first_name} ${r.last_name}`.trim();
  return name || r.email;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const AdminRegistrationsPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<StatusTab>('pending');
  const [requests, setRequests] = useState<RegistrationDetail[]>([]);
  const [loading, setLoading] = useState(true);

  // Action state
  const [actingId, setActingId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<RegistrationDetail | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RegistrationDetail | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RegistrationDetail | null>(null);
  // The request whose full details are open in the side panel.
  const [selected, setSelected] = useState<RegistrationDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminRegistrationApi.list(tab === 'all' ? undefined : tab);
      setRequests(data);
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Failed to load registrations.';
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [tab, showError]);

  useEffect(() => {
    load();
  }, [load]);

  // Live-sync the list when a registration is submitted/decided (silent refetch).
  useAutoRefresh(() => {
    adminRegistrationApi
      .list(tab === 'all' ? undefined : tab)
      .then(setRequests)
      .catch(() => { /* keep current */ });
  });

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests]
  );

  // Flash the registration card a notification points at.
  const { isHighlighted } = useHighlightTarget(!loading);

  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setActingId(approveTarget.id);
    try {
      await adminRegistrationApi.approve(approveTarget.id);
      showSuccess(`Approved — login credentials emailed to ${approveTarget.email}.`);
      setApproveTarget(null);
      setSelected(null);
      await load();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Approval failed.';
      showError(message);
    } finally {
      setActingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      showError('Please enter a reason so the applicant knows why.');
      return;
    }
    setActingId(rejectTarget.id);
    try {
      await adminRegistrationApi.reject(rejectTarget.id, rejectReason.trim());
      showSuccess(`Rejected — email sent to ${rejectTarget.email}.`);
      setRejectTarget(null);
      setRejectReason('');
      setSelected(null);
      await load();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Rejection failed.';
      showError(message);
    } finally {
      setActingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActingId(deleteTarget.id);
    try {
      await adminRegistrationApi.remove(deleteTarget.id);
      showSuccess('Registration request permanently deleted.');
      setDeleteTarget(null);
      setSelected(null);
      await load();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Delete failed.';
      showError(message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <PageHero
      title="Registration requests"
      subtitle="Review driver, rental and mechanic sign-ups. Approving creates the account and emails login credentials; rejecting emails the applicant your reason."
    >
      <ToggleButtonGroup
        value={tab}
        exclusive
        onChange={(_, v) => v && setTab(v)}
        size="small"
        sx={{ mb: 3, flexWrap: 'wrap' }}
      >
        {STATUS_TABS.map((s) => (
          <ToggleButton key={s.value} value={s.value} sx={{ textTransform: 'none', px: 2 }}>
            {s.label}
            {s.value === 'pending' && pendingCount > 0 && tab === 'pending' ? ` (${pendingCount})` : ''}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <AnimatePresence mode="wait">
        {loading ? (
          <Box key="loading" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : requests.length === 0 ? (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                No {tab === 'all' ? '' : tab} registrations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tab === 'pending'
                  ? 'There are no requests waiting for review right now.'
                  : 'Nothing to show here.'}
              </Typography>
            </Paper>
          </motion.div>
        ) : (
          <motion.div key={tab} variants={listVariants} initial="initial" animate="animate" exit="exit">
            <Stack spacing={2}>
              {requests.map((r) => {
                const chip = STATUS_CHIP[r.status];
                return (
                  <motion.div key={r.id} variants={fadeVariants}>
                    <Paper
                      variant="outlined"
                      onClick={() => setSelected(r)}
                      {...highlightAttrProps(isHighlighted(r.id))}
                      sx={{
                        p: { xs: 2, sm: 3 },
                        borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'box-shadow .2s, border-color .2s',
                        '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
                        ...(isHighlighted(r.id) ? (highlightSx as object) : {}),
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1,
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1.5,
                        }}
                      >
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {fullName(r)}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip size="small" label={r.role_display} color="primary" variant="outlined" />
                            <Chip
                              size="small"
                              icon={chip.icon}
                              label={r.status_display}
                              color={chip.color}
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Submitted {formatDate(r.created_at)}
                        </Typography>
                      </Box>

                      <Divider sx={{ my: 1.5 }} />

                      <Stack spacing={0.75}>
                        <Detail icon={<Email fontSize="small" />} text={r.email} />
                        {r.phone_number && <Detail icon={<Phone fontSize="small" />} text={r.phone_number} />}
                        {r.documents.length > 0 && (
                          <Detail
                            icon={<Description fontSize="small" />}
                            text={`${r.documents.length} document${r.documents.length > 1 ? 's' : ''} attached`}
                          />
                        )}
                      </Stack>

                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
                        {r.status === 'pending' && (
                          <>
                            <Button
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircle />}
                              disabled={actingId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setApproveTarget(r);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<Cancel />}
                              disabled={actingId === r.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectReason('');
                                setRejectTarget(r);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          variant="text"
                          color="error"
                          startIcon={<DeleteForever />}
                          disabled={actingId === r.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(r);
                          }}
                        >
                          Delete
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          View details →
                        </Typography>
                      </Stack>
                    </Paper>
                  </motion.div>
                );
              })}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-detail centered modal (background blurred, only this is in focus) */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? fullName(selected) : undefined}
        maxWidth="sm"
        showActions={false}
        slotProps={{
          backdrop: {
            sx: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
          },
        }}
        customActions={
          selected ? (
            <>
              <Button
                variant="text"
                color="error"
                startIcon={<DeleteForever />}
                disabled={actingId === selected.id}
                onClick={() => setDeleteTarget(selected)}
              >
                Delete
              </Button>
              <Box sx={{ flex: 1 }} />
              {selected.status === 'pending' && (
                <>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    disabled={actingId === selected.id}
                    onClick={() => {
                      setRejectReason('');
                      setRejectTarget(selected);
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    disabled={actingId === selected.id}
                    onClick={() => setApproveTarget(selected)}
                  >
                    Approve
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {selected && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
              <Chip size="small" label={selected.role_display} color="primary" variant="outlined" />
              <Chip
                size="small"
                icon={STATUS_CHIP[selected.status].icon}
                label={selected.status_display}
                color={STATUS_CHIP[selected.status].color}
                variant="outlined"
              />
            </Stack>

            <SectionTitle>Applicant</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone_number} />
              <Field label="Submitted" value={formatDate(selected.created_at)} />
              {selected.reviewed_at && <Field label="Reviewed" value={formatDate(selected.reviewed_at)} />}
            </Stack>

            {(selected.rental_type || selected.company_name || selected.abn) && (
              <>
                <SectionTitle>Rental business</SectionTitle>
                <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
                  {selected.rental_type && <Field label="Type" value={selected.rental_type} />}
                  {selected.company_name && <Field label="Company" value={selected.company_name} />}
                  {selected.abn && <Field label="ABN" value={selected.abn} />}
                </Stack>
              </>
            )}

            {(selected.shop_name || selected.shop_address) && (
              <>
                <SectionTitle>Workshop</SectionTitle>
                <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
                  {selected.shop_name && <Field label="Shop name" value={selected.shop_name} />}
                  {selected.shop_address && <Field label="Address" value={selected.shop_address} />}
                </Stack>
              </>
            )}

            {selected.documents.length > 0 && (
              <>
                <SectionTitle>Documents</SectionTitle>
                <Stack spacing={2} sx={{ mb: 3, mt: 0.5 }}>
                  {selected.documents.map((d) => (
                    <DocumentPreview key={d.id} doc={d} />
                  ))}
                </Stack>
              </>
            )}

            {selected.status === 'rejected' && selected.rejection_reason && (
              <>
                <SectionTitle>Rejection reason</SectionTitle>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selected.rejection_reason}
                </Typography>
              </>
            )}
          </Box>
        )}
      </Dialog>

      {/* Approve confirmation */}
      <Dialog
        open={!!approveTarget}
        onClose={() => (actingId ? undefined : setApproveTarget(null))}
        title="Approve registration?"
        subtitle={
          approveTarget
            ? `An account will be created for ${approveTarget.email} and a password emailed to them.`
            : undefined
        }
        confirmText="Approve & send email"
        cancelText="Cancel"
        confirmColor="success"
        loading={actingId === approveTarget?.id}
        onConfirm={handleApproveConfirm}
        onCancel={() => setApproveTarget(null)}
      >
        <Typography variant="body2" color="text.secondary">
          The applicant will be able to log in using their email{' '}
          <strong>{approveTarget?.email}</strong> and the system-generated password sent in the email.
        </Typography>
      </Dialog>

      {/* Reject with reason */}
      <Dialog
        open={!!rejectTarget}
        onClose={() => (actingId ? undefined : setRejectTarget(null))}
        title="Reject registration"
        subtitle={
          rejectTarget ? `An email with your reason will be sent to ${rejectTarget.email}.` : undefined
        }
        confirmText="Reject & send email"
        cancelText="Cancel"
        confirmColor="error"
        loading={actingId === rejectTarget?.id}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectTarget(null)}
      >
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label="Reason for rejection"
          placeholder="e.g. The uploaded licence was not readable. Please re-apply with a clearer photo."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Dialog>

      {/* Permanent delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => (actingId ? undefined : setDeleteTarget(null))}
        title="Delete this registration request?"
        subtitle={
          deleteTarget
            ? `This permanently removes ${deleteTarget.email}'s request and any uploaded documents. This cannot be undone.`
            : undefined
        }
        confirmText="Delete permanently"
        cancelText="Cancel"
        confirmColor="error"
        loading={actingId === deleteTarget?.id}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      >
        <Typography variant="body2" color="text.secondary">
          {deleteTarget?.status === 'approved'
            ? 'Note: the user account created from this request is not affected — only the request record and its documents are deleted.'
            : 'The applicant will not be notified.'}
        </Typography>
      </Dialog>
    </PageHero>
  );
};

const Detail: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
    <Box sx={{ display: 'flex', color: 'action.active' }}>{icon}</Box>
    <Typography variant="body2">{text}</Typography>
  </Stack>
);

/** Small section heading used inside the detail drawer. */
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.5, display: 'block' }}
  >
    {children}
  </Typography>
);

/** Labelled value row inside the detail drawer. */
const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
      {value || '—'}
    </Typography>
  </Box>
);

export default AdminRegistrationsPage;
