/**
 * Background GPS tracking for drivers (Phase 5).
 *
 * While a logged-in driver has an active rental, this provider watches the
 * device's browser GPS and reports the position to the backend every ~45s. If
 * location permission is denied / unavailable, it shows a persistent banner
 * urging the driver to turn location on (the backend issues warnings server-side
 * for sustained outages; three warnings suspend the account). It mounts once,
 * inside AuthProvider, so it keeps running across every page during a trip.
 *
 * No-op for non-drivers and signed-out users.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useAuth } from './hooks';
import { listMyRequests } from '../services/rental/driverRequests';
import { reportLocation, reportLocationUnavailable } from '../services/tracking';
import { createTrackingSocket, type TrackingSocket } from '../services/trackingSocket';

// How often we push a position while a trip is active, and how often we re-check
// whether the driver still has an active trip.
const REPORT_INTERVAL_MS = 45_000;
const TRIP_POLL_MS = 60_000;
// When the live WebSocket is connected we push far more often (movement-driven,
// but never faster than this) so the owner's map moves in near real time. The
// server throttles its DB writes independently, so this doesn't add DB load.
// The HTTP fallback keeps the slower REPORT_INTERVAL_MS cadence.
const SOCKET_MIN_INTERVAL_MS = 3_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  children: ReactNode;
}

export const LocationTrackingProvider: React.FC<Props> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const isDriver = (user?.role || '').toLowerCase() === 'driver';
  // Suspended drivers are locked to their profile — don't track or call the API.
  const eligible = isAuthenticated && isDriver && !user?.is_suspended;

  const [hasActiveTrip, setHasActiveTrip] = useState(false);
  const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [insecure, setInsecure] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [maxStrikes, setMaxStrikes] = useState(3);

  const watchIdRef = useRef<number | null>(null);
  const lastReportRef = useRef(0);
  const lastSocketSendRef = useRef(0);
  const socketRef = useRef<TrackingSocket | null>(null);

  // --- Poll for an active (approved, not-yet-ended) trip --------------------
  useEffect(() => {
    if (!eligible) {
      setHasActiveTrip(false);
      setActiveVehicleId(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const reqs = await listMyRequests();
        const today = todayIso();
        const active = reqs.find(
          (r) => r.status === 'running' && (!r.endDate || r.endDate >= today),
        );
        if (!cancelled) {
          setHasActiveTrip(!!active);
          setActiveVehicleId(active ? Number(active.vehicleId) : null);
        }
      } catch {
        /* leave previous state */
      }
    };
    check();
    const id = window.setInterval(check, TRIP_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [eligible]);

  // --- Open/close the live tracking socket for the active trip --------------
  useEffect(() => {
    if (!eligible || activeVehicleId == null) {
      return;
    }
    const sock = createTrackingSocket(activeVehicleId, {
      // Server says the trip is no longer active — the trip poll will also
      // clear it shortly, but reset the send throttle so the fallback path is
      // ready immediately if a new trip starts.
      onInactive: () => {
        lastSocketSendRef.current = 0;
      },
    });
    socketRef.current = sock;
    return () => {
      sock.close();
      socketRef.current = null;
    };
  }, [eligible, activeVehicleId]);

  // --- Push a position ------------------------------------------------------
  // Prefer the live socket (fast, near-real-time). If it isn't open, fall back
  // to the throttled HTTP report so tracking still works and the server keeps
  // seeing fresh positions (no spurious location-off strikes).
  const pushPosition = useCallback((pos: GeolocationPosition) => {
    const now = Date.now();
    const sock = socketRef.current;
    if (sock && sock.isOpen()) {
      if (now - lastSocketSendRef.current < SOCKET_MIN_INTERVAL_MS) return;
      lastSocketSendRef.current = now;
      sock.send(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      setLocationOff(false);
      return;
    }
    // HTTP fallback (throttled).
    if (now - lastReportRef.current < REPORT_INTERVAL_MS) return;
    lastReportRef.current = now; // throttle now so concurrent fixes don't double-post
    reportLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).then((res) => {
      if (res) {
        setLocationOff(false);
        setWarnings(res.warnings);
      } else {
        // Report failed (network/API). Roll back the throttle so the next
        // position fix retries promptly instead of waiting a full interval —
        // otherwise the server sees a reporting gap and may issue a strike.
        lastReportRef.current = 0;
      }
    });
  }, []);

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    // 1 = permission denied, 2 = position unavailable, 3 = timeout.
    if (err.code === err.PERMISSION_DENIED || err.code === err.POSITION_UNAVAILABLE) {
      setLocationOff(true);
      reportLocationUnavailable().then((res) => {
        if (res) {
          setWarnings(res.warnings);
          setMaxStrikes(res.maxStrikes);
        }
      });
    }
  }, []);

  const startWatch = useCallback(() => {
    // Geolocation only works over HTTPS / localhost. On an insecure origin it
    // fails immediately — do NOT treat that as the driver hiding their location
    // (that would issue strikes and eventually suspend them for a deployment
    // problem). Surface a distinct banner and skip reporting instead.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setInsecure(true);
      return;
    }
    setInsecure(false);
    if (!('geolocation' in navigator) || watchIdRef.current != null) return;
    // Force an immediate first report so a brand-new trip is tracked at once.
    lastReportRef.current = 0;
    navigator.geolocation.getCurrentPosition(pushPosition, handleGeoError, {
      enableHighAccuracy: true,
      timeout: 27_000,
      maximumAge: 30_000,
    });
    watchIdRef.current = navigator.geolocation.watchPosition(pushPosition, handleGeoError, {
      enableHighAccuracy: true,
      timeout: 27_000,
      maximumAge: 30_000,
    });
  }, [pushPosition, handleGeoError]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // --- Start/stop watching based on eligibility + active trip ---------------
  useEffect(() => {
    if (eligible && hasActiveTrip) {
      startWatch();
    } else {
      stopWatch();
      setLocationOff(false);
      setInsecure(false);
    }
    return stopWatch;
  }, [eligible, hasActiveTrip, startWatch, stopWatch]);

  const retry = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(pushPosition, handleGeoError, {
      enableHighAccuracy: true,
      timeout: 27_000,
    });
  }, [pushPosition, handleGeoError]);

  const showBanner = eligible && hasActiveTrip && (locationOff || insecure);

  return (
    <>
      {children}
      <Snackbar
        open={showBanner}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: { xs: 7, sm: 8 } }}
      >
        {insecure ? (
          <Alert severity="info" variant="filled" sx={{ width: '100%', maxWidth: 560 }}>
            Location tracking needs a secure connection (HTTPS). Your trip can&apos;t be
            tracked over an insecure link — no warnings are counted while this is the case.
          </Alert>
        ) : (
          <Alert
            severity={warnings >= maxStrikes - 1 ? 'error' : 'warning'}
            variant="filled"
            action={
              <Button color="inherit" size="small" onClick={retry}>
                Enable
              </Button>
            }
            sx={{ width: '100%', maxWidth: 560 }}
          >
            {`Location is off for your active rental. Please turn it on${
              warnings > 0 ? ` — warning ${warnings} of ${maxStrikes}` : ''
            }. After ${maxStrikes} warnings your account is suspended.`}
          </Alert>
        )}
      </Snackbar>
    </>
  );
};

export default LocationTrackingProvider;
