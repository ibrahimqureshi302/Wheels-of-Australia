import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { differenceInDays, startOfDay } from 'date-fns';
import {
  submitBookingRequest,
  getOpenRequestsByVehicle,
  type VehicleRequestState,
} from '../../../services/rental/driverRequests';
import { browseGetRental, browseListVehicles } from '../../../services/rentals/browse';
import type { Vehicle } from '../../../services/rental/types';
import type { Rental } from '../../../services/rentals/types';
import { ROUTES } from '../../../constants/routes';
import { cardVariants, fadeVariants } from '../../../lib/animations';
import DatePicker from '../../../components/Common/DatePicker';
import Pagination from '../../../components/Common/Pagination';
import IdentityVerification, {
  emptyVerification,
  isVerificationComplete,
  type VerificationResult,
} from '../../../components/Requests/IdentityVerification';
import { Divider } from '@mui/material';
import { VehicleRentalCard, VehiclesEmptyState } from '../components';

const today = () => startOfDay(new Date());

/** Default interval between oil services (matches the backend reminder logic). */
const OIL_CHANGE_INTERVAL_DAYS = 180;

function getRentalDisplayName(rental: Rental): string {
  return rental.rentalType === 'company' && rental.companyName
    ? rental.companyName
    : rental.contactName;
}

/** Format a stored date ("2026-06-22") as "22 Jun 2026" without timezone drift. */
function fmtAU(iso?: string): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** When the next oil change is due: the stored due date if set, otherwise the
 * last oil change + the standard interval (same rule the reminders use). */
function oilDueOf(vehicle: Vehicle): string | undefined {
  if (vehicle.oilDueDate) return vehicle.oilDueDate;
  if (!vehicle.lastOilChangeDate) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(vehicle.lastOilChangeDate);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + OIL_CHANGE_INTERVAL_DAYS);
  return d.toISOString().slice(0, 10);
}

const DetailLine: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
  </Box>
);

const VehiclesRentalPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rentalId } = useParams<{ rentalId: string }>();
  const [rental, setRental] = useState<Rental | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  // Map of vehicleId → the driver's open-request status ('pending' | 'info_requested').
  // Vehicles absent from the map have no open request and may be requested.
  const [openByVehicle, setOpenByVehicle] = useState<Record<string, VehicleRequestState>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [requestDialog, setRequestDialog] = useState<{
    open: boolean;
    vehicle: Vehicle | null;
    startDate: Date | null;
    endDate: Date | null;
  }>({ open: false, vehicle: null, startDate: null, endDate: null });
  const [verification, setVerification] = useState<VerificationResult>(emptyVerification());
  const [detailsVehicle, setDetailsVehicle] = useState<Vehicle | null>(null);

  // Re-read the driver's open requests and rebuild the per-vehicle state map.
  // Called on load and after a successful submission so the card buttons reflect
  // the new "pending request" state without a full page reload.
  const refreshOpenRequests = useCallback(async () => {
    try {
      const open = await getOpenRequestsByVehicle();
      const map: Record<string, VehicleRequestState> = {};
      for (const [vehicleId, req] of Object.entries(open)) {
        map[vehicleId] = req.status === 'info_requested' ? 'info_requested' : 'pending';
      }
      setOpenByVehicle(map);
    } catch {
      // Non-fatal: fall back to no open requests (buttons stay enabled). The
      // backend still rejects a true duplicate, so we never create one.
      setOpenByVehicle({});
    }
  }, []);

  useEffect(() => {
    if (!rentalId) {
      navigate(ROUTES.VEHICLES, { replace: true });
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([browseGetRental(rentalId), browseListVehicles(rentalId), getOpenRequestsByVehicle()])
      .then(([r, vs, open]) => {
        if (!active) return;
        setRental(r);
        setVehicles(vs);
        const map: Record<string, VehicleRequestState> = {};
        for (const [vehicleId, req] of Object.entries(open)) {
          map[vehicleId] = req.status === 'info_requested' ? 'info_requested' : 'pending';
        }
        setOpenByVehicle(map);
      })
      .catch(() => {
        if (!active) return;
        setRental(null);
        setVehicles([]);
        setOpenByVehicle({});
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rentalId, navigate]);

  const totalPages = Math.max(1, Math.ceil(vehicles.length / pageSize));
  const paginatedVehicles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return vehicles.slice(start, start + pageSize);
  }, [vehicles, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const openRequestDialog = (vehicle: Vehicle) => {
    setRequestDialog({
      open: true,
      vehicle,
      startDate: null,
      endDate: null,
    });
    setVerification(emptyVerification());
  };

  const closeRequestDialog = () => {
    setRequestDialog({ open: false, vehicle: null, startDate: null, endDate: null });
    setVerification(emptyVerification());
  };

  const startDate = requestDialog.startDate;
  const endDate = requestDialog.endDate;
  const rentalDays =
    startDate && endDate && endDate >= startDate ? differenceInDays(endDate, startDate) + 1 : null;
  const dateError = startDate && endDate && endDate < startDate;
  const minDays =
    (requestDialog.vehicle?.minimumRentalDays ?? rental?.minimumRentalDays) ?? 1;
  const belowMinimum = rentalDays != null && rentalDays < minDays;

  const handleSubmitRequest = async () => {
    if (!requestDialog.vehicle || !startDate || !endDate || dateError || belowMinimum || !rental) return;
    if (!isVerificationComplete(verification)) return;
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    const vehicleId = requestDialog.vehicle.id;
    try {
      await submitBookingRequest({
        vehicleId,
        vehicleMake: requestDialog.vehicle.make,
        vehicleModel: requestDialog.vehicle.model,
        rentalId: rental.id,
        rentalName: getRentalDisplayName(rental),
        startDate: startStr,
        endDate: endStr,
        idDocuments: verification.documents,
        verifiedDetails: verification.details,
      });
      // Optimistically mark the vehicle as pending so the button flips
      // immediately, then reconcile with the backend.
      setOpenByVehicle((prev) => ({ ...prev, [vehicleId]: 'pending' }));
      closeRequestDialog();
      refreshOpenRequests();
    } catch {
      closeRequestDialog();
    }
  };

  // The driver clicked an "info requested" vehicle: send them to My Requests to
  // update the existing request (a new request is not allowed in this state).
  const handleProvideInfo = () => navigate(ROUTES.MY_REQUESTS);

  const handleBack = () => navigate(ROUTES.VEHICLES);
  const handlePageChange = (newPage: number) => setPage(newPage);
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  if (!rentalId) return null;
  if (!loading && !rental) {
    navigate(ROUTES.VEHICLES, { replace: true });
    return null;
  }

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        maxWidth: 1400,
        mx: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton
          onClick={handleBack}
          aria-label={t('common.back')}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <ArrowBack />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={handleBack}>
          {t('vehicles.title')}
        </Typography>
      </Box>

      <Box sx={{ mb: { xs: 2.5, sm: 3, md: 4 } }}>
        {loading ? (
          <Skeleton variant="text" width={280} height={40} />
        ) : rental ? (
          <>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                mb: 0.5,
              }}
            >
              {getRentalDisplayName(rental)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 560, lineHeight: 1.5 }}
            >
              {t('vehicles.vehiclesUnderRental')}
            </Typography>
          </>
        ) : null}
      </Box>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 2.5, md: 3 }, width: '100%' }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Box
                  key={i}
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '0 1 calc((100% - 20px) / 2)',
                      md: '0 1 calc((100% - 48px) / 3)',
                      lg: '0 1 calc((100% - 72px) / 4)',
                    },
                    minWidth: { xs: 0, sm: 260, md: 240, lg: 220 },
                  }}
                >
                  <Skeleton
                    variant="rounded"
                    height={280}
                    sx={{ borderRadius: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  />
                </Box>
              ))}
            </Box>
          </motion.div>
        ) : vehicles.length === 0 ? (
          <motion.div
            key="empty"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <VehiclesEmptyState />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%' }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: { xs: 2, sm: 2.5, md: 3 },
                width: '100%',
              }}
            >
              {paginatedVehicles.map((vehicle, index) => (
                <Box
                  key={vehicle.id}
                  sx={{
                    flex: {
                      xs: '1 1 100%',
                      sm: '0 1 calc((100% - 20px) / 2)',
                      md: '0 1 calc((100% - 48px) / 3)',
                      lg: '0 1 calc((100% - 72px) / 4)',
                    },
                    minWidth: { xs: 0, sm: 260, md: 240, lg: 220 },
                    maxWidth: {
                      xs: '100%',
                      sm: 'calc((100% - 20px) / 2)',
                      md: 'calc((100% - 48px) / 3)',
                      lg: 'calc((100% - 72px) / 4)',
                    },
                  }}
                >
                  <motion.div
                    variants={cardVariants}
                    initial="initial"
                    animate="animate"
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    style={{ height: '100%' }}
                  >
                    <VehicleRentalCard
                      vehicle={vehicle}
                      onRequestRental={openRequestDialog}
                      onViewDetails={setDetailsVehicle}
                      requestState={openByVehicle[vehicle.id] ?? 'none'}
                      onProvideInfo={handleProvideInfo}
                      minimumRentalDays={vehicle.minimumRentalDays ?? rental?.minimumRentalDays}
                    />
                  </motion.div>
                </Box>
              ))}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && vehicles.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={vehicles.length}
          pageSize={pageSize}
          onChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <Dialog
        open={requestDialog.open}
        onClose={(_, reason) => {
          if (reason === 'backdropClick') return;
          closeRequestDialog();
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '60vh',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ flexShrink: 0 }}>
          {t('vehicles.requestRentalTitle')}
          {requestDialog.vehicle && (
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              fontWeight={400}
              sx={{ display: 'block', mt: 0.5 }}
            >
              {requestDialog.vehicle.make} {requestDialog.vehicle.model}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {requestDialog.vehicle && (
            <Box sx={{ mb: 2.5, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Vehicle details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <DetailLine label="Rego" value={requestDialog.vehicle.rego || '—'} />
                <DetailLine label="Year" value={requestDialog.vehicle.year || '—'} />
                <DetailLine label="Rego expiry" value={fmtAU(requestDialog.vehicle.regoDueDate)} />
                <DetailLine label="Oil change due" value={fmtAU(oilDueOf(requestDialog.vehicle))} />
              </Box>
            </Box>
          )}
          <DialogContentText sx={{ mb: 2 }}>{t('vehicles.rentalPeriod')}</DialogContentText>
          {minDays > 1 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('vehicles.minimumRentalRequired', { count: minDays })}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <DatePicker
              label={t('vehicles.startDate')}
              value={requestDialog.startDate}
              onChange={(date) =>
                setRequestDialog((prev) => ({
                  ...prev,
                  startDate: date,
                  endDate: prev.endDate && date && prev.endDate < date ? null : prev.endDate,
                }))
              }
              minDate={today()}
              clearable={false}
            />
            <DatePicker
              label={t('vehicles.endDate')}
              value={requestDialog.endDate}
              onChange={(date) => setRequestDialog((prev) => ({ ...prev, endDate: date }))}
              minDate={requestDialog.startDate ?? today()}
              error={dateError ?? undefined}
              helperText={dateError ? t('vehicles.endDateBeforeStart') : undefined}
              clearable={false}
            />
            {rentalDays != null && !dateError && (
              <Typography
                variant="body2"
                color={belowMinimum ? 'error.main' : 'text.secondary'}
              >
                {t('vehicles.daysCount', { count: rentalDays })}
                {belowMinimum && ` — ${t('vehicles.minimumRentalRequired', { count: minDays })}`}
              </Typography>
            )}
          </Box>
          <Divider sx={{ my: 2.5 }} />
          <IdentityVerification value={verification} onChange={setVerification} />
        </DialogContent>
        <DialogActions sx={{ flexShrink: 0, px: 3, pb: 2 }}>
          <Button onClick={closeRequestDialog} sx={{ borderRadius: 2, textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitRequest}
            disabled={!startDate || !endDate || (dateError ?? false) || belowMinimum || !isVerificationComplete(verification)}
            sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
          >
            {t('vehicles.submitRequest')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vehicle details — opened by clicking a card */}
      <Dialog
        open={detailsVehicle != null}
        onClose={() => setDetailsVehicle(null)}
        maxWidth="sm"
        fullWidth
      >
        {detailsVehicle && (
          <>
            <DialogTitle>
              {detailsVehicle.make} {detailsVehicle.model}
            </DialogTitle>
            <DialogContent dividers>
              {detailsVehicle.imageUrl && (
                <Box
                  sx={{
                    width: '100%',
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={detailsVehicle.imageUrl}
                    alt={`${detailsVehicle.make} ${detailsVehicle.model}`}
                    sx={{
                      width: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <DetailLine label="Year" value={detailsVehicle.year || '—'} />
                <DetailLine label="Rego" value={detailsVehicle.rego || '—'} />
                <DetailLine label="Status" value={t('vehicles.available')} />
                <DetailLine
                  label="Price per day"
                  value={detailsVehicle.rentPricePerDay != null ? `$${detailsVehicle.rentPricePerDay}` : '—'}
                />
                <DetailLine
                  label="Minimum rental"
                  value={t('vehicles.daysCount', {
                    count: detailsVehicle.minimumRentalDays ?? rental?.minimumRentalDays ?? 1,
                  })}
                />
                <DetailLine label="Rego expiry" value={fmtAU(detailsVehicle.regoDueDate)} />
                <DetailLine label="Oil change due" value={fmtAU(oilDueOf(detailsVehicle))} />
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDetailsVehicle(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                {t('common.close')}
              </Button>
              {(openByVehicle[detailsVehicle.id] ?? 'none') === 'pending' ? (
                <Button
                  variant="outlined"
                  disabled
                  sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                >
                  {t('vehicles.pendingRequest')}
                </Button>
              ) : (openByVehicle[detailsVehicle.id] ?? 'none') === 'info_requested' ? (
                <Button
                  variant="contained"
                  color="info"
                  onClick={() => {
                    setDetailsVehicle(null);
                    handleProvideInfo();
                  }}
                  sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                >
                  {t('vehicles.infoRequested')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => {
                    const v = detailsVehicle;
                    setDetailsVehicle(null);
                    openRequestDialog(v);
                  }}
                  sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none' }}
                >
                  {t('vehicles.requestRental')}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default VehiclesRentalPage;
