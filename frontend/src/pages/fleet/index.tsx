import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import { listVariants, fadeVariants } from '../../lib/animations';
import { listFleet, removeFleetVehicle } from '../../services/rental/fleet';
import type { Vehicle } from '../../services/rental/types';
import type { StatusFilter } from './components/FleetToolbar';
import Pagination from '../../components/Common/Pagination';
import Dialog from '../../components/Common/Dialog';
import Button from '../../components/Common/Button';
import { PageHero } from '../../components/Common';
import { useHighlightTarget } from '../../components/Notifications/recordHighlight';
import { useAutoRefresh } from '../../hooks';
import {
  FleetToolbar,
  FleetVehicleTable,
  FleetVehicleDetails,
  FleetEmptyState,
  FleetSkeleton,
  FleetNoResults,
} from './components';

function filterVehicles(vehicles: Vehicle[], search: string, statusFilter: StatusFilter): Vehicle[] {
  const q = search.trim().toLowerCase();
  let list = vehicles;
  if (statusFilter !== 'all') {
    list = list.filter((v) => v.status === statusFilter);
  }
  if (q) {
    list = list.filter(
      (v) =>
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.rego.toLowerCase().includes(q)
    );
  }
  return list;
}

const FleetPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Status filter, mirrored in the URL so a dashboard card/chart can deep-link
  // to a filtered fleet (e.g. `/fleet?status=maintenance`).
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_STATUS: StatusFilter[] = ['all', 'available', 'rented', 'pending_return', 'maintenance'];
  const statusFilter: StatusFilter =
    (VALID_STATUS.find((s) => s === searchParams.get('status'))) ?? 'all';
  const setStatusFilter = (next: StatusFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleIdToDelete, setVehicleIdToDelete] = useState<string | null>(null);
  const [viewVehicleId, setViewVehicleId] = useState<string | null>(null);

  // Initial load shows the skeleton; auto-refresh updates silently in place so
  // status changes (a vehicle flagged for maintenance, rented out, returned)
  // surface without a manual reload.
  const reload = useCallback((withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    listFleet()
      .then((list) => setVehicles(list))
      .catch(() => { if (withSpinner) setVehicles([]); })
      .finally(() => { if (withSpinner) setLoading(false); });
  }, []);

  useEffect(() => { reload(true); }, [reload]);

  // Poll every 25s and refresh immediately on any new notification, so a
  // maintenance flag / rental approval reflects on the fleet status chips live.
  useAutoRefresh(() => reload(false));

  const filtered = useMemo(
    () => filterVehicles(vehicles, search, statusFilter),
    [vehicles, search, statusFilter]
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
    const idx = filtered.findIndex((v) => v.id === highlightId);
    if (idx >= 0) setPage(Math.floor(idx / rowsPerPage) + 1);
  }, [highlightId, loading, filtered, rowsPerPage]);

  const handleRowsPerPageChange = (rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  };

  const handleDeleteClick = (id: string) => {
    setVehicleIdToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vehicleIdToDelete) return;
    await removeFleetVehicle(vehicleIdToDelete);
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleIdToDelete));
    setVehicleIdToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setVehicleIdToDelete(null);
    setDeleteDialogOpen(false);
  };

  return (
    <PageHero title={t('fleet.title')}>
      <FleetToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onAddVehicle={() => navigate(ROUTES.FLEET_ADD)}
      />

      <AnimatePresence mode="wait">
        {loading ? (
          <FleetSkeleton />
        ) : vehicles.length === 0 ? (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <FleetEmptyState onAddVehicle={() => navigate(ROUTES.FLEET_ADD)} />
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div key="no-results" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <FleetNoResults />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <FleetVehicleTable
              vehicles={paginated}
              onView={(id) => setViewVehicleId(id)}
              onEdit={(id) => navigate(`${ROUTES.FLEET_EDIT_BASE}/${id}`)}
              onDelete={handleDeleteClick}
              highlightId={activeId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={viewVehicleId != null}
        onClose={() => setViewVehicleId(null)}
        title={t('common.details')}
        showActions
        customActions={
          <>
            <Button variant="outlined" color="inherit" onClick={() => setViewVehicleId(null)}>
              {t('common.close')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (viewVehicleId) navigate(`${ROUTES.FLEET_EDIT_BASE}/${viewVehicleId}`);
              }}
            >
              {t('common.edit')}
            </Button>
          </>
        }
      >
        {viewVehicleId && (() => {
          const v = vehicles.find((x) => x.id === viewVehicleId);
          return v ? <FleetVehicleDetails vehicle={v} /> : null;
        })()}
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        title={t('fleet.deleteVehicleTitle')}
        subtitle={t('fleet.deleteVehicleMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        showActions={true}
      />

      {!loading && vehicles.length > 0 && filtered.length > 0 && (
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

export default FleetPage;
