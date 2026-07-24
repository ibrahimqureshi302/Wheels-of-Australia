import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Stack,
  IconButton,
} from '@mui/material';
import { Search, EditOutlined, DeleteOutlined, Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeVariants } from '../../lib/animations';
import { ROUTES } from '../../constants/routes';
import { mechanicsApi } from '../../services/mechanics/api';
import { listMaintenanceRequests } from '../../services/maintenance';
import type { MaintenanceRequest } from '../../services/maintenance/types';
import { useToast, Field, SectionTitle, PageHero, DocumentPreview } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import Dialog from '../../components/Common/Dialog';
import Button from '../../components/Common/Button';
import type { Mechanic } from '../../services/mechanics/types';

const MechanicsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [search, setSearch] = useState('');
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  // The mechanic whose read-only details are open in the popup.
  const [selected, setSelected] = useState<Mechanic | null>(null);
  const [toDelete, setToDelete] = useState<Mechanic | null>(null);
  const [deleting, setDeleting] = useState(false);
  // All maintenance jobs (admin sees every job) — used to show a mechanic's
  // jobs in the detail popup.
  const [jobs, setJobs] = useState<MaintenanceRequest[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    mechanicsApi
      .list()
      .then((data) => { if (active) setMechanics(data); })
      .catch(() => { if (active) showError('Failed to load mechanics.'); })
      .finally(() => { if (active) setLoading(false); });
    listMaintenanceRequests()
      .then((data) => { if (active) setJobs(data); })
      .catch(() => { /* non-fatal — detail just won't show jobs */ });
    return () => { active = false; };
  }, [showError]);

  // Live-sync the list when a mechanic record changes elsewhere (silent refetch).
  useAutoRefresh(() => {
    mechanicsApi.list().then(setMechanics).catch(() => { /* keep current */ });
  });

  const selectedJobs = useMemo(
    () => (selected ? jobs.filter((j) => j.mechanicEmail?.toLowerCase() === selected.email.toLowerCase()) : []),
    [selected, jobs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mechanics;
    return mechanics.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.shopName.toLowerCase().includes(q) ||
        m.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    );
  }, [search, mechanics]);

  // Flash the row a notification points at (no pagination on this page).
  const { isHighlighted } = useHighlightTarget(!loading);

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await mechanicsApi.remove(toDelete.id);
      setMechanics((prev) => prev.filter((m) => m.id !== toDelete.id));
      showSuccess('Mechanic deleted.');
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to delete mechanic.');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <PageHero
      title="Mechanics"
      subtitle={`All registered mechanics (${mechanics.length}).`}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search by name, email, shop or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>) }}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate(ROUTES.ADMIN.MECHANICS_ADD)}
          sx={{
            borderRadius: 2,
            px: 2.5,
            py: 1.25,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: (theme) =>
              theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          Add mechanic
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Shop</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No mechanics found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    hover
                    onClick={() => setSelected(m)}
                    {...highlightAttrProps(isHighlighted(m.id))}
                    sx={{ cursor: 'pointer', ...(isHighlighted(m.id) ? (highlightSx as object) : {}) }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{m.fullName}</TableCell>
                    <TableCell>
                      {m.shopName}
                      {m.shopAddress && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {m.shopAddress}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={m.status === 'active' ? 'Active' : 'Inactive'}
                        color={m.status === 'active' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          aria-label="Edit"
                          onClick={(e) => { e.stopPropagation(); navigate(`${ROUTES.MECHANICS_EDIT_BASE}/${m.id}`); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Delete"
                          onClick={(e) => { e.stopPropagation(); setToDelete(m); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>
      )}

      {/* Read-only details popup (edit via the Edit button) */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.fullName : undefined}
        maxWidth="sm"
        showActions={false}
        slotProps={{ backdrop: { sx: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.45)' } } }}
        customActions={
          selected ? (
            <Button
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={() => {
                const id = selected.id;
                setSelected(null);
                navigate(`${ROUTES.MECHANICS_EDIT_BASE}/${id}`);
              }}
            >
              {t('common.edit')}
            </Button>
          ) : undefined
        }
      >
        {selected && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
              <Chip size="small" label={t('roles.mechanic', 'Mechanic')} color="primary" variant="outlined" />
              <Chip
                size="small"
                label={selected.status === 'active' ? 'Active' : 'Inactive'}
                color={selected.status === 'active' ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>
            <SectionTitle>Mechanic</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label="Full name" value={selected.fullName} />
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone} />
            </Stack>
            <SectionTitle>Workshop</SectionTitle>
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Field label="Shop name" value={selected.shopName} />
              <Field label="Address" value={selected.shopAddress} />
              <Field label="ABN" value={selected.abn} />
            </Stack>

            <Box sx={{ mt: 3 }}>
              <SectionTitle>Documents ({selected.documents.length})</SectionTitle>
              {selected.documents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  No documents on file.
                </Typography>
              ) : (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {selected.documents.map((d) => (
                    <DocumentPreview key={d.id} doc={d} />
                  ))}
                </Stack>
              )}
            </Box>

            <Box sx={{ mt: 3 }}>
              <SectionTitle>Maintenance jobs ({selectedJobs.length})</SectionTitle>
              {selectedJobs.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  No jobs quoted yet.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {selectedJobs.slice(0, 8).map((j) => (
                    <Box key={j.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>{j.vehicleMake} {j.vehicleModel}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {j.quotedPrice != null ? `$${j.quotedPrice.toFixed(2)}` : '—'}
                          {j.estimatedValue ? ` · ${j.estimatedValue} ${j.estimatedUnit}` : ''}
                        </Typography>
                      </Box>
                      <Chip size="small" label={j.statusDisplay} sx={{ textTransform: 'capitalize' }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!toDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
        title="Delete mechanic"
        subtitle={toDelete ? `Permanently remove ${toDelete.fullName}? This cannot be undone.` : undefined}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setToDelete(null)}
      />
    </PageHero>
  );
};

export default MechanicsPage;
