import React, { createContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth as useAuthHook } from '../hooks/auth';
import type { User } from '../services/auth/types';
import type { RegisterRequest } from '../services/auth/types';

// Create context with the same interface as before for compatibility
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ user: User }>;
  register: (data: RegisterRequest) => Promise<unknown>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuthHook();

  // Adapt the new auth hook to match the old context interface
  const contextValue: AuthContextType = {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.isLoading,
    error: auth.error,
    login: async (email: string, password: string) => {
      const data = await auth.login({ email, password });
      return { user: data.user };
    },
    register: async (data) => {
      await auth.register(data);
    },
    logout: auth.logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Export the context for direct access if needed
export { AuthContext };

// Export the context type for TypeScript
export type { AuthContextType };