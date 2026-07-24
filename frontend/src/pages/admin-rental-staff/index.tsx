import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, TextField, Button, Paper, IconButton, Stack, Chip,
  MenuItem, Select, FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import { Add, EditOutlined, DeleteOutlined, People, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '../../constants/routes';
import { listVariants, fadeVariants } from '../../lib/animations';
import { adminRentalStaffApi } from '../../services/adminRentalStaff/api';
import type { AdminRentalStaff } from '../../services/adminRentalStaff/types';
import { useToast, Field, SectionTitle, PageHero, DocumentPreview } from '../../components/Common';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import Pagination from '../../components/Common/Pagination';
import Dialog from '../../components/Common/Dialog';
import DataTable from '../../components/Common/Table';
import { GRANTABLE_RENTAL_NAV } from '../../constants/nav';

const RENTAL_MENU_OPTIONS = GRANTABLE_RENTAL_NAV;

function formatMenus(paths: string[], t: (k: string) => string, max = Infinity): string {
  if (paths.length === 0) return '—';
  const labels = paths.map((p) => {
    const item = RENTAL_MENU_OPTIONS.find((n) => n.path === p);
    return item ? t(item.labelKey) : p;
  });
  if (labels.length > max) return labels.slice(0, max).join(', ') + '…';
  return labels.join(', ');
}

function filterStaff(staff: AdminRentalStaff[], search: string, rentalId: string): AdminRentalStaff[] {
  let list = staff;
  if (rentalId !== 'all') list = list.filter((s) => s.rentalId === rentalId);
  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.rentalName.toLowerCase().includes(q) ||
        s.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    );
  }
  return list;
}

const AdminRentalStaffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [staff, setStaff] = useState<AdminRentalStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rentalFilter, setRentalFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminRentalStaffApi
      .list()
      .then((list) => { if (active) setStaff(list); })
      .catch(() => { if (active) showError(t('adminRentalStaff.loadError')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showError, t]);

  // Live-sync the list when a staff record changes elsewhere (silent refetch).
  useAutoRefresh(() => {
    adminRentalStaffApi.list().then(setStaff).catch(() => { /* keep current */ });
  });

  // Distinct rentals for the filter dropdown.
  const rentalOptions = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => { if (s.rentalId) map.set(s.rentalId, s.rentalName || s.rentalId); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [staff]);

  const filtered = useMemo(() => filterStaff(staff, search, rentalFilter), [staff, search, rentalFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  // When opened from a notification, flash the target row and jump to its page.
  const { highlightId, activeId } = useHighlightTarget(!loading);
  useEffect(() => {
    if (!highlightId || loading) return;
    const idx = filtered.findIndex((s) => s.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / rowsPerPage) + 1);
  }, [highlightId, loading, filtered, rowsPerPage]);

  const handleDeleteConfirm = async () => {
    if (!idToDelete) return;
    try {
      await adminRentalStaffApi.remove(idToDelete);
      setStaff((prev) => prev.filter((s) => s.id !== idToDelete));
      showSuccess(t('adminRentalStaff.deleted'));
    } catch (err) {
      showError((err as { message?: string })?.message || t('adminRentalStaff.deleteError'));
    } finally {
      setIdToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const columns = [
    {
      id: 'staff',
      label: t('rentalPortal.name'),
      width: '26%',
      render: (row: AdminRentalStaff) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <People sx={{ fontSize: 22, color: 'text.secondary' }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                {row.fullName || '—'}
              </Typography>
              {row.status === 'inactive' && (
                <Chip label={t('rentalPortal.statusInactive')} size="small" sx={{ height: 20, fontSize: '0.6875rem' }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">{row.email}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'rental',
      label: t('adminRentalStaff.rental'),
      width: '22%',
      render: (row: AdminRentalStaff) => (
        <Chip label={row.rentalName || '—'} size="small" variant="outlined" color="primary" sx={{ maxWidth: '100%' }} />
      ),
    },
    {
      id: 'phone',
      label: t('rentals.phone'),
      width: '16%',
      render: (row: AdminRentalStaff) => (
        <Typography variant="body2" color="text.secondary">{row.phone || '—'}</Typography>
      ),
    },
    {
      id: 'menus',
      label: t('rentalPortal.allowedMenus'),
      width: '22%',
      render: (row: AdminRentalStaff) => (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          {formatMenus(row.allowedNavPaths, t, 3)}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: '',
      width: '14%',
      align: 'center' as const,
      render: (row: AdminRentalStaff) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); navigate(`${ROUTES.ADMIN_RENTAL_STAFF_EDIT_BASE}/${row.id}`); }}
            aria-label={t('common.edit')}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setIdToDelete(row.id); setDeleteDialogOpen(true); }}
            aria-label={t('common.delete')}
            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <PageHero
      title={t('adminRentalStaff.title')}
      subtitle={t('adminRentalStaff.subtitle')}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder={t('rentals.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 240,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('adminRentalStaff.rental')}</InputLabel>
          <Select
            label={t('adminRentalStaff.rental')}
            value={rentalFilter}
            onChange={(e) => { setRentalFilter(e.target.value); setPage(1); }}
            sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
          >
            <MenuItem value="all">{t('adminRentalStaff.allRentals')}</MenuItem>
            {rentalOptions.map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate(ROUTES.ADMIN.RENTAL_STAFF_ADD)}
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
          {t('adminRentalStaff.addStaff')}
        </Button>
      </Box>

      <AnimatePresence mode="wait">
        {loading ? (
          <Box sx={{ py: 4 }}>
            <Typography color="text.secondary">{t('common.loading')}</Typography>
          </Box>
        ) : staff.length === 0 ? (
          <motion.div variants={fadeVariants} initial="initial" animate="animate">
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
              <People sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>{t('adminRentalStaff.noStaffYet')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('adminRentalStaff.noStaffMessage')}
              </Typography>
              <Button variant="contained" onClick={() => navigate(ROUTES.ADMIN.RENTAL_STAFF_ADD)}>
                {t('adminRentalStaff.addStaff')}
              </Button>
            </Paper>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div variants={fadeVariants} initial="initial" animate="animate">
            <Typography color="text.secondary">{t('rentals.noResults')}</Typography>
          </motion.div>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate">
            <DataTable<AdminRentalStaff>
              columns={columns}
              data={paginated}
              getRowId={(row) => row.id}
              onRowClick={(row) => setViewId(row.id)}
              minWidth={680}
              highlightId={activeId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={viewId != null}
        onClose={() => setViewId(null)}
        title={t('adminRentalStaff.title')}
        showActions
        customActions={
          <>
            <Button variant="outlined" color="inherit" onClick={() => setViewId(null)}>
              {t('common.close')}
            </Button>
            <Button
              variant="contained"
              onClick={() => { if (viewId) navigate(`${ROUTES.ADMIN_RENTAL_STAFF_EDIT_BASE}/${viewId}`); }}
            >
              {t('common.edit')}
            </Button>
          </>
        }
      >
        {viewId && (() => {
          const s = staff.find((x) => x.id === viewId);
          if (!s) return null;
          return (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                <Chip size="small" label={s.rentalName || '—'} color="primary" variant="outlined" />
                <Chip
                  size="small"
                  label={t(s.status === 'active' ? 'rentalPortal.statusActive' : 'rentalPortal.statusInactive')}
                  color={s.status === 'active' ? 'success' : 'default'}
                  variant="outlined"
                />
              </Stack>
              <SectionTitle>{t('adminRentalStaff.title')}</SectionTitle>
              <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                <Field label={t('rentalPortal.name')} value={s.fullName || '—'} />
                <Field label="Email" value={s.email} />
                <Field label={t('rentals.phone')} value={s.phone || '—'} />
                <Field label={t('adminRentalStaff.rental')} value={s.rentalName || '—'} />
                <Field label={t('rentalPortal.allowedMenus')} value={formatMenus(s.allowedNavPaths, t)} />
              </Stack>
              <Box sx={{ mt: 3 }}>
                <SectionTitle>Documents ({s.documents.length})</SectionTitle>
                {s.documents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    No documents on file.
                  </Typography>
                ) : (
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    {s.documents.map((d) => (
                      <DocumentPreview key={d.id} doc={d} />
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          );
        })()}
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title={t('adminRentalStaff.deleteStaffTitle')}
        subtitle={t('adminRentalStaff.deleteStaffMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialogOpen(false)}
        showActions
      />

      {!loading && staff.length > 0 && filtered.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={rowsPerPage}
          onChange={setPage}
          onPageSizeChange={(rows) => { setRowsPerPage(rows); setPage(1); }}
        />
      )}
    </PageHero>
  );
};

export default AdminRentalStaffPage;
