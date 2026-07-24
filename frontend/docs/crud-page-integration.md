# CRUD API Integration Guide - Page-by-Page Implementation

This guide shows how to integrate the CRUD API system with different types of pages in your application.

## 📋 **Page Types & CRUD Integration**

### **1. 👤 Profile Page** 
**Current User Details (from localStorage)**

```typescript
// src/pages/profile/index.tsx
import React from 'react';
import { useAuth } from '../../context/hooks';
import { useUpdateUser } from '../../hooks/api/users';

const ProfilePage = () => {
  const { user } = useAuth(); // Get current user from localStorage
  const updateUser = useUpdateUser();

  const handleUpdateProfile = (data: UpdateUserRequest) => {
    updateUser.mutate({ id: user.id, data });
    // ✅ Auto success toast: "User updated successfully!"
    // ✅ Auto error handling via global interceptor
  };

  return (
    <div>
      <h1>My Profile</h1>
      {/* Use user data directly from localStorage */}
      <p>Name: {user?.full_name}</p>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role_display}</p>
      
      {/* Profile edit form */}
      <ProfileEditForm 
        user={user} 
        onSubmit={handleUpdateProfile}
        loading={updateUser.isPending}
      />
    </div>
  );
};
```

### **2. 👥 Users Management Page** 
**Admin Page - List All Users**

```typescript
// src/pages/users/index.tsx
import React, { useState } from 'react';
import { 
  useUsers, 
  useCreateUser, 
  useUpdateUser, 
  useDeleteUser,
  useSearchUsers 
} from '../../hooks/api/users';

const UsersManagementPage = () => {
  const [filters, setFilters] = useState({ page: 1, limit: 10 });
  const [searchQuery, setSearchQuery] = useState('');

  // Query hooks
  const { data: usersData, isLoading, error } = useUsers(filters);
  const { data: searchResults } = useSearchUsers(searchQuery, searchQuery.length > 2);
  
  // Mutation hooks
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const displayUsers = searchQuery.length > 2 ? searchResults : usersData?.results;

  return (
    <div>
      <h1>Users Management</h1>
      
      {/* Search */}
      <SearchInput 
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search users..."
      />
      
      {/* Create User Button */}
      <Button onClick={() => setShowCreateModal(true)}>
        Add New User
      </Button>
      
      {/* Users Table */}
      <UsersTable 
        users={displayUsers}
        loading={isLoading}
        onEdit={(user) => updateUser.mutate({ id: user.id, data: {...} })}
        onDelete={(id) => deleteUser.mutate(id)}
      />
      
      {/* Pagination */}
      <Pagination 
        current={filters.page}
        total={usersData?.count}
        onChange={(page) => setFilters(prev => ({ ...prev, page }))}
      />
    </div>
  );
};
```

### **3. 📊 Dashboard Page**
**Analytics & Stats**

```typescript
// src/pages/dashboard/index.tsx
import React from 'react';
import { useAuth } from '../../context/hooks';
import { useUsers } from '../../hooks/api/users';

const DashboardPage = () => {
  const { user } = useAuth(); // Current user from localStorage
  
  // Get users stats (only for admin)
  const { data: usersData } = useUsers(
    { limit: 5 }, // Recent users
    user?.role === 'admin' // Only fetch if admin
  );

  return (
    <div>
      <h1>Welcome back, {user?.first_name}!</h1>
      
      {/* User-specific dashboard content */}
      <UserStats user={user} />
      
      {/* Admin-only content */}
      {user?.role === 'admin' && (
        <AdminSection>
          <h2>Recent Users</h2>
          <RecentUsersList users={usersData?.results} />
        </AdminSection>
      )}
    </div>
  );
};
```

### **4. ⚙️ Settings Page**
**User Preferences & Account Settings**

```typescript
// src/pages/settings/index.tsx
import React from 'react';
import { useAuth } from '../../context/hooks';
import { useUpdateUser } from '../../hooks/api/users';
import { useUserRoles } from '../../hooks/api/users';

const SettingsPage = () => {
  const { user } = useAuth(); // Current user from localStorage
  const updateUser = useUpdateUser();
  const { data: roles } = useUserRoles(); // For role selection (admin only)

  const handleUpdateSettings = (settings: UpdateUserRequest) => {
    updateUser.mutate({ id: user.id, data: settings });
  };

  return (
    <div>
      <h1>Account Settings</h1>
      
      {/* Personal Information */}
      <Section title="Personal Information">
        <PersonalInfoForm 
          user={user}
          onSubmit={handleUpdateSettings}
          loading={updateUser.isPending}
        />
      </Section>
      
      {/* Role Management (Admin only) */}
      {user?.role === 'admin' && (
        <Section title="Role Management">
          <RoleSelector 
            currentRole={user.role}
            availableRoles={roles}
            onRoleChange={(role) => handleUpdateSettings({ role })}
          />
        </Section>
      )}
    </div>
  );
};
```

### **5. 🔍 Search Page**
**Global Search Functionality**

```typescript
// src/pages/search/index.tsx
import React, { useState, useEffect } from 'react';
import { useSearchUsers } from '../../hooks/api/users';
import { useDebounce } from '../../hooks';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300); // Debounce search
  
  const { 
    data: users, 
    isLoading, 
    error 
  } = useSearchUsers(debouncedQuery, debouncedQuery.length > 2);

  return (
    <div>
      <h1>Search</h1>
      
      <SearchInput 
        value={query}
        onChange={setQuery}
        placeholder="Search users, products, orders..."
      />
      
      {isLoading && <SearchSkeleton />}
      
      {users && (
        <SearchResults>
          <UserResults users={users} />
          {/* Add more result types as you create them */}
        </SearchResults>
      )}
    </div>
  );
};
```

## 🎯 **Integration Patterns**

### **Pattern 1: Current User Data**
```typescript
// ✅ Use for: Profile, Settings, Dashboard personalization
const { user } = useAuth(); // From localStorage - instant, no API call
```

### **Pattern 2: List Management**
```typescript
// ✅ Use for: Admin panels, management pages
const { data, isLoading, error } = useUsers(filters);
const createMutation = useCreateUser();
const updateMutation = useUpdateUser();
const deleteMutation = useDeleteUser();
```

### **Pattern 3: Search & Filter**
```typescript
// ✅ Use for: Search pages, filtered lists
const { data: searchResults } = useSearchUsers(query, query.length > 2);
const { data: filteredUsers } = useUsers({ role: 'admin', is_active: true });
```

### **Pattern 4: Conditional Loading**
```typescript
// ✅ Use for: Role-based data loading
const { data } = useUsers(
  filters,
  user?.role === 'admin' // Only load if user is admin
);
```

## 🔐 **Role-Based Page Access**

### **Admin Pages**
- Users Management
- System Settings
- Analytics Dashboard

### **User Pages**
- Personal Profile
- User Dashboard
- Account Settings

### **Public Pages**
- Login
- Register
- Home (if applicable)

## 📱 **Mobile-Responsive Integration**

```typescript
// Responsive data loading
const isMobile = useMediaQuery('(max-width: 768px)');
const pageSize = isMobile ? 5 : 10;

const { data } = useUsers({ 
  limit: pageSize,
  // Load less data on mobile
});
```

## 🚀 **Performance Optimizations**

### **1. Smart Caching**
```typescript
// Different stale times for different data types
useUsers(filters, {
  staleTime: 2 * 60 * 1000, // 2 minutes for list data
});

useUserRoles({
  staleTime: 30 * 60 * 1000, // 30 minutes for rarely changing data
});
```

### **2. Conditional Queries**
```typescript
// Only fetch when needed
const { data } = useUsers(
  filters,
  isAdminPage && user?.role === 'admin' // Conditional loading
);
```

### **3. Background Updates**
```typescript
// Keep data fresh in background
const { data, refetch } = useUsers(filters);

// Refetch on window focus for critical data
useEffect(() => {
  const handleFocus = () => refetch();
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [refetch]);
```

## 🎨 **UI Integration Examples**

### **Loading States**
```typescript
const LoadingComponent = ({ isLoading, children }) => {
  if (isLoading) return <Skeleton />;
  return children;
};
```

### **Error Handling**
```typescript
const ErrorBoundary = ({ error, retry, children }) => {
  if (error) {
    return (
      <Alert severity="error">
        {error.message}
        <Button onClick={retry}>Retry</Button>
      </Alert>
    );
  }
  return children;
};
```

### **Empty States**
```typescript
const EmptyState = ({ data, children }) => {
  if (!data || data.length === 0) {
    return <EmptyStateComponent />;
  }
  return children;
};
```

This integration guide shows you exactly how to use the CRUD API system across different page types while leveraging localStorage for current user data! 🎯
