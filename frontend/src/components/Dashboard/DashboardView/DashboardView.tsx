import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
} from '@mui/material';
import {
  DirectionsCar,
  RequestQuote,
  Notifications,
  ChevronRight,
  Route,
  Assignment,
  People,
  Build,
  CarRental,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/hooks';
import { useNotifications } from '../../../context/NotificationContext';
import { ROUTES } from '../../../constants/routes';
import { normalizeRole } from '../../../constants/roles';
import { isStaffPathAllowed } from '../../../constants/nav';
import type { Vehicle, RentalRequest } from '../../../services/rental/types';
import { listFleet } from '../../../services/rental/fleet';
import { listIncomingRequests } from '../../../services/rental/rentalRequests';
import { listMaintenanceRequests } from '../../../services/maintenance';
import { listMyRequests } from '../../../services/rental/driverRequests';
import type { DriverRequest } from '../../../services/rental/driverRequests';
import { listRentalStaff } from '../../../services/rentals/rentalStaff';
import { browseListRentals } from '../../../services/rentals/browse';
import { cardVariants, listVariants, listItemVariants, fadeVariants } from '../../../lib/animations';
import { RENTAL_STATUS_FILTERS, matchesRentalStatusFilter } from '../../../constants/rentalStatusFilters';

/** Map a request/job status to a MUI palette colour (theme-driven, no hard-coded hex). */
type ChipColor = 'default' | 'success' | 'warning' | 'error' | 'info';
function statusColor(status: string): ChipColor {
  if (['approved', 'accepted', 'completed', 'running'].includes(status)) return 'success';
  if (['pending', 'request_info', 'info_requested'].includes(status)) return 'warning';
  if (['rejected', 'declined', 'cancelled'].includes(status)) return 'error';
  if (status === 'quoted') return 'info';
  return 'default';
}

/** Compact "time ago" label for a recent-activity row. */
function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** A small pulsing "Live" badge that signals the data auto-refreshes. */
const LiveBadge: React.FC = () => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: 'success.main',
        animation: 'woaPulse 1.6s ease-in-out infinite',
        '@keyframes woaPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
      }}
    />
    <Typography variant="caption" color="success.main" fontWeight={700}>
      Live
    </Typography>
  </Box>
);

/** Placeholder shown in trend charts when there is no data. */
const ChartEmptyState: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      height: 140,
      mt: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 2,
      bgcolor: 'action.hover',
    }}
  >
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);

const DashboardView: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unreadCount, latestNotificationId } = useNotifications();
  // Status filter for the recent-booking-requests feed (rental view).
  const [feedStatus, setFeedStatus] = useState<string>('all');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<RentalRequest[]>([]);
  /** Vehicle ids that have an open (in-flight) maintenance job. */
  const [maintenanceVehicleIds, setMaintenanceVehicleIds] = useState<string[]>([]);

  const vehiclesCount = vehicles.length;
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || '';
  const role = normalizeRole(user?.role);
  const isDriver = role === 'driver';
  const isRental = role === 'rental';

  // A staff sub-account only sees data for the sections it was granted; the
  // owner (no allowed_nav_paths) sees everything. This mirrors the route guard
  // so the dashboard never surfaces data for a section the staff can't open.
  const grantedPaths = user?.allowed_nav_paths;
  const isStaff = isRental && !!grantedPaths?.length;
  const canSeeFleet = !isStaff || isStaffPathAllowed(grantedPaths as string[], ROUTES.FLEET);
  const canSeeRequests = !isStaff || isStaffPathAllowed(grantedPaths as string[], ROUTES.RENTAL_REQUESTS);
  const canSeeMaintenance = !isStaff || isStaffPathAllowed(grantedPaths as string[], ROUTES.MAINTENANCE);

  // Fleet + pending-requests + maintenance are rental-only endpoints, and only
  // the rental stat cards display them. Drivers/mechanics don't fetch them
  // (avoids a pointless background 403). Refreshed on a timer so new requests,
  // quotes and maintenance jobs show up without a manual reload.
  useEffect(() => {
    if (!isRental) {
      setVehicles([]);
      setIncomingRequests([]);
      setMaintenanceVehicleIds([]);
      return;
    }
    let active = true;
    const refresh = () => {
      // Only fetch data the user is allowed to see (a staff member without the
      // grant gets nothing — keeping the data, not just the widget, out of view).
      if (canSeeFleet) {
        listFleet()
          .then((list) => { if (active) setVehicles(list); })
          .catch(() => { if (active) setVehicles([]); });
      }
      if (canSeeRequests) {
        listIncomingRequests()
          .then((list) => { if (active) setIncomingRequests(list); })
          .catch(() => { if (active) setIncomingRequests([]); });
      }
      // Maintenance data drives the maintenance card and refines the fleet's
      // vehicles-by-status chart. Fetch only when the maintenance section is
      // granted; without it, vehicles-by-status falls back to the stored status.
      if (canSeeMaintenance) {
        listMaintenanceRequests()
          .then((jobs) => {
            if (!active) return;
            // Vehicles with an open (in-flight) maintenance job — drives both the
            // "Active maintenance" card and the maintenance bar so they always agree.
            const open = jobs.filter((j) => ['pending', 'quoted', 'accepted', 'info_requested'].includes(j.status));
            setMaintenanceVehicleIds(open.map((j) => j.vehicleId));
          })
          .catch(() => { if (active) setMaintenanceVehicleIds([]); });
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
    // latestNotificationId: refetch immediately whenever something changes
    // (a vehicle rented/returned, a new request) so the cards stay real-time.
  }, [isRental, canSeeFleet, canSeeRequests, canSeeMaintenance, latestNotificationId]);
  /** Main rental owner (not a restricted staff sub-account). */
  const isMainRental = isRental && !(user?.allowed_nav_paths?.length);
  const [staffCount, setStaffCount] = useState(0);
  useEffect(() => {
    let active = true;
    if (isMainRental && user?.id) {
      listRentalStaff(user.id)
        .then((s) => { if (active) setStaffCount(s.length); })
        .catch(() => { if (active) setStaffCount(0); });
    } else {
      setStaffCount(0);
    }
    return () => { active = false; };
  }, [isMainRental, user?.id]);

  // Driver booking stats — fetched from the real API and refreshed on a timer
  // so approvals show up without a manual reload. Cards: trips, requests.
  const [driverTripsCount, setDriverTripsCount] = useState(0);
  const [driverRequestsCount, setDriverRequestsCount] = useState(0);
  const [driverRequests, setDriverRequests] = useState<DriverRequest[]>([]);
  useEffect(() => {
    if (!isDriver) {
      setDriverTripsCount(0);
      setDriverRequestsCount(0);
      setDriverRequests([]);
      return;
    }
    let active = true;
    const refresh = () => {
      listMyRequests()
        .then((reqs) => {
          if (!active) return;
          // A "trip" = a completed (returned) booking only, matching the My trips
          // page, so the stat card and that page always show the same count.
          setDriverTripsCount(reqs.filter((r) => r.status === 'completed').length);
          setDriverRequestsCount(reqs.filter((r) => r.status === 'pending').length);
          setDriverRequests(reqs);
        })
        .catch(() => {
          if (!active) return;
          setDriverTripsCount(0);
          setDriverRequestsCount(0);
          setDriverRequests([]);
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [isDriver]);

  // "Active rentals" card — the total number of rental providers currently
  // available to rent from. Both rental COMPANIES and INDIVIDUAL OWNERS are
  // rental users; the browse endpoint returns every active, non-suspended
  // provider that has an available vehicle, regardless of type, so this counts
  // them all. (Previously this card showed only the driver's own approved
  // bookings, which did not reflect all active rentals in the system.)
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);
  useEffect(() => {
    if (!isDriver) {
      setActiveRentalsCount(0);
      return;
    }
    let active = true;
    const refresh = () => {
      browseListRentals()
        .then(({ rentals }) => { if (active) setActiveRentalsCount(rentals.length); })
        .catch(() => { if (active) setActiveRentalsCount(0); });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [isDriver]);

  // A vehicle counts as "in maintenance" if its status says so OR it has an
  // open maintenance job. Both the card and the chart use this single rule, so
  // the "Active maintenance" number always matches the maintenance bar.
  const maintenanceIds = useMemo(() => new Set(maintenanceVehicleIds), [maintenanceVehicleIds]);
  const inMaintenance = useMemo(
    () => (v: Vehicle) => v.status === 'maintenance' || maintenanceIds.has(v.id),
    [maintenanceIds],
  );

  const maintenanceCount = useMemo(
    () => vehicles.filter(inMaintenance).length,
    [vehicles, inMaintenance],
  );
  const pendingRequestsCount = useMemo(
    () => incomingRequests.filter((r) => r.status === 'pending').length,
    [incomingRequests],
  );
  // Currently-rented vehicles = fleet vehicles whose status is 'rented' (an
  // active rental). Updates in real time via the refresh timer + notifications.
  const rentedVehiclesCount = useMemo(
    () => vehicles.filter((v) => v.status === 'rented').length,
    [vehicles],
  );

  const vehiclesByStatus = useMemo(() => {
    const maintenance = vehicles.filter(inMaintenance).length;
    const available = vehicles.filter((v) => v.status === 'available' && !inMaintenance(v)).length;
    const rented = vehicles.filter((v) => v.status === 'rented' && !inMaintenance(v)).length;
    return [
      { label: 'Available', value: available, color: 'success.main', href: `${ROUTES.FLEET}?status=available` },
      { label: 'Rented', value: rented, color: 'info.main', href: `${ROUTES.FLEET}?status=rented` },
      { label: 'Maintenance', value: maintenance, color: 'warning.main', href: `${ROUTES.FLEET}?status=maintenance` },
    ];
  }, [vehicles, inMaintenance]);

  // Recent activity feed (real data) — newest 5 booking requests for a rental,
  // or the driver's own newest 5 requests. Auto-refreshes with the timers above.
  const recentActivity = useMemo(() => {
    if (isRental) {
      return [...incomingRequests]
        .filter((r) => matchesRentalStatusFilter(r.status, feedStatus))
        .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''))
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          title: `${r.vehicleMake} ${r.vehicleModel}`.trim(),
          subtitle: r.driverName,
          when: r.requestedAt,
          status: r.status,
          statusLabel: r.status === 'request_info' ? 'Info requested' : r.status,
        }));
    }
    if (isDriver) {
      return [...driverRequests]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          title: `${r.vehicleMake} ${r.vehicleModel}`.trim(),
          subtitle: r.rentalName,
          when: r.createdAt,
          status: r.status,
          statusLabel: r.statusDisplay,
        }));
    }
    return [];
  }, [isRental, isDriver, incomingRequests, driverRequests, feedStatus]);

  // Deep-link the feed (and its "View all") to the Rental Requests page, carrying
  // the selected status so the destination shows the same filtered set.
  const rentalRequestsHref = feedStatus !== 'all'
    ? `${ROUTES.RENTAL_REQUESTS}?status=${feedStatus}`
    : ROUTES.RENTAL_REQUESTS;

  // Deep-link a single recent-activity row to its own record so the destination
  // page flashes/scrolls to it (carrying the feed's status filter for rentals).
  const activityRowHref = (id: string) => {
    if (isRental) {
      const params = new URLSearchParams();
      if (feedStatus !== 'all') params.set('status', feedStatus);
      params.set('highlight', id);
      return `${ROUTES.RENTAL_REQUESTS}?${params.toString()}`;
    }
    return `${ROUTES.MY_REQUESTS}?highlight=${id}`;
  };

  // Driver: real trips per month over the last 6 calendar months. A trip is a
  // completed (returned) booking, bucketed by its start date (falling back to
  // when it was requested).
  const driverTripsByMonth = useMemo(() => {
    if (!isDriver) return [];
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.toLocaleString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, count: 0 };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    driverRequests
      .filter((r) => r.status === 'completed')
      .forEach((r) => {
        const d = new Date(r.startDate || r.createdAt);
        if (Number.isNaN(d.getTime())) return;
        const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
        if (i !== undefined) buckets[i].count += 1;
      });
    return buckets;
  }, [isDriver, driverRequests]);

  // Rental: real booking requests received per month over the last 6 calendar
  // months, bucketed by when each request was made.
  const requestsByMonth = useMemo(() => {
    if (!isRental) return [];
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.toLocaleString('en-US', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, count: 0 };
    });
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    incomingRequests.forEach((r) => {
      const d = new Date(r.requestedAt);
      if (Number.isNaN(d.getTime())) return;
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) buckets[i].count += 1;
    });
    return buckets;
  }, [isRental, incomingRequests]);

  // Driver: a breakdown of their booking requests by status (right-side chart).
  const driverRequestsByStatus = useMemo(() => {
    const count = (s: string) => driverRequests.filter((r) => r.status === s).length;
    return [
      { label: 'Pending', value: count('pending') + count('info_requested'), color: 'warning.main', href: `${ROUTES.MY_REQUESTS}?status=pending` },
      { label: 'Running', value: count('running'), color: 'info.main', href: `${ROUTES.MY_TRIPS}?status=running` },
      { label: 'Completed', value: count('completed'), color: 'success.main', href: `${ROUTES.MY_TRIPS}?status=completed` },
      { label: 'Declined', value: count('rejected') + count('cancelled'), color: 'error.main', href: `${ROUTES.MY_REQUESTS}?status=rejected` },
    ];
  }, [driverRequests]);

  const statCards = useMemo(() => {
    if (isDriver) {
      return [
        {
          labelKey: 'dashboard.statsTrips',
          value: driverTripsCount,
          icon: Route,
          path: ROUTES.MY_TRIPS,
          color: theme.palette.primary.main,
        },
        {
          labelKey: 'dashboard.statsActiveRental',
          value: activeRentalsCount,
          icon: Assignment,
          path: ROUTES.VEHICLES,
          color: theme.palette.success.main,
        },
        {
          labelKey: 'dashboard.statsRequests',
          value: driverRequestsCount,
          icon: RequestQuote,
          // Card counts pending requests → open My Requests filtered to Pending.
          path: `${ROUTES.MY_REQUESTS}?status=pending`,
          color: theme.palette.warning.main,
        },
        {
          labelKey: 'dashboard.statsNotifications',
          value: unreadCount,
          icon: Notifications,
          path: ROUTES.NOTIFICATIONS,
          color: theme.palette.info.main,
        },
      ];
    }
    if (isRental) {
      return [
        // Each card is shown only when the user is allowed to see that section
        // (the owner sees all; a staff member only their granted sections).
        ...(canSeeRequests ? [{
          labelKey: 'dashboard.statsRequests',
          value: pendingRequestsCount,
          icon: RequestQuote,
          // Card counts pending requests → open Rental Requests filtered to Pending.
          path: `${ROUTES.RENTAL_REQUESTS}?status=pending`,
          color: theme.palette.warning.main,
        }] : []),
        ...(canSeeFleet ? [{
          labelKey: 'dashboard.statsVehicles',
          value: vehiclesCount,
          icon: DirectionsCar,
          path: ROUTES.FLEET,
          color: theme.palette.primary.main,
        }] : []),
        ...(canSeeMaintenance ? [{
          labelKey: 'dashboard.statsMaintenance',
          value: maintenanceCount,
          icon: Build,
          path: ROUTES.MAINTENANCE,
          color: theme.palette.error.main,
        }] : []),
        // Currently-rented vehicles → deep-links to the running rentals on the
        // Rental Requests page (needs both the fleet count and requests access).
        ...(canSeeFleet && canSeeRequests ? [{
          labelKey: 'dashboard.statsRentedVehicles',
          value: rentedVehiclesCount,
          icon: CarRental,
          path: `${ROUTES.RENTAL_REQUESTS}?status=running`,
          color: theme.palette.info.main,
        }] : []),
        ...(isMainRental
          ? [
              {
                labelKey: 'dashboard.statsStaff',
                value: staffCount,
                icon: People,
                path: ROUTES.RENTAL.STAFF,
                color: theme.palette.secondary.main,
              },
            ]
          : []),
        {
          labelKey: 'dashboard.statsNotifications',
          value: unreadCount,
          icon: Notifications,
          path: ROUTES.NOTIFICATIONS,
          color: theme.palette.info.main,
        },
      ];
    }
    return [
      {
        labelKey: 'dashboard.statsVehicles',
        value: vehiclesCount,
        icon: DirectionsCar,
        path: ROUTES.FLEET,
        color: theme.palette.primary.main,
      },
      {
        labelKey: 'dashboard.statsRequests',
        value: pendingRequestsCount,
        icon: RequestQuote,
        path: ROUTES.RENTAL_REQUESTS,
        color: theme.palette.warning.main,
      },
      {
        labelKey: 'dashboard.statsNotifications',
        value: unreadCount,
        icon: Notifications,
        path: null,
        color: theme.palette.info.main,
      },
    ];
  }, [
    isDriver,
    isRental,
    isMainRental,
    staffCount,
    driverTripsCount,
    activeRentalsCount,
    driverRequestsCount,
    unreadCount,
    vehiclesCount,
    pendingRequestsCount,
    maintenanceCount,
    rentedVehiclesCount,
    canSeeRequests,
    canSeeFleet,
    canSeeMaintenance,
    theme.palette,
  ]);

  return (
    <Box sx={{ width: '100%', minHeight: '100%', maxWidth: '100%' }}>
      {/* Welcome hero */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 0,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'primary.contrastText',
            boxShadow: `0 4px 20px ${theme.palette.primary.main}40`,
          }}
        >
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            {t('dashboard.welcome')}{firstName ? `, ${firstName}` : ''}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.95 }}>
            {isRental ? t('dashboard.welcomeSubtitleRental') : t('dashboard.welcomeSubtitle')}
          </Typography>
        </Box>
      </motion.div>

      {/* Stats cards */}
      <Box sx={{ px: { xs: 2, sm: 3 }, mt: -2, position: 'relative', zIndex: 1 }}>
        <motion.div
          variants={listVariants}
          initial="initial"
          animate="animate"
          style={{ width: '100%' }}
        >
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Box
                  key={stat.labelKey}
                  sx={{
                    flex: '1 1 0',
                    minWidth: { xs: '100%', sm: 220 },
                    maxWidth: { sm: statCards.length >= 4 ? '25%' : '33.333%' },
                  }}
                >
                  <motion.div variants={listItemVariants} style={{ width: '100%', minWidth: 0, height: '100%' }}>
                    <Paper
                      elevation={0}
                      onClick={() => stat.path && navigate(stat.path)}
                      sx={{
                        p: 2.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'divider',
                        width: '100%',
                        maxWidth: '100%',
                        height: 160,
                        minHeight: 160,
                        cursor: stat.path ? 'pointer' : 'default',
                        transition: 'box-shadow 0.25s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                        '&:hover': stat.path
                          ? {
                              boxShadow: theme.shadows[4],
                              '& .stat-action': { opacity: 1 },
                            }
                          : {},
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1, flexShrink: 0 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: `${stat.color}18`,
                          }}
                        >
                          <Icon sx={{ color: stat.color, fontSize: 28 }} />
                        </Box>
                        {stat.path && (
                          <ChevronRight className="stat-action" sx={{ opacity: 0.5, fontSize: 20, mt: 0.5 }} />
                        )}
                      </Box>
                      <Typography variant="h4" fontWeight={700} color="text.primary">
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(stat.labelKey)}
                      </Typography>
                    </Paper>
                  </motion.div>
                </Box>
              );
            })}
          </Box>
        </motion.div>
      </Box>

      {/* Charts / graphs */}
      <Box sx={{ p: { xs: 2, sm: 3 }, pt: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {isDriver ? (
            <>
              {/* Driver: My trips per month (last 6 months) — half-width bar chart */}
              <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('dashboard.chartMyTripsTrend')}
                  </Typography>
                  {driverTripsByMonth.every((d) => d.count === 0) ? (
                    <ChartEmptyState message={t('dashboard.chartNoData')} />
                  ) : (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, height: 140 }}>
                    {driverTripsByMonth.map((item) => {
                      const maxCount = Math.max(...driverTripsByMonth.map((d) => d.count), 1);
                      const heightPct = (item.count / maxCount) * 100;
                      return (
                        <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, opacity: item.count > 0 ? 1 : 0 }}>
                            {item.count}
                          </Typography>
                          <Box
                            sx={{
                              width: '100%',
                              maxWidth: 32,
                              height: `${heightPct}%`,
                              minHeight: item.count > 0 ? 8 : 0,
                              borderRadius: '4px 4px 0 0',
                              bgcolor: 'primary.main',
                              transition: 'height 0.5s ease',
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                            {item.month}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  )}
                </Paper>
              </motion.div>

              {/* Driver: requests by status — half-width horizontal bar chart */}
              <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('dashboard.chartMyRequestsByStatus')}
                  </Typography>
                  {driverRequestsByStatus.every((d) => d.value === 0) ? (
                    <ChartEmptyState message={t('dashboard.chartNoData')} />
                  ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                    {driverRequestsByStatus.map((item) => {
                      const maxVal = Math.max(...driverRequestsByStatus.map((d) => d.value), 1);
                      const pct = (item.value / maxVal) * 100;
                      return (
                        <Box
                          key={item.label}
                          onClick={() => item.href && navigate(item.href)}
                          sx={{
                            cursor: item.href ? 'pointer' : 'default',
                            borderRadius: 1,
                            p: 0.5,
                            mx: -0.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': item.href ? { bgcolor: 'action.hover' } : {},
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                            <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                          </Box>
                          <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 1, transition: 'width 0.5s ease' }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  )}
                </Paper>
              </motion.div>
            </>
          ) : (
            <>
              {/* Rental staff: show requests trend first; admin/mechanic: vehicles first */}
              {isRental && canSeeRequests && (
                <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('dashboard.chartRequestsTrend')}
                    </Typography>
                    {requestsByMonth.every((d) => d.count === 0) ? (
                      <ChartEmptyState message={t('dashboard.chartNoData')} />
                    ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, height: 140 }}>
                      {requestsByMonth.map((item) => {
                        const maxCount = Math.max(...requestsByMonth.map((d) => d.count), 1);
                        const heightPct = (item.count / maxCount) * 100;
                        return (
                          <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, opacity: item.count > 0 ? 1 : 0 }}>
                              {item.count}
                            </Typography>
                            <Box sx={{ width: '100%', maxWidth: 32, height: `${heightPct}%`, minHeight: item.count > 0 ? 8 : 0, borderRadius: '4px 4px 0 0', bgcolor: 'primary.main', transition: 'height 0.5s ease' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{item.month}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                    )}
                  </Paper>
                </motion.div>
              )}

              {/* Vehicles by status – horizontal bar chart (hidden from staff without fleet access) */}
              {canSeeFleet && (
              <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {t('dashboard.chartVehiclesByStatus')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                    {vehiclesByStatus.map((item) => {
                      const maxVal = Math.max(...vehiclesByStatus.map((d) => d.value), 1);
                      const pct = (item.value / maxVal) * 100;
                      return (
                        <Box
                          key={item.label}
                          onClick={() => item.href && navigate(item.href)}
                          sx={{
                            cursor: item.href ? 'pointer' : 'default',
                            borderRadius: 1,
                            p: 0.5,
                            mx: -0.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': item.href ? { bgcolor: 'action.hover' } : {},
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                            <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                          </Box>
                          <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 1, transition: 'width 0.5s ease' }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </motion.div>
              )}

              {/* Rental requests trend – for admin/mechanic; rental already shown above */}
              {!isRental && (
                <motion.div variants={cardVariants} initial="initial" animate="animate" style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('dashboard.chartRequestsTrend')}
                    </Typography>
                    {requestsByMonth.length === 0 ? (
                      <ChartEmptyState message={t('dashboard.chartNoData')} />
                    ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2, height: 140 }}>
                      {requestsByMonth.map((item) => {
                        const maxCount = Math.max(...requestsByMonth.map((d) => d.count), 1);
                        const heightPct = (item.count / maxCount) * 100;
                        return (
                          <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', maxWidth: 32, height: `${heightPct}%`, minHeight: item.count > 0 ? 8 : 0, borderRadius: '4px 4px 0 0', bgcolor: 'primary.main', transition: 'height 0.5s ease' }} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{item.month}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                    )}
                  </Paper>
                </motion.div>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Recent activity — real, auto-refreshing feed (rental + driver).
          Hidden from a rental staff member without the booking-requests grant. */}
      {((isRental && canSeeRequests) || isDriver) && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
          <motion.div variants={cardVariants} initial="initial" animate="animate">
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {isRental ? 'Recent booking requests' : 'My recent requests'}
                  </Typography>
                  <LiveBadge />
                </Box>
                <Button
                  size="small"
                  onClick={() => navigate(isRental ? rentalRequestsHref : ROUTES.MY_REQUESTS)}
                  sx={{ textTransform: 'none' }}
                >
                  {t('dashboard.viewAll')}
                </Button>
              </Box>

              {/* Status filter — same options/behaviour as the Rental Requests page. */}
              {isRental && (
                <ToggleButtonGroup
                  value={feedStatus} exclusive size="small"
                  onChange={(_, v) => { if (v) setFeedStatus(v); }}
                  sx={{ mb: 1.5, flexWrap: 'wrap' }}
                >
                  {RENTAL_STATUS_FILTERS.map((f) => (
                    <ToggleButton key={f.value} value={f.value} sx={{ textTransform: 'none', px: 1.5 }}>
                      {t(f.labelKey, f.fallback)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}

              {recentActivity.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <RequestQuote sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {isRental
                      ? (feedStatus === 'all' ? 'No booking requests yet.' : 'No requests with this status.')
                      : 'You have not requested any vehicles yet.'}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {recentActivity.map((item) => (
                    <Box
                      key={item.id}
                      onClick={() => navigate(activityRowHref(item.id))}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1.5,
                        px: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        transition: 'background-color 0.2s ease',
                        '&:last-of-type': { borderBottom: 'none' },
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: `${theme.palette.primary.main}14`,
                        }}
                      >
                        <DirectionsCar sx={{ color: 'primary.main', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.title || 'Vehicle'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {item.subtitle}{item.when ? ` · ${timeAgo(item.when)}` : ''}
                        </Typography>
                      </Box>
                      <Chip
                        label={item.statusLabel}
                        size="small"
                        color={statusColor(item.status)}
                        variant="outlined"
                        sx={{ textTransform: 'capitalize', flexShrink: 0 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </motion.div>
        </Box>
      )}
    </Box>
  );
};

export default DashboardView;
