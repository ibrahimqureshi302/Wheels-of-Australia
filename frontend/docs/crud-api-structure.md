# CRUD API Structure with TanStack React Query

This document explains the comprehensive CRUD API structure implemented in the application using TanStack React Query.

## 🏗️ Architecture Overview

The CRUD system is built with the following components:

1. **Enhanced API Client** - Global error handling & auto-logout
2. **Query Keys Factory** - Centralized cache management
3. **Type-Safe API Services** - Full CRUD operations
4. **React Query Hooks** - Queries & Mutations
5. **Toast Integration** - Success/Error notifications
6. **Loading States Management** - Unified loading handling

## 📁 File Structure

```
src/
├── lib/
│   ├── api/
│   │   └── client.ts              # Enhanced Axios client
│   └── react-query/
│       ├── client.ts              # React Query client
│       └── queryKeys.ts           # Centralized query keys
├── services/
│   ├── api/
│   │   └── users.ts               # User API endpoints
│   └── types/
│       ├── common.ts              # Common CRUD types
│       └── user.ts                # User-specific types
├── hooks/
│   └── api/
│       └── users/
│           ├── useUsers.ts        # Query hooks (GET)
│           ├── useUserMutations.ts # Mutation hooks (CUD)
│           └── index.ts           # Barrel exports
└── components/
    └── Users/
        └── UsersManagement/
            └── UsersManagement.tsx # Example CRUD UI
```

## 🚀 Key Features

### ✅ **1. Global Error Handling**

- **401 Auto-logout**: Automatically logs out user on unauthorized access
- **Status Code Handling**: Different messages for 400, 403, 404, 500, etc.
- **Network Error Handling**: Connection issues, timeouts
- **Toast Integration**: All errors show user-friendly messages

### ✅ **2. Success/Error Toast Messages**

All CRUD operations show appropriate toast messages:
- **Create**: "User created successfully!"
- **Update**: "User updated successfully!"
- **Delete**: "User deleted successfully!"
- **Errors**: Formatted API error messages

### ✅ **3. Loading States**

Comprehensive loading state management:
- **Query Loading**: `isLoading`, `isFetching`, `isRefetching`
- **Mutation Loading**: `isPending`, `isSuccess`, `isError`
- **Global Loading**: Overlay for critical operations

### ✅ **4. Cache Management**

Intelligent cache updates:
- **Optimistic Updates**: Immediate UI updates
- **Cache Invalidation**: Auto-refresh related data
- **Selective Updates**: Update specific cache entries

## 🔧 Usage Examples

### **Query Hooks (GET Operations)**

```typescript
import { useUsers, useUser } from '../hooks/api/users';

// Get all users with filters
const UsersComponent = () => {
  const { data, isLoading, error, refetch } = useUsers({
    search: 'john',
    role: 'admin',
    page: 1,
    limit: 10
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <div>
      {data?.results.map(user => (
        <div key={user.id}>{user.full_name}</div>
      ))}
    </div>
  );
};

// Get single user
const UserDetail = ({ userId }: { userId: number }) => {
  const { data: user, isLoading } = useUser(userId);
  
  if (isLoading) return <CircularProgress />;
  
  return <div>{user?.full_name}</div>;
};
```

### **Mutation Hooks (CUD Operations)**

```typescript
import { useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/api/users';

const UserActions = () => {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const handleCreate = () => {
    createUser.mutate({
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password: 'password123'
    });
  };

  const handleUpdate = (id: number) => {
    updateUser.mutate({
      id,
      data: { first_name: 'Updated Name' }
    });
  };

  const handleDelete = (id: number) => {
    deleteUser.mutate(id);
  };

  return (
    <div>
      <Button 
        onClick={handleCreate}
        disabled={createUser.isPending}
      >
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </Button>
    </div>
  );
};
```

### **Error Handling**

All errors are automatically handled by the global error handler:

```typescript
// 401 → Auto-logout + "Session expired" toast
// 400 → Validation error toast with details
// 403 → "Permission denied" toast
// 404 → "Resource not found" toast
// 500 → "Server error" toast
// Network → "Connection failed" toast
```

### **Loading States**

```typescript
const UsersList = () => {
  const { data, isLoading, isFetching } = useUsers();
  const deleteUser = useDeleteUser();

  return (
    <div>
      {/* Initial loading */}
      {isLoading && <CircularProgress />}
      
      {/* Background refetch indicator */}
      {isFetching && <LinearProgress />}
      
      {/* Mutation loading */}
      {deleteUser.isPending && <div>Deleting user...</div>}
      
      {/* Content */}
      {data?.results.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
};
```

## 🎯 Creating New CRUD Entities

To add a new entity (e.g., Products), follow this pattern:

### **1. Create Types**

```typescript
// src/services/types/product.ts
export interface Product extends BaseEntity {
  id: number;
  name: string;
  price: number;
  category: string;
  // ... other fields
}

export interface CreateProductRequest {
  name: string;
  price: number;
  category: string;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  category?: string;
}
```

### **2. Create API Service**

```typescript
// src/services/api/products.ts
export const productsApi = {
  getProducts: async (params?: QueryParams) => {
    const response = await apiClient.get('/products/', { params });
    return response.data;
  },
  
  getProduct: async (id: number) => {
    const response = await apiClient.get(`/products/${id}/`);
    return response.data;
  },
  
  createProduct: async (data: CreateProductRequest) => {
    const response = await apiClient.post('/products/', data);
    return response.data;
  },
  
  // ... other CRUD operations
};
```

### **3. Add Query Keys**

```typescript
// Add to src/lib/react-query/queryKeys.ts
products: {
  all: ['products'] as const,
  lists: () => [...queryKeys.products.all, 'list'] as const,
  list: (filters?: Record<string, any>) => 
    [...queryKeys.products.lists(), { filters }] as const,
  details: () => [...queryKeys.products.all, 'detail'] as const,
  detail: (id: number | string) => [...queryKeys.products.details(), id] as const,
},
```

### **4. Create Hooks**

```typescript
// src/hooks/api/products/useProducts.ts
export const useProducts = (params?: QueryParams) => {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productsApi.getProducts(params),
  });
};

// src/hooks/api/products/useProductMutations.ts
export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();

  return useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: (newProduct) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      showSuccess(`Product "${newProduct.name}" created successfully!`);
    },
  });
};
```

## 🔐 Security Features

- **Auto-logout on 401**: Clears tokens, cache, and redirects to login
- **Token Refresh**: Automatic token refresh on expiry
- **Request Retry**: Smart retry logic for failed requests
- **Error Boundary**: Graceful error handling

## 📊 Performance Optimizations

- **Stale-while-revalidate**: Fresh data with background updates
- **Cache Management**: Intelligent cache invalidation
- **Optimistic Updates**: Immediate UI feedback
- **Request Deduplication**: Prevent duplicate requests
- **Background Refetching**: Keep data fresh

## 🎨 UI Integration

The system integrates seamlessly with Material-UI components:
- Loading spinners and skeletons
- Error alerts and retry buttons
- Success/error toast notifications
- Disabled states during operations

Your CRUD API structure is now complete and ready to use! 🚀
