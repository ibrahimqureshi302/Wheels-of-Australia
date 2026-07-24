import axios, { AxiosError } from 'axios';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';

// API Configuration.
// When VITE_API_BASE_URL is set, use it. Otherwise derive the backend from the
// address the browser opened the site with:
//   • Raw Vite dev server (port 3000)  -> backend is a separate origin on :8000.
//   • Anything else (the nginx proxy, e.g. https://<ip>:8443) -> the proxy serves
//     /api and /ws from the SAME origin, so use it as-is. This is what lets the
//     phone use HTTPS (a secure context) and get live GPS, with no CORS/cookie
//     cross-site issues.
// Works for http://localhost:3000, http://<lan-ip>:3000, and https://<lan-ip>:8443
// without editing any env file.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.port === '3000'
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : `${window.location.protocol}//${window.location.host}/api`);

// Global toast function - will be set by the app
let globalShowToast: ((message: string | object, severity: 'success' | 'error' | 'warning' | 'info') => void) | null = null;

// Function to set the global toast function
export const setGlobalToast = (toastFn: typeof globalShowToast) => {
  globalShowToast = toastFn;
};

// Create axios instance.
// `withCredentials: true` makes the browser send the HttpOnly access/refresh
// cookies with every request — the session token lives in those cookies, never
// in JS-readable storage, so there is no Authorization header to set manually.
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Enhanced response interceptor with global error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosError['config'] & { _retry?: boolean };

    // Handle 401 - Unauthorized. The refresh token lives in an HttpOnly cookie,
    // so we POST to the refresh endpoint with credentials (no body needed) — the
    // backend reads the refresh cookie and sets a fresh access cookie. We never
    // see or store the tokens. The refresh endpoint itself is exempt to avoid an
    // infinite loop when the refresh cookie is also gone.
    const isRefreshCall = (originalRequest?.url || '').includes('/auth/jwt/refresh/');
    // Only attempt a token refresh + auto-logout when there is actually a cached
    // session to recover. Without this, a 401 from an anonymous request (e.g. the
    // public branding fetch on the login page, carrying a stale HttpOnly cookie)
    // would trigger refresh → logout → redirect → reload → repeat forever.
    const hasCachedSession = !!localStorage.getItem('user_data');
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall && hasCachedSession) {
      originalRequest._retry = true;

      try {
        // suppressErrorToast: a failed refresh is handled below (auto-logout),
        // we don't want the generic global toast for its 401.
        await apiClient.post('/auth/jwt/refresh/', undefined, { suppressErrorToast: true } as AxiosRequestConfig & { suppressErrorToast: boolean });
        // New access cookie is set by the browser; just replay the request.
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - force logout
        handleAutoLogout('Session expired. Please login again.');
        return Promise.reject(refreshError);
      }
    }

    // Handle other error status codes
    handleGlobalErrors(error);

    return Promise.reject(error);
  }
);

// Auto-logout function
const handleAutoLogout = (message: string = 'Session expired. Please login again.') => {
  // The tokens are HttpOnly cookies cleared server-side; locally we only drop the
  // cached (non-sensitive) user profile so the SPA stops rendering a stale session.
  localStorage.removeItem('user_data');

  // Already on the login page — nothing to log out from, and redirecting would
  // reload the page in a loop. Just drop the cached user and stop.
  if (window.location.pathname === '/login') return;

  // Show error toast
  if (globalShowToast) {
    globalShowToast(message, 'error');
  }

  // Clear React Query cache (will be handled by the auth context)
  // Redirect to login
  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
};

// Global error handler
const handleGlobalErrors = (error: AxiosError) => {
  if (!globalShowToast) return;

  const config = error.config as (AxiosError['config'] & { suppressErrorToast?: boolean }) | undefined;

  // Per-request opt-out: a caller can set `suppressErrorToast: true` to handle
  // the error itself without a global toast.
  if (config?.suppressErrorToast) return;

  const status = error.response?.status;
  const data = error.response?.data as Record<string, unknown>;

  // A 403/404 on a safe (read) request is almost always a page firing a
  // role-scoped call that the current role isn't allowed on (e.g. a driver's
  // dashboard touching a rental-only endpoint). Pages already handle these by
  // falling back to an empty state, so don't surface a global toast for them.
  // Mutations (POST/PATCH/DELETE) still toast so real user actions surface
  // permission errors.
  const method = (config?.method || 'get').toLowerCase();
  const isSafeMethod = method === 'get' || method === 'head' || method === 'options';
  if (isSafeMethod && (status === 403 || status === 404)) return;

  switch (status) {
    case 400:
      // Bad Request - show validation errors
      if (data) {
        globalShowToast(data, 'error');
      } else {
        globalShowToast('Invalid request. Please check your input.', 'error');
      }
      break;
    
    case 403:
      // Forbidden
      globalShowToast('You do not have permission to perform this action.', 'error');
      break;
    
    case 404:
      // Not Found
      globalShowToast('The requested resource was not found.', 'error');
      break;
    
    case 409:
      // Conflict
      globalShowToast(data?.message || 'A conflict occurred. Please try again.', 'error');
      break;
    
    case 422:
      // Unprocessable Entity - validation errors
      if (data) {
        globalShowToast(data, 'error');
      } else {
        globalShowToast('Validation failed. Please check your input.', 'error');
      }
      break;
    
    case 429:
      // Too Many Requests
      globalShowToast('Too many requests. Please wait a moment and try again.', 'warning');
      break;
    
    case 500:
      // Internal Server Error
      globalShowToast('Server error. Please try again later.', 'error');
      break;
    
    case 502:
    case 503:
    case 504:
      // Bad Gateway, Service Unavailable, Gateway Timeout
      globalShowToast('Service temporarily unavailable. Please try again later.', 'error');
      break;
    
    default:
      // Network errors or other errors
      if (!error.response) {
        globalShowToast('Network error. Please check your connection.', 'error');
      } else {
        globalShowToast('An unexpected error occurred. Please try again.', 'error');
      }
  }
};

export default apiClient;
