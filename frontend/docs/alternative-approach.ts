// If you REALLY want one file, here's how (NOT recommended):

// src/hooks/api/users/index.ts
export * from './useUsers';      // Re-export queries
export * from './useUserMutations'; // Re-export mutations

// Usage in components:
import { useUsers, useCreateUser } from '../hooks/api/users';
// ✅ Still clean imports
// ✅ Best of both worlds

// But keep the files separate internally for all the reasons above!
