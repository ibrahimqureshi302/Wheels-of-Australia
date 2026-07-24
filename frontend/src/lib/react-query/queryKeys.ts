// Centralized Query Keys Factory for React Query
// This ensures consistent cache keys across the application

export const queryKeys = {
  // Authentication queries
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },

  // Products queries (example entity)
  products: {
    all: ['products'] as const,
    lists: () => [...queryKeys.products.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, 'detail'] as const,
    detail: (id: number | string) => [...queryKeys.products.details(), id] as const,
    categories: () => [...queryKeys.products.all, 'categories'] as const,
    search: (query: string) => [...queryKeys.products.all, 'search', query] as const,
  },

  // Orders queries (example entity)
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.orders.lists(), { filters }] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: number | string) => [...queryKeys.orders.details(), id] as const,
  },

  // Dashboard queries
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    analytics: (period: string) => 
      [...queryKeys.dashboard.all, 'analytics', period] as const,
  },
} as const;

// Helper function to invalidate related queries
export const getInvalidationKeys = {
  // When product is updated, invalidate product queries
  product: (productId?: number | string) => [
    queryKeys.products.lists(),
    queryKeys.products.categories(),
    ...(productId ? [queryKeys.products.detail(productId)] : []),
  ],

  // When order is updated, invalidate order-related queries
  order: (orderId?: number | string) => [
    queryKeys.orders.lists(),
    ...(orderId ? [queryKeys.orders.detail(orderId)] : []),
    queryKeys.dashboard.stats(),
  ],
};
