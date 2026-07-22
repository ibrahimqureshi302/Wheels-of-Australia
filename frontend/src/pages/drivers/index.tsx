import React, { useState, useEffect, useMemo } from 'react';
import { Box, Stack, Chip } from '@mui/material';
import { EditOutlined } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import { listVariants, fadeVariants } from '../../lib/animations';
import { driversApi } from '../../services/drivers/api';
import { listIncomingRequests } from '../../services/rental/rentalRequests';
import type { RentalRequest } from '../../services/rental/types';
import { useToast, Field, SectionTitle, PageHero, DocumentPreview } from '../../components/Common';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import Button from '../../components/Common/Button';
import { Typography, Chip as MuiChip } from '@mui/material';
import type { Driver } from '../../services/drivers/types';
import type { StatusFilter } from './components/DriversToolbar';
import Pagination from '../../components/Common/Pagination';
import Dialog from '../../components/Common/Dialog';
import {
  DriversToolbar,
  DriversTable,
  DriversEmptyState,
  DriversSkeleton,
  DriversNoResults,
} from './components';

function filterDrivers(drivers: Driver[], search: string, statusFilter: StatusFilter): Driver[] {
  const q = search.trim().toLowerCase();
  let list = drivers;
  if (statusFilter !== 'all') {
    list = list.filter((d) => d.status === statusFilter);
  }
  if (q) {
    list = list.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.phone.replace(/\s/g, '').includes(q)
    );
  }
  return list;
}

const DriversPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [driverIdToDelete, setDriverIdToDelete] = useState<string | null>(null);
  // The driver whose read-only details are open in the popup.
  const [selected, setSelected] = useState<Driver | null>(null);
  // All booking requests (admin sees every request) — used to show a driver's
  // bookings in the detail popup.
  const [requests, setRequests] = useState<RentalRequest[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    driversApi
      .list()
      .then((data) => { if (active) setDrivers(data); })
      .catch(() => { if (active) showError('Failed to load drivers.'); })
      .finally(() => { if (active) setLoading(false); });
    listIncomingRequests()
      .then((data) => { if (active) setRequests(data); })
      .catch(() => { /* non-fatal — detail just won't show bookings */ });
    return () => { active = false; };
  }, [showError]);

  // Live-sync the list when a driver record changes elsewhere (silent refetch).
  useAutoRefresh(() => {
    driversApi.list().then(setDrivers).catch(() => { /* keep current */ });
  });

  const selectedBookings = useMemo(
    () => (selected ? requests.filter((r) => r.driverEmail?.toLowerCase() === selected.email.toLowerCase()) : []),
    [selected, requests],
  );

  const filtered = useMemo(
    () => filterDrivers(drivers, search, statusFilter),
    [drivers, search, statusFilter]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // When opened from a notification, flash the target row and jump to its page.
  const { highlightId, activeId } = useHighlightTarget(!loading);
  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = filtered.findIndex((d) => d.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / rowsPerPage) + 1);
  }, [highlightId, loading, filtered, rowsPerPage]);

  const handleRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  };

  const handleDeleteClick = (id: string) => {
    setDriverIdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!driverIdToDelete) return;
    try {
      await driversApi.remove(driverIdToDelete);
      setDrivers((prev) => prev.filter((d) => d.id !== driverIdToDelete));
      showSuccess('Driver deleted.');
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to delete driver.');
    } finally {
      setDriverIdToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setDriverIdToDelete(null);
    setDeleteDialogOpen(false);
  };

  return (
    <PageHero title={t('drivers.title')} subtitle={t('drivers.subtitle')}>
      <DriversToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onAddDriver={() => navigate(ROUTES.ADMIN.DRIVERS_ADD)}
      />

      <AnimatePresence mode="wait">
        {loading ? (
          <DriversSkeleton />
        ) : drivers.length === 0 ? (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <DriversEmptyState onAddDriver={() => navigate(ROUTES.ADMIN.DRIVERS_ADD)} />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="no-results" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <DriversNoResults />
          </motion.div>
        ) : (
          <motion.div key="list" variants={listVariants} initial="initial" animate="animate" exit="exit">
            <DriversTable
              drivers={paginated}
              onView={(driver) => setSelected(driver)}
              onEdit={(id) => navigate(`${ROUTES.DRIVERS_EDIT_BASE}/${id}`)}
              onDelete={handleDeleteClick}
              highlightId={activeId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Read-only details popup (edit only via the Edit button) */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.fullName : undefined}
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
                navigate(`${ROUTES.DRIVERS_EDIT_BASE}/${id}`);
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
              <Chip size="small" label={t('roles.driver', 'Driver')} color="primary" variant="outlined" />
              <Chip
                size="small"
                label={t(selected.status === 'active' ? 'drivers.statusActive' : 'drivers.statusInactive')}
                color={selected.status === 'active' ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>
            <SectionTitle>{t('drivers.fullName')}</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 1, mt: 0.5 }}>
              <Field label={t('drivers.fullName')} value={selected.fullName} />
              <Field label={t('drivers.email', 'Email')} value={selected.email} />
              <Field label={t('drivers.phone')} value={selected.phone} />
              <Field label={t('drivers.licenseNumber')} value={selected.licenseNumber} />
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
              <SectionTitle>Bookings ({selectedBookings.length})</SectionTitle>
              {selectedBookings.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  No booking requests yet.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {selectedBookings.slice(0, 8).map((b) => (
                    <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap>{b.vehicleMake} {b.vehicleModel}</Typography>
                        {(b.rentalStartDate || b.rentalEndDate) && (
                          <Typography variant="caption" color="text.secondary">
                            {b.rentalStartDate || '—'} → {b.rentalEndDate || '—'}
                          </Typography>
                        )}
                      </Box>
                      <MuiChip
                        size="small"
                        label={b.status}
                        color={b.status === 'approved' || b.status === 'running' || b.status === 'completed' ? 'success' : b.status === 'rejected' ? 'error' : 'warning'}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        title={t('drivers.deleteDriverTitle')}
        subtitle={t('drivers.deleteDriverMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        showActions={true}
      />

      {!loading && drivers.length > 0 && filtered.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={rowsPerPage}
          onChange={(newPage) => setPage(newPage)}
          onPageSizeChange={handleRowsPerPageChange}
        />
      )}
    </PageHero>
  );
};

export default DriversPage;
