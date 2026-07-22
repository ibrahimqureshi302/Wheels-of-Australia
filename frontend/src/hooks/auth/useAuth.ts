import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../services/auth/api';
import { sessionUtils } from '../../utils/session';
import { queryKeys } from '../../lib/react-query/client';
import type { LoginRequest, RegisterRequest } from '../../services/auth/types';
import type { User } from '../../services/auth/types';

// Helper function to safely extract error messages
const getErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  
  // If it's an Error object
  if (error instanceof Error) {
    return error.message;
  }
  
  // If it's an object with a message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const errorObj = error as { message: unknown };
    return typeof errorObj.message === 'string' ? errorObj.message : null;
  }
  
  // If it's a string
  if (typeof error === 'string') {
    return error;
  }
  
  return null;
};

// Auth hooks using React Query
export const useAuth = () => {
  const queryClient = useQueryClient();

  // Keep user in state so context/sidebar update immediately after login (role-based nav)
  const [user, setUser] = useState<User | null>(() => sessionUtils.getUser());

  // Sync from localStorage on mount (e.g. refresh or return with existing session),
  // then re-validate against the backend so account status changes made AFTER
  // login (e.g. an admin suspending the account, or a GPS auto-suspension) take
  // effect on the next load — not only after a manual re-login.
  useEffect(() => {
    setUser(sessionUtils.getUser());
    if (sessionUtils.isAuthenticated()) {
      authApi
        .me()
        .then((fresh) => {
          sessionUtils.setUser(fresh);
          setUser(fresh);
        })
        .catch(() => {
          /* keep the local user; apiClient handles real token-expiry 401s */
        });
    }
  }, []);

  // Keep auth state reactive to session changes made OUTSIDE the React tree:
  // another tab logging out, the API client clearing an expired token, or the
  // token being removed manually. Without this, a guarded page keeps rendering
  // with a stale session until the next navigation — so /dashboard stays up even
  // though there is no longer a valid token. Re-syncing `user` forces a re-render;
  // ProtectedRoute reads the live session and then redirects to /login when it's
  // gone. We re-check on cross-tab storage writes, tab focus, and visibility.
  useEffect(() => {
    const syncSession = () => {
      setUser(sessionUtils.isAuthenticated() ? sessionUtils.getUser() : null);
    };
    window.addEventListener('storage', syncSession);
    window.addEventListener('focus', syncSession);
    document.addEventListener('visibilitychange', syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('focus', syncSession);
      document.removeEventListener('visibilitychange', syncSession);
    };
  }, []);

  // Login mutation → real backend.
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Tokens were set as HttpOnly cookies by the backend; we only cache the user.
      sessionUtils.setUser(data.user);
      setUser(data.user);
      queryClient.setQueryData(queryKeys.auth.user(), data.user);
    },
    onError: (error: unknown) => {
      console.error('Login failed:', error);
      sessionUtils.clearSession();
    },
  });

  // Self-registration is approval-based and handled by the registration pages
  // (services/registrations/api.ts) — it does NOT sign the user in. This
  // mutation is kept only to satisfy the legacy hook/context interface.
  const registerMutation = useMutation({
    mutationFn: async (_data: RegisterRequest): Promise<void> => {
      throw new Error('Use the registration pages to sign up; accounts require admin approval.');
    },
    onError: (error: unknown) => {
      console.error('Registration failed:', error);
    },
  });

  // Logout (local session clear + best-effort backend logout)
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await authApi.logout().catch(() => { /* ignore — clear locally regardless */ });
    },
    onSuccess: () => {
      sessionUtils.clearSession();
      setUser(null);
      queryClient.clear();
      window.location.href = '/login';
    },
    onError: () => {
      sessionUtils.clearSession();
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  // Helper functions
  const login = async (credentials: LoginRequest) => {
    return loginMutation.mutateAsync(credentials);
  };

  const register = async (userData: RegisterRequest) => {
    return registerMutation.mutateAsync(userData);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  // Check authentication status - use localStorage data only
  const hasValidSession = sessionUtils.isAuthenticated();
  const isAuthenticated = hasValidSession;

  return {
    // User from state (updated on login/logout) so sidebar gets correct role immediately
    user,
    isAuthenticated,
    
    // Loading states
    loading: loginMutation.isPending,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    
    // Error states - safely access error messages
    error: getErrorMessage(loginMutation.error) || getErrorMessage(registerMutation.error) || null,
    loginError: getErrorMessage(loginMutation.error) || null,
    registerError: getErrorMessage(registerMutation.error) || null,
    
    // Actions
    login,
    register,
    logout,
    
    // Mutation objects (for additional control)
    loginMutation,
    registerMutation,
    logoutMutation,
  };
};
