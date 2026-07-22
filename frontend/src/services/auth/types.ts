// Authentication related types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  // Tokens are NOT returned in the body — the backend delivers them as HttpOnly
  // cookies, so they never touch JavaScript.
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  user: User;
  // Tokens are delivered as HttpOnly cookies, not in the body.
}

// Refresh is cookie-driven: the browser sends the HttpOnly refresh cookie, so
// there is no token to pass in or read back — only an acknowledgement.
export type RefreshTokenRequest = Record<string, never>;

export interface RefreshTokenResponse {
  detail: string;
}

export interface User {
  id: number;        // Changed from string to number
  email: string;
  first_name: string; // Changed from firstName
  last_name: string;  // Changed from lastName
  full_name: string;  // Added full_name
  role: string;       // Changed to string (your API uses custom roles)
  role_display: string; // Added role_display
  date_joined: string;  // Changed from createdAt
  is_active: boolean;   // Changed from isEmailVerified
  /** True when the account is suspended: can log in but is locked to the Profile page. */
  is_suspended?: boolean;
  /** Message shown to a suspended user explaining why (admin reason or GPS message). */
  suspension_reason?: string;
  phone_number?: string; // Optional; used for OTP / contact
  /** When set for role rental, sidebar shows only these paths (plus Dashboard). Main rental has this undefined. */
  allowed_nav_paths?: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// API Error types
export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// API Response wrapper - your API returns data directly, not wrapped
export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
  success: boolean;
}
