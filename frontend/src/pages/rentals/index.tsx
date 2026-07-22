import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Stack, Chip, Divider } from '@mui/material';
import { EditOutlined, Person } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import { listVariants, fadeVariants } from '../../lib/animations';
import { rentalsApi } from '../../services/rentals/api';
import { useToast, Field, SectionTitle, PageHero, DocumentPreview } from '../../components/Common';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import Button from '../../components/Common/Button';
import type { Rental } from '../../services/rentals/types';
import type { StatusFilter } from './components/RentalsToolbar';
import Pagination from '../../components/Common/Pagination';
import Dialog from '../../components/Common/Dialog';
import {
  RentalsToolbar,
  RentalsTable,
  RentalsEmptyState,
  RentalsSkeleton,
  RentalsNoResults,
} from './components';

function filterRentals(rentals: Rental[], search: string, statusFilter: StatusFilter): Rental[] {
  const q = search.trim().toLowerCase();
  let list = rentals;
  if (statusFilter !== 'all') {
    list = list.filter((r) => r.status === statusFilter);
  }
  if (q) {
    list = list.filter(
      (r) =>
        r.contactName.toLowerCase().includes(q) ||
        (r.companyName?.toLowerCase().includes(q) ?? false) ||
        r.email.toLowerCase().includes(q)
    );
  }
  return list;
}

const RentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rentalIdToDelete, setRentalIdToDelete] = useState<string | null>(null);
  // The rental whose read-only details (and staff) are open in the popup.
  const [selected, setSelected] = useState<Rental | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    rentalsApi
      .list()
      .then((data) => { if (active) setRentals(data); })
      .catch(() => { if (active) showError('Failed to load rentals.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showError]);

  // Live-sync the list when a rental record changes elsewhere (silent refetch).
  useAutoRefresh(() => {
    rentalsApi.list().then(setRentals).catch(() => { /* keep current */ });
  });

  const filtered = useMemo(
    () => filterRentals(rentals, search, statusFilter),
    [rentals, search, statusFilter]
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
    const idx = filtered.findIndex((r) => r.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / rowsPerPage) + 1);
  }, [highlightId, loading, filtered, rowsPerPage]);

  const handleRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  };

  const handleDeleteClick = (id: string) => {
    setRentalIdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rentalIdToDelete) return;
    try {
      await rentalsApi.remove(rentalIdToDelete);
      setRentals((prev) => prev.filter((r) => r.id !== rentalIdToDelete));
      showSuccess('Rental deleted.');
    } catch (err) {
      showError((err as { message?: string })?.message || 'Failed to delete rental.');
    } finally {
      setRentalIdToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setRentalIdToDelete(null);
    setDeleteDialogOpen(false);
  };

  return (
    <PageHero title={t('rentals.title')} subtitle={t('rentals.subtitle')}>
      <RentalsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onAddRental={() => navigate(ROUTES.ADMIN.RENTALS_ADD)}
      />

      <AnimatePresence mode="wait">
        {loading ? (
          <RentalsSkeleton />
        ) : rentals.length === 0 ? (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <RentalsEmptyState onAddRental={() => navigate(ROUTES.ADMIN.RENTALS_ADD)} />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="no-results" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <RentalsNoResults />
          </motion.div>
        ) : (
          <motion.div key="list" variants={listVariants} initial="initial" animate="animate" exit="exit">
            <RentalsTable
              rentals={paginated}
              onView={(rental) => setSelected(rental)}
              onEdit={(id) => navigate(`${ROUTES.RENTALS_EDIT_BASE}/${id}`)}
              onDelete={handleDeleteClick}
              highlightId={activeId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Read-only details popup: rental info + its rental staff (edit only via the Edit button) */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.contactName : undefined}
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
                navigate(`${ROUTES.RENTALS_EDIT_BASE}/${id}`);
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
                label={selected.rentalType === 'company' ? t('rental.company', 'Company') : t('rental.individual', 'Individual')}
                color="primary"
                variant="outlined"
              />
              <Chip
                size="small"
                label={t(selected.status === 'active' ? 'rentals.statusActive' : 'rentals.statusInactive')}
                color={selected.status === 'active' ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>

            <SectionTitle>{t('rental.contactName')}</SectionTitle>
            <Stack spacing={1.25} sx={{ mb: 3, mt: 0.5 }}>
              <Field label={t('rental.contactName')} value={selected.contactName} />
              {selected.companyName && <Field label={t('rental.company', 'Company')} value={selected.companyName} />}
              {selected.abn && <Field label="ABN" value={selected.abn} />}
              <Field label={t('rentals.email', 'Email')} value={selected.email} />
              <Field label={t('rentals.phone')} value={selected.phone} />
              {selected.minimumRentalDays != null && (
                <Field label={t('rental.minimumRentalDays', 'Minimum rental days')} value={selected.minimumRentalDays} />
              )}
              {selected.certificateFileName && (
                <Field label={t('rental.certificateUpload', 'Registration certificate')} value={selected.certificateFileName} />
              )}
            </Stack>

            <Box sx={{ mb: 2 }}>
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

            <Divider sx={{ mb: 2 }} />

            <SectionTitle>
              {t('navigation.rentalStaff', 'Rental staff')} ({selected.staff.length})
            </SectionTitle>
            {selected.staff.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('rentals.noStaff', 'This rental has no staff accounts yet.')}
              </Typography>
            ) : (
              <Stack spacing={1.25} sx={{ mt: 1 }}>
                {selected.staff.map((s) => (
                  <Box
                    key={s.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.25,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Person sx={{ fontSize: 20, color: 'text.secondary' }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {s.fullName || s.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {s.email}
                        {s.phone ? ` · ${s.phone}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={t(s.status === 'active' ? 'rentals.statusActive' : 'rentals.statusInactive')}
                      color={s.status === 'active' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        title={t('rentals.deleteRentalTitle')}
        subtitle={t('rentals.deleteRentalMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        showActions={true}
      />

      {!loading && rentals.length > 0 && filtered.length > 0 && (
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

export default RentalsPage;
