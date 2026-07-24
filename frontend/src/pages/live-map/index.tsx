import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { GpsFixed } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Bundle the marker images with the app instead of loading them from unpkg.com,
// so the pin renders on the self-signed-HTTPS LAN setup and offline.
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { fadeVariants } from '../../lib/animations';
import { useAuth } from '../../context/hooks';
import { fetchTrackedLocations, type TrackedVehicle } from '../../services/tracking';
import { createTrackingSocket } from '../../services/trackingSocket';

/** Fix default marker icon in Vite/bundled env */
const createDefaultIcon = () =>
  L.icon({
    iconUrl: markerIconUrl,
    iconRetinaUrl: markerIcon2xUrl,
    shadowUrl: markerShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

/** Car pin for a tracked rental vehicle — green when live, amber when its
 *  position has gone stale (driver's location likely off). */
const createVehicleIcon = (stale: boolean) =>
  L.divIcon({
    className: 'vehicle-marker',
    html: `<div style="
      width: 26px; height: 26px; border-radius: 50% 50% 50% 0;
      background: ${stale ? '#ed6c02' : '#2e7d32'}; transform: rotate(-45deg);
      border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
    "><span style="transform: rotate(45deg); font-size: 13px;">🚗</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });

/** A live position override arriving over the WebSocket. */
interface LivePos {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

/** Latest reported positions of vehicles out on active rentals. Shown to rental
 *  owners (their own fleet) and admins (all).
 *
 *  Two data paths: an HTTP poll every 30s establishes which vehicles are being
 *  tracked (and seeds their positions + stale flags), and a live WebSocket per
 *  vehicle pushes movement in near real time. Live pushes override the polled
 *  position; if the socket is down the poll alone keeps the map current. */
function TrackedVehicleMarkers() {
  const map = useMap();
  const [vehicles, setVehicles] = useState<TrackedVehicle[]>([]);
  const [live, setLive] = useState<Record<number, LivePos>>({});

  // HTTP poll — the source of truth for the tracked-vehicle list + fallback.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchTrackedLocations().then((v) => {
        if (!cancelled) setVehicles(v);
      });
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // One live socket per tracked vehicle. Re-run only when the SET of vehicle ids
  // changes (not on every 30s poll that returns the same ids).
  const idsKey = vehicles.map((v) => v.vehicleId).sort((a, b) => a - b).join(',');
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',').map(Number);
    const sockets = ids.map((vehicleId) =>
      createTrackingSocket(vehicleId, {
        onPosition: (pos) => {
          setLive((prev) => ({
            ...prev,
            [pos.vehicleId]: {
              latitude: pos.latitude,
              longitude: pos.longitude,
              recordedAt: pos.recordedAt,
            },
          }));
        },
      }),
    );
    return () => {
      sockets.forEach((s) => s.close());
    };
  }, [idsKey]);

  // Center the map on the tracked vehicles (the whole point of the fleet map),
  // not on the viewer's own location. Runs when the SET of vehicles changes
  // (first load / added / removed) — NOT on every live tick, so the map doesn't
  // fight the user panning while a driver moves.
  useEffect(() => {
    if (!idsKey) return;
    const pts = vehicles
      .map((v) => {
        const l = live[v.vehicleId];
        return [l?.latitude ?? v.latitude, l?.longitude ?? v.longitude] as [number, number];
      })
      .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
    if (pts.length === 1) {
      map.setView(pts[0], Math.max(map.getZoom(), 14));
    } else if (pts.length > 1) {
      map.fitBounds(pts, { padding: [60, 60] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return (
    <>
      {vehicles.map((v) => {
        const l = live[v.vehicleId];
        const latitude = l?.latitude ?? v.latitude;
        const longitude = l?.longitude ?? v.longitude;
        const recordedAt = l?.recordedAt ?? v.recordedAt;
        // A fresh live push means it's definitely not stale.
        const stale = l ? false : v.stale;
        return (
          <Marker key={v.vehicleId} position={[latitude, longitude]} icon={createVehicleIcon(stale)}>
            <Popup>
              <Box sx={{ minWidth: 170 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'block' }}>
                  {v.vehicleLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Driver: {v.driverName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Updated {new Date(recordedAt).toLocaleString()}
                </Typography>
                {stale && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                    Location stale — driver may have turned GPS off.
                  </Typography>
                )}
              </Box>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

type GpsStatus = 'idle' | 'prompt' | 'loading' | 'live' | 'denied' | 'lost' | 'disabled' | 'insecure';

function LiveMarker({ position }: { position: [number, number] }) {
  const { t } = useTranslation();
  const map = useMap();
  useEffect(() => {
    if (position[0] && position[1]) map.setView(position, map.getZoom());
  }, [position, map]);
  // This blue pin is the CURRENT viewer's own device position (driver, rental
  // owner, or admin) — NOT the tracked driver. The tracked driver/vehicle is the
  // green car marker (TrackedVehicleMarkers). Labeling this "Driver location"
  // made rental owners read their own position as the driver's.
  return (
    <Marker position={position} icon={createDefaultIcon()}>
      <Popup>{t('gps.yourLocation', 'Your location')}</Popup>
    </Marker>
  );
}

const LiveMapPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  // Rental owners/staff and admins see live vehicle positions; drivers only see
  // their own location (they report it for tracking, not view the fleet).
  const showsFleet = role === 'rental' || role === 'admin';
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const requestLocation = useCallback(() => {
    // Browser Geolocation only works in a secure context (HTTPS or localhost).
    // Over plain http://<ip> it fails silently, which looks like "GPS broken" —
    // so detect it up front and show a clear message instead.
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setGpsStatus('insecure');
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus('disabled');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setGpsStatus('live');
        const id = navigator.geolocation.watchPosition(
          (p) => setPosition([p.coords.latitude, p.coords.longitude]),
          () => setGpsStatus('lost'),
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
        setWatchId(id);
      },
      (err) => {
        if (err.code === 1) setGpsStatus('denied');
        else if (err.code === 2) setGpsStatus('lost');
        else setGpsStatus('disabled');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (gpsStatus !== 'live' && watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [gpsStatus, watchId]);

  /** Perth, WA default center; zoom 12 for city view */
  const defaultCenter: [number, number] = [-31.9505, 115.8605];
  const defaultZoom = 12;
  const mapCenter = position ?? defaultCenter;
  const mapZoom = position ? 15 : defaultZoom;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        overflow: 'hidden',
      }}
    >
      <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {/* Legend: which locations are shown on the map */}
          <Paper
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 8,
              zIndex: 1000,
              p: 1.5,
              maxWidth: 280,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 2,
            }}
          >
            <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ display: 'block', mb: 0.75 }}>
              {t('gps.legendTitle')}
            </Typography>
            {showsFleet ? (
              // Fleet viewers (rental/admin) track drivers, not themselves — the
              // only marker is the driver's live vehicle position.
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('gps.legendVehicles', '🚗 Driver location — rented vehicle (live GPS)')}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('gps.legendYourLocation')}
              </Typography>
            )}
          </Paper>

          {!showsFleet && (gpsStatus === 'denied' || gpsStatus === 'lost' || gpsStatus === 'disabled' || gpsStatus === 'insecure') && (
            <Paper
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                right: 8,
                zIndex: 1000,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {gpsStatus === 'denied'
                  ? t('gps.permissionDenied')
                  : gpsStatus === 'lost'
                    ? t('gps.gpsLost')
                    : gpsStatus === 'insecure'
                      ? t('gps.insecureContext')
                      : t('gps.locationDisabled')}
              </Typography>
              {gpsStatus !== 'insecure' && (
                <Button size="small" variant="outlined" startIcon={<GpsFixed />} onClick={requestLocation}>
                  {t('gps.allowLocation')}
                </Button>
              )}
            </Paper>
          )}

          {!showsFleet && gpsStatus === 'live' && position && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'success.main',
                color: 'white',
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                typography: 'caption',
                fontWeight: 600,
              }}
            >
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'white',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                }}
              />
              {t('gps.live')}
            </Box>
          )}

          {!showsFleet && (gpsStatus === 'idle' || gpsStatus === 'loading') && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
              }}
            >
              <Button
                variant="contained"
                startIcon={gpsStatus === 'loading' ? null : <GpsFixed />}
                onClick={requestLocation}
                disabled={gpsStatus === 'loading'}
                sx={{ borderRadius: 2, fontWeight: 600, textTransform: 'none', boxShadow: 2 }}
              >
                {gpsStatus === 'loading' ? t('common.loading') : t('gps.allowLocation')}
              </Button>
            </Box>
          )}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showsFleet && <TrackedVehicleMarkers />}
            {!showsFleet && position && <LiveMarker position={position} />}
          </MapContainer>
        </Box>
      </motion.div>
    </Box>
  );
};

export default LiveMapPage;
