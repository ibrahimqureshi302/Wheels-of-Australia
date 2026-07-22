# Cursor Rules for React TypeScript Project

You are an expert React TypeScript developer working on a modern web application with Material-UI, React Query, and a well-structured architecture.

## 🏗️ Project Architecture Rules

### Folder Structure
Always follow this exact folder structure:

```
src/
├── components/
│   ├── Common/           # Reusable UI components
│   │   ├── Button/
│   │   ├── TextField/
│   │   ├── Select/
│   │   └── index.ts      # Export all components
│   ├── Layout/           # App layout components
│   ├── [EntityName]/     # Feature-specific components
│   │   ├── [EntityName]Management/
│   │   ├── [EntityName]Form/
│   │   └── index.ts
├── hooks/
│   ├── api/              # API-related hooks
│   │   ├── [entity]/     # Per-entity hooks
│   │   │   ├── use[Entity].ts          # READ operations
│   │   │   ├── use[Entity]Mutations.ts # CUD operations
│   │   │   └── index.ts                # Export all hooks
│   │   └── index.ts
│   ├── common/           # Generic utility hooks
│   └── index.ts
├── services/
│   ├── api/              # API service functions
│   │   ├── [entity].ts   # Per-entity API calls
│   │   └── index.ts
│   └── types/            # TypeScript interfaces
│       ├── [entity].ts   # Per-entity types
│       ├── common.ts     # Shared types
│       └── index.ts
├── lib/
│   ├── api/
│   │   └── client.ts     # Axios configuration
│   └── react-query/
│       ├── client.ts     # Query client setup
│       └── queryKeys.ts  # Centralized query keys
├── pages/
│   ├── [pageName]/
│   │   └── index.tsx     # Page component
├── routes/
│   ├── components/       # Route components
│   ├── guards/          # Route protection
│   └── index.ts
├── constants/
│   ├── routes.ts        # Route constants
│   └── index.ts
├── context/
│   ├── [ContextName]Context.tsx
│   └── hooks/           # Context consumer hooks
├── assets/
│   └── styles/
│       └── theme.ts     # Material-UI theme
└── utils/               # Utility functions
```

## 📡 API & CRUD Rules

### 1. Always Create Separate Files for Queries and Mutations
```typescript
// ❌ DON'T combine in one file
// ✅ DO separate into:
// hooks/api/users/useUsers.ts (READ operations)
// hooks/api/users/useUserMutations.ts (CUD operations)
```

### 2. API Service Layer Pattern
```typescript
// services/api/users.ts
export const usersApi = {
  getUsers: async (params?: QueryParams): Promise<UsersResponse> => {
    const response = await apiClient.get<UsersResponse>('/users/', { params });
    return response.data;
  },
  
  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/users/', data);
    return response.data;
  },
  
  // ... other CRUD operations
};
```

### 3. Query Hooks Pattern
```typescript
// hooks/api/users/useUsers.ts
export const useUsers = (params?: QueryParams & UserFilters) => {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.getUsers(params),
    staleTime: 2 * 60 * 1000,
  });
};
```

### 4. Mutation Hooks Pattern
```typescript
// hooks/api/users/useUserMutations.ts
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => usersApi.createUser(data),
    onSuccess: (newUser: User) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      showSuccess(`User "${newUser.full_name}" created successfully!`);
    },
    onError: (error) => {
      console.error('Create user failed:', error);
    },
  });
};
```

### 5. Query Keys Factory Pattern
```typescript
// lib/react-query/queryKeys.ts
export const queryKeys = {
  [entity]: {
    all: ['[entity]'] as const,
    lists: () => [...queryKeys.[entity].all, 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.[entity].lists(), { filters }] as const,
    details: () => [...queryKeys.[entity].all, 'detail'] as const,
    detail: (id: number | string) => [...queryKeys.[entity].details(), id] as const,
  },
};
```

## 🎨 Component Rules

### 1. Use Common Components First
Always check `src/components/Common/` before creating new components:
```typescript
// ✅ DO use common components
import { TextField, Select, Button, Alert } from '../components/Common';

// ❌ DON'T import MUI directly unless extending
import { TextField } from '@mui/material'; // Only for extending
```

### 2. Component File Structure
```typescript
// components/Users/UserForm/UserForm.tsx
import React from 'react';
import { Box } from '@mui/material';
import { TextField, Select, Button } from '../../Common';
import type { User, CreateUserRequest } from '../../../services/types/user';

interface UserFormProps {
  user?: User;
  onSubmit: (data: CreateUserRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

const UserForm: React.FC<UserFormProps> = ({
  user,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  // Component logic here
  
  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Form content */}
    </Box>
  );
};

export default UserForm;
```

### 3. Always Export Types
```typescript
// Export component props interface
export type { UserFormProps } from './UserForm';
```

## 🔄 State Management Rules

### 1. Use React Query for Server State
```typescript
// ✅ DO use React Query for API data
const { data: users, isLoading, error } = useUsers();
const createUser = useCreateUser();

// ❌ DON'T use useState for server data
const [users, setUsers] = useState([]); // Wrong for server data
```

### 2. Use useState for UI State
```typescript
// ✅ DO use useState for UI state
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [selectedTab, setSelectedTab] = useState('overview');
```

### 3. Context for Global App State
```typescript
// ✅ DO use Context for auth, theme, etc.
const { user, isAuthenticated } = useAuth();
```

## 📝 TypeScript Rules

### 1. Always Define Interfaces
```typescript
// services/types/user.ts
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  date_joined: string;
  is_active: boolean;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role?: string;
}

export interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_active?: boolean;
}
```

### 2. Use Proper Generic Types
```typescript
// ✅ DO use proper generics
const useGenericQuery = <TData, TError = Error>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>
) => {
  return useQuery<TData, TError>({ queryKey, queryFn });
};
```

### 3. Export Types from Index Files
```typescript
// services/types/index.ts
export type * from './user';
export type * from './common';
```

## 🎯 Naming Conventions

### 1. Files and Folders
- **Folders**: PascalCase for components, camelCase for others
- **Files**: PascalCase for components, camelCase for utilities
- **API files**: Plural entity names (users.ts, products.ts)
- **Hook files**: Prefix with 'use' (useUsers.ts, useUserMutations.ts)

### 2. Components
```typescript
// ✅ DO use PascalCase
const UserManagement: React.FC = () => {};
export default UserManagement;
```

### 3. Hooks
```typescript
// ✅ DO prefix with 'use'
export const useUsers = () => {};
export const useCreateUser = () => {};
```

### 4. Constants
```typescript
// ✅ DO use UPPER_SNAKE_CASE for constants
export const API_BASE_URL = 'http://localhost:8000/api';
export const ROUTES = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
} as const;
```

## 🚨 Error Handling Rules

### 1. Global Error Handling
```typescript
// ✅ DO let global error handler manage API errors
// lib/api/client.ts handles all HTTP errors automatically

// ✅ DO handle specific errors in components when needed
try {
  await createUser.mutateAsync(userData);
} catch (error) {
  // Handle specific business logic errors
  console.error('Create failed:', error);
}
```

### 2. Loading States
```typescript
// ✅ DO use React Query loading states
const { data, isLoading, error } = useUsers();

if (isLoading) return <Loading />;
if (error) return <EmptyState type="error" />;
if (!data?.data?.length) return <EmptyState type="empty" />;
```

## 🎨 Styling Rules

### 1. Use Theme System
```typescript
// ✅ DO use theme values
sx={{
  color: 'primary.main',
  backgroundColor: 'background.paper',
  borderRadius: 2, // Theme spacing
  p: 3, // Theme spacing
}}
```

### 2. Common Component Props
```typescript
// ✅ DO use common component enhanced props
<TextField
  label="Email"
  type="email"
  startIcon={<Email />}
  helpText="Enter your email address"
  fullWidth
/>
```

## 📚 Import Rules

### 1. Import Order
```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party imports
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

// 3. Internal imports (absolute paths preferred)
import { TextField, Button } from '../../../components/Common';
import { useUsers } from '../../../hooks/api/users';
import type { User } from '../../../services/types/user';
```

### 2. Barrel Exports
```typescript
// ✅ DO use barrel exports
export { default as UserManagement } from './UserManagement';
export { default as UserForm } from './UserForm';
export type { UserManagementProps } from './UserManagement';
```

## 🔄 Form Handling Rules

### 1. Form State Management
```typescript
// ✅ DO use controlled components
const [formData, setFormData] = useState<CreateUserRequest>({
  email: '',
  first_name: '',
  last_name: '',
  password: '',
});

const handleInputChange = (field: keyof CreateUserRequest) => (value: string) => {
  setFormData(prev => ({ ...prev, [field]: value }));
};
```

### 2. Form Submission
```typescript
// ✅ DO use mutation hooks for form submission
const createUser = useCreateUser();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await createUser.mutateAsync(formData);
    onSuccess?.();
  } catch (error) {
    // Error handled by global handler
    console.error('Submission failed:', error);
  }
};
```

## 🎯 Performance Rules

### 1. Memoization
```typescript
// ✅ DO memoize expensive calculations
const filteredUsers = useMemo(() => {
  return users?.data?.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
}, [users?.data, searchQuery]);
```

### 2. Callback Optimization
```typescript
// ✅ DO use useCallback for event handlers
const handleUserSelect = useCallback((userId: number) => {
  setSelectedUserId(userId);
}, []);
```

## 📱 Responsive Design Rules

### 1. Use Theme Breakpoints
```typescript
// ✅ DO use theme breakpoints
sx={{
  display: { xs: 'block', md: 'flex' },
  gap: { xs: 2, md: 3 },
  p: { xs: 2, md: 4 },
}}
```

## 🧪 Testing Preparation Rules

### 1. Testable Component Structure
```typescript
// ✅ DO separate logic from JSX
const UserManagement: React.FC = () => {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  
  const handleCreateUser = useCallback(async (userData: CreateUserRequest) => {
    await createUser.mutateAsync(userData);
  }, [createUser]);
  
  if (isLoading) return <Loading />;
  
  return (
    <Box data-testid="user-management">
      {/* JSX here */}
    </Box>
  );
};
```

## 🚀 When Creating New Features

### 1. Checklist for New Entity
- [ ] Create types in `services/types/[entity].ts`
- [ ] Create API service in `services/api/[entity].ts`
- [ ] Add query keys to `lib/react-query/queryKeys.ts`
- [ ] Create query hooks in `hooks/api/[entity]/use[Entity].ts`
- [ ] Create mutation hooks in `hooks/api/[entity]/use[Entity]Mutations.ts`
- [ ] Create components in `components/[Entity]/`
- [ ] Create pages in `pages/[entity]/`
- [ ] Add routes to `constants/routes.ts`
- [ ] Update route guards if needed

### 2. Always Follow CRUD Pattern
```typescript
// For each entity, create:
// - GET (list, single, search)
// - POST (create)
// - PATCH (update)
// - DELETE (single, bulk)
```

## 📏 File Size Rules

### 1. Maximum File Length
```typescript
// ❌ DON'T create files longer than 400 lines
// ✅ DO break large files into smaller, focused modules

// If a file exceeds 400 lines:
// - Split components into smaller sub-components
// - Extract hooks into separate files
// - Move utility functions to utils/
// - Create barrel exports for organization
```

### 2. Component Splitting Strategy
```typescript
// ❌ BAD: One large component (500+ lines)
const UserManagement = () => {
  // 500+ lines of code
};

// ✅ GOOD: Split into focused components
const UserManagement = () => {
  return (
    <Box>
      <UserFilters />
      <UserTable />
      <UserPagination />
    </Box>
  );
};

// components/Users/UserManagement/
// ├── UserManagement.tsx      (< 100 lines)
// ├── UserFilters.tsx         (< 150 lines)
// ├── UserTable.tsx           (< 200 lines)
// ├── UserPagination.tsx      (< 100 lines)
// └── index.ts                (exports)
```

### 3. Hook Splitting Strategy
```typescript
// ❌ BAD: One large hook file (500+ lines)
// ✅ GOOD: Split by responsibility

// hooks/api/users/
// ├── useUsers.ts             (< 100 lines - READ operations)
// ├── useUserMutations.ts     (< 200 lines - CUD operations)
// ├── useUserFilters.ts       (< 100 lines - Filter logic)
// └── index.ts                (exports)
```

### 4. API Service Splitting
```typescript
// ❌ BAD: One large API file (600+ lines)
// ✅ GOOD: Split by entity or feature

// services/api/
// ├── users.ts                (< 200 lines)
// ├── products.ts             (< 200 lines)
// ├── orders.ts               (< 200 lines)
// └── index.ts                (exports)
```

## 📋 Code Review Rules

### 1. Before Committing
- [ ] All imports are organized correctly
- [ ] TypeScript interfaces are defined
- [ ] Components use Common components where possible
- [ ] API calls follow the established pattern
- [ ] Error handling is in place
- [ ] Loading states are handled
- [ ] Responsive design is considered
- [ ] **No file exceeds 400 lines** ⚠️

### 2. Performance Checks
- [ ] No unnecessary re-renders
- [ ] Expensive operations are memoized
- [ ] Query keys are properly structured
- [ ] Cache invalidation is correct

### 3. File Size Checks
- [ ] Components are focused and single-purpose
- [ ] Large files are split into logical modules
- [ ] Hooks are separated by responsibility
- [ ] API services are organized by entity

## 🚨 File Size Enforcement

### When a file approaches 400 lines:
1. **Identify responsibilities** - What does this file do?
2. **Extract components** - Can UI parts be separate components?
3. **Extract hooks** - Can logic be moved to custom hooks?
4. **Extract utilities** - Can functions be moved to utils/?
5. **Create sub-modules** - Can the file be split by feature?

### Refactoring Large Files:
```typescript
// Before: UserManagement.tsx (500 lines)
// After: Split into focused files

// UserManagement/
// ├── index.tsx               (Main component - 80 lines)
// ├── components/
// │   ├── UserFilters.tsx     (120 lines)
// │   ├── UserTable.tsx       (150 lines)
// │   └── UserActions.tsx     (90 lines)
// ├── hooks/
// │   ├── useUserFilters.ts   (60 lines)
// │   └── useUserSelection.ts (40 lines)
// └── utils/
//     └── userHelpers.ts      (80 lines)
```

Remember: **Keep files focused, readable, and under 400 lines**. This improves maintainability, readability, and team collaboration.
