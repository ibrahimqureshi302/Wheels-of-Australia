# Reminder: Backend APIs for Roles & RBAC (To Add Later)

**When you add backend APIs**, align them with the frontend roles and RBAC described below. This doc is the single place to check what the frontend expects and what to sync.

---

## 1. Frontend assumptions (current)

The frontend already implements **role-based UI** (Phase B). It assumes:

| Area | Location | Assumption |
|------|----------|------------|
| **Role type** | `src/constants/roles.ts` | Roles: **admin**, **driver**, **rental**, **mechanic**. Normalized from API string (e.g. `"Admin"` → `admin`). |
| **Role checks** | `canAccess(userRole, allowedRoles)`, `normalizeRole(role)` | Admin can access everything; others only what’s in `allowedRoles`. |
| **Nav items** | `src/constants/nav.ts` | Each item has `allowedRoles: AppRole[]`. Sidebar filters by `user.role`. |
| **Route guards** | `src/routes/guards/ProtectedRoute.tsx` | Optional `requiredRole?: AppRole`. No Access page if user lacks role. |
| **User shape** | `src/services/auth/types.ts` | `User.role: string`, `User.role_display: string`. Frontend normalizes `role` for checks. |

---

## 2. What to align when adding backend

- **Auth/login response**  
  Ensure the user object includes a **role** (and optionally **role_display**) that the backend will enforce. Frontend will keep using `normalizeRole(user.role)` so backend can send e.g. `"Admin"`, `"Driver"`, `"Rental"`, `"Mechanic"` (or lowercase).

- **Role names**  
  If backend uses different role names or codes, either:
  - Update `AppRole` and `normalizeRole()` in `src/constants/roles.ts` to match backend, or  
  - Add a small mapping layer (e.g. backend `role_id` or `role_code` → frontend `AppRole`).

- **Permissions (optional)**  
  If backend exposes **permissions** (e.g. `can_approve_driver`, `can_manage_fleet`), consider:
  - Extending auth types and hooks to store permissions.
  - Using permissions in addition to (or instead of) role for fine-grained UI (e.g. hide buttons, disable actions).  
  Frontend can stay role-only until you add a permissions API.

- **API-level enforcement**  
  Frontend guards and nav only **hide** UI. Backend must **enforce** RBAC on every protected endpoint (return 403 when role/permission is insufficient).

---

## 3. Quick checklist for backend integration

- [ ] Auth/login (or /me) returns `user.role` (and optionally `user.role_display`).
- [ ] Role values match or are mapped in `src/constants/roles.ts` (`normalizeRole`).
- [ ] Protected endpoints check role/permissions and return 403 when unauthorized.
- [ ] (Optional) Add permissions to auth response and frontend types; use for fine-grained UI later.

---

*Reminder created so frontend roles and related behaviour stay consistent when backend APIs are added.*
