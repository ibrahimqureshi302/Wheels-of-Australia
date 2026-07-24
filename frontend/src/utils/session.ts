import type { User } from '../services/auth/types';

// LocalStorage keys.
// NOTE: the session tokens are NOT here — they live in HttpOnly cookies set by
// the backend and are invisible to JavaScript. We only cache the (non-sensitive)
// user profile so the SPA can render role-based nav instantly on reload; the
// cookie remains the real source of truth, re-validated via /auth/me/.
const USER_KEY = 'user_data';
const PENDING_PHONE_VERIFY_KEY = 'pending_phone_verification';

export const sessionUtils = {
  // Pending phone OTP verification (after register; back button should return to OTP, not dashboard)
  setPendingPhoneVerification: () => {
    try {
      localStorage.setItem(PENDING_PHONE_VERIFY_KEY, '1');
    } catch (error) {
      console.error('Failed to set pending verification flag:', error);
    }
  },
  hasPendingPhoneVerification: (): boolean => {
    try {
      return localStorage.getItem(PENDING_PHONE_VERIFY_KEY) === '1';
    } catch {
      return false;
    }
  },
  clearPendingPhoneVerification: () => {
    try {
      localStorage.removeItem(PENDING_PHONE_VERIFY_KEY);
    } catch (error) {
      console.error('Failed to clear pending verification flag:', error);
    }
  },

  // User data management
  setUser: (user: User) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  },

  getUser: (): User | null => {
    try {
      const userData = localStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  },

  removeUser: () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch (error) {
      console.error('Failed to remove user data:', error);
    }
  },

  // Session checks.
  // The token is an HttpOnly cookie JS cannot read, so "authenticated" is the
  // presence of a cached user. The backend is the authority: an expired/cleared
  // cookie makes /auth/me/ (and every API call) 401, which the API client turns
  // into an auto-logout that clears this cached user.
  isAuthenticated: (): boolean => {
    return !!sessionUtils.getUser();
  },

  // Clear all local session data (the cookies themselves are cleared server-side
  // by POST /auth/logout/).
  clearSession: () => {
    sessionUtils.removeUser();
    sessionUtils.clearPendingPhoneVerification();
  },

  // Initialize session from storage
  initializeSession: () => {
    const user = sessionUtils.getUser();
    if (user) {
      return { user, isAuthenticated: true };
    }
    return { user: null, isAuthenticated: false };
  },
};
