import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, Button, Paper, IconButton, Stack, Chip, InputAdornment } from '@mui/material';
import { Add, EditOutlined, DeleteOutlined, People, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ROUTES } from '../../constants/routes';
import { listVariants, fadeVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import {
  listRentalStaff,
  deleteRentalStaff,
} from '../../services/rentals/rentalStaff';
import type { RentalPortalStaffEntry } from '../../services/rentals/rentalStaff';
import Pagination from '../../components/Common/Pagination';
import Dialog from '../../components/Common/Dialog';
import DataTable from '../../components/Common/Table';
import { Field, SectionTitle, PageHero } from '../../components/Common';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';
import { GRANTABLE_RENTAL_NAV } from '../../constants/nav';

function filterStaff(staff: RentalPortalStaffEntry[], search: string): RentalPortalStaffEntry[] {
  const q = search.trim().toLowerCase();
  if (!q) return staff;
  const fullName = (s: RentalPortalStaffEntry) =>
    `${s.firstName} ${s.lastName}`.trim().toLowerCase();
  return staff.filter(
    (s) =>
      fullName(s).includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
  );
}

const RENTAL_MENU_OPTIONS = GRANTABLE_RENTAL_NAV;

function formatAllowedMenus(paths: string[], t: (k: string) => string): string {
  if (paths.length === 0) return '—';
  return paths
    .map((p) => {
      const item = RENTAL_MENU_OPTIONS.find((n) => n.path === p);
      return item ? t(item.labelKey) : p;
    })
    .slice(0, 3)
    .join(', ') + (paths.length > 3 ? '…' : '');
}

/** Full list of allowed-menu labels (no truncation) for the details view. */
function formatAllMenus(paths: string[], t: (k: string) => string): string {
  if (paths.length === 0) return '—';
  return paths
    .map((p) => {
      const item = RENTAL_MENU_OPTIONS.find((n) => n.path === p);
      return item ? t(item.labelKey) : p;
    })
    .join(', ');
}

const RentalStaffPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [staff, setStaff] = useState<RentalPortalStaffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const isMainRental =
    user?.role?.toLowerCase() === 'rental' && !(user?.allowed_nav_paths?.length);

  useEffect(() => {
    if (!isMainRental && user) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return;
    }
  }, [isMainRental, user, navigate]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listRentalStaff(user?.id ?? 0)
      .then((list) => { if (active) setStaff(list); })
      .catch(() => { if (active) setStaff([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const filtered = useMemo(() => filterStaff(staff, search), [staff, search]);
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
    const idx = filtered.findIndex((s) => s.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / rowsPerPage) + 1);
  }, [highlightId, loading, filtered, rowsPerPage]);

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!idToDelete) return;
    await deleteRentalStaff(idToDelete);
    setStaff((prev) => prev.filter((s) => s.id !== idToDelete));
    setIdToDelete(null);
    setDeleteDialogOpen(false);
  };

  if (!isMainRental) return null;

  const columns = [
    {
      id: 'staff',
      label: t('rentalPortal.name'),
      width: '28%',
      render: (row: RentalPortalStaffEntry) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <People sx={{ fontSize: 22, color: 'text.secondary' }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
              </Typography>
              {row.status === 'pending' && (
                <Chip label={t('rentalPortal.statusPending')} size="small" color="warning" sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600 }} />
              )}
              {row.status === 'inactive' && (
                <Chip label={t('rentalPortal.statusInactive')} size="small" sx={{ height: 20, fontSize: '0.6875rem' }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {row.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'phone',
      label: t('rentals.phone'),
      width: '22%',
      render: (row: RentalPortalStaffEntry) => (
        <Typography variant="body2" color="text.secondary">
          {row.phone}
        </Typography>
      ),
    },
    {
      id: 'menus',
      label: t('rentalPortal.allowedMenus'),
      width: '28%',
      render: (row: RentalPortalStaffEntry) => (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
          {formatAllowedMenus(row.allowedNavPaths, t)}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: '',
      width: '14%',
      align: 'center' as const,
      render: (row: RentalPortalStaffEntry) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${ROUTES.RENTAL_STAFF_EDIT_BASE}/${row.id}`);
            }}
            aria-label={t('common.edit')}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row.id);
            }}
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
      title={t('rentalPortal.staffTitle')}
      subtitle={t('rentalPortal.staffSubtitle')}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
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
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate(ROUTES.RENTAL.STAFF_ADD)}
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
          {t('rentalPortal.addStaff')}
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
              <Typography variant="h6" gutterBottom>
                {t('rentalPortal.noStaffYet')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('rentalPortal.noStaffMessage')}
              </Typography>
              <Button variant="contained" onClick={() => navigate(ROUTES.RENTAL.STAFF_ADD)}>
                {t('rentalPortal.addStaff')}
              </Button>
            </Paper>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div variants={fadeVariants} initial="initial" animate="animate">
            <Typography color="text.secondary">{t('rentals.noResults')}</Typography>
          </motion.div>
        ) : (
          <motion.div variants={listVariants} initial="initial" animate="animate">
            <DataTable<RentalPortalStaffEntry>
              columns={columns}
              data={paginated}
              getRowId={(row) => row.id}
              onRowClick={(row) => setViewId(row.id)}
              minWidth={560}
              highlightId={activeId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={viewId != null}
        onClose={() => setViewId(null)}
        title={t('rentalPortal.staffTitle')}
        showActions
        customActions={
          <>
            <Button variant="outlined" color="inherit" onClick={() => setViewId(null)}>
              {t('common.close')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (viewId) navigate(`${ROUTES.RENTAL_STAFF_EDIT_BASE}/${viewId}`);
              }}
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
              <SectionTitle>{t('rentalPortal.staffTitle')}</SectionTitle>
              <Stack spacing={1.25} sx={{ mt: 0.5 }}>
                <Field
                  label={t('rentalPortal.name')}
                  value={[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                />
                <Field label="Email" value={s.email} />
                <Field label={t('rentals.phone')} value={s.phone || '—'} />
                <Field
                  label={t('rentalPortal.allowedMenus')}
                  value={formatAllMenus(s.allowedNavPaths, t)}
                />
              </Stack>
            </Box>
          );
        })()}
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title={t('rentalPortal.deleteStaffTitle')}
        subtitle={t('rentalPortal.deleteStaffMessage')}
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

export default RentalStaffPage;
