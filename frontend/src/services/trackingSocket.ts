/**
 * Real-time GPS tracking over WebSockets (Phase 5 — live upgrade).
 *
 * A thin wrapper around the browser WebSocket that:
 *  - derives the `ws(s)://` URL from the REST API base URL (same host, root
 *    `/ws/track/<vehicleId>/` path — NOT under `/api`),
 *  - authenticates purely from the HttpOnly access-token cookie, which the
 *    browser attaches to the handshake automatically (nothing to pass in JS),
 *  - auto-reconnects with capped backoff if the connection drops.
 *
 * Both sides use the same socket: a driver calls `send(...)` to push positions;
 * a viewer (owner/admin) reads them via the `onPosition` handler. The HTTP
 * endpoints in `services/tracking.ts` remain as a fallback when the socket is
 * unavailable, so tracking degrades gracefully rather than breaking.
 */
// Same rule as the REST client (keep in sync): raw Vite (:3000) talks to the
// backend on :8000; anything else (the nginx proxy, incl. https://<ip>:8443)
// uses the same origin, so the tracking WebSocket becomes wss:// over the proxy.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.port === '3000'
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : `${window.location.protocol}//${window.location.host}/api`);

/** A live position pushed from the server. */
export interface LivePosition {
  vehicleId: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recordedAt: string;
}

export interface TrackingSocketHandlers {
  /** A new position arrived (viewer side). */
  onPosition?: (pos: LivePosition) => void;
  /** The server says this trip is no longer active — stop tracking. */
  onInactive?: () => void;
  /** The socket opened (or re-opened after a drop). */
  onOpen?: () => void;
  /** The socket closed (before any auto-reconnect attempt). */
  onClose?: () => void;
}

export interface TrackingSocket {
  /** Push the driver's current position. No-op until the socket is open. */
  send: (latitude: number, longitude: number, accuracy?: number | null) => void;
  /** True while the underlying socket is OPEN. */
  isOpen: () => boolean;
  /** Close permanently (cancels reconnection). */
  close: () => void;
}

/** Build `ws(s)://<api-host>/ws/track/<vehicleId>/` from the REST base URL. */
export function trackingSocketUrl(vehicleId: number): string {
  const api = new URL(API_BASE_URL, window.location.origin);
  const proto = api.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${api.host}/ws/track/${vehicleId}/`;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

/**
 * Open a resilient tracking socket for one vehicle. Returns a controller; call
 * `close()` on unmount. Reconnection uses exponential backoff capped at 30s.
 */
export function createTrackingSocket(
  vehicleId: number,
  handlers: TrackingSocketHandlers = {},
): TrackingSocket {
  let ws: WebSocket | null = null;
  let closedByCaller = false;
  let attempt = 0;
  let reconnectTimer: number | null = null;

  const connect = () => {
    if (closedByCaller) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(trackingSocketUrl(vehicleId));
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      handlers.onOpen?.();
    };

    socket.onmessage = (evt) => {
      let data: unknown;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      const msg = data as Record<string, unknown>;
      if (msg.type === 'position') {
        handlers.onPosition?.({
          vehicleId: Number(msg.vehicle_id),
          latitude: Number(msg.latitude),
          longitude: Number(msg.longitude),
          accuracy: msg.accuracy == null ? null : Number(msg.accuracy),
          recordedAt: String(msg.recorded_at),
        });
      } else if (msg.type === 'inactive') {
        handlers.onInactive?.();
      }
    };

    socket.onclose = () => {
      handlers.onClose?.();
      if (!closedByCaller) scheduleReconnect();
    };

    // An error is always followed by a close event — let onclose handle retry.
    socket.onerror = () => {};
  };

  const scheduleReconnect = () => {
    if (closedByCaller || reconnectTimer != null) return;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  connect();

  return {
    send: (latitude, longitude, accuracy = null) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ latitude, longitude, accuracy }));
      }
    },
    isOpen: () => ws != null && ws.readyState === WebSocket.OPEN,
    close: () => {
      closedByCaller = true;
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close();
      ws = null;
    },
  };
}
