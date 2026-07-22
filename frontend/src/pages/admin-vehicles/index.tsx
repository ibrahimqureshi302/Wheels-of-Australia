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
  Stack,
  Avatar,
  CircularProgress,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Search, DirectionsCar, EditOutlined, DeleteOutlined, Add } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { fadeVariants } from '../../lib/animations';
import { ROUTES } from '../../constants/routes';
import { adminVehiclesApi, type AdminVehicleRow } from '../../services/vehicles/api';
import { useToast, Field, SectionTitle, PageHero } from '../../components/Common';
import { useHighlightTarget, highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import Dialog from '../../components/Common/Dialog';
import Button from '../../components/Common/Button';

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  available: 'success',
  rented: 'warning',
  maintenance: 'default',
};

/** Maps an insurance type to the suffix of its `fleet.insurance*` i18n key. */
const INSURANCE_LABEL: Record<string, string> = {
  ctp: 'Ctp',
  third_party_property: 'ThirdPartyProperty',
  third_party_fire_theft: 'ThirdPartyFireTheft',
  comprehensive: 'Comprehensive',
};

/** Format a stored date ("2026-06-22") as "22 Jun 2026" without timezone drift.
 * Returns "—" when empty so the table reads cleanly (mirrors the rental Fleet table). */
function formatDate(iso?: string): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const AdminVehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [search, setSearch] = useState('');
  // Status filter, mirrored in the URL so the admin dashboard "Vehicles by
  // status" chart can deep-link to a filtered list (e.g. `?status=maintenance`).
  const [searchParams, setSearchParams] = useSearchParams();
  const VEHICLE_STATUSES = ['available', 'rented', 'pending_return', 'maintenance'] as const;
  const statusFilter = (VEHICLE_STATUSES as readonly string[]).includes(searchParams.get('status') || '')
    ? (searchParams.get('status') as string)
    : 'all';
  const setStatusFilter = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };
  const [vehicles, setVehicles] = useState<AdminVehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  // The vehicle whose read-only details are open in the popup.
  const [selected, setSelected] = useState<AdminVehicleRow | null>(null);
  const [toDelete, setToDelete] = useState<AdminVehicleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminVehiclesApi
      .list()
      .then((data) => { if (active) setVehicles(data); })
      .catch(() => { if (active) showError('Failed to load vehicles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showError]);

  // Keep the list in sync when another user changes a vehicle (silent refetch).
  useAutoRefresh(() => {
    adminVehiclesApi.list().then(setVehicles).catch(() => { /* keep current */ });
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        `${v.make} ${v.model}`.toLowerCase().includes(q) ||
        v.rego.toLowerCase().includes(q) ||
        v.rentalName.toLowerCase().includes(q)
      );
    });
  }, [search, vehicles, statusFilter]);

  // Flash the row a notification points at (no pagination on this page).
  const { isHighlighted } = useHighlightTarget(!loading);

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminVehiclesApi.remove(toDelete.id);
      setVehicles((prev) => prev.filter((v) => v.id !== toDelete.id));
      showSuccess('Vehicle deleted.');
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to delete vehicle.');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <PageHero
      title="Vehicles"
      subtitle={`All vehicles across every rental (${vehicles.length}), with the rental each one belongs to.`}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search by vehicle, rego or rental"
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
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl
          size="small"
          sx={{
            minWidth: 160,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
        >
          <InputLabel id="admin-vehicle-status">Status</InputLabel>
          <Select
            labelId="admin-vehicle-status"
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="available">Available</MenuItem>
            <MenuItem value="rented">Rented</MenuItem>
            <MenuItem value="pending_return">Pending return</MenuItem>
            <MenuItem value="maintenance">Maintenance</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate(ROUTES.ADMIN.VEHICLES_ADD)}
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
          Add vehicle
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table sx={{ width: '100%', tableLayout: 'fixed', minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: '16%' }}>Vehicle</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '6%' }}>Rego</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '12%' }}>Rental</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '9%' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '9%' }} align="right">{t('distance.totalDistance')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '7%', pr: 4 }} align="right">{t('distance.trips')}</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '8%' }}>Last oil change</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '9%' }}>Last rego payment</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '9%' }}>Rego expiry</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '7%' }} align="right">
                  Price / day
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: '8%' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No vehicles found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((v) => (
                  <TableRow
                    key={v.id}
                    hover
                    onClick={() => setSelected(v)}
                    {...highlightAttrProps(isHighlighted(v.id))}
                    sx={{ cursor: 'pointer', ...(isHighlighted(v.id) ? (highlightSx as object) : {}) }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar variant="rounded" src={v.imageUrl} sx={{ bgcolor: 'action.hover', color: 'action.active' }}>
                          <DirectionsCar fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {v.make} {v.model}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {v.year}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{v.rego}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{v.rentalName}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={v.status}
                        color={STATUS_COLOR[v.status] ?? 'default'}
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {v.totalDistanceKm != null ? `${v.totalDistanceKm.toLocaleString()} km` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', pr: 4 }}>
                      {v.trips != null ? v.trips : '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(v.lastOilChangeDate)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(v.lastRegoPaymentDate)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(v.regoDueDate)}</TableCell>
                    <TableCell align="right">
                      {v.rentPricePerDay != null ? `$${v.rentPricePerDay}` : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          aria-label="Edit"
                          onClick={(e) => { e.stopPropagation(); navigate(`${ROUTES.VEHICLES_EDIT_BASE}/${v.id}`); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Delete"
                          onClick={(e) => { e.stopPropagation(); setToDelete(v); }}
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

      {/* Read-only details popup */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.make} ${selected.model}` : undefined}
        maxWidth="sm"
        showActions={false}
        slotProps={{
          backdrop: { sx: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15, 23, 42, 0.45)' } },
        }}
        customActions={
          selected ? (
            <Button
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={() => {
                const id = selected.id;
                setSelected(null);
                navigate(`${ROUTES.VEHICLES_EDIT_BASE}/${id}`);
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
              <Chip
                size="small"
                label={selected.status}
                color={STATUS_COLOR[selected.status] ?? 'default'}
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
            </Stack>
            <SectionTitle>Vehicle</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label="Make & model" value={`${selected.make} ${selected.model}`} />
              <Field label="Year" value={selected.year} />
              <Field label="Rego" value={selected.rego} />
              <Field label="Insurance" value={selected.insuranceType ? t(`fleet.insurance${INSURANCE_LABEL[selected.insuranceType]}`, selected.insuranceType) : '—'} />
              <Field
                label="Price / day"
                value={selected.rentPricePerDay != null ? `$${selected.rentPricePerDay}` : '—'}
              />
              <Field label="Minimum rental days" value={selected.minimumRentalDays != null ? selected.minimumRentalDays : '—'} />
            </Stack>
            <SectionTitle>Service &amp; registration</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label="Odometer" value={selected.odometerKm != null ? `${selected.odometerKm.toLocaleString()} km` : '—'} />
              <Field label="Total distance" value={`${selected.totalDistanceKm.toLocaleString()} km`} />
              <Field label="Trips" value={selected.trips} />
              <Field label="Last oil change" value={selected.lastOilChangeDate || '—'} />
              <Field label="Oil due" value={selected.oilDueDate || '—'} />
              <Field label="Last rego payment" value={selected.lastRegoPaymentDate || '—'} />
              <Field label="Rego expiry" value={selected.regoDueDate || '—'} />
            </Stack>
            <SectionTitle>Rental</SectionTitle>
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              <Field label="Belongs to" value={selected.rentalName} />
            </Stack>

            {selected.status === 'rented' && selected.renter && (
              <Box sx={{ mt: 3 }}>
                <SectionTitle>Rented by</SectionTitle>
                <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                  <Field label="Driver" value={selected.renter.driverName} />
                  <Field label="Email" value={selected.renter.driverEmail} />
                  {selected.renter.driverPhone && <Field label="Phone" value={selected.renter.driverPhone} />}
                  {(selected.renter.startDate || selected.renter.endDate) && (
                    <Field label="Period" value={`${selected.renter.startDate || '—'} → ${selected.renter.endDate || '—'}`} />
                  )}
                </Stack>
              </Box>
            )}

            {selected.status === 'maintenance' && selected.maintenance && (
              <Box sx={{ mt: 3 }}>
                <SectionTitle>In maintenance</SectionTitle>
                <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                  <Field label="Mechanic" value={selected.maintenance.mechanicName || '—'} />
                  {selected.maintenance.shopName && <Field label="Shop" value={selected.maintenance.shopName} />}
                  <Field label="Work" value={selected.maintenance.workDescription} />
                  <Field label="Price" value={selected.maintenance.quotedPrice != null ? `$${selected.maintenance.quotedPrice.toFixed(2)}` : '—'} />
                  {selected.maintenance.estimatedValue != null && (
                    <Field label="Estimated time" value={`${selected.maintenance.estimatedValue} ${selected.maintenance.estimatedUnit || ''}`} />
                  )}
                  {selected.maintenance.mechanicNotes && <Field label="Notes" value={selected.maintenance.mechanicNotes} />}
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!toDelete}
        onClose={() => (deleting ? undefined : setToDelete(null))}
        title="Delete vehicle"
        subtitle={toDelete ? `Permanently remove ${toDelete.make} ${toDelete.model}? This cannot be undone.` : undefined}
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

export default AdminVehiclesPage;
