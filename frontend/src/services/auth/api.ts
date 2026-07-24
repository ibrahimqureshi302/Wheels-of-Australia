import { apiClient } from '../../lib/api/client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
  User,
} from './types';

/** Normalize API user to frontend User shape (snake_case from API). */
function normalizeUser(apiUser: Record<string, unknown>): User {
  const dateJoined = apiUser.date_joined;
  return {
    id: Number(apiUser.id),
    email: String(apiUser.email ?? ''),
    first_name: String(apiUser.first_name ?? ''),
    last_name: String(apiUser.last_name ?? ''),
    full_name: String(apiUser.full_name ?? ''),
    // Default to 'driver' when role is missing so we never show admin portal by mistake
    role: String(apiUser.role ?? 'driver'),
    role_display: String(apiUser.role_display ?? ''),
    date_joined: typeof dateJoined === 'string' ? dateJoined : (dateJoined ? new Date(dateJoined as string).toISOString() : ''),
    is_active: Boolean(apiUser.is_active),
    is_suspended: Boolean(apiUser.is_suspended),
    suspension_reason: apiUser.suspension_reason != null ? String(apiUser.suspension_reason) : '',
    phone_number: apiUser.phone_number != null ? String(apiUser.phone_number) : undefined,
    allowed_nav_paths: Array.isArray(apiUser.allowed_nav_paths) ? apiUser.allowed_nav_paths as string[] : undefined,
  };
}

/** Extract a single error message from backend 400 response. */
export function getLoginErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Login failed. Please try again.';
  const d = err as Record<string, unknown>;
  if (typeof d.detail === 'string') return d.detail;
  const nonField = d.non_field_errors;
  if (Array.isArray(nonField) && nonField.length) return String(nonField[0]);
  const emailErr = d.email;
  if (Array.isArray(emailErr) && emailErr.length) return String(emailErr[0]);
  const passwordErr = d.password;
  if (Array.isArray(passwordErr) && passwordErr.length) return String(passwordErr[0]);
  return 'Invalid email or password.';
}

// Auth API endpoints
export const authApi = {
  /** Re-fetch the current user from the backend (source of truth for status,
   *  e.g. suspension applied after login). Returns the normalized User. */
  me: async (): Promise<User> => {
    const response = await apiClient.get<Record<string, unknown>>('/auth/me/');
    return normalizeUser(response.data ?? {});
  },

  // Login user. The backend sets the access/refresh tokens as HttpOnly cookies;
  // the response body carries only the user.
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await apiClient.post<Record<string, unknown>>('/auth/login/', data);
      const body = response.data;
      const user = normalizeUser((body.user as Record<string, unknown>) ?? {});
      return { user };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (axiosError.response?.data) {
          throw new Error(getLoginErrorMessage(axiosError.response.data));
        }
      }
      if (error instanceof Error) throw error;
      throw new Error('Login failed. Please try again.');
    }
  },

  // Self-registration is approval-based and goes through services/registrations/api.ts
  // (it creates a pending RegistrationRequest, not an account). This direct
  // register endpoint is intentionally not used.
  register: async (_data: RegisterRequest): Promise<RegisterResponse> => {
    throw new Error('Use services/registrations/api.ts — sign-up requires admin approval.');
  },

  // Refresh the access token. The HttpOnly refresh cookie is sent automatically
  // (withCredentials); the backend rotates the access cookie. No token in/out.
  refreshToken: async (): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/jwt/refresh/');
    return response.data;
  },

  // Logout user
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout/');
  },

  // Verify email
  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post('/auth/verify-email/', { token });
  },

  // Forgot password
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password/', { email });
  },

  // Reset password
  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post('/auth/reset-password/', { token, password });
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password/', {
      currentPassword,
      newPassword,
    });
  },
};
