// Common types for CRUD operations

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Sorting types
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filtering types
export interface FilterParams {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

// Combined query params
export interface QueryParams extends PaginationParams, SortParams, FilterParams {}

// API Response wrapper
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: Record<string, string[]>;
}

// Error response
export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  non_field_errors?: string[];
}

// Mutation response
export interface MutationResponse<T = any> {
  data: T;
  message: string;
  success: boolean;
}

// Base entity interface
export interface BaseEntity {
  id: number | string;
  created_at?: string;
  updated_at?: string;
}

// Loading states
export interface LoadingStates {
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  isSuccess: boolean;
}

// Mutation states
export interface MutationStates {
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: any;
}

// CRUD hook return types
export interface QueryHookReturn<T> extends LoadingStates {
  data: T | undefined;
  error: any;
  refetch: () => void;
}

export interface MutationHookReturn<TData, TVariables> extends MutationStates {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}
