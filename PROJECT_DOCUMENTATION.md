# Wheels of Australia — Complete Project Documentation

This document explains **every file and method** in the project in simple, plain language — both the **backend** (the server) and the **frontend** (the website users see). It's meant to be read by someone new to the project who wants to understand what each part does.

---

## 1. What the project is

**Wheels of Australia** is a vehicle rental platform. It connects four kinds of users:

| Role | What they do |
|---|---|
| **Admin** | Runs the whole system: approves sign-ups, manages every rental company, driver, mechanic and vehicle, sees activity logs, and sets the site branding. |
| **Rental** (owner + staff) | A rental company. Owners list their vehicles (fleet), approve/reject driver booking requests, track rented vehicles live on a map, handle maintenance, and can create staff sub-accounts with limited menus. |
| **Driver** | Browses vehicles, requests bookings, goes on trips, and shares live GPS location while a rental is active. |
| **Mechanic** | Receives maintenance jobs, sends price+time quotes, and records repair history. |

## 2. How it's built (technology)

- **Backend:** Python + **Django** and **Django REST Framework** (the API). **PostgreSQL** database, **Redis** + **Celery** for scheduled/background jobs, **Django Channels + Daphne** for real-time WebSockets (live GPS), and **JWT** login stored in secure HttpOnly cookies. Google **Gemini** is used to read (OCR) uploaded ID documents.
- **Frontend:** **React** + **TypeScript**, **Material-UI (MUI)** for the look, **Vite** for the dev server/build, **React Router** for pages, **React Query** (TanStack Query) for server data/caching, **axios** for API calls, **Leaflet + OpenStreetMap** for maps, **Framer Motion** for animations, and **i18next** for translations.
- **Runs in:** Docker (separate containers for the web server, database, Redis, Celery worker, and Celery beat scheduler).

## 3. How the two halves talk

The frontend never touches the database directly. It calls the backend's REST API (URLs like `/api/...`) using the shared `apiClient`. The login token rides along automatically as a secure cookie. For live location, the driver's browser opens a **WebSocket** (`ws://.../ws/track/<vehicle_id>/`) so positions stream instantly to the rental owner's map. Scheduled jobs (reminders, GPS "location-off" checks) run on the server via Celery.

## 4. Big-picture folder map

**Backend (`backend/src/`)**
- `core/` — project setup: settings, URL wiring, ASGI/WSGI servers, Celery.
- `authentication/` — the custom user model, login/registration, JWT + cookies, suspension rules, WebSocket auth.
- `operations/` — the heart of the app: all business data (vehicles, bookings, maintenance, GPS, activity logs) and their API endpoints, plus background jobs and real-time tracking.

**Frontend (`frontend/src/`)**
- `services/` — functions that call the backend API (one area per feature).
- `pages/` — the actual screens, grouped by feature and role.
- `components/` — reusable UI pieces (buttons, tables, dialogs, auth widgets, onboarding, etc.).
- `context/`, `hooks/`, `routes/`, `lib/`, `constants/`, `utils/`, `i18n/` — the app "plumbing": login state, routing/guards, API client, animations, translations, and helpers.

---

## Table of contents

**Backend**
1. Core & Authentication
2. Operations — Data Models & Admin
3. Operations — Serializers, Views & URLs (the API endpoints)
4. Operations — Services, Tasks, Realtime Tracking & Background Jobs

**Frontend**
5. Services (the API layer)
6. Pages (the screens)
7. Components (reusable UI)
8. App Infrastructure (context, hooks, routing, lib, constants, utils)

---


---

# Backend — Core & Authentication

This document explains the "core" project setup files and the whole "authentication" app of the Wheels of Australia backend. It is written for beginners: every file, class, function, method, and model field is described in plain English.

---

### `backend/src/core/asgi.py`

This file is the entry point for the ASGI server, which handles both normal web (HTTP) requests and live WebSocket connections.

- **module setup** — Sets the environment variable that tells Django which settings module to use (`core.settings`), then builds the normal Django HTTP application. Building it first also loads all the app models so the imports below are safe.
- **`application`** — The object the server actually runs. It is a `ProtocolTypeRouter` that sends plain HTTP traffic to the normal Django app, and sends WebSocket traffic through a chain: first `AllowedHostsOriginValidator` (checks the connection is coming from an allowed website), then `CookieJWTAuthMiddleware` (figures out which logged-in user is connecting, using the login cookie), then a `URLRouter` that picks the right WebSocket handler based on the URL. It returns nothing directly; it is the callable the server invokes for every connection.

---

### `backend/src/core/wsgi.py`

This file is the entry point for a traditional WSGI server that only handles normal HTTP requests (used for deployment without WebSockets).

- **module setup** — Sets the `DJANGO_SETTINGS_MODULE` environment variable to `core.settings`.
- **`application`** — The standard Django WSGI callable, produced by `get_wsgi_application()`. The web server calls this for every HTTP request.

---

### `backend/src/core/celery.py`

This file sets up Celery, the tool that runs background jobs (like sending emails) and scheduled tasks outside the normal request/response cycle.

- **module setup** — Points Celery at the Django settings module.
- **`app`** — The Celery application named `'core'`. It reads its configuration from Django settings (only keys starting with `CELERY_`) and automatically finds task functions in every installed app.
- **`debug_task(self)`** — A simple test task that just prints its own request info. Used to confirm Celery is wired up correctly. Returns nothing meaningful.

---

### `backend/src/core/urls.py`

This file maps URLs to the code that handles them for the whole project (the top-level routing table).

- **`health_check(request)`** — Handles `GET /health/` and `GET /api/health/`. Anyone can call it (no login needed). Returns a small JSON body `{"status": "ok"}` so monitoring tools can confirm the API is alive. It is decorated with schema info so it shows up nicely in the API docs.
- **`urlpatterns`** — The list of all top-level routes:
  - `admin/` → the Django admin site.
  - `health/` and `api/health/` → the health check above.
  - `api/auth/` → includes all the authentication app URLs.
  - `api/` → includes the operations app URLs (drivers, rentals, mechanics, vehicles, etc.).
  - `api/schema/`, `api/docs/`, `api/redoc/` → auto-generated API documentation (OpenAPI schema, Swagger UI, Redoc UI).
  - When `DEBUG` is on, it also adds a route to serve uploaded media files (user documents/images) directly.

---

### `backend/src/core/settings/base.py`

This file holds all the common Django settings shared by every environment (development, production, etc.).

- **`BASE_DIR`** — The project's root folder path, used to build other paths.
- **`env`** — A helper that reads configuration from environment variables and a `.env` file, so secrets are not hard-coded.
- **`SECRET_KEY`** — The secret used to sign things (read from the environment; must stay private).
- **`DEBUG`** — Whether debug mode is on (defaults off for safety).
- **`ALLOWED_HOSTS`** — Which host names the site is allowed to be served under.
- **`DJANGO_APPS`, `THIRD_PARTY_APPS`, `LOCAL_APPS`, `INSTALLED_APPS`** — The lists of Django apps that are turned on. Notable ones: `daphne` (ASGI dev server, listed first on purpose), `rest_framework` (the API framework), `rest_framework_simplejwt` and its `token_blacklist` (JWT login tokens plus the ability to blacklist old tokens on refresh/logout), `corsheaders` (cross-site request rules), `drf_spectacular` (API docs), `django_celery_beat` (scheduled tasks), `channels` (WebSockets), and the local `authentication` and `operations` apps.
- **`MIDDLEWARE`** — The chain of processing steps every request passes through, including CORS handling, WhiteNoise (serving static files), security, sessions, CSRF protection, and Django's auth middleware.
- **`ROOT_URLCONF`** — Points to `core.urls` as the top URL map.
- **`TEMPLATES`** — Django template engine configuration (used mainly by the admin site).
- **`WSGI_APPLICATION` / `ASGI_APPLICATION`** — Which callables the servers use (`core.wsgi.application` / `core.asgi.application`).
- **`CHANNEL_LAYERS`** — Configures the WebSocket "message bus" backed by Redis (on Redis database 2) so one connection's message can reach others (e.g. a driver's GPS position reaching everyone watching that vehicle).
- **`AUTH_PASSWORD_VALIDATORS`** — Rules that passwords must meet (minimum length, not too common, not all numbers, not too similar to the user's info).
- **Internationalization settings** — `LANGUAGE_CODE` (en-us), `TIME_ZONE` (UTC), `USE_I18N`, `USE_TZ`.
- **Static/media settings** — `STATIC_URL`, `STATIC_ROOT`, `STATICFILES_STORAGE` (WhiteNoise compressed storage), plus `MEDIA_URL` and `MEDIA_ROOT` for user uploads.
- **`DEFAULT_AUTO_FIELD`** — Uses big integers for automatic primary keys.
- **`AUTH_USER_MODEL`** — Tells Django to use the custom `authentication.User` model instead of the built-in one.
- **`AUTHENTICATION_BACKENDS`** — Uses the custom `RestrictedLoginModelBackend` so restricted end users can still log in.
- **`REST_FRAMEWORK`** — The API framework defaults: use the custom `SuspensionAwareJWTAuthentication` for login checks, require login by default, render/parse JSON (and form/multipart uploads), paginate lists 20 per page, and use drf-spectacular for schema.
- **`SPECTACULAR_SETTINGS`** — Settings for the auto-generated API documentation (title, version, Swagger UI options, security scheme, tags).
- **`SIMPLE_JWT`** — JWT token settings: access token lives 60 minutes, refresh token 7 days, refresh tokens rotate and the old one is blacklisted, last-login is updated, tokens are signed with the secret key using HS256, and the user id lives in the `user_id` claim.
- **JWT cookie settings (`AUTH_COOKIE_*`)** — Configure the HttpOnly cookies that carry the tokens so JavaScript can never read them (XSS protection): the access cookie name, refresh cookie name, HttpOnly on, Secure (off by default since the deployment is HTTP), SameSite (`Lax` by default for CSRF protection), path, and optional domain.
- **Email settings** — `EMAIL_BACKEND` (defaults to console, which prints emails to the log in development), plus SMTP host/port/TLS/user/password and `DEFAULT_FROM_EMAIL` for real sending.
- **`FRONTEND_LOGIN_URL`** — The public login page URL, included in approval emails.
- **`GEMINI_API_KEY` / `GEMINI_MODEL`** — Google Gemini config used by the ID-document OCR feature (kept server-side); model defaults to `gemini-2.5-flash`.
- **Celery settings** — Timezone, task tracking, a 30-minute task time limit, and JSON serialization.
- **`CELERY_BEAT_SCHEDULE`** — The scheduled (cron-like) jobs: clean up inactive users daily at 2 AM, generate user stats at 6 AM, generate vehicle reminders at 7 AM, and check active-trip GPS locations every 5 minutes.
- **`LOGGING`** — Configures console logging with a verbose and a simple format, at INFO level.

---

### `backend/src/core/settings/__init__.py`

This file is loaded when Django reads `core.settings`; it imports the base settings and then applies overrides depending on which environment is selected.

- **imports base + `DJANGO_ENV`** — Pulls in everything from `base.py`, then reads the `DJANGO_ENV` variable (defaults to `"local"`) to decide which environment block to apply.
- **`local` block** — For local development without Docker: turns DEBUG on, connects to a local PostgreSQL database, allows the localhost frontend origins for CORS, and points Celery and the WebSocket channel layer at Redis on localhost.
- **`dev` block** — For development inside Docker: DEBUG on, database from `DATABASE_URL`, localhost CORS origins, and Celery pointed at the Docker `redis` service.
- **`uat` block** — For User Acceptance Testing: DEBUG off, database/CORS/Celery all read strictly from environment variables (no defaults).
- **`prod` block** — For production: DEBUG off, everything from environment variables, plus extra security headers (XSS filter, no content-type sniffing, deny framing).
- **`else` branch** — Raises an error if `DJANGO_ENV` is an unknown value, to fail fast on misconfiguration.
- **`CSRF_TRUSTED_ORIGINS` / `CORS_ALLOW_CREDENTIALS`** — Set at the end for all environments: trusted CSRF origins default to the CORS origins, and credentials are allowed by default because the cookie-based JWT login needs the browser to send cookies cross-origin (which forbids a wildcard origin).

---

### `backend/src/authentication/models.py`

This file defines the database tables (models) for users, registration requests, uploaded documents, and in-app notifications.

- **`ROLE_CHOICES`** — The allowed user roles: `admin`, `driver`, `rental`, `mechanic`. (Rental staff are stored as `rental` role but with `allowed_nav_paths` set.)
- **`UserManager`** — Helper class for creating users:
  - **`create_user(email, password, **extra)`** — Creates and saves a normal user; requires an email, normalizes it, and hashes the password. Returns the new user.
  - **`create_superuser(email, password, **extra)`** — Creates an admin superuser; forces `is_staff=True` and `is_superuser=True` (erroring if not) and returns the user.
- **`User`** — The custom user model that logs in with email instead of username. Fields:
  - **`email`** — Unique, indexed email address used to log in.
  - **`role`** — The user's role (admin/driver/rental/mechanic), default `driver`, indexed.
  - **`first_name`, `last_name`** — The user's name parts (optional).
  - **`phone_number`** — Contact phone (optional).
  - **`allowed_nav_paths`** — A JSON list of navigation paths a rental staff member may access; `null` for main rental owners and everyone else.
  - **`rental_parent`** — A link to the rental owner a staff member belongs to; `null` for everyone else. Set to null if the owner is deleted.
  - **`is_active`** — Whether the account is active (Django's standard flag).
  - **`is_staff`** — Whether the user can access the Django admin.
  - **`must_change_password`** — True when the password was system-generated so the user should change it on first login.
  - **`is_suspended`** — True when the account is restricted (locked to the profile page) but can still log in; indexed.
  - **`suspension_reason`** — The message shown to a suspended user explaining why.
  - **`location_warning_count`** — Counts GPS "strikes" for drivers; at 3 the account is auto-suspended, and admin reactivation resets it to 0.
  - **`date_joined`** — When the account was created (set automatically).
  - **`updated_at`** — When the record was last changed (set automatically).
  - **`objects`** — Uses the `UserManager` above.
  - **`USERNAME_FIELD`** — Set to `email` so email is the login identifier.
  - **`Meta`** — Uses the `auth_user` table, sets display names, and adds indexes on email and on active users.
  - **`__str__()`** — Returns the email as the display text.
  - **`get_full_name()`** — Returns "First Last" if a name exists, otherwise the email.
  - **`get_short_name()`** — Returns the first name, or the part of the email before the `@`.
  - **`is_restricted`** (property) — True if the account should be locked to its profile page. It combines two cases: `is_suspended` set, or `is_active` false. Superusers are never restricted.
  - **`effective_suspension_reason`** (property) — Returns the explicit suspension reason if set, otherwise a sensible default message.
- **`REGISTRABLE_ROLE_CHOICES`** — The roles a registration request can carry: driver, rental, mechanic, and rental_staff (staff is created by a rental owner, not self-registered).
- **`RegistrationRequest`** — A pending sign-up submitted by a driver/rental/mechanic; no account exists until an admin approves it. Fields:
  - **status constants** (`STATUS_PENDING`, `STATUS_APPROVED`, `STATUS_REJECTED`) and **`STATUS_CHOICES`** — The possible review states.
  - **`RENTAL_TYPE_CHOICES`** — company vs individual.
  - **`role`** — Which registrable role this request is for; indexed.
  - **`email`, `first_name`, `last_name`, `phone_number`** — Common contact details.
  - **`rental_type`, `company_name`, `abn`** — Extra fields for rental sign-ups.
  - **`shop_name`, `shop_address`** — Extra fields for mechanic sign-ups.
  - **`requested_by`** — For rental staff: the rental owner who created the request.
  - **`allowed_nav_paths`** — For rental staff: the granted nav paths, copied to the user on approval.
  - **`extra`** — Any other free-form JSON data supplied at registration.
  - **`status`** — Current review state (pending/approved/rejected), indexed.
  - **`rejection_reason`** — Why it was rejected, if applicable.
  - **`reviewed_at`, `reviewed_by`** — When and by which admin it was reviewed.
  - **`created_user`** — Link to the User account created when approved.
  - **`created_at`, `updated_at`** — Timestamps set automatically.
  - **`Meta`** — Newest first ordering and display names.
  - **`__str__()`** — Returns a readable summary like `email (Driver) - Pending`.
  - **`create_user_account(generated_password)`** — Creates the active User for this request with the given password and `must_change_password=True`. Rental staff become a `rental` user with the granted nav paths and a link to their owner; others get their plain role. Links the new user back to the request and returns it (does not mark the request approved by itself).
- **`registration_document_upload_path(instance, filename)`** — Builds the folder path where an uploaded registration document is stored, grouped by registration id.
- **`Document`** — An uploaded file attached to a registration request (ID, certificate, shop image, etc.). Fields:
  - **`DOC_TYPE_CHOICES`** — The document type options (license, passport, cnic, certificate, shop_image, other).
  - **`registration`** — Link to the registration request it belongs to; deleted with it.
  - **`doc_type`** — Which kind of document it is.
  - **`file`** — The actual uploaded file, stored via the path helper above.
  - **`original_name`** — The file's original name.
  - **`uploaded_at`** — When it was uploaded (automatic).
  - **`__str__()`** — Returns a readable label with the document type and name.
- **`Notification`** — An in-app notification (bell/notifications page), used to alert admins and other users. Fields:
  - **`recipient`** — The user who receives it; deleted with the user.
  - **`notification_type`** — A category string, default `new_registration`.
  - **`title`, `message`** — The text shown.
  - **`link`** — An optional frontend path to deep-link to (a fallback).
  - **`entity_type`** — What kind of record this is about (vehicle, driver, booking, etc.).
  - **`entity_id`** — The primary key of that record, stored as a string.
  - **`action`** — What happened (created, updated, approved, etc.).
  - **`actor_name`** — A saved snapshot of who did it, so the message still reads correctly if that user is later renamed or deleted.
  - **`registration`** — Optional link to a related registration request.
  - **`is_read`** — Whether the recipient has read it.
  - **`created_at`** — When created (automatic).
  - **`Meta`** — Newest first ordering.
  - **`__str__()`** — Returns "title -> recipient email".

---

### `backend/src/authentication/serializers.py`

This file defines serializers, which convert between JSON (from/to the API) and the model objects, and also validate incoming data.

- **`UserRegistrationSerializer`** — Validates a direct user sign-up with email, password, and password confirmation.
  - **`validate(attrs)`** — Checks the two passwords match; errors otherwise.
  - **`create(validated_data)`** — Drops the confirm field and creates the user with a hashed password. Returns the new user.
- **`UserLoginSerializer`** — Validates a login with email and password.
  - **`validate(attrs)`** — Tries to authenticate the credentials. Fails if wrong. If the user is a deactivated staff/superuser it blocks login; a restricted end user is still allowed (they land on a locked profile page). On success it puts the authenticated user into the validated data.
- **`UserProfileSerializer`** — Read-only serializer describing a user for the frontend. All fields are read-only. Fields include id, email, name parts, full_name, role, role_display, date_joined, is_active, is_suspended, suspension_reason, phone_number, allowed_nav_paths, profile, admin_contact, and documents.
  - **`get_full_name(obj)`** — Returns the user's full name.
  - **`get_is_suspended(obj)`** — Returns the unified `is_restricted` value (suspended OR deactivated).
  - **`get_suspension_reason(obj)`** — Returns the effective reason if restricted, else empty.
  - **`get_role_display(obj)`** — Returns the human-friendly role label.
  - **`get_profile(obj)`** — Returns role-specific details: driver's license number, a rental owner's company info, or a mechanic's shop info. Returns `None` for admins and rental staff.
  - **`get_documents(obj)`** — Returns the documents the user uploaded during registration (found via their approved request); empty for admins.
  - **`get_admin_contact(obj)`** — Returns who this user can contact for help. For rental staff it is their owner; for others it is the first active, non-suspended admin/superuser. `None` for admins.
  - **`_related(obj, attr)`** (static) — Safely reads a reverse one-to-one relation, returning `None` if it does not exist.
- **`TokenResponseSerializer`** — Documents the shape of a token response (access, refresh, user). Used for API docs.
- **`ErrorResponseSerializer`** — Documents the shape of an error response (a `detail` message). Used for API docs.
- **`RegistrationCreateSerializer`** — Validates and creates a pending `RegistrationRequest` (no account yet).
  - **`validate_role(value)`** — Ensures the role is driver, rental, or mechanic.
  - **`validate_email(value)`** — Lowercases/trims the email and rejects it if an account already exists or a pending request already uses it.
  - **`_clean_abn(value, required)`** (static) — Strips spaces and enforces that an ABN is exactly 11 digits (only required when needed).
  - **`validate(attrs)`** — Applies role-specific rules: rentals must pick company/individual (companies need a company name and an 11-digit ABN); mechanics must supply an 11-digit ABN.
- **`DocumentSerializer`** — Read serializer for an uploaded document.
  - **`get_file_url(obj)`** — Returns the file's full absolute URL (or `None` if there is no file).
- **`RegistrationDetailSerializer`** — Full read-only serializer used by admins reviewing a registration, including its documents and display labels.
  - **`get_requested_by_email(obj)`** — Returns the email of the rental owner who requested it (for staff requests), or `None`.
- **`NotificationSerializer`** — Read-only serializer for a notification, exposing its text, deep-link fields, read status, and timestamps.

---

### `backend/src/authentication/views.py`

This file defines the API endpoints (views) for registration, login, logout, profile, admin review of registrations, and notifications.

- **`IsAdmin`** — A permission class that allows access only to logged-in admins (role `admin` or a superuser).
  - **`has_permission(request, view)`** — Returns True only for an authenticated admin/superuser.
- **`REGISTRATION_DOC_FIELDS`** — A mapping of upload field names to document types accepted by the registration endpoint.
- **`RegisterView`** — `POST /api/auth/register/`. Open to anyone. Directly creates a user and logs them in by setting HttpOnly JWT cookies; returns the new user profile (tokens are never in the JSON body). Status 201.
- **`RegistrationSubmitView`** — `POST /api/auth/registrations/`. Open to anyone; accepts form/multipart uploads. Stores a pending registration request plus any uploaded documents, notifies admins, and returns a "awaiting approval" message. No account is created yet. Status 201.
- **`LoginView`** — `POST /api/auth/login/`. Open to anyone. Validates email/password, logs the session in, sets HttpOnly JWT cookies, and returns a user summary (including the unified `is_suspended` restriction and allowed nav paths) so the SPA can render the correct navigation.
- **`ProfileView`** — `GET /api/auth/me/`. Requires login. Returns the current user's full profile via `UserProfileSerializer`.
- **`CookieTokenRefreshView`** — `POST /api/auth/jwt/refresh/`. Open to anyone. Reads the refresh token from the HttpOnly cookie (or request body for tooling), validates it through SimpleJWT (so rotation/blacklisting apply), and writes fresh tokens back as cookies. If missing/invalid, it clears the cookies and returns 401 so the SPA falls back to login.
- **`LogoutView`** — `POST /api/auth/logout/`. Open to anyone. Best-effort blacklists the refresh token (so a stolen cookie can't be reused) and clears both auth cookies. Returns a "Logged out" message.
- **`UserViewSet`** — Read-only viewset at `/api/auth/users/`. Requires login. Lists/retrieves active users and supports filtering by `?email=` substring.
  - **`get_queryset()`** — Returns active users, optionally filtered by email.
- **`AdminRegistrationViewSet`** — Admin-only review of registration requests at `/api/auth/registrations/admin/`. Supports list, retrieve, delete, approve, and reject.
  - **`get_queryset()`** — Returns all requests (with documents prefetched); can filter by `?status=` and `?role=`. The default list hides `rental_staff` requests, but detail/approve/reject actions can still reach them.
  - **`approve(request, pk)`** — `POST /registrations/admin/{id}/approve/`. Approves the request (creating an account and emailing credentials via `approve_registration`), notifies other admins with a deep-link to the new account, and returns the updated request. Returns a 400 if approval fails.
  - **`reject(request, pk)`** — `POST /registrations/admin/{id}/reject/`. Rejects the request with an optional `reason`, emails the applicant, notifies other admins, and returns the updated request. Returns 400 if rejection fails.
- **`NotificationsGranted`** — A permission class gating the notifications module for rental staff.
  - **`has_permission(request, view)`** — Rental staff (role `rental` with nav paths) may use notifications only if `/notifications` is one of their granted paths; rental owners and all other roles always pass.
- **`NotificationViewSet`** — The current user's notifications at `/api/auth/notifications/`. Requires login and the notifications permission. Supports list and delete.
  - **`get_queryset()`** — Returns only the current user's notifications.
  - **`unread_count(request)`** — `GET /notifications/unread-count/`. Returns the count of unread notifications.
  - **`mark_all_read(request)`** — `POST /notifications/mark-all-read/`. Marks all of the user's notifications read and reports how many were updated.
  - **`mark_read(request, pk)`** — `POST /notifications/{id}/mark-read/`. Marks one notification read and returns it.

---

### `backend/src/authentication/urls.py`

This file lists the URL routes for the authentication app (mounted under `/api/auth/`).

- **`router`** — A DRF router that auto-generates the list/detail routes for three viewsets: `users`, `registrations/admin` (admin registration review), and `notifications`.
- **`urlpatterns`** — The route list:
  - `register/` → `RegisterView`.
  - `registrations/` → `RegistrationSubmitView` (public self-registration).
  - `login/` → `LoginView`; `logout/` → `LogoutView`; `me/` → `ProfileView`.
  - `jwt/create/` → SimpleJWT's `TokenObtainPairView`; `jwt/refresh/` → the cookie-aware `CookieTokenRefreshView`; `jwt/verify/` → SimpleJWT's `TokenVerifyView`.
  - `''` → includes all the router-generated URLs.

---

### `backend/src/authentication/authentication.py`

This file defines the custom JWT authentication class that both logs users in from cookies and enforces account suspension across the whole API.

- **`SuspensionAwareJWTAuthentication`** — Extends SimpleJWT's authentication. It is the single global point that enforces suspension.
  - **`EXEMPT_SEGMENT`** — The URL segment (`/auth/`) that a restricted user is always allowed to reach (login, profile, refresh, logout).
  - **`get_user(validated_token)`** — Loads the user from the token's user id. Unlike SimpleJWT's default, it does NOT reject deactivated end users (so they can still see why they're restricted); it only blocks deactivated staff/superusers. Raises if the token has no user id or the user is missing.
  - **`authenticate(request)`** — Finds the token from the `Authorization: Bearer` header, or falls back to the HttpOnly access-token cookie. If the token is bad and came from a cookie, it returns anonymous (so public endpoints don't loop the login page); a bad explicit header still hard-fails with 401. If the user is restricted and the request is not under `/auth/`, it refuses with a suspended error. Otherwise it returns the authenticated user and token.

---

### `backend/src/authentication/backends.py`

This file defines a custom login backend that lets restricted end users still log in.

- **`RestrictedLoginModelBackend`** — Extends Django's `ModelBackend`.
  - **`user_can_authenticate(user)`** — Returns True for active users; for inactive users it returns True only if they are NOT staff/superuser. This means deactivated end users can still log in (to reach their locked profile page), but deactivated staff/superusers stay fully blocked (a real kill switch).

---

### `backend/src/authentication/cookies.py`

This file is the single place that knows the JWT cookie names and security settings, used by login, refresh, and logout to stay consistent.

- **`_cookie_kwargs()`** — Returns the shared cookie security attributes (HttpOnly, Secure, SameSite, domain, path) from settings.
- **`_max_age(setting_key)`** — Returns a cookie lifetime in seconds, matching the corresponding SimpleJWT token lifetime.
- **`set_auth_cookies(response, access, refresh)`** — Attaches the access and/or refresh JWTs to the response as HttpOnly cookies with the right lifetimes. Returns the response.
- **`clear_auth_cookies(response)`** — Expires both auth cookies (used at logout or on invalid refresh). Returns the response.

---

### `backend/src/authentication/services.py`

This file holds the business logic for the registration approval workflow and for creating in-app notifications, kept separate so both the Django admin and the REST views can reuse it.

- **`_PASSWORD_WORDS`** — A list of simple Australian/car-themed words used to build friendly generated passwords.
- **`generate_password()`** — Returns a random easy-to-type password: a capitalized word plus four digits (e.g. `Koala4821`).
- **`actor_label(user)`** — Returns a readable snapshot of who did something, like `John Smith (driver)`, so notification text survives later renames/deletes.
- **`notify_user(recipient, title, message, ...)`** — Creates one in-app notification for a single user, with optional deep-link and entity fields. Returns the created notification (or `None` if no recipient).
- **`notify_admins(title, message, ..., exclude=None)`** — Creates a notification for every active, non-suspended admin/superuser (optionally skipping one user, usually the actor). Uses a bulk insert; returns how many were created.
- **`notify_admins_of_action(actor, action, entity_type, entity_id, title, message, ...)`** — Convenience wrapper that notifies all admins that a user performed an action on a record, excluding the actor. Returns the count sent.
- **`notify_admins_of_registration(registration)`** — Notifies all active, non-suspended admins about a new registration, linking to the request. Returns the count sent.
- **`notify_admins_of_staff_created(staff_user, owner)`** — Notifies all admins when a rental owner adds a staff member directly (no approval step). Returns the count sent.
- **`ApprovalError`** — A custom exception raised when a registration cannot be approved or rejected.
- **`approve_registration(registration, reviewer, login_url)`** — Runs in a database transaction. Rejects if the request is not pending or the email is already taken. Otherwise generates a password, creates the user account, marks the request approved (recording reviewer/time), creates the role-specific profile (via the operations app), and emails the credentials. Returns `(user, raw_password)`.
- **`reject_registration(registration, reviewer, reason)`** — Runs in a transaction. Rejects if not pending; otherwise marks the request rejected (with reason/reviewer/time) and emails the applicant. Returns the registration.

---

### `backend/src/authentication/tasks.py`

This file defines Celery background/scheduled tasks for the authentication app, mostly around sending emails and periodic user stats.

- **`send_welcome_email(user_email)`** — Sends a welcome email to a newly registered user. Logs success or failure; re-raises on error.
- **`_from_email()`** — Returns the configured "from" email address, or a fallback default.
- **`send_registration_approved_email(email, password, role, login_url)`** — Emails a newly approved user their generated login credentials and a reminder to change the password. Safe to call directly (without `.delay`). Logs and re-raises on failure.
- **`send_registration_rejected_email(email, role, reason)`** — Emails a user that their registration was rejected, including an optional reason. Logs and re-raises on failure.
- **`cleanup_inactive_users()`** — Scheduled daily. Counts suspended users and logs the number (a placeholder that could later actually remove old accounts). Returns a summary string.
- **`generate_user_stats()`** — Scheduled daily. Computes total users, active users, and users joined in the last 30 days, logs them, and returns the stats dictionary.

---

### `backend/src/authentication/ws_auth.py`

This file authenticates WebSocket connections using the same HttpOnly access-token cookie the HTTP API uses.

- **`_access_token_from_scope(scope)`** — Reads the raw cookie header from the WebSocket handshake and pulls out the access-token cookie value (or `None`).
- **`_resolve_user(raw_token)`** — Validates the token and loads its user, returning `AnonymousUser` on any failure or missing token. Runs safely in the async context via `database_sync_to_async`.
- **`CookieJWTAuthMiddleware`** — Channels middleware that identifies the connecting user.
  - **`__init__(inner)`** — Stores the next handler in the chain.
  - **`__call__(scope, receive, send)`** — Resolves the user from the cookie, puts them on `scope['user']`, then passes control to the inner handler. Suspension is not enforced here; the consumer decides what a restricted user may do.

---

### `backend/src/authentication/admin.py`

This file customizes the Django admin site for users, registration requests, and notifications, and hides unused admin sections.

- **`UserCreationForm`** — Admin form for adding a new user, with two password fields.
  - **`clean_password2()`** — Ensures the two passwords match.
  - **`save(commit=True)`** — Saves the user with the password properly hashed.
- **`UserChangeForm`** — Admin form for editing a user; shows a read-only password hash instead of the raw password.
  - **`clean_password()`** — Always keeps the existing password hash (editing here never changes the password).
- **`UserAdmin`** — Registers the `User` model in the admin with custom forms, list columns, filters, fieldsets, search, and read-only date fields.
  - **`suspend_users(request, queryset)`** — Bulk action: suspends selected non-superuser accounts (they can still log in but are locked to their profile) with a generic reason. Reports how many were suspended.
  - **`activate_users(request, queryset)`** — Bulk action: reactivates selected accounts, clearing the suspension, reason, GPS strike count, and any legacy inactive flag. Reports how many were reactivated.
- **`DocumentInline`** — A read-only inline that shows the files uploaded with a registration inside its admin page.
  - **`has_add_permission(...)`** — Returns False so files can't be added here.
  - **`preview(obj)`** — Renders an image thumbnail for image files or an "Open file" link otherwise.
- **`RegistrationRequestAdmin`** — Registers `RegistrationRequest` in the admin for reviewing sign-ups (with the document inline). All applicant fields are read-only.
  - **`approve_selected(request, queryset)`** — Bulk action: approves each selected request (creating accounts and emailing credentials), reporting successes and any errors.
  - **`reject_selected(request, queryset)`** — Bulk action: rejects each selected request using its typed rejection reason, reporting results and errors.
- **`NotificationAdmin`** — Registers `Notification` in the admin with list columns, filters, search, and read-only fields.
  - **`registration_link(obj)`** — Renders a link to the related registration's admin page, or `-` if none.
- **beat-model hiding** — Tries to unregister the `django_celery_beat` scheduling models (Clocked/Crontab/Interval/PeriodicTask/Solar) so they don't clutter the admin UI (scheduling still works). Silently skips if the package isn't installed.
- **Groups hiding** — Unregisters Django's built-in "Groups" admin because this project uses its own `role` field for access control instead.

---

### `backend/src/authentication/apps.py`

This file is the Django app configuration for the authentication app.

- **`AuthenticationConfig`** — Declares the app named `authentication` and sets its default primary-key field type to a big integer.


---

# Backend — Operations: Data Models & Admin

### `operations/models.py`

This file defines the main database tables for the platform: role-specific profile tables (extra info for drivers, rental owners, mechanics), the vehicles themselves, booking requests, maintenance jobs, GPS tracking, warning/audit trails, and the single global site-branding record. Each Python class below is one database table.

#### Model: `DriverProfile`

Extra sign-up details for a person whose role is "driver". It attaches to their main user account.

Fields:
- `user` — OneToOneField to `User` (from the authentication app) — the driver's main account; deleting the user deletes this profile (CASCADE). Reachable from the user as `user.driver_profile`.
- `license_number` — CharField (max 50, optional/blank) — the driver's licence number.
- `created_at` — DateTimeField (auto set once on creation) — when the profile row was made.
- `updated_at` — DateTimeField (auto updated on every save) — when it was last changed.

Methods:
- `__str__` — returns a readable label like `DriverProfile<email>` for admin/debug displays.

#### Model: `RentalProfile`

Extra sign-up details for a "rental" owner — the business or individual who owns vehicles and rents them out.

Fields:
- `user` — OneToOneField to `User` — the rental owner's main account (CASCADE delete). Reachable as `user.rental_profile`.
- `rental_type` — CharField (max 20, optional) — either `company` or `individual` (from `RENTAL_TYPE_CHOICES`).
- `company_name` — CharField (max 255, optional) — business name if it is a company.
- `abn` — CharField (max 20, optional) — Australian Business Number.
- `minimum_rental_days` — PositiveIntegerField (optional/null) — default minimum number of days they rent for.
- `latitude` — FloatField (optional/null) — map latitude of the rental location.
- `longitude` — FloatField (optional/null) — map longitude of the rental location.
- `created_at` — DateTimeField (auto on creation) — when created.
- `updated_at` — DateTimeField (auto on save) — last change time.

Methods:
- `__str__` — returns a label like `RentalProfile<email>`.

#### Model: `MechanicProfile`

Extra sign-up details for a "mechanic" — the person/shop that repairs vehicles.

Fields:
- `user` — OneToOneField to `User` — the mechanic's main account (CASCADE delete). Reachable as `user.mechanic_profile`.
- `shop_name` — CharField (max 255, optional) — the workshop's name.
- `shop_address` — TextField (optional) — the workshop's address.
- `abn` — CharField (max 20, optional) — Australian Business Number.
- `created_at` — DateTimeField (auto on creation) — when created.
- `updated_at` — DateTimeField (auto on save) — last change time.

Methods:
- `__str__` — returns a label like `MechanicProfile<email>`.

#### Model: `Vehicle`

A single car owned by a rental owner and offered for rent.

Status choices (constants `STATUS_*`, stored in `status`):
- `available` — free to be booked.
- `rented` — currently out with a driver.
- `pending_return` — the rental period ended but the owner has not yet confirmed the car physically came back; it cannot be re-booked until confirmed.
- `maintenance` — being repaired.

Insurance choices (`INSURANCE_TYPE_CHOICES`) are only quick-pick suggestions for the UI (CTP, third-party property, third-party fire & theft, comprehensive). The `insurance_type` field is NOT limited to these — a custom provider name can also be typed.

Fields:
- `rental` — ForeignKey to `User`, limited to users with role `rental` — the owner of this car (CASCADE delete). Reachable from the owner as `user.vehicles`.
- `make` — CharField (max 100) — vehicle make (e.g. Toyota).
- `model` — CharField (max 100) — vehicle model (e.g. Corolla).
- `year` — PositiveIntegerField (optional/null) — model year.
- `rego` — CharField (max 20, optional) — registration/number plate.
- `insurance_expiry` — DateField (optional/null) — when the insurance runs out.
- `insurance_type` — CharField (max 100, optional) — an insurance code from the choices above OR free-text custom provider name.
- `image_url` — TextField (optional) — the primary photo; stored as text (not URLField) so it can hold a long uploaded data URL. Mirrors the first entry of `image_urls`.
- `image_urls` — JSONField (default empty list) — all vehicle photos as a list of data URLs.
- `status` — CharField (max 20, default `available`, database-indexed) — current state from the status choices.
- `maintenance_note` — TextField (optional) — what work is needed, filled when the owner sets status to `maintenance` from the fleet edit form.
- `total_distance_km` — PositiveIntegerField (default 0) — total kilometres the car has travelled on the platform.
- `trips` — PositiveIntegerField (default 0) — how many rental trips it has completed.
- `oil_due_date` — DateField (optional/null) — when the next oil change is due.
- `rego_due_date` — DateField (optional/null) — when the registration is due for renewal.
- `odometer_km` — PositiveIntegerField (optional/null) — the odometer reading entered by the owner.
- `last_oil_change_date` — DateField (optional/null) — when the oil was last changed.
- `last_rego_payment_date` — DateField (optional/null) — when the registration was last paid.
- `rent_price_per_day` — DecimalField (up to 8 digits, 2 decimals, optional/null) — daily rental price.
- `minimum_rental_days` — PositiveIntegerField (optional/null) — minimum days a driver must book this car.
- `created_at` — DateTimeField (auto on creation) — when added.
- `updated_at` — DateTimeField (auto on save) — last change time.

Meta:
- `ordering = ['-created_at']` — newest vehicles listed first by default.

Methods:
- `__str__` — returns a label like `Make Model (rego)`.

#### Model: `VehicleReminderLog`

Records that a specific person was reminded about a specific vehicle event (oil, rego, return, maintenance) on a specific day. It exists so the daily reminder job knows what has already been sent and does not spam duplicates — but a new day allows the reminder to fire again. Deleting the actual notification does NOT cause it to be re-created the same day, because the dedup key lives here, not on the notification.

Notification-type choices (`NTYPE_CHOICES`, stored in `ntype`):
- `oil` — oil change reminder.
- `rego` — registration expiry reminder.
- `return` — return-due reminder.
- `maint` — maintenance-overdue reminder.

Fields:
- `recipient` — ForeignKey to `User` — who received the reminder (CASCADE delete). Reachable as `user.vehicle_reminder_logs`.
- `vehicle` — ForeignKey to `Vehicle` — which vehicle the reminder is about (CASCADE). Reachable as `vehicle.reminder_logs`.
- `ntype` — CharField (max 10) — the reminder type from the choices above.
- `due_date` — DateField — the date the reminded thing is due.
- `sent_date` — DateField (indexed) — the day the reminder was sent (the dedup key).
- `created_at` — DateTimeField (auto on creation) — row creation time.

Meta:
- `unique_together = ('recipient', 'vehicle', 'ntype', 'sent_date')` — guarantees only one reminder of each kind, per vehicle, per recipient, per day.

Methods:
- `__str__` — returns a label like `ReminderLog<recipient vehicle ntype date>`.

#### Model: `ActivityLog`

A permanent audit trail of who did what inside a rental owner's account. Every meaningful write by the owner or one of their staff sub-accounts (adding a vehicle, approving a booking, accepting a quote, etc.) creates one row. Unlike notifications (which can be deleted), this trail is durable and lets the owner see exactly which staff member made each change.

Fields:
- `rental` — ForeignKey to `User` — the rental owner whose account this activity belongs to, i.e. the "scope" (CASCADE delete). Reachable as `user.activity_log`.
- `actor` — ForeignKey to `User` (SET_NULL, optional) — who actually performed the action; set to null (not deleted) if that user is later removed. Reachable as `user.activity_performed`.
- `actor_name` — CharField (max 255, optional) — a snapshot of the actor's display name at the time, so the record still reads correctly even after the actor is deleted.
- `by_staff` — BooleanField (default False) — True if a staff sub-account did it, not the owner personally.
- `action` — CharField (max 50, indexed) — a machine-readable code, e.g. `request.approved`, `vehicle.created`.
- `summary` — TextField — a human-readable one-line description of what happened.
- `link` — CharField (max 255, optional) — an in-app deep link to where the action happened.
- `created_at` — DateTimeField (auto on creation, indexed) — when the action happened.

Meta:
- `ordering = ['-created_at']` — newest activity first.

Methods:
- `__str__` — returns a label like `Activity<rental_id action by actor_name>`.

#### Model: `RentalRequest`

A driver's booking request for a vehicle, which the rental owner reviews and decides on. Also tracks the "return handshake" at the end of a trip.

Status choices (`STATUS_*`, stored in `status`):
- `pending` — awaiting the owner's decision.
- `approved` — legacy active state, replaced by `running` (kept only for old rows).
- `running` — active rental; approved and the car is out with the driver.
- `rejected` — owner declined.
- `cancelled` — cancelled.
- `info_requested` — owner asked the driver for more information.
- `completed` — the rental period finished (auto at the end date, or an early return was confirmed).

Return-handshake choices (`RETURN_*`, stored in `return_state`) — these run alongside `status`; the booking stays `running` while a return is negotiated and only the final confirm flips it to `completed`:
- `''` (RETURN_NONE) — running normally, no return in progress.
- `requested_by_rental` — the owner asked the driver to return early; the driver acts next.
- `requested_by_driver` — the driver asked to return early; the owner acts next.
- `period_ended` — the end date passed (set by a cron job); the driver clicks "Complete Trip".
- `driver_completed` — the driver completed the trip at the end of the period; the owner confirms the return.

Fields:
- `driver` — ForeignKey to `User`, limited to role `driver` — who is requesting (CASCADE). Reachable as `user.rental_requests`.
- `vehicle` — ForeignKey to `Vehicle` — the car being requested (CASCADE). Reachable as `vehicle.requests`.
- `rental` — ForeignKey to `User` — the owning rental, copied from `vehicle.rental` so it can be filtered easily (denormalised). Reachable as `user.incoming_rental_requests`.
- `start_date` — DateField (optional/null) — requested start of the rental.
- `end_date` — DateField (optional/null) — requested end of the rental.
- `status` — CharField (max 20, default `pending`, indexed) — current status from the choices above.
- `decision_reason` — TextField (optional) — the owner's reason when approving/rejecting.
- `id_documents` — JSONField (default empty list) — uploaded identity documents.
- `verified_details` — JSONField (optional/null) — identity details pulled by OCR before submitting.
- `info_request_message` — TextField (optional) — the owner's "please send more info" note (used with `info_requested`).
- `return_state` — CharField (max 20, default `''`) — the return-handshake state from the choices above.
- `return_requested_at` — DateTimeField (optional/null) — when an early return was requested.
- `reviewed_at` — DateTimeField (optional/null) — when the owner made their decision.
- `created_at` — DateTimeField (auto on creation) — when the request was made.
- `updated_at` — DateTimeField (auto on save) — last change time.

Meta:
- `ordering = ['-created_at']` — newest requests first.

Methods:
- `__str__` — returns a label like `driver_email -> vehicle (status)`.

#### Model: `MaintenanceRequest`

A repair job for a vehicle. Lifecycle: the owner flags a car and describes the work (`pending`) → any mechanic can see the pool and submit a quote of price + duration (`quoted`, which assigns that mechanic) → the owner accepts (`running`, car becomes `maintenance`) or declines (`declined`) → the mechanic finishes the work (`pending_return`) → the owner confirms the return (`completed`, car back to `available`). Admins are notified at each step.

Status choices (`STATUS_*`, stored in `status`):
- `pending` — flagged with work described; awaiting a mechanic's quote.
- `quoted` — a mechanic submitted a price and duration.
- `running` — owner accepted; repair under way and the car is in maintenance (current active state).
- `accepted` — legacy active state, replaced by `running` (treated the same everywhere).
- `declined` — owner declined the quote.
- `cancelled` — mechanic withdrew their quote.
- `pending_return` — mechanic marked the work done; awaiting the owner's return confirmation.
- `completed` — owner confirmed the return; car back to available.
- `info_requested` — owner asked the mechanic for more info.

Other constants:
- `ACTIVE_STATUSES = (running, accepted)` — the statuses that mean a repair is in progress.
- Duration-unit choices (`DURATION_UNIT_CHOICES`, stored in `estimated_unit`): `hours` or `days`.

Fields:
- `vehicle` — ForeignKey to `Vehicle` — the car to be repaired (CASCADE). Reachable as `vehicle.maintenance_requests`.
- `rental` — ForeignKey to `User` — the owning rental, copied from `vehicle.rental` for easy filtering (denormalised). Reachable as `user.maintenance_requests_as_rental`.
- `mechanic` — ForeignKey to `User` (SET_NULL, optional), limited to role `mechanic` — the mechanic who quoted/took the job; null until one quotes. Reachable as `user.maintenance_requests_as_mechanic`.
- `work_description` — TextField — the work the owner needs done.
- `status` — CharField (max 20, default `pending`, indexed) — current status from the choices above.
- `quoted_price` — DecimalField (up to 10 digits, 2 decimals, optional/null) — the mechanic's quoted price.
- `estimated_value` — PositiveIntegerField (optional/null) — the number part of the estimated duration.
- `estimated_unit` — CharField (max 10, optional) — the unit of the duration (`hours`/`days`).
- `mechanic_notes` — TextField (optional) — extra notes from the mechanic.
- `decision_reason` — TextField (optional) — the owner's reason when accepting/declining.
- `id_documents` — JSONField (default empty list) — identity documents uploaded before quoting.
- `verified_details` — JSONField (optional/null) — OCR identity details.
- `info_request_message` — TextField (optional) — the owner's "please send more info" note.
- `quoted_at` — DateTimeField (optional/null) — when the mechanic quoted.
- `decided_at` — DateTimeField (optional/null) — when the owner accepted/declined.
- `work_completed_at` — DateTimeField (optional/null) — when the mechanic marked the work done (job went to `pending_return`).
- `completed_at` — DateTimeField (optional/null) — when the owner confirmed the return (fully completed).
- `created_at` — DateTimeField (auto on creation) — when created.
- `updated_at` — DateTimeField (auto on save) — last change time.

Meta:
- `ordering = ['-created_at']` — newest jobs first.

Methods:
- `__str__` — returns a label like `Maintenance<vehicle / status>`.

#### Model: `VehicleLocation`

The latest GPS position reported for a vehicle by the driver currently renting it. There is exactly one row per vehicle, overwritten (upserted) on each new report. The owner's live map reads these, and a missing or old `recorded_at` is treated as "location off" for the active trip by the staleness check in `operations.tracking`.

Fields:
- `vehicle` — OneToOneField to `Vehicle` — the car being tracked; one location per car (CASCADE). Reachable as `vehicle.location`.
- `driver` — ForeignKey to `User`, limited to role `driver` — who reported the position, for map attribution (CASCADE). Reachable as `user.reported_locations`.
- `rental_request` — ForeignKey to `RentalRequest` — the booking the position came from (CASCADE). Reachable as `rental_request.locations`.
- `latitude` — FloatField — the latitude.
- `longitude` — FloatField — the longitude.
- `accuracy` — FloatField (optional/null) — reported accuracy in metres.
- `recorded_at` — DateTimeField (indexed) — when the device recorded this position (used for the staleness check).
- `created_at` — DateTimeField (auto on creation) — when the row was written.

Methods:
- `__str__` — returns a label like `VehicleLocation<vehicle_id @ date time>`.

#### Model: `LocationWarning`

A single "location off" warning issued against a driver during an active rental. Rows serve two purposes: they stop duplicate warnings (no new warning within the gap window for the same trip) and they form the permanent history behind a driver's strike count. The running total lives on `User.location_warning_count`; this model snapshots its value at issue time (1, 2, 3 → suspension).

Fields:
- `driver` — ForeignKey to `User`, limited to role `driver` — the warned driver (CASCADE). Reachable as `user.location_warnings`.
- `rental_request` — ForeignKey to `RentalRequest` — the trip it happened on (CASCADE). Reachable as `rental_request.location_warnings`.
- `vehicle` — ForeignKey to `Vehicle` — the car involved (CASCADE). Reachable as `vehicle.location_warnings`.
- `warning_number` — PositiveIntegerField — the driver's strike number at the moment this warning was issued.
- `suspended` — BooleanField (default False) — True for the specific warning that crossed the threshold and suspended the account.
- `issued_at` — DateTimeField (auto on creation, indexed) — when the warning was issued.

Meta:
- `ordering = ['-issued_at']` — newest warnings first.

Methods:
- `__str__` — returns a label like `LocationWarning<driver=id #number>`.

#### Model: `DeletionAudit`

A permanent, standalone record of a destructive delete and everything it cascaded away. On purpose it has NO foreign key to the deleted thing (only a SET_NULL link to the actor) so the audit row SURVIVES the very cascade it documents. It stores a snapshot of the deleted row plus a per-model count of everything the delete removed, so an accidental delete can be investigated or understood. It is created BEFORE the delete runs.

Fields:
- `actor` — ForeignKey to `User` (SET_NULL, optional) — the admin who did the delete; nulled (not cascaded) if that admin is later removed. Reachable as `user.deletion_audits`.
- `actor_name` — CharField (max 255, optional) — a snapshot of the actor's name so the entry stands on its own.
- `target_type` — CharField (max 40, indexed) — the frontend-style entity type deleted (`rental`, `driver`, `mechanic`, `vehicle`, `booking`, `maintenance`, etc.).
- `target_id` — CharField (max 64, indexed) — the deleted row's original primary key.
- `target_label` — CharField (max 255, optional) — a human-readable label for the deleted thing.
- `snapshot` — JSONField (default empty dict) — a curated field-by-value copy of the deleted row itself.
- `cascade_counts` — JSONField (default empty dict) — a map of model name → number of rows the cascade removed (including the target).
- `cascade_total` — PositiveIntegerField (default 0) — the sum of `cascade_counts`, i.e. total rows removed.
- `created_at` — DateTimeField (auto on creation, indexed) — when the delete happened.

Meta:
- `ordering = ['-created_at']` — newest deletes first.

Methods:
- `__str__` — returns a label like `DeletionAudit<target_type target_id by actor_name>`.

#### Model: `SiteBranding`

App-wide branding controlled by the admin: theme mode, primary/secondary colour and logo. This is a deliberate SINGLE-ROW (singleton) model — there is always exactly one record at `pk=1`. Every user reads it on app load so the look-and-feel is global, and only admins may write it (enforced in the view). This is what makes an admin's theme change apply to everyone, instead of living in one browser's local storage.

Mode choices (`MODE_CHOICES`, stored in `mode`): `light` or `dark`.

Fields:
- `mode` — CharField (max 10, default `light`) — light or dark theme.
- `primary_color` — CharField (max 7, default `#6366f1`) — primary hex colour.
- `secondary_color` — CharField (max 7, default `#f59e0b`) — secondary hex colour.
- `logo_url` — TextField (optional, default empty) — the logo as a base64 data URL or a hosted URL; TextField because base64 logos are long.
- `updated_at` — DateTimeField (auto on save) — last change time.

Meta:
- `verbose_name` / `verbose_name_plural` — both set to "Site branding" so the admin does not show a pluralised name.

Methods:
- `save(...)` — forces `self.pk = 1` before saving, so there can only ever be one branding row.
- `load()` (classmethod) — returns the one branding row, creating it with defaults the first time it is used (via `get_or_create(pk=1)`).
- `__str__` — returns the fixed label `Site branding`.

### `operations/admin.py`

This file registers the models above in the Django admin site so staff can view and manage them through the built-in admin UI. Each block below is one registered admin screen. (Note: `RentalProfile`, `MechanicProfile`, and `MaintenanceRequest` are imported/defined but a couple are still registered below; `MaintenanceRequest` is NOT registered here.)

- `DriverProfileAdmin` (for `DriverProfile`) — the list shows the user, licence number, and creation date. You can search by the user's email and licence number.

- `RentalProfileAdmin` (for `RentalProfile`) — the list shows the user, rental type, company name, ABN, and creation date. You can search by user email, company name, and ABN.

- `MechanicProfileAdmin` (for `MechanicProfile`) — the list shows the user, shop name, ABN, and creation date. You can search by user email, shop name, and ABN.

- `VehicleAdmin` (for `Vehicle`) — the list shows make, model, rego, owner (rental), status, and daily price. You can filter the list by status, and search by make, model, rego, and the owner's email.

- `RentalRequestAdmin` (for `RentalRequest`) — the list shows id, driver, vehicle, owning rental, status, start and end dates, and creation date. You can filter by status, and search by driver email, vehicle rego, and rental email.

- `VehicleLocationAdmin` (for `VehicleLocation`) — the list shows vehicle, driver, latitude, longitude, and the recorded time. You can search by vehicle rego and driver email. All fields are read-only in the admin (`readonly_fields`), so these auto-reported GPS rows cannot be hand-edited.

- `LocationWarningAdmin` (for `LocationWarning`) — the list shows driver, vehicle, warning number, whether it caused a suspension, and when it was issued. You can filter by the `suspended` flag and search by driver email and vehicle rego. All fields are read-only, so warnings cannot be altered by hand.

- `DeletionAuditAdmin` (for `DeletionAudit`) — a forensic, read-only record of deletes. The list shows creation time, target type, target label, target id, actor name, and the total cascade count. You can filter by target type and creation date, and search by target label, target id, and actor name. All fields are read-only, and it overrides `has_add_permission` (returns False) and `has_change_permission` (returns False) so no one can add or edit these rows — the whole point is an immutable trail.

- `SiteBrandingAdmin` (for `SiteBranding`) — manages the single global branding row (though it is normally edited from the admin Settings page in the app). The list shows the label, mode, primary colour, secondary colour, and last-updated time. It overrides `has_add_permission` to only allow adding when no branding row exists yet (enforcing the singleton), and overrides `has_delete_permission` to return False so the single row can never be deleted.


---

# Backend — Operations: Serializers, Views & URLs

This document explains the `operations` app of the "Wheels of Australia" Django REST Framework backend. It covers the serializers (which turn database records into JSON and validate incoming data), the views (the API endpoints), and the URL routing (which web address calls which view).

---

### `operations/serializers.py`

This file holds all the serializers for the admin Drivers/Rentals/Mechanics lists, vehicles, bookings, maintenance jobs, activity logs, and site branding. Each user-facing serializer treats the `User` record as the single source of truth for name/email/phone/status and pulls role-specific extras from an attached profile. It also defines several small helper functions used across the serializers.

**Module-level helper functions**

- `HEX_COLOR_RE` / `ABN_RE` — pre-compiled regular expressions: one matches a valid hex colour (`#abc` or `#aabbcc`), the other matches exactly 11 digits (an Australian Business Number).
- `user_documents(user, context)` — returns the list of documents the user uploaded during registration, found through their linked registration request. Returns an empty list for users with no request (e.g. admin-created accounts).
- `rental_display_name(rental_user)` — returns the best display name for a rental owner: the company name if one is set, otherwise the person's full name.
- `vehicle_renter_info(vehicle)` — if the vehicle is currently rented (or pending return), returns a small dict about the driver holding it (name, email, phone, start/end dates, since when). Returns `None` otherwise. Looks up the latest running/completed booking.
- `vehicle_trip_count(vehicle)` — counts how many times a vehicle has actually been rented out (running + completed bookings). A finished trip still counts.
- `vehicle_maintenance_info(vehicle)` — if the vehicle is in maintenance, returns a dict about the active maintenance job (mechanic name/email/shop, work description, quoted price, estimate, notes). Returns `None` otherwise.
- `_status(user)` — returns the string `'inactive'` if the account is restricted (suspended or legacy-inactive), else `'active'`.
- `split_name(full_name)` — splits one "full name" string into `(first_name, last_name)`.
- `clean_abn(value, required)` — strips spaces and checks the ABN is exactly 11 digits. Empty is allowed only when not required; anything invalid raises a validation error.
- `unique_email(serializer, value)` — lower-cases the email and makes sure no other account already uses it (excluding the record being edited). Raises a validation error on a duplicate.

**`ActivityLogSerializer`** — Converts one audit-trail entry (who did what, when, in which rental's account) to JSON.
- Key fields: `id`, `action`, `summary`, `link`, `by_staff`, `actor_id`, `actor_name`, `rental_id`, `rental_name`, `created_at`.
- `get_actor_name(obj)` — prefers the actor's live name/email; falls back to the stored snapshot name if the actor account is gone.
- `get_rental_name(obj)` — returns the display name of the rental this entry belongs to.

**`_BaseUserWriteMixin`** — Shared create/update plumbing used by the role serializers (driver, rental, mechanic, admin rental-staff). It is not a serializer on its own.
- `validate_email(value)` — delegates to `unique_email` (lower-case + uniqueness).
- `validate(attrs)` — requires a password when creating a brand-new account, and requires a suspension reason when an admin sets status to `'inactive'`.
- `_apply_user_fields(user, validated)` — copies the shared writable inputs onto the `User` object: splits `full_name`/`contact_name` into first/last name, sets phone/email, applies status (`'inactive'` suspends but keeps login enabled so the user can read the reason; reactivating clears the lock, reason and GPS strike count), and sets the password if one was given.

**`DriverSerializer`** (extends `_BaseUserWriteMixin`) — Admin create/read/update of a driver account (`User` + `DriverProfile`).
- Writable inputs: `full_name`, `email`, `phone`, `license_number`, `status`, `suspension_reason`, `password`.
- `to_representation(instance)` — builds the read shape: id, full name, email, phone, licence number, status, GPS `location_warnings`, `suspended` flag, suspension reason, and uploaded documents.
- `create(validated_data)` — creates a `role='driver'` User (defaulting status to active) and its `DriverProfile` with the licence number.
- `update(instance, validated_data)` — applies the changed user fields, saves, then updates (or creates) the driver profile's licence number.

**`RentalSerializer`** (extends `_BaseUserWriteMixin`) — Admin create/read/update of a rental OWNER account (`User` + `RentalProfile`). Name comes in as `contact_name`.
- Writable inputs: `rental_type`, `company_name`, `abn`, `contact_name`, `email`, `phone`, `status`, `suspension_reason`, `minimum_rental_days`, `latitude`, `longitude`, `password`.
- `validate(attrs)` — runs the base checks, then validates the ABN (required + 11 digits only when `rental_type == 'company'`; ignored for individuals).
- `to_representation(instance)` — read shape including profile fields, contact name, status/suspension, location, documents, and a nested `staff` list (each staff member's id, name, email, phone, status, allowed nav paths).
- `_pop_profile(validated_data)` — pulls the profile-only fields out of the validated data.
- `create` / `update` — save the User via the base mixin and create/update the `RentalProfile` with the profile fields.

**`MechanicSerializer`** (extends `_BaseUserWriteMixin`) — Admin create/read/update of a mechanic account (`User` + `MechanicProfile`).
- Writable inputs: `full_name`, `email`, `phone`, `shop_name`, `shop_address`, `abn`, `status`, `suspension_reason`, `password`.
- `validate_abn(value)` — mechanics must supply a valid 11-digit ABN (always required).
- `to_representation(instance)` — read shape: id, name, email, phone, shop name/address, ABN, status/suspension, documents.
- `_pop_profile`, `create`, `update` — same pattern as the rental serializer, for the `MechanicProfile`.

**`VehicleSerializer`** — Vehicle create/read/update for the vehicle's OWNING rental (the Fleet page). The `rental` owner is set from the request user in the view, never by the client.
- Fields include make/model/year, rego, insurance, images, status, distances, service/rego dates, price, minimum rental days, plus computed `renter`, `maintenance`, `trips`.
- `get_trips` / `get_renter` / `get_maintenance` — call the corresponding helper functions above.
- `validate(attrs)` — keeps the single thumbnail `image_url` in sync with the first entry of the `image_urls` list.

**`AdminVehicleSerializer`** — All-vehicles list/CRUD for admins across every rental. Same as `VehicleSerializer` but the admin picks the owning `rental` (a rental owner's id) explicitly.
- Extra fields: `rental` (write-only owner id), `rental_id`, `rental_name` (display).
- `get_rental_name` — returns the owner's display name; `get_trips`/`get_renter`/`get_maintenance` mirror `VehicleSerializer`.
- `validate(attrs)` — same thumbnail-sync logic.

**`RentalStaffSerializer`** — Read-only view of a staff *registration request* as seen by the rental owner who created it. Exposes name, email, phone, granted nav paths, status + human status, rejection reason, created date, and the created user's id.

**`RentalStaffCreateSerializer`** (plain `Serializer`) — A rental owner creates a staff account directly, with no admin approval; the owner sets the login password so the staff member can sign in immediately.
- Inputs: `first_name`, `last_name`, `email`, `phone_number`, `password`, `allowed_nav_paths` (must be non-empty).
- `validate_email(value)` — lower-cases and rejects a duplicate email.
- `validate_password(value)` — rejects a blank password.
- `create(validated_data)` — creates a `role='rental'` User with the granted nav paths and a `rental_parent` link back to the owner, active immediately.

**`AdminRentalStaffSerializer`** (extends `_BaseUserWriteMixin`) — Admin full CRUD over rental staff (role='rental' users that have nav paths). The admin picks the owning rental and sets the password.
- Inputs: `full_name`, `email`, `phone`, `status`, `suspension_reason`, `password`, `allowed_nav_paths`, `rental` (owner id).
- `validate(attrs)` — on create requires both a password and a selected owning rental; also enforces the reason-when-inactive rule.
- `to_representation(instance)` — read shape: id, name, email, phone, status/suspension, allowed nav paths, owning rental id + name, documents.
- `create(validated_data)` — creates the staff User under the chosen owner with the given nav paths (defaults to `['/dashboard']`).
- `update(instance, validated_data)` — can change the owner and/or nav paths, then applies the other user fields.

**`RentalRequestSerializer`** — Read-only view of a booking request, joined with vehicle/driver/rental details.
- Fields: booking id/status, vehicle make/model/rego/status, driver name/email, rental name, dates, decision reason, review time, ID documents, verified details, info-request message, return state + time.
- `get_driver_name` — driver's full name; `get_rental_name` — owning rental's display name.

**`RentalRequestCreateSerializer`** — A driver creates a booking request for a vehicle, attaching identity documents.
- Inputs: `vehicle`, `start_date`, `end_date`, `id_documents`, `verified_details`.
- `validate_vehicle(vehicle)` — rejects any vehicle that isn't currently available.
- `validate(attrs)` — end date must be on/after start date; at least one identity document is required; and the driver can't have another open (pending or info-requested) request for the same vehicle.
- `create(validated_data)` — creates the `RentalRequest` for the logged-in driver, wiring the vehicle's owner as the rental.

**`BrowseRentalSerializer`** — Public-facing rental info for the driver "Browse rentals" page. Reads a rental owner User + its profile + a count of available vehicles.
- `available_vehicle_count` comes from the `available_count` annotation on the queryset.
- `_profile(obj)` and the `get_*` methods (rental_type, company_name, contact_name, minimum_rental_days, latitude, longitude) read from the rental profile, defaulting gracefully when it is missing.

**`MaintenanceRequestSerializer`** — Read-only view of a maintenance job, joined with vehicle / rental / mechanic details.
- Fields: job id/status, vehicle make/model/rego/image/status, rental id + name, mechanic id + name/email/phone/shop/address/ABN, work description, quoted price, estimate value+unit, notes, decision reason, ID documents, verified details, info-request message, and several timestamps.
- `get_rental_name`, `get_mechanic_name`, `_mechanic_profile`, `get_mechanic_shop`, `get_mechanic_shop_address`, `get_mechanic_abn` — pull the joined display data, defaulting when the mechanic isn't set yet.

**`MaintenanceRequestCreateSerializer`** — A rental owner flags one of their vehicles for maintenance and describes the work.
- Inputs: `vehicle`, `work_description`.
- `validate_work_description(value)` — the description can't be blank.
- `validate_vehicle(vehicle)` — the vehicle must belong to the requesting owner, and it can't already have an open maintenance request.
- `create(validated_data)` — creates the `MaintenanceRequest` for the owner.

**`SiteBrandingSerializer`** — The single global branding record (theme mode, primary/secondary colours, logo URL). Read by anyone; only admins reach the write path (enforced in the view).
- `_validate_hex(value)`, `validate_primary_color`, `validate_secondary_color` — ensure a supplied colour is a valid hex value.

---

### `operations/views.py`

This file holds the API endpoints (ViewSets and APIViews) for admin management, the rental fleet, bookings, maintenance, browsing, activity logs, reminders, dashboard stats, automatic behaviours, and branding. It also defines permission classes and many helper functions.

**Module-level helpers and permissions**

- `owning_rental(user)` — returns the rental OWNER a user acts for: the user themselves if they are an owner, or their `rental_parent` if they are staff. `None` for non-rental users.
- `is_rental_staff(user)` — `True` if the user is a rental STAFF member (role rental + has nav paths).
- `staff_lacks_section(user, nav_path)` — `True` if a rental staff member has NOT been granted that section, used to block direct API access.
- `record_action(actor, owner, action, summary, link, notify_title, entity_type, entity_id, notify_admin)` — writes a durable `ActivityLog` entry attributing an action to an actor within an owner's scope. When a STAFF member (not the owner) did it, it also notifies the owner. Optionally notifies all admins (excluding the actor). No-op for admins or when there's no owning rental.
- `_snapshot_instance(instance)` — builds a small JSON-safe dict of a record's key fields (used for deletion auditing).
- `record_deletion(actor, instance, target_type)` — writes a `DeletionAudit` BEFORE a record is deleted, capturing a snapshot plus a per-model count of everything the delete cascade will remove. Best-effort; never blocks the delete.
- `close_open_maintenance_for_vehicle(vehicle, actor, reason)` — when a vehicle is put back to "available", removes any still-open maintenance request for it, notifies the assigned mechanic and admins, and returns the count removed.
- `AdminWriteNotifyMixin` — a mixin for admin ModelViewSets. When one admin creates/updates/deletes a record it notifies every OTHER admin (panel sync). `_entity_label` builds a readable label; `perform_create`/`perform_update`/`perform_destroy` save/delete and then notify. `perform_update` also frees maintenance when an admin sets a vehicle back to available. `perform_destroy` writes a deletion audit first.
- Permission classes: `IsRental` (any rental user), `IsRentalOwner` (owners only, not staff), `RentalSectionPermission` (base: a staff member passes only if this section's nav path is in their grants; owners and non-rental roles pass), with concrete subclasses `FleetSectionGranted` (`/fleet`), `RentalRequestsSectionGranted` (`/rental/requests`), `MaintenanceSectionGranted` (`/maintenance`). Also `IsMechanic`, `IsDriver`. `IsAdmin` is imported from the authentication app.

#### `DriverViewSet`
Manages driver accounts. Admin-only (`IsAdmin`). Uses `AdminWriteNotifyMixin`, so create/update/delete auto-notify other admins.
- `get_queryset()` — all `role='driver'` users, with profile + registration documents pre-loaded, newest first.
- (inherited) `list` GET `/api/admin/drivers/`, `retrieve` GET `/api/admin/drivers/{id}/`, `create` POST, `update`/`partial_update` PUT/PATCH, `destroy` DELETE — standard admin CRUD over drivers.
- `reactivate` — POST `/api/admin/drivers/{id}/reactivate/`. Admin only. Lifts a (GPS) suspension: unlocks the account, clears the strike count and reason, tells the driver their account is active again, and notifies other admins.

#### `RentalViewSet`
Manages rental OWNER accounts. Admin-only. Uses `AdminWriteNotifyMixin`.
- `get_queryset()` — rental OWNERS only (role rental with no nav paths), with profile, staff and documents pre-loaded, newest first.
- (inherited) standard admin CRUD (`list`, `retrieve`, `create`, `update`, `partial_update`, `destroy`) at `/api/admin/rentals/...`, each auto-notifying other admins.

#### `MechanicViewSet`
Manages mechanic accounts. Admin-only. Uses `AdminWriteNotifyMixin`.
- `get_queryset()` — all `role='mechanic'` users with profile + documents, newest first.
- (inherited) standard admin CRUD at `/api/admin/mechanics/...`, auto-notifying other admins.

#### `AdminVehicleViewSet`
Manages ALL vehicles across every rental (admin Vehicles page). Admin-only. Uses `AdminWriteNotifyMixin`.
- `get_queryset()` — every vehicle, with owner + owner profile pre-loaded.
- (inherited) standard admin CRUD at `/api/admin/vehicles/...`. On update, if the admin sets a vehicle back to available, `perform_update` also closes any open maintenance for it. Each write notifies other admins.

#### `FleetViewSet`
A rental owner's own vehicles — the Fleet page. Full CRUD, scoped so one rental can never see or edit another's vehicles. Permissions: authenticated + `IsRental` + `FleetSectionGranted` (staff need the `/fleet` grant).
- `get_queryset()` — vehicles belonging to the acting owner (a staff member sees the OWNER's fleet, not an empty one).
- `perform_create(serializer)` — saves the new vehicle with the owner attached, logs the action (`vehicle.created`) and notifies the owner (if a staff member did it) and admins.
- `perform_update(serializer)` — saves changes, logs `vehicle.updated`; if the vehicle was moved back to available, closes any open maintenance for it.
- `perform_destroy(instance)` — writes a deletion audit, deletes the vehicle, then logs `vehicle.deleted` and notifies.
- (inherited) `list` GET `/api/fleet/`, `retrieve` GET `/api/fleet/{id}/`, `create` POST, `update`/`partial_update` PUT/PATCH, `destroy` DELETE.

#### `RentalStaffViewSet`
A rental OWNER manages their staff. Creating a member creates the account immediately (no admin approval); the owner sets the login password. Permissions: authenticated + `IsRentalOwner` (staff can't manage other staff). Item ids are prefixed like `u<id>`.
- `_user_item(u)` (static) — builds the JSON shape for one staff member (prefixed id, kind, user id, name, email, phone, nav paths, status).
- `_resolve(pk)` — turns a prefixed id back into a staff User scoped to this owner, or `None`.
- `list` — GET `/api/rental-staff/`. Returns all staff of the logged-in owner.
- `create` — POST `/api/rental-staff/`. Validates + creates a staff account via `RentalStaffCreateSerializer`, notifies admins, logs `staff.created`, returns the new item (201).
- `_apply_edit(obj)` — applies the editable fields (nav paths, first/last name, phone) from the request and saves.
- `partial_update` — PATCH `/api/rental-staff/{pk}/`. Resolves the member (404 if not found), applies the edit, logs `staff.updated` and notifies admins.
- `update` — PUT `/api/rental-staff/{pk}/`. Delegates to `partial_update`.
- `destroy` — DELETE `/api/rental-staff/{pk}/`. Resolves the member, deletes them, logs `staff.deleted` and notifies admins (204).

#### `AdminRentalStaffViewSet`
Admin full CRUD over every rental's staff, grouped by owning rental. Admin-only. Uses `AdminWriteNotifyMixin`.
- `get_queryset()` — all `role='rental'` users that HAVE nav paths (i.e. staff), with owner + profile + documents, newest first.
- (inherited) standard admin CRUD at `/api/admin/rental-staff/...`, auto-notifying other admins.

#### `RentalRequestViewSet`
Booking requests, scoped by role: a driver sees/creates their own; a rental owner/staff sees requests for their fleet and can approve/reject; an admin sees all. Permissions: authenticated + `RentalRequestsSectionGranted`. Allowed HTTP methods: GET, POST, DELETE (edits happen through the custom actions below).
- `get_serializer_class()` — uses the create serializer for `create`, otherwise the read serializer.
- `get_queryset()` — admin sees all; driver sees their own; rental sees their owner's; others see none.
- `destroy` — DELETE `/api/rental-requests/{id}/`. Permanently removes a booking. The owning rental, an admin, or the requesting driver may delete; a still-active running booking can't be deleted (a driver may delete their own only after the rental period has ended). Writes a deletion audit first.
- `create` — POST `/api/rental-requests/`. Only drivers may create; otherwise delegates to the base create.
- `perform_create(serializer)` — saves the booking, notifies the owning rental of a new request, and surfaces it to the admin panel.
- `_decide(request, new_status)` — shared approve/reject engine: checks the caller owns the request (or is admin) and it's still pending/info-requested, sets the new status + decision reason + review time, notifies the driver. On approval it flags the vehicle "rented", auto-rejects and notifies every other still-pending request for the same vehicle, and notifies admins; also logs the action.
- `approve` — POST `/api/rental-requests/{id}/approve/`. Owning rental (or admin) approves; puts the booking straight into the active "running" state.
- `reject` — POST `/api/rental-requests/{id}/reject/`. Owning rental (or admin) rejects the request.
- `cancel` — POST `/api/rental-requests/{id}/cancel/`. The owning driver (or admin) cancels the request in any status; the row is kept (status set to cancelled) and both the rental and admins are notified.
- `_booking_party(request, booking)` — returns how the caller relates to the booking: `'admin'`, `'rental'`, `'driver'`, or `None`.
- `_home_link(booking, user)` (static) — the list page a given user manages a booking from (`/my-requests` for the driver, else `/rental/requests`).
- `request_return` — POST `/api/rental-requests/{id}/request-return/`. Either party asks to end an active rental EARLY (before its end date). Records who initiated, notifies the other party to confirm/decline, and notifies admins. The booking stays running.
- `cancel_return` — POST `/api/rental-requests/{id}/cancel-return/`. Declines (recipient) or withdraws (initiator) an outstanding early-return request; the rental simply continues. Notifies whoever did not act.
- `complete_trip` — POST `/api/rental-requests/{id}/complete-trip/`. After the period has ended (return state "period_ended"), the driver (or admin) marks the trip complete; the rental is then asked to confirm the physical return. Notifies the rental and admins.
- `confirm_return` — POST `/api/rental-requests/{id}/confirm-return/`. Final return step: completes the booking and releases the vehicle to "available". Who may confirm depends on the return handshake state (driver confirms an owner-initiated return; rental confirms a driver-initiated or period-ended one). Notifies both parties (except the confirmer) and admins; logs the action.
- `request_info` — POST `/api/rental-requests/{id}/request-info/`. The owning rental (or admin) asks the driver for more information; moves the request to "info_requested" with a message and notifies the driver; logs and notifies admins.
- `provide_info` — POST `/api/rental-requests/{id}/provide-info/`. The driver supplies the requested documents/details; the request goes back to "pending" for review. Notifies the rental and admins.

#### `MaintenanceRequestViewSet`
Maintenance jobs, scoped by role: a rental owner/staff creates jobs for their own vehicles and accepts/declines/completes quotes; a mechanic sees the open pool plus their own jobs and submits quotes; an admin sees all. Permissions: authenticated + `MaintenanceSectionGranted`. Allowed HTTP methods: GET, POST, DELETE (decisions via actions).
- `get_serializer_class()` — the create serializer for `create`, otherwise the read serializer.
- `get_queryset()` — admin sees all; mechanic sees pending pool + own jobs; rental sees their owner's jobs; others none.
- `create` — POST `/api/maintenance-requests/`. Only rental users may flag a vehicle. Validates via the create serializer, saves, moves an available vehicle into "maintenance", notifies admins and logs `maintenance.flagged`.
- `quote` — POST `/api/maintenance-requests/{id}/quote/`. Mechanic-only. Validates price, duration value + unit, and required identity documents; assigns the mechanic, records the quote, sets status "quoted", and notifies admins and the owning rental.
- `_is_owning_rental(request, mr)` — helper: `True` if the caller is an admin or the job's owning rental.
- `accept` — POST `/api/maintenance-requests/{id}/accept/`. Owning rental (or admin) accepts a quote → job goes "running" and vehicle to "maintenance". Notifies admins and the mechanic, auto-declines every other open quote for the same vehicle (notifying those mechanics), and logs `maintenance.accepted`.
- `decline` — POST `/api/maintenance-requests/{id}/decline/`. Owning rental (or admin) rejects THIS mechanic's quote only; the job reopens to the pool (back to "pending"), the mechanic's quote is cleared, and the vehicle status is deliberately left unchanged. Notifies admins and the declined mechanic; logs the action.
- `request_info` — POST `/api/maintenance-requests/{id}/request-info/`. Owning rental (or admin) asks the mechanic for more info about a quoted job; moves it to "info_requested" and notifies the mechanic; logs the action.
- `provide_info` — POST `/api/maintenance-requests/{id}/provide-info/`. The assigned mechanic supplies the requested documents/details; the job returns to "quoted" for review. Notifies the rental and admins.
- `cancel` — POST `/api/maintenance-requests/{id}/cancel/`. The assigned mechanic withdraws their quote (must be "quoted"), OR the owning rental cancels the request while it is still "pending" (once quoted they must decline instead). Cancelling by the rental frees the vehicle back to available. Notifies the relevant parties and admins.
- `destroy` — DELETE `/api/maintenance-requests/{id}/`. Deletes a request: an admin can delete any; the job's mechanic only a declined/cancelled/completed one; the owning rental only a cancelled or completed one (a pending one must be cancelled first). Writes a deletion audit first.
- `complete` — POST `/api/maintenance-requests/{id}/complete/`. Marks an active job done. If the mechanic marks it, the job/vehicle move to "pending_return" and the rental is asked to confirm. If the owning rental marks it, it goes straight to "completed" and the vehicle to "available". Notifies the right parties; the owner path logs `maintenance.completed`.
- `confirm_return` — POST `/api/maintenance-requests/{id}/confirm-return/`. Owning rental confirms the vehicle came back after the mechanic finished → job "completed" and vehicle "available". Notifies admins and the mechanic; logs the action.
- `sync_reminders` — POST `/api/maintenance-requests/sync-reminders/` (collection action, no id). Mechanic-only: lazily creates any overdue-maintenance reminders for the signed-in mechanic. Safe to call on every app open (deduped per day).

#### `BrowseRentalViewSet`
Driver-facing "Browse rentals" catalogue: read-only. Permissions: authenticated + `IsDriver`.
- `get_queryset()` — active rental owners (not suspended) that have at least one available vehicle, annotated with `available_count` and ordered by it.
- (inherited) `list` GET `/api/browse/rentals/`, `retrieve` GET `/api/browse/rentals/{id}/`.
- `vehicles` — GET `/api/browse/rentals/{id}/vehicles/`. Returns the available vehicles for one rental owner.

#### `ActivityLogViewSet`
The "who did what" audit trail. Read-only. Permissions: authenticated.
- `get_queryset()` — admin sees all activity; a rental OWNER sees every action in their account (own + all their staff); rental staff and everyone else see none.
- (inherited) `list` GET `/api/activity/`, `retrieve` GET `/api/activity/{id}/`.

#### `DriverReminderSyncView` (APIView)
Called by the driver app on open. Permissions: authenticated + `IsDriver`.
- `post(request)` — POST `/api/driver/reminders/sync/`. Lazily creates any due vehicle reminders (oil change / rego expiry) for the driver, plus any "rental period ended" return prompts for vehicles they still hold; returns the count created.

#### `RentalReminderSyncView` (APIView)
Called by the rental app on open. Permissions: authenticated + `IsRental` (staff act for their owner).
- `post(request)` — POST `/api/rental/reminders/sync/`. Lazily creates any due fleet reminders (oil change / rego expiry) for the owner, plus any "confirm return" nudges; returns the count created.

#### `DashboardStatsView` (APIView)
Aggregated counts for the admin dashboard cards. Admin-only.
- `get(request)` — GET `/api/admin/dashboard-stats/`. Returns totals (drivers, rental owners, rental staff, mechanics, vehicles, pending registrations, pending staff requests, unread notifications), vehicles-by-status, requests-by-status, a gap-filled last-6-months booking trend, and the top 5 rentals by fleet size.

#### `AutomaticBehaviorsView` (APIView)
The catalogue of every AUTOMATIC state transition the backend makes on its own. Read-only, authenticated.
- `get(request)` — GET `/api/system/automatic-behaviors/`. Returns the count and the list from `operations.automatic_behaviors.AUTOMATIC_BEHAVIORS`, so engineers/admins can see when and why a status flips without a direct click.

#### `SiteBrandingView` (APIView)
The single app-wide branding record (theme, colours, logo).
- `get_permissions()` — GET is open to everyone (`AllowAny`) so every app loads the same look; PUT/PATCH is admin-only.
- `get(request)` — GET `/api/system/branding/`. Loads and returns the branding record.
- `put(request)` — PUT `/api/system/branding/`. Delegates to `_update` (admin only).
- `patch(request)` — PATCH `/api/system/branding/`. Delegates to `_update` (admin only).
- `_update(request)` — validates and saves partial branding changes, returning the updated record.

**Reminder helper functions** (module-level, used by the sync views and background tasks)

- Constants: `OIL_CHANGE_INTERVAL_DAYS` (180), `REMINDER_WINDOW_DAYS` (7), `REMINDER_LOCK_NS` (advisory-lock namespace).
- `_reminder_lock(recipient_id)` — a context manager taking a per-recipient Postgres advisory lock so two concurrent syncs can't create duplicate reminders.
- `_maybe_remind(recipient, vehicle, ntype, label, due_date, today, link)` — creates a reminder when the due date is within the active window (7 days before to 7 days after), deduped once per day via `VehicleReminderLog`. Returns 1 if created.
- `generate_driver_vehicle_reminders(driver)` — creates oil/rego reminders for every vehicle the driver currently rents.
- `generate_rental_vehicle_reminders(owner)` — creates oil/rego reminders for every vehicle in the owner's fleet.
- `_due_return_bookings(today)` — ended bookings whose vehicle is still out.
- `_transition_to_pending_return(vehicle)` — one-time flip rented → pending_return (idempotent).
- `_mark_period_ended(booking)` — moves a running booking whose period ended into the "period_ended" return state (idempotent; skips an in-flight early-return handshake).
- `_maybe_return_nudge(recipient, vehicle, end_date, today, link, is_owner)` — daily "rental period ended" nudge, deduped per day; wording differs for owner vs driver.
- `process_owner_due_returns(owner)` / `process_driver_due_returns(driver)` — flag the owner's/driver's ended rentals as pending_return and send today's nudge.
- `_maintenance_deadline(mr)` — the agreed completion time for an accepted job (decided_at + estimate).
- `generate_maintenance_overdue_reminders(mechanic)` — for each accepted job past its agreed time and not yet done, sends a daily "please complete the work" reminder (deduped per day).

---

### `operations/urls.py`

This file wires URLs to the views. It uses a DRF `DefaultRouter` for the ViewSets (which auto-generates list/detail routes plus the custom `@action` routes) and a list of plain `path(...)` entries for the standalone APIViews. The final `urlpatterns` is `router.urls + [ ...paths... ]`.

**Router registrations** (each prefix is under the app's `/api/` mount):

| Prefix | ViewSet | Purpose |
|---|---|---|
| `admin/drivers` | `DriverViewSet` | admin CRUD over drivers |
| `admin/rentals` | `RentalViewSet` | admin CRUD over rental owners |
| `admin/mechanics` | `MechanicViewSet` | admin CRUD over mechanics |
| `admin/vehicles` | `AdminVehicleViewSet` | admin CRUD over all vehicles |
| `admin/rental-staff` | `AdminRentalStaffViewSet` | admin CRUD over all rental staff |
| `fleet` | `FleetViewSet` | a rental owner's own vehicles |
| `rental-staff` | `RentalStaffViewSet` | a rental owner's own staff |
| `rental-requests` | `RentalRequestViewSet` | booking requests + approve/reject/return/info actions |
| `maintenance-requests` | `MaintenanceRequestViewSet` | maintenance jobs + quote/accept/decline/complete actions |
| `browse/rentals` | `BrowseRentalViewSet` | driver-facing catalogue + `/vehicles` action |
| `activity` | `ActivityLogViewSet` | audit-trail read |

The router gives each of these a list route (`.../`) and, where applicable, detail routes (`.../{id}/`) plus one route per `@action` (e.g. `rental-requests/{id}/approve/`, `maintenance-requests/sync-reminders/`, `browse/rentals/{id}/vehicles/`).

**Explicit `path(...)` routes** (standalone APIViews and other endpoints):

- `admin/dashboard-stats/` → `DashboardStatsView` — admin dashboard aggregates.
- `driver/reminders/sync/` → `DriverReminderSyncView` — driver on-open reminder sync.
- `rental/reminders/sync/` → `RentalReminderSyncView` — rental on-open reminder sync.
- `ocr/extract/` → `IdDocumentOcrView` (imported from `operations/ocr.py`) — ID-document OCR extraction.
- `driver/location/report/` → `DriverLocationReportView` (from `operations/tracking.py`) — driver reports their GPS location.
- `driver/location/unavailable/` → `DriverLocationUnavailableView` (from tracking) — driver reports GPS unavailable.
- `tracking/locations/` → `TrackedVehicleLocationsView` (from tracking) — the tracked vehicle locations feed.
- `system/automatic-behaviors/` → `AutomaticBehaviorsView` — catalogue of automatic behaviours.
- `system/branding/` → `SiteBrandingView` — global branding (GET open, PUT/PATCH admin).

(The OCR and tracking views live in `operations/ocr.py` and `operations/tracking.py` respectively and are only routed — not defined — in this file.)


---

# Backend — Operations: Services, Tasks, Realtime Tracking & Background Jobs

This document explains the "operations" app's helper code: business logic, scheduled jobs, live GPS tracking (both over HTTP and WebSockets), document scanning (OCR), and the catalogue of things the system does on its own. Each section covers one file, in plain words.

---

### `operations/services.py`

Small helper module that holds business logic shared by other parts of the app. Right now it just has one function used when a new user's registration is approved.

- **`create_profile_for_registration(user, registration)`** — When an admin approves someone's sign-up, this creates the correct "profile" record for that person's role, copying over the details they typed at sign-up. Inputs are the newly-approved `user` and their `registration` (which carries the extra sign-up fields). What it does by role:
  - **driver** → creates/updates a `DriverProfile` with their license number.
  - **rental** → creates/updates a `RentalProfile` with rental type, company name, and ABN — but **only if** the user is a real rental owner. Rental *staff* (they have `allowed_nav_paths` set) are skipped and get no profile.
  - **mechanic** → creates/updates a `MechanicProfile` with shop name, shop address, and ABN.

  It is "idempotent" (safe to run more than once — it updates instead of duplicating) because it uses `update_or_create`. It returns nothing; the effect is the created/updated profile row. It is called from the authentication approval flow using a lazy import there to avoid a circular import.

---

### `operations/tasks.py`

Defines the app's Celery background jobs — code that runs on a schedule (not triggered by a user click). These jobs generate reminders, flag ended rentals, and watch GPS. Two are the actual scheduled tasks; the rest are internal helpers.

- **`_alert_admins_task_failed(task_name, detail)`** — Helper that notifies every admin that a scheduled job crashed, so a silent failure (like the 7 AM sweep) doesn't go unnoticed. Inputs are the failing task's name and a short reason. It sends a "system" notification linking to the admin dashboard. It is "best-effort": it swallows its own errors so that a problem *while alerting* can never hide the original error.

- **`_count_unflagged_ended_rentals()`** — Helper that counts how many bookings are still `RUNNING`, are past their `end_date`, and were never moved into a return state. After a healthy daily sweep this should be `0`; any non-zero number means some ended rentals were missed and a human should look. Returns that count as an integer.

- **`generate_vehicle_reminders()`** *(scheduled task, daily ~07:00 UTC)* — The main daily sweep. For every rental owner it creates any due oil-change / rego-expiry reminders and processes owner "due return" nudges; for every driver it creates their vehicle reminders and processes driver due-return nudges; for every mechanic it nudges overdue accepted jobs. It reuses the same per-day de-duplicated generator functions from `views.py` that the "on app open" endpoints use, so reminders recur daily even for users who never open the app. It also flags ended rentals as pending return. Safety features: if the sweep raises an error, it alerts all admins and re-raises so Celery records the failure; after a successful run it double-checks via `_count_unflagged_ended_rentals()` and alerts admins if any ended rentals slipped through. Returns the number of new notifications created.

- **`monitor_active_trip_locations()`** *(scheduled task, every ~5 min)* — The GPS watchdog job. It calls `check_active_trip_locations()` in `tracking.py`, which issues "location off" warnings (and suspends drivers on the third strike) for active trips whose vehicle has stopped reporting its position. If it crashes it alerts admins and re-raises. Returns the number of warnings issued this run.

---

### `operations/tracking.py`

Handles GPS tracking for active rentals over plain HTTP: drivers post their position, the system detects when a car has gone quiet and warns/suspends the driver, and owners/admins read the live positions. The key idea: "location off" is detected on the **server** by the *absence* of recent reports — it never trusts the browser to honestly announce it stopped.

**Tuning constants (named so they're easy to change):**
- `STALE_THRESHOLD_MINUTES = 15` — how long a vehicle may go silent before its location counts as "off"; also the grace period after a trip starts before reports are expected.
- `WARNING_GAP_MINUTES = 60` — minimum time between two warnings for the same trip, so one long or flickering outage can't burn all three strikes quickly (suspension now takes ~2 hours of repeated location-off).
- `MAX_STRIKES = 3` — number of warnings before the account is suspended.
- `TRACKING_LOCK_NS = 4243` — an ID for the per-driver database lock (kept separate from the reminder system's lock).

**Functions and classes:**

- **`_active_trips()`** — Returns the set of bookings that are truly "out with the driver right now": status `RUNNING`, the vehicle is `RENTED` or `PENDING_RETURN`, and the booked window has not ended (`end_date` today or later, or open-ended/null). The end-date check matters: without it the server would keep expecting GPS after the driver app already stopped reporting, and would wrongly issue strikes.

- **`_tracking_lock(driver_id)`** *(context manager)* — Wraps a block of code in a per-driver Postgres advisory lock inside a transaction, so two overlapping runs of the watchdog can't race and double-count a driver's strikes.

- **`_vlabel(vehicle)`** — Small helper that builds a human-readable label like `"Toyota Corolla (ABC123)"` from a vehicle's make, model, and rego.

- **`_issue_location_warning(trip, now, gap_before)`** — Issues one "location off" warning for a trip, but only if none was already issued within the gap window. Under the per-driver lock it re-reads the driver's state (in case another run just warned/suspended), then: creates a `LocationWarning` record, bumps `location_warning_count`, and notifies both the driver and the rental owner. On the **third** strike it also sets `is_suspended = True` with a reason, notifies the driver, the owner, and all admins, and locks the driver to their profile page (note: `is_active` stays true so they can still log in to read why). Returns `1` if a warning was issued, else `0`.

- **`check_active_trip_locations()`** — The core watchdog logic (called by the Celery task). For each active trip it skips already-suspended drivers, skips trips too new to expect reports yet (still inside the grace period), and skips trips whose latest stored position is still fresh. For the rest it calls `_issue_location_warning`. Safe to run repeatedly because the gap window de-duplicates. Returns the total warnings issued this run.

- **`_coerce_coord(value)`** — Helper that turns an incoming latitude/longitude/accuracy into a float, returning `None` if it isn't a valid number.

- **`DriverLocationReportView` (APIView, POST)** — The endpoint a driver's browser calls (~every 45s) to report `{latitude, longitude, accuracy?}`. It rejects non-drivers (403), validates the coordinates are present and in range (400 otherwise), finds the driver's active trip, and stores/updates the vehicle's latest `VehicleLocation`. If there's no active trip, nothing is stored and it returns `{tracking: false}`. On success it returns `{tracking: true, warnings: <current strike count>}`.

- **`DriverLocationUnavailableView` (APIView, POST)** — Called when the browser reports that location was denied or is unavailable. It lets the frontend confirm the "off" state and read the current strike count and `max_strikes` for its warning banner. Importantly it does **not** issue a strike itself — strikes only come from the server-side staleness check — so a brief permission prompt won't cost the driver a strike. Rejects non-drivers (403).

- **`TrackedVehicleLocationsView` (APIView, GET)** — Feeds the live map. Returns the latest position of each vehicle on a running trip. Access is role-scoped: admins/superusers see everything; a rental owner (or their staff who have the `/map` module granted) sees only their own fleet; drivers and everyone else get 403. Each result row includes vehicle id, label, rego, driver name, coordinates, accuracy, the recorded timestamp, and a `stale` flag (true if the last report is older than `STALE_THRESHOLD_MINUTES`).

---

### `operations/consumers.py`

The **WebSocket** version of live GPS tracking — a faster, real-time upgrade over the HTTP polling in `tracking.py`. One consumer serves both the driver (who pushes positions) and viewers (owners/admins who watch), on the URL `ws/track/<vehicle_id>/`. It writes and reads the same `VehicleLocation` rows as the HTTP path, so the warning/suspension watchdog keeps working unchanged.

- `WS_DB_SAVE_INTERVAL_SECONDS = 30` — every position frame is broadcast live, but a position is only *saved to the database* at most this often, keeping DB load similar to the old ~45s HTTP reports while staying well inside the watchdog's staleness window.
- `CLOSE_UNAUTHENTICATED = 4401` and `CLOSE_FORBIDDEN = 4403` — custom WebSocket close codes for "not logged in" and "not allowed".

**Class `VehicleTrackingConsumer` (an async WebSocket consumer) and its methods:**

- **`connect()`** — Runs when a socket opens. Reads the logged-in user and the `vehicle_id` from the URL (closes as forbidden if the id is bad). Closes as unauthenticated if there's no logged-in user. Calls `_authorize()` to decide the connection's mode (`driver`, `viewer`, or `None`); if not allowed, closes as forbidden. Otherwise it joins the per-vehicle broadcast group `vehicle_<id>` and accepts the connection. If the connection is a **viewer**, it immediately sends the last known position so the map isn't blank until the next driver push.

- **`disconnect(code)`** — Runs when the socket closes; removes this connection from its broadcast group.

- **`receive_json(content, **kwargs)`** — Handles an incoming frame. Anything sent by a viewer is ignored (only drivers push). For a driver it validates the coordinates (silently drops invalid ones), and on the throttled save cadence writes the position to the DB via `_save_position`. If saving finds the trip has ended, it sends an `{type: 'inactive'}` frame and stops. Either way, it broadcasts the position to everyone watching that vehicle via the group.

- **`position_broadcast(event)`** — The group-message handler. When the group broadcasts a position, this sends it to this particular socket as a `{type: 'position', ...}` frame.

- **`_authorize()`** *(runs sync DB work off the event loop)* — Decides what this user may do. A **driver** gets `'driver'` only for a vehicle that is their own active trip. An admin/superuser gets `'viewer'` for any vehicle. A **rental** user gets `'viewer'` only if they have the `/map` section and the vehicle belongs to their owner account. Everyone else gets `None` (not allowed). Mirrors the HTTP authorization rules.

- **`_save_position(lat, lng, accuracy)`** *(sync DB work)* — Stores the position as the vehicle's latest `VehicleLocation`, but only if the driver's trip is still active. Returns the ISO timestamp it wrote, or `None` when there's no active trip (signalling the caller to end tracking).

- **`_last_location()`** *(sync DB work)* — Returns the latest stored position for this vehicle on a running trip (as a small dict), or `None` if there isn't one. Used to seed a viewer's map on connect.

---

### `operations/routing.py`

Tiny file that maps WebSocket URLs to their consumer (the WebSocket equivalent of `urls.py`).

- **`websocket_urlpatterns`** — A list with one route: any URL matching `ws/track/<vehicle_id>/` (digits only) is handled by `VehicleTrackingConsumer`. The ASGI server uses this list to route incoming WebSocket connections.

---

### `operations/ocr.py`

Scans photos of identity documents using Google's Gemini vision model. During registration a user uploads a photo/scan of a passport, driving licence, or CNIC (national ID); this code asks Gemini to say what kind of document it is and read the holder's details, returning a small JSON object the user then reviews and confirms. The Gemini API key stays on the server so it is never exposed to the browser. It calls the REST API with Python's built-in `urllib` to avoid adding an SDK dependency.

**Module-level pieces:**
- `GEMINI_URL` — the Gemini REST endpoint template (model and key filled in per call).
- `_PROMPT` — the detailed instruction sent to Gemini. It demands a JSON-only reply with a fixed set of keys (`doc_type`, `looks_like_id`, `full_name`, `date_of_birth`, `document_number`, `expiry_date`, `nationality`), ISO date formatting, and blanks instead of guesses — a tight contract so the result drops straight into the review form.
- `_ALLOWED_DOC_TYPES` — the valid document types (`passport`, `licence`, `cnic`, `unknown`).

**Functions and classes:**

- **`OcrError` (Exception)** — Custom error raised when calling Gemini or parsing its reply fails.

- **`_call_gemini(image_bytes, mime_type)`** — Does the actual Gemini API call. It builds the request (the prompt plus the base64-encoded image), forcing a JSON response and temperature 0 for deterministic reads. It **retries** on transient failures: HTTP 500/503 (overloaded) and network errors are retried up to 4 attempts with a short growing backoff; HTTP 429 (rate limit) is *not* retried (its retry window is long, so it fails fast so the caller can say "try again shortly"). It then digs the model's text out of the response (raising `OcrError` if the content is missing — often a safety block) and parses that text as JSON (raising `OcrError` if it isn't valid JSON). Returns the parsed dict.

- **`_normalise(raw)`** — Cleans Gemini's raw dict into the app's fixed, frontend-friendly shape. It trims strings, lowercases and validates `doc_type` (mapping common synonyms like `license`→`licence` or `national_id`→`cnic`, falling back to `unknown`), and returns exactly the seven expected keys with safe defaults.

- **`IdDocumentOcrView` (APIView, POST)** — The public endpoint. It is open to **unauthenticated** callers because documents are uploaded during public registration, before any account exists. It accepts either a multipart file field named `document` (preferred) or a JSON body `{"image": "<data-url-or-base64>", "mime_type": ...}`. It enforces a 12 MB size cap and an allowed-types list (`image/jpeg`, `png`, `webp`, `heic`, `heif`, `application/pdf`), returning 400 for missing/too-large/unsupported files. On success it returns the normalised result (200); if Gemini fails it returns 502 (the upstream provider's fault, not the caller's).
  - **`post(request)`** — the request handler described above.
  - **`_read_upload(request)`** — helper that pulls the raw bytes and MIME type out of the request, handling both a multipart file and a JSON `data:` URL / base64 string. Returns `(bytes, mime_type)`, or `(None, None)` if nothing usable was sent.

---

### `operations/automatic_behaviors.py`

A single, machine-readable list documenting **every automatic state change** the backend makes on its own — i.e. changes to a booking, vehicle, maintenance job, or account that happen *without* the affected user clicking that record. It is the one source of truth behind the `GET /api/system/automatic-behaviors/` endpoint and the human-readable doc `backend/docs/automatic-state-transitions.md`. Developers must keep it in sync whenever they add or change an automatic transition.

- **`AUTOMATIC_BEHAVIORS`** — A list of dictionaries, one per automatic behavior. Each entry records: a stable `id` slug, the `trigger` (`time` for a scheduled job, `event` for a side-effect of another action), the `schedule` (cron cadence for time-based ones), the `actor` (what causes it), what it `affects`, the `change` (from → to), the `why` (business reason), who it `notifies`, and `where` in the code it lives. The documented behaviors include:
  - **`booking.period_ended`** — when a rental's end date passes, the booking is flagged (`return_state` → `period_ended`) so the driver is prompted to complete the trip; the booking stays `running` and does not auto-complete.
  - **`vehicle.pending_return`** — mirrors the above: the car goes `rented` → `pending_return` when the window closes, until the owner confirms handover.
  - **`driver.gps_suspension`** — the GPS strike system: stale location warns the driver, and the third strike (≥60 min apart) auto-suspends the account; only an admin can reverse it.
  - **`booking.auto_rejected`** — approving one booking auto-rejects the other pending requests for the same vehicle, preventing double-booking.
  - **`vehicle.rented_on_approval`** — an approved car goes `available` → `rented`.
  - **`vehicle.released_on_return`** — confirming the return frees the car (`→ available`) and completes the booking.
  - **`maintenance.auto_declined`** — accepting one mechanic's quote auto-declines the competing quotes for that vehicle.
  - **`vehicle.maintenance_chain`** — the maintenance lifecycle: `available` → `maintenance` (accept) → `pending_return` (mechanic done) → `available` (owner confirms).
  - **`reminder.daily_nudges`** — the daily de-duplicated oil-change / rego / return / maintenance-overdue reminders (notifications only, no record change).
  - **`auth.token_rotation`** — on refresh/logout the old refresh token is blacklisted so it can't be replayed.
  - **`deletion.cascade_audit`** — deleting an owner/vehicle/booking cascades to related rows, and a durable `DeletionAudit` snapshot is written first for recovery/investigation.

---

### `operations/apps.py`

Standard Django app-configuration file — tells Django this app exists and how to name it.

- **`OperationsConfig` (AppConfig)** — The app's config. Sets `default_auto_field` to `BigAutoField` (so new models get big integer primary keys by default), names the app `operations`, and gives it the human-friendly `verbose_name` "Operations" shown in the Django admin.


---

# Frontend — Services (API layer)

This is the "API layer" of the Wheels of Australia web app. Each file here is a small helper module that talks to the Django backend, sending HTTP requests and turning the backend's `snake_case` JSON into friendly `camelCase` objects the React pages can use.

**How requests are sent (shared client):** Every service imports `apiClient` from `src/lib/api/client.ts`. This is a pre-configured `axios` instance. Key things it does for you:
- Base URL is `http://54.206.231.112:8000/api` (or the `VITE_API_BASE_URL` env var). So a call to `/fleet/` really hits `.../api/fleet/`.
- `withCredentials: true` — the browser automatically attaches the login session, which lives in HttpOnly cookies. There is no token to pass by hand.
- On a `401` (expired session), it silently calls the refresh endpoint and retries the request once; if that fails it logs the user out.
- It shows a global error "toast" pop-up for most failures. A request can opt out by passing `suppressErrorToast: true`.

**Common helper you will see everywhere:** `unwrapList(data)` — the backend sometimes returns a plain array and sometimes a paginated object like `{ results: [...] }`. This helper returns the array in either case.

---

## `services/activity/`

### `services/activity/api.ts`
Talks to the audit-trail API (`/activity/`) — a log of "who did what" inside a rental owner's account.
- **`listActivity()`** — Fetches the activity log the current user is allowed to see (a rental owner sees their own account plus their staff; an admin sees everything across all rentals). Calls `GET /activity/`. Returns an array of `ActivityEntry`.
- **type `ActivityEntry`** — One audit entry: `id`, `action` (machine code like `request.approved`), `summary` (human sentence), `link` (in-app deep link), `byStaff` (true if a staff sub-account did it), `actorId`, `actorName`, `rentalId`/`rentalName` (only filled in the admin cross-rental view), and `createdAt`.

---

## `services/adminRentalStaff/`

### `services/adminRentalStaff/api.ts`
Admin-only management of rental staff across every rental (`/admin/rental-staff/`). Exposes the `adminRentalStaffApi` object:
- **`adminRentalStaffApi.list()`** — Lists every rental's staff. `GET /admin/rental-staff/`. Returns `AdminRentalStaff[]`.
- **`adminRentalStaffApi.get(id)`** — Fetches one staff member by id. `GET /admin/rental-staff/{id}/`. Returns `AdminRentalStaff`.
- **`adminRentalStaffApi.create(input)`** — Creates a staff member assigned to a rental (admin types the password). `POST /admin/rental-staff/`. Returns the created `AdminRentalStaff`.
- **`adminRentalStaffApi.update(id, input)`** — Edits an existing staff member (partial fields). `PATCH /admin/rental-staff/{id}/`. Returns the updated `AdminRentalStaff`.
- **`adminRentalStaffApi.remove(id)`** — Permanently deletes a staff member. `DELETE /admin/rental-staff/{id}/`. Returns nothing.

### `services/adminRentalStaff/types.ts`
- **type `AdminRentalStaffStatus`** — `'active' | 'inactive'`.
- **type `AdminRentalStaff`** — A staff account as the admin sees it: `id`, `fullName`, `email`, `phone`, `status`, `suspensionReason`, `allowedNavPaths` (pages they may open), `rentalId`/`rentalName` (owning rental), and `documents` (files uploaded at registration).
- **type `AdminRentalStaffInput`** — The fields the admin can set when creating/editing: `fullName`, `email`, optional `phone`, `status`, `suspensionReason`, `allowedNavPaths`, `rentalId` (required on create), and `password` (required on create; leave out on edit to keep the current one).

---

## `services/auth/`

### `services/auth/api.ts`
Login/session API (`/auth/...`). Tokens are delivered as HttpOnly cookies, never in the response body.
- **`getLoginErrorMessage(err)`** — Helper that digs a single readable error message out of a backend 400 error object. Returns a string.
- **`authApi.me()`** — Re-fetches the current logged-in user from the server (the source of truth, e.g. to detect a suspension applied after login). `GET /auth/me/`. Returns a normalized `User`.
- **`authApi.login(data)`** — Logs in with email + password; the backend sets the session cookies and returns the user. `POST /auth/login/`. Returns `LoginResponse` (`{ user }`). Throws a friendly `Error` on bad credentials.
- **`authApi.register(_data)`** — Intentionally NOT used. Sign-up goes through the approval-based `registrations` service instead, so this just throws an explanatory error.
- **`authApi.refreshToken()`** — Refreshes the session; the refresh cookie is sent automatically and the backend rotates the access cookie. `POST /auth/jwt/refresh/`. Returns `RefreshTokenResponse` (`{ detail }`).
- **`authApi.logout()`** — Ends the session. `POST /auth/logout/`. Returns nothing.
- **`authApi.verifyEmail(token)`** — Confirms an email address using a token. `POST /auth/verify-email/`. Returns nothing.
- **`authApi.forgotPassword(email)`** — Starts a password reset (emails a link). `POST /auth/forgot-password/`. Returns nothing.
- **`authApi.resetPassword(token, password)`** — Sets a new password using the reset token. `POST /auth/reset-password/`. Returns nothing.
- **`authApi.changePassword(currentPassword, newPassword)`** — Changes the password while logged in. `POST /auth/change-password/`. Returns nothing.

### `services/auth/types.ts`
- **`LoginRequest`** — `{ email, password }`.
- **`LoginResponse`** — `{ user }` (no tokens; they are cookies).
- **`RegisterRequest`** — Sign-up fields (first/last name, email, phone, password, confirmPassword).
- **`RegisterResponse`** — `{ user }`.
- **`RefreshTokenRequest`** — An empty object type (refresh needs no body).
- **`RefreshTokenResponse`** — `{ detail }` acknowledgement.
- **`User`** — The logged-in user: `id`, `email`, `first_name`, `last_name`, `full_name`, `role`, `role_display`, `date_joined`, `is_active`, optional `is_suspended`, `suspension_reason`, `phone_number`, and `allowed_nav_paths` (limits which sidebar pages a rental staff member sees).
- **`AuthState`** — UI auth state: `user`, `isAuthenticated`, `isLoading`, `error`.
- **`ApiError`** — `{ message, statusCode, errors? }`.
- **`ApiResponse<T>`** — Generic wrapper `{ data, message, success }`.

---

## `services/branding/`

### `services/branding/index.ts`
App-wide look-and-feel (`/system/branding/`), a single global record: anyone can read it; only an admin can change it, and the change applies to everyone.
- **`getBranding()`** — Reads the global branding (works even when not logged in). `GET /system/branding/`. Returns `BrandingPayload`.
- **`updateBranding(b)`** — Saves a branding change (admin only, enforced by the backend). `PATCH /system/branding/`. Returns the updated `BrandingPayload`.
- **type `ThemeModeValue`** — `'light' | 'dark'`.
- **type `BrandingPayload`** — `{ mode, primaryColor, secondaryColor, logoUrl }`.

---

## `services/dashboard/`

### `services/dashboard/api.ts`
Admin dashboard summary numbers (`/admin/dashboard-stats/`).
- **`dashboardApi.stats()`** — Fetches all the aggregated counts for the admin dashboard (totals of drivers/rentals/mechanics/vehicles, pending registrations, unread notifications, vehicles grouped by status, requests grouped by status, a monthly trend, and top rentals). `GET /admin/dashboard-stats/`. Returns `DashboardStats`.
- **type `DashboardStats`** — The full shape of those dashboard numbers (see above).

---

## `services/drivers/`

### `services/drivers/api.ts`
Admin CRUD over driver accounts (`/admin/drivers/`). Exposes `driversApi`:
- **`driversApi.list()`** — Lists all drivers. `GET /admin/drivers/`. Returns `Driver[]`.
- **`driversApi.get(id)`** — One driver by id. `GET /admin/drivers/{id}/`. Returns `Driver`.
- **`driversApi.create(input)`** — Creates a driver account (admin sets the password). `POST /admin/drivers/`. Returns `Driver`.
- **`driversApi.update(id, input)`** — Edits a driver. `PATCH /admin/drivers/{id}/`. Returns `Driver`.
- **`driversApi.remove(id)`** — Deletes a driver. `DELETE /admin/drivers/{id}/`. Returns nothing.
- **type `DriverInput`** — Editable fields: `fullName`, `email`, optional `phone`, `licenseNumber`, `status`, `suspensionReason`, `password`.

### `services/drivers/types.ts`
- **type `DriverStatus`** — `'active' | 'inactive'`.
- **type `Driver`** — A driver: `id`, `fullName`, `email`, `phone`, optional `licenseNumber`, `status`, `suspensionReason`, and `documents` (registration uploads).

---

## `services/maintenance/`

### `services/maintenance/index.ts`
Maintenance jobs API (`/maintenance-requests/`): a rental flags a vehicle for repair, a mechanic quotes, and the rental accepts or declines.
- **`maintenanceAvailable()`** — Returns `true` (the feature is always on now; kept for callers that used to check).
- **`listMaintenanceRequests()`** — Lists the maintenance jobs the current user may see (the backend scopes by role). `GET /maintenance-requests/`. Returns `MaintenanceRequest[]`.
- **`createMaintenanceRequest(vehicleId, workDescription)`** — Rental flags a vehicle and describes the work needed. `POST /maintenance-requests/`. Returns the new `MaintenanceRequest`.
- **`submitQuote(id, payload)`** — Mechanic submits a quote (price, estimated duration, notes, and ID docs). `POST /maintenance-requests/{id}/quote/`. Returns the updated `MaintenanceRequest`.
- **`requestMaintenanceInfo(id, message)`** — Rental asks the mechanic for more information about the quote. `POST /maintenance-requests/{id}/request-info/`. Returns the updated request.
- **`provideMaintenanceInfo(id, idDocuments, verifiedDetails)`** — Mechanic supplies the requested documents/details; the job goes back to `quoted`. `POST /maintenance-requests/{id}/provide-info/`. Returns the updated request.
- **`acceptQuote(id)`** — Rental accepts the quote; the vehicle moves into maintenance. `POST /maintenance-requests/{id}/accept/`. Returns the updated request.
- **`declineQuote(id, reason='')`** — Rental declines the quote with an optional reason. `POST /maintenance-requests/{id}/decline/`. Returns the updated request.
- **`completeMaintenance(id)`** — Marks an accepted job done; the vehicle returns to available. `POST /maintenance-requests/{id}/complete/`. Returns the updated request.
- **`confirmMaintenanceReturn(id)`** — Owning rental confirms the vehicle is back after the mechanic finished. `POST /maintenance-requests/{id}/confirm-return/`. Returns the updated request.
- **`cancelQuote(id)`** — Mechanic withdraws their quote (only while the rental hasn't decided). `POST /maintenance-requests/{id}/cancel/`. Returns the updated request.
- **`cancelMaintenanceRequest(id)`** — Owning rental cancels a request before it is accepted. `POST /maintenance-requests/{id}/cancel/` (same endpoint as above). Returns the updated request.
- **`deleteMaintenanceRequest(id)`** — Permanently deletes a request (only declined/cancelled ones). `DELETE /maintenance-requests/{id}/`. Returns nothing.
- Re-exports the types `MaintenanceRequest`, `MaintenanceStatus`, `QuotePayload`, `DurationUnit`.

### `services/maintenance/types.ts`
- **type `MaintenanceStatus`** — The job's lifecycle: `pending | quoted | running | accepted | declined | cancelled | pending_return | completed | info_requested`.
- **type `DurationUnit`** — `'hours' | 'days'`.
- **type `MaintenanceRequest`** — A maintenance job: vehicle details, owning rental (`rentalId`/`rentalName`), mechanic details, `workDescription`, `status`/`statusDisplay`, quote fields (`quotedPrice`, `estimatedValue`, `estimatedUnit`, `mechanicNotes`), `decisionReason`, attached `idDocuments` + `verifiedDetails`, `infoRequestMessage`, and various timestamps.
- **type `QuotePayload`** — What a mechanic sends when quoting: `quotedPrice`, `estimatedValue`, `estimatedUnit`, optional `mechanicNotes`, `idDocuments`, `verifiedDetails`.

---

## `services/mechanics/`

### `services/mechanics/api.ts`
Admin CRUD over mechanic accounts (`/admin/mechanics/`). Exposes `mechanicsApi`:
- **`mechanicsApi.list()`** — Lists all mechanics. `GET /admin/mechanics/`. Returns `Mechanic[]`.
- **`mechanicsApi.get(id)`** — One mechanic by id. `GET /admin/mechanics/{id}/`. Returns `Mechanic`.
- **`mechanicsApi.create(input)`** — Creates a mechanic (admin sets the password). `POST /admin/mechanics/`. Returns `Mechanic`.
- **`mechanicsApi.update(id, input)`** — Edits a mechanic. `PATCH /admin/mechanics/{id}/`. Returns `Mechanic`.
- **`mechanicsApi.remove(id)`** — Deletes a mechanic. `DELETE /admin/mechanics/{id}/`. Returns nothing.
- **type `MechanicInput`** — Editable fields: `fullName`, `email`, optional `phone`, `shopName`, `shopAddress`, `abn`, `status`, `suspensionReason`, `password`.

### `services/mechanics/types.ts`
- **type `MechanicStatus`** — `'active' | 'inactive'`.
- **type `Mechanic`** — A mechanic: `id`, `fullName`, `email`, `phone`, `shopName`, optional `shopAddress`, `abn`, `status`, `suspensionReason`, and `documents`.

---

## `services/notifications/`

### `services/notifications/api.ts`
In-app notifications (`/auth/notifications/`) plus per-role "sync reminders" endpoints. Exposes `notificationsApi`:
- **`notificationsApi.list()`** — Lists the current user's notifications (newest first). `GET /auth/notifications/`. Returns `Notification[]`.
- **`notificationsApi.markRead(id)`** — Marks one notification read. `POST /auth/notifications/{id}/mark-read/`. Returns nothing.
- **`notificationsApi.markAllRead()`** — Marks all read. `POST /auth/notifications/mark-all-read/`. Returns nothing.
- **`notificationsApi.remove(id)`** — Deletes one notification. `DELETE /auth/notifications/{id}/`. Returns nothing.
- **`notificationsApi.syncDriverReminders()`** — Driver-only: asks the backend to generate any due vehicle reminders (oil/rego). `POST /driver/reminders/sync/`. Errors are swallowed (non-fatal). Returns nothing.
- **`notificationsApi.syncRentalReminders()`** — Rental-only: generate any due fleet reminders. `POST /rental/reminders/sync/`. Non-fatal. Returns nothing.
- **`notificationsApi.syncMechanicReminders()`** — Mechanic-only: generate overdue-maintenance reminders. `POST /maintenance-requests/sync-reminders/`. Non-fatal. Returns nothing.

### `services/notifications/index.ts`
- Re-exports the `Notification` and `NotificationType` types for convenience.

### `services/notifications/target.ts`
Pure routing helper (no network calls). Decides where clicking a notification should take a user.
- **`resolveNotificationTarget(n, role)`** — Given a notification and the user's role, returns the in-app URL (with `highlight`, `hlAction`, and `notif` query params so the destination page can flash/scroll to the exact record and explain what happened). Routing is role-aware (e.g. a vehicle notification sends an admin to the admin vehicles list but a rental owner to their fleet). Returns `null` when there is no page for that role, so the caller falls back to the notification's plain `link`.

### `services/notifications/types.ts`
- **type `NotificationType`** — The display category (`oil`, `rego`, `payment`, `rental_decision`, `location_disabled`, `location_warning`, `suspension`, `registration`, `staff`, `vehicle_rented`, `maintenance`, `system`).
- **type `NotificationEntityType`** — What record the notification points at (`vehicle`, `driver`, `rental`, `mechanic`, `rental_staff`, `booking`, `maintenance`, `registration`, or empty).
- **type `Notification`** — A notification: `id`, `type`, `title`, optional `message`, `createdAt`, `read`, plus deep-link fields `entityType`, `entityId`, `action`, `actorName`, and a fallback `link`.

---

## `services/ocr.ts`
Identity-document OCR (`/ocr/extract/`). The backend runs Google Gemini vision to read an uploaded ID; the browser only uploads the image. If OCR fails, callers get a permissive result so manual entry still works.
- **type `IdDocType`** — `'passport' | 'licence' | 'cnic'`.
- **`ID_DOC_LABELS`** — A lookup mapping each `IdDocType` to a display label.
- **type `IdDocument`** — `{ docType, name, image }` (image is a data URL).
- **type `VerifiedDetails`** — Confirmed identity fields: `fullName`, `dateOfBirth`, `documentNumber`, `expiryDate`.
- **type `DocReadResult`** — Result of a full read: `details`, `looksLikeId`, `checked` (false if OCR couldn't run), optional `error`, `detectedType`, `nationality`.
- **`fileToDataUrl(file)`** — Reads a browser `File` into a base64 data URL (no server). Returns a `Promise<string>`.
- **`readDocument(file, _docType?, fallbackName='')`** — Uploads the image and reads full identity details; if OCR fails it returns blank details with `checked:false` so the user types them in. `POST /ocr/extract/` (60s timeout, toast suppressed). Returns `DocReadResult`.
- **`looksLikeIdDocument(file)`** — Lighter check for forms that only need yes/no: does this image look like an ID? `POST /ocr/extract/`. Returns `{ looksLikeId, checked, detectedType? }`.

---

## `services/profile/`

### `services/profile/api.ts`
The current user's own profile (`/auth/me/`). Exposes `profileApi`:
- **`profileApi.me()`** — Fetches the logged-in user's full profile, including role-specific fields and admin/owner contact info. `GET /auth/me/`. Returns `MyProfile`.
- **type `RoleProfile`** — Role-specific extras (driver `license_number`; rental `rental_type`/`company_name`/`abn`/`minimum_rental_days`; mechanic `shop_name`/`shop_address`). Only the relevant keys are present.
- **type `AdminContact`** — Contact of the admin (or the staff member's owner): `full_name`, `email`, optional `is_owner`.
- **type `MyProfile`** — The full profile: identity fields, `role`/`roleDisplay`, `isActive`, `isSuspended`, `suspensionReason`, optional `phoneNumber`/`allowedNavPaths`, `isRentalStaff` (computed), nested `profile` (`RoleProfile`), `adminContact`, and `documents`.

---

## `services/registrations/`

### `services/registrations/api.ts`
Public self-registration and the admin review workflow (`/auth/registrations/...`). No account exists until an admin approves. Exposes two objects:

`registrationApi` (public):
- **`registrationApi.submit(payload)`** — Submits a pending registration (driver/rental/mechanic) with optional document file uploads, sent as `multipart/form-data`. `POST /auth/registrations/`. Returns `RegistrationResponse`. Throws a friendly `RegistrationError` (with per-field messages) on validation failure.

`adminRegistrationApi` (admin-only):
- **`adminRegistrationApi.list(status?)`** — Lists registration requests, optionally filtered by status. `GET /auth/registrations/admin/` (with `?status=` when given). Returns `RegistrationDetail[]`.
- **`adminRegistrationApi.approve(id)`** — Approves a request: creates the account, generates a password, and emails the applicant. `POST /auth/registrations/admin/{id}/approve/`. Returns `RegistrationDetail`.
- **`adminRegistrationApi.reject(id, reason)`** — Rejects with a reason (emailed to the applicant). `POST /auth/registrations/admin/{id}/reject/`. Returns `RegistrationDetail`.
- **`adminRegistrationApi.remove(id)`** — Permanently deletes a registration request and its documents. `DELETE /auth/registrations/admin/{id}/`. Returns nothing.

Main types:
- **type `RegistrationRole`** — `'driver' | 'rental' | 'mechanic'`.
- **type `RegistrationFiles`** — Optional uploads keyed by backend field: `license`, `passport`, `cnic`, `certificate`, `shop_image`.
- **type `RegistrationPayload`** — All submit fields (role, contact, rental-specific, mechanic-specific, `extra`, and `files`).
- **type `RegistrationResponse`** — `{ id, status, detail }`.
- **type `RegistrationError`** — `{ message, fieldErrors }`.
- **type `RegistrationStatus`** — `'pending' | 'approved' | 'rejected'`.
- **type `RegistrationDocument`** — An uploaded document: `id`, `doc_type`, `doc_type_display`, `file_url`, `original_name`, `uploaded_at`. (Reused by many other services to show registration uploads.)
- **type `RegistrationDetail`** — The full request as the admin sees it (all applicant fields plus `status`, `rejection_reason`, `reviewed_at`, `documents`).

---

## `services/rental/` (rental-owner and driver booking/fleet)

### `services/rental/driverRequests.ts`
Driver-side booking requests (`/rental-requests/`): create bookings, list the driver's own requests, cancel/complete, and handle early returns.
- **`listSentRequests()`** — The driver's still-pending requests only. `GET /rental-requests/` (filtered to `pending` client-side). Returns `DriverSentRequest[]`.
- **`submitBookingRequest(input)`** — Sends a booking request for a vehicle (dates + ID docs). `POST /rental-requests/`. Returns nothing.
- **`provideBookingInfo(id, idDocuments, verifiedDetails)`** — Supplies documents the rental asked for; the request goes back to `pending`. `POST /rental-requests/{id}/provide-info/`. Returns nothing.
- **`cancelSentRequest(id)`** — Cancels a still-pending sent request. `POST /rental-requests/{id}/cancel/`. Returns `true`.
- **`canCancelSentRequests()`** — Returns `true` (UI should show the Cancel action). No network call.
- **`listMyRequests()`** — All of the driver's requests in any status, newest first. `GET /rental-requests/`. Returns `DriverRequest[]`.
- **`getOpenRequestsByVehicle()`** — Builds a map of `vehicleId → the driver's open request` (only `pending`/`info_requested`, newest per vehicle). Uses `listMyRequests()` internally. Returns `Record<string, DriverRequest>`.
- **`getMyRequest(id)`** — Finds one of the driver's requests by id (from the full list). Returns `DriverRequest | null`.
- **`listMyTrips()`** — The driver's trips = `running` + `completed` bookings. Filters `listMyRequests()`. Returns `DriverRequest[]`.
- **`cancelRequest(id)`** — Cancels a request in any status (keeps the record). `POST /rental-requests/{id}/cancel/`. Returns `true`.
- **`deleteMyRequest(id)`** — Permanently deletes one of the driver's requests. `DELETE /rental-requests/{id}/`. Returns `true`.
- **`requestReturn(id)`** — Driver asks the rental to take the car back early. `POST /rental-requests/{id}/request-return/`. Returns the updated `DriverRequest`.
- **`cancelReturn(id)`** — Withdraws an early-return request; the rental keeps running. `POST /rental-requests/{id}/cancel-return/`. Returns the updated `DriverRequest`.
- **`completeTrip(id)`** — At period end, the driver marks the trip complete (rental then confirms). `POST /rental-requests/{id}/complete-trip/`. Returns the updated `DriverRequest`.
- **`confirmReturn(id)`** — Driver confirms an early return that the RENTAL requested, ending the booking now. `POST /rental-requests/{id}/confirm-return/`. Returns the updated `DriverRequest`.
- **type `DriverSentRequest`** — A pending sent request (vehicle + rental + dates + `requestedAt`).
- **type `SubmitBookingInput`** — Fields to create a booking (vehicle/rental info, dates, `idDocuments`, `verifiedDetails`).
- **type `DriverRequestStatus`** — `pending | approved | running | rejected | cancelled | info_requested | completed`.
- **type `DriverRequest`** — A request in any status with the owner's response (`decisionReason`, `reviewedAt`, return-handshake fields, ID docs, `infoRequestMessage`).
- **type `VehicleRequestState`** — `'none' | 'pending' | 'info_requested'` (a vehicle's state from the driver's point of view).

### `services/rental/fleetApi.ts`
Low-level client for a rental owner's own fleet (`/fleet/`, scoped server-side to the logged-in rental). Exposes `fleetApi`:
- **`fleetApi.list()`** — Lists the owner's vehicles. `GET /fleet/`. Returns `Vehicle[]`.
- **`fleetApi.get(id)`** — One vehicle by id (returns `null` if not found). `GET /fleet/{id}/`. Returns `Vehicle | null`.
- **`fleetApi.add(input)`** — Adds a vehicle. `POST /fleet/`. Returns the created `Vehicle`.
- **`fleetApi.update(id, patch)`** — Edits a vehicle. `PATCH /fleet/{id}/`. Returns nothing.
- **`fleetApi.remove(id)`** — Deletes a vehicle. `DELETE /fleet/{id}/`. Returns nothing.

### `services/rental/fleet.ts`
A thin, friendly wrapper that the Fleet pages call; it just forwards to `fleetApi`.
- **`listFleet()`** — Forwards to `fleetApi.list()`. Returns `Vehicle[]`.
- **`getFleetVehicle(id)`** — Forwards to `fleetApi.get(id)`. Returns `Vehicle | null`.
- **`addFleetVehicle(input)`** — Forwards to `fleetApi.add(input)`. Returns the created `Vehicle`.
- **`updateFleetVehicle(id, patch)`** — Forwards to `fleetApi.update(id, patch)`. Returns nothing.
- **`removeFleetVehicle(id)`** — Forwards to `fleetApi.remove(id)`. Returns nothing.

### `services/rental/rentalRequests.ts`
Rental OWNER side of the same `/rental-requests/` API — the incoming bookings for the owner's fleet.
- **`listIncomingRequests()`** — Booking requests for the owner's fleet, newest first. `GET /rental-requests/`. Returns `RentalRequest[]`.
- **`countPendingRequests()`** — Counts still-pending requests (for the dashboard card). Uses `listIncomingRequests()`. Returns a number.
- **`approveRequest(id)`** — Approves a request (booking becomes running). `POST /rental-requests/{id}/approve/`. Returns the updated `RentalRequest`.
- **`rejectRequest(id, notes)`** — Rejects with an optional note. `POST /rental-requests/{id}/reject/`. Returns the updated `RentalRequest`.
- **`requestMoreInfo(id, message)`** — Asks the driver for more info; moves the request to `request_info`. `POST /rental-requests/{id}/request-info/`. Returns the updated `RentalRequest`.
- **`confirmReturn(id)`** — Confirms the driver returned the vehicle; completes the booking and frees the car. `POST /rental-requests/{id}/confirm-return/`. Returns the updated `RentalRequest`.
- **`requestReturn(id)`** — Owner asks the driver to return the car early. `POST /rental-requests/{id}/request-return/`. Returns the updated `RentalRequest`.
- **`cancelReturn(id)`** — Withdraws an early-return request. `POST /rental-requests/{id}/cancel-return/`. Returns the updated `RentalRequest`.
- **`deleteRequest(id)`** — Permanently removes a booking request (backend blocks deleting approved ones). `DELETE /rental-requests/{id}/`. Returns `true`.
- **`canDeleteRequests()`** — Returns `true` (UI should offer Delete). No network call.

### `services/rental/types.ts`
Shared rental/fleet types.
- **type `RentalType`** — `'company' | 'individual'`.
- **type `RentalRegistrationForm`** — Fields for the rental sign-up form.
- **type `InsuranceType`** — Suggested Australian cover codes (`ctp`, `third_party_property`, `third_party_fire_theft`, `comprehensive`); the stored value is a free string.
- **type `VehicleRenterInfo`** — The driver currently renting a vehicle (name, email, phone, dates).
- **type `VehicleMaintenanceInfo`** — The accepted maintenance job attached to a vehicle (mechanic, shop, work, quote).
- **type `Vehicle`** — The main vehicle model used across fleet/browse/maintenance: identity (`make`/`model`/`year`/`rego`), insurance, images, `status` (`available | rented | pending_return | maintenance`), service tracking (oil/rego dates, odometer), pricing (`rentPricePerDay`, `minimumRentalDays`), and embedded `renter`/`maintenance`.
- **type `RentalRequestStatus`** — `pending | approved | running | rejected | request_info | completed`.
- **type `ReturnState`** — The return handshake state on an active booking (`''`, `requested_by_rental`, `requested_by_driver`, `period_ended`, `driver_completed`).
- **type `RentalRequest`** — Owner-facing booking request (vehicle + driver + dates + status + return-handshake + ID docs).
- **type `RentalRequestPayload`** — `{ vehicleId, startDate, endDate }`.

### `services/rental/vehicleInfoMap.ts`
Shared mapper helpers (no network) that convert the backend's embedded renter/maintenance blobs into frontend shapes; used by both the fleet and admin-vehicles services.
- **type `ApiRenter`** / **type `ApiMaintenance`** — The raw backend shapes.
- **`mapRenter(r)`** — Converts an `ApiRenter` (or null) into `VehicleRenterInfo | null`.
- **`mapMaintenance(m)`** — Converts an `ApiMaintenance` (or null) into `VehicleMaintenanceInfo | null`.

---

## `services/rentals/` (admin-facing rentals + driver browse + owner's staff)

### `services/rentals/api.ts`
Admin CRUD over rental-owner accounts (`/admin/rentals/`). Exposes `rentalsApi`:
- **`rentalsApi.list()`** — Lists all rental owners. `GET /admin/rentals/`. Returns `Rental[]`.
- **`rentalsApi.get(id)`** — One rental by id. `GET /admin/rentals/{id}/`. Returns `Rental`.
- **`rentalsApi.create(input)`** — Creates a rental account (admin sets the password). `POST /admin/rentals/`. Returns `Rental`.
- **`rentalsApi.update(id, input)`** — Edits a rental. `PATCH /admin/rentals/{id}/`. Returns `Rental`.
- **`rentalsApi.remove(id)`** — Deletes a rental. `DELETE /admin/rentals/{id}/`. Returns nothing.
- **type `RentalInput`** — Editable fields: `rentalType`, optional `companyName`/`abn`, `contactName`, `email`, optional `phone`, `status`, `suspensionReason`, `minimumRentalDays`, `password`.

### `services/rentals/browse.ts`
Driver "Browse rentals" (`/browse/rentals/`) — active rentals that have available vehicles.
- **`browseListRentals()`** — Lists browsable rentals plus a count of available vehicles per rental. `GET /browse/rentals/`. Returns `{ rentals: Rental[], countByRental: Map<string, number> }`.
- **`browseGetRental(rentalId)`** — One rental by id (null if missing / no available vehicles). `GET /browse/rentals/{rentalId}/`. Returns `Rental | null`.
- **`browseListVehicles(rentalId)`** — The available vehicles for one rental. `GET /browse/rentals/{rentalId}/vehicles/`. Returns `Vehicle[]`.

### `services/rentals/rentalStaffApi.ts`
Low-level client for a rental owner managing their own staff (`/rental-staff/`). Creating a staff member creates the account immediately (owner types the password; no admin approval). Exposes `rentalStaffApi`:
- **`rentalStaffApi.list()`** — Lists the owner's staff (active accounts + any pending requests). `GET /rental-staff/`. Returns `RentalPortalStaffEntry[]`.
- **`rentalStaffApi.add(input)`** — Creates a staff account directly. `POST /rental-staff/`. Returns the created `RentalPortalStaffEntry`.
- **`rentalStaffApi.update(id, patch)`** — Edits a staff member's name/phone/allowed pages. `PATCH /rental-staff/{id}/`. Returns the updated `RentalPortalStaffEntry`.
- **`rentalStaffApi.remove(id)`** — Removes a staff account (or cancels a pending request). `DELETE /rental-staff/{id}/`. Returns nothing.
- **type `UpdateRentalStaffInput`** — Editable fields: `firstName`, `lastName`, `phone`, `allowedNavPaths`.

### `services/rentals/rentalStaff.ts`
Friendly wrapper the rental-staff pages call; forwards to `rentalStaffApi`. (The `_parentRentalUserId` args are ignored because the backend scopes by the logged-in owner.)
- **`listRentalStaff(_parentRentalUserId)`** — Forwards to `rentalStaffApi.list()`. Returns `RentalPortalStaffEntry[]`.
- **`addRentalStaff(_parentRentalUserId, input)`** — Forwards to `rentalStaffApi.add(input)`. Returns the created entry.
- **`updateRentalStaff(id, patch)`** — Forwards to `rentalStaffApi.update(id, patch)`. Returns nothing.
- **`deleteRentalStaff(id)`** — Forwards to `rentalStaffApi.remove(id)`. Returns nothing.
- **`getRentalStaffById(id)`** — Finds one staff member from the list. Returns `RentalPortalStaffEntry | undefined`.
- Re-exports the `RentalPortalStaffEntry`, `AddRentalPortalStaffInput`, `UpdateRentalStaffInput` types.

### `services/rentals/rentalStaffTypes.ts`
- **type `RentalStaffStatus`** — `'pending' | 'active' | 'inactive'`.
- **type `RentalPortalStaffEntry`** — A staff member of a rental owner: `id`, `userId`, `parentRentalUserId`, name fields, `email`, `phone`, `allowedNavPaths`, `status`.
- **type `AddRentalPortalStaffInput`** — Fields to add staff: name, `email`, `phone`, `password`, `allowedNavPaths`.

### `services/rentals/types.ts`
- **type `RentalType`** — `'company' | 'individual'`.
- **type `RentalStatus`** — `'active' | 'inactive'`.
- **type `RentalStaffMember`** — A staff account nested inside a `Rental` (`id`, name, contact, `status`, `allowedNavPaths`).
- **type `Rental`** — A rental owner: type/company/abn, contact, `status`, `suspensionReason`, `minimumRentalDays`, map `latitude`/`longitude`, nested `staff`, and `documents`.

---

## `services/tracking.ts`
GPS tracking over plain HTTP (Phase 5). Drivers report their position; owners/admins read the latest positions for a live map. All calls suppress the global error toast.
- **type `LocationReportResult`** — `{ tracking, warnings }`.
- **type `UnavailableResult`** — `{ tracking, warnings, maxStrikes }`.
- **type `TrackedVehicle`** — A vehicle's latest position for the live map (`vehicleId`, `vehicleLabel`, `rego`, `driverName`, lat/long, `accuracy`, `recordedAt`, `stale`).
- **`reportLocation(latitude, longitude, accuracy?)`** — Driver reports current position. `POST /driver/location/report/`. Returns `LocationReportResult` (or `null` on any failure).
- **`reportLocationUnavailable()`** — Tells the backend the driver's location is unavailable (adds a strike). `POST /driver/location/unavailable/`. Returns `UnavailableResult` (or `null`).
- **`fetchTrackedLocations()`** — Latest vehicle positions the owner/admin may see. `GET /tracking/locations/`. Returns `TrackedVehicle[]` (empty array on failure).

## `services/trackingSocket.ts`
Real-time GPS over WebSockets (the "live upgrade" for tracking). It authenticates from the HttpOnly cookie automatically and connects to `ws(s)://<api-host>/ws/track/<vehicleId>/` (note: at the server root, NOT under `/api`). The HTTP endpoints in `tracking.ts` remain as a fallback.
- **type `LivePosition`** — A pushed position (`vehicleId`, lat/long, `accuracy`, `recordedAt`).
- **type `TrackingSocketHandlers`** — Optional callbacks: `onPosition`, `onInactive`, `onOpen`, `onClose`.
- **type `TrackingSocket`** — The controller returned to callers: `send(lat, lng, accuracy?)`, `isOpen()`, `close()`.
- **`trackingSocketUrl(vehicleId)`** — Builds the `ws(s)://.../ws/track/<vehicleId>/` URL from the REST base URL. Returns a string.
- **`createTrackingSocket(vehicleId, handlers?)`** — Opens a resilient WebSocket for one vehicle, auto-reconnecting with exponential backoff (capped at 30s). Drivers call `send(...)` to push positions; viewers receive them via `onPosition`. Returns a `TrackingSocket` controller — call `close()` on unmount.

---

## `services/types/common.ts`
Generic, reusable helper types (no functions, no network). Used across the app for lists, queries and hook state.
- **`PaginationParams`** / **`PaginationResponse<T>`** — Paging request params and a paged response envelope.
- **`SortParams`** — `sortBy` + `sortOrder`.
- **`FilterParams`** — Search/status/date filters (plus arbitrary extra keys).
- **`QueryParams`** — Combines pagination + sort + filter.
- **`ApiResponse<T>`** — Generic `{ data, message?, success, errors? }` wrapper.
- **`ApiError`** — `{ message, statusCode, errors?, non_field_errors? }`.
- **`MutationResponse<T>`** — `{ data, message, success }`.
- **`BaseEntity`** — Common id + timestamps for a record.
- **`LoadingStates`** / **`MutationStates`** — Boolean flags used by React Query-style hooks.
- **`QueryHookReturn<T>`** / **`MutationHookReturn<TData, TVariables>`** — The shapes returned by custom data hooks.

---

## `services/vehicles/api.ts`
Admin CRUD over ALL vehicles across every rental (`/admin/vehicles/`). Exposes `adminVehiclesApi`:
- **`adminVehiclesApi.list()`** — Lists all vehicles (each carries its owning rental's name). `GET /admin/vehicles/`. Returns `AdminVehicleRow[]`.
- **`adminVehiclesApi.get(id)`** — One vehicle by id. `GET /admin/vehicles/{id}/`. Returns `AdminVehicleRow`.
- **`adminVehiclesApi.create(input)`** — Creates a vehicle owned by the chosen rental. `POST /admin/vehicles/`. Returns `AdminVehicleRow`.
- **`adminVehiclesApi.update(id, input)`** — Edits a vehicle. `PATCH /admin/vehicles/{id}/`. Returns `AdminVehicleRow`.
- **`adminVehiclesApi.remove(id)`** — Deletes a vehicle. `DELETE /admin/vehicles/{id}/`. Returns nothing.
- **type `VehicleStatus`** — `'available' | 'rented' | 'maintenance'`.
- **type `AdminVehicleRow`** — A vehicle row for the admin list: identity, images, `status`, pricing, insurance, service/registration tracking, `rentalId`/`rentalName`, and embedded `renter`/`maintenance`.
- **type `VehicleInput`** — Editable fields the admin sets, including `rentalId` (the owning rental).


---

# Frontend — Pages (Screens)

This document describes every page (screen) in the `frontend/src/pages/` folder of the "Wheels of Australia" vehicle rental app. The app has four user roles: **admin**, **rental owner/staff**, **driver**, and **mechanic**. Many pages are role-aware — they show different content depending on who is logged in.

A few conventions used across pages:
- **PageHero** — a shared gradient banner header at the top of most list/content pages (title + subtitle + optional action buttons).
- **useToast** — shows small success/error pop-up messages.
- **useAutoRefresh** — silently re-fetches list data when something changes elsewhere (driven by notifications), so lists stay up to date without a manual reload.
- **useHighlightTarget / highlightSx** — when the user arrives from a notification deep-link, the affected row/card briefly flashes so it's easy to spot.
- Most pages animate in with `framer-motion` (`fadeVariants`, `listVariants`, etc.).

---

### `pages/home/`
Public landing/home screen. Used by anyone (logged out or in).

- **Main component (`HomePage`)**: Very thin wrapper — it just renders the shared `<LandingPage />` component (`components/Landing`). All the marketing/hero content lives there.
- **State/data**: None.
- **Handlers**: None.

---

### `pages/login/`
Sign-in screen. Used by all roles.

- **Main component (`LoginPage`)**: Thin wrapper that renders the shared `<Login />` component (`components/Auth/Login/Login`). The actual login form, validation, and auth-call logic live inside that component.
- **State/data**: None here.
- **Handlers**: None here.

---

### `pages/register/`
Driver self-registration screen. Used by would-be drivers (logged out).

- **Main component (`RegisterPage`)**: Thin wrapper that renders the shared `<Register />` component (`components/Auth/Register`), which holds the driver sign-up form.
- **State/data**: None here.
- **Handlers**: None here.

---

### `pages/rental-register/`
Self-registration form for rental businesses (company or individual). Used by would-be rental owners (logged out).

- **Main component (`RentalRegisterPage`)**: A form inside `AuthPageLayout`. Lets the applicant pick "company" or "individual". Company shows extra fields (company name, ABN + certificate upload); individual uploads an ID document instead. On success it swaps to a "registration submitted, awaiting admin approval" confirmation screen.
- **Key state/data**:
  - `form` — rentalType, companyName, abn, contactName, email, phone.
  - `countryIso` — selected phone country code.
  - `certificate` / `idDocument` — uploaded files; `idDocChecking` / `idDocWarning` — soft OCR check state.
  - `errors`, `submitting`, `submitted` — validation and submit flags.
  - Submits via `registrationApi.submit(...)` (services/registrations).
- **Handlers**:
  - `handleIdDocSelect(file)` — stores the ID file and runs `looksLikeIdDocument()` OCR check; shows a soft warning if it doesn't look like an ID (does not block submit).
  - `handleChange` — updates a form field and clears that field's error.
  - `handleRentalTypeChange` — switches company/individual (which fields are shown).
  - `validate()` — checks required fields, valid email, valid phone, valid ABN, and required file uploads.
  - `handleSubmit` — validates, calls `registrationApi.submit`, and on success sets `submitted`; on failure shows field errors + a toast.

---

### `pages/mechanic-register/`
Self-registration form for mechanic workshops. Used by would-be mechanics (logged out).

- **Main component (`MechanicRegisterPage`)**: A form in `AuthPageLayout` collecting contact name, email, phone, shop name, shop address, ABN, and a required shop photo. On success shows a "registration submitted, awaiting admin approval" screen.
- **Key state/data**: `form` (contactName, email, phone, abn, shopName, shopAddress), `countryIso`, `shopImage` file, `errors`, `submitting`, `submitted`. Submits via `registrationApi.submit({ role: 'mechanic', ... })`.
- **Handlers**:
  - `handleChange` — updates field + clears its error.
  - `validate()` — requires all fields, valid email/phone, valid ABN (`isValidAbn`), and a shop photo.
  - `handleSubmit` — validates, calls `registrationApi.submit`, sets `submitted` on success, shows field errors + toast on failure.

---

### `pages/verify-otp/`
Phone verification screen (enter a 6-digit code). Used after sign-up/login flows that require phone verification.

- **Main component (`VerifyOTPPage`)**: Shows a 6-digit `OTPInput` in `AuthPageLayout` and a "Verify & go to dashboard" button.
- **Key state/data**: `otp` (typed code), `error` (shown if fewer than 6 digits).
- **Handlers**:
  - `handleVerify` — if the code isn't 6 digits, sets an error; otherwise clears the pending-phone-verification session flag (`sessionUtils.clearPendingPhoneVerification`) and navigates to the dashboard. (Note: this screen does not call a backend verify endpoint — it just checks length and proceeds.)

---

### `pages/onboarding/`
Multi-step onboarding wizard (welcome → upload documents → OCR review → face verification). Used by newly created users completing setup.

- **Main component (`OnboardingPage`)**: Defines a 4-step config array and renders the shared `<OnboardingWizard steps=... />`. Each step renders a component from `components/Onboarding/steps`: `StepWelcome`, `StepDocumentUpload`, `StepOCRReview`, `StepFaceVerification`.
- **State/data**: None here (each step manages its own).
- **Handlers**: `onComplete` and `onCancel` both navigate to the dashboard.

---

### `pages/no-access/`
"You don't have access" screen. Shown when a user hits a page their role can't use.

- **Main component (`NoAccessPage`)**: A centered "blocked" icon, a translated no-access message, and a button back to the dashboard.
- **State/data**: None.
- **Handlers**: Button `onClick` navigates to the dashboard.

---

### `pages/dashboard/`
The main dashboard router. Used by all logged-in roles.

- **Main component (`DashboardPage`)**: Reads the current user's role and renders the right dashboard:
  - `admin` → `<AdminDashboardPage />` (the `admin-dashboard` page below).
  - `mechanic` → `<MechanicDashboard />` (from components/Dashboard).
  - everyone else (driver / rental) → `<DashboardView />` (from components/Dashboard).
- **State/data**: Reads `user` from `useAuth()`.
- **Handlers**: None (pure routing by role).

---

### `pages/admin-dashboard/`
Admin overview dashboard with stats, charts, and recent notifications. Used by admins.

- **Main component (`AdminDashboardPage`)**: A gradient welcome hero, a grid of clickable stat cards, and several panels (charts + notifications).
- **Key state/data**:
  - `stats` — loaded from `dashboardApi.stats()`; **re-fetched every 30 seconds** so counts stay live.
  - `notifications`, `unreadCount`, `markAsRead`, `markAllAsRead` from `useNotifications()`.
  - Derived: `statCards` (drivers, rentals, rental staff, mechanics, vehicles, pending registrations, unread notifications), `vehiclesByStatus`, `requestsByStatus`, `trend` (last-6-months request trend), `topRentals`.
- **Handlers / interactions**:
  - `formatWhen(iso)` — turns a timestamp into "just now / Xm / Xh / Xd".
  - Each stat card, vehicle-status row, and top-rental row is clickable and navigates to a filtered list page (e.g. `/admin/vehicles?status=rented`).
  - Recent-notification click: marks it read and deep-links via `resolveNotificationTarget(n, role)`.
  - "Mark all read" button calls `markAllAsRead`.

---

### `pages/admin-registrations/`
Review queue for driver/rental/mechanic sign-up requests. Used by admins.

- **Main component (`AdminRegistrationsPage`)**: Inside `PageHero`. A status tab bar (Pending / Approved / Rejected / All), a list of registration cards, a full-detail modal, and confirm dialogs for approve/reject/delete.
- **Key state/data**:
  - `requests` — loaded via `adminRegistrationApi.list(status)`.
  - `tab` (status filter), `loading`, `actingId` (which row is mid-action).
  - `selected` (detail modal), `approveTarget` / `rejectTarget` / `deleteTarget` (which record a dialog acts on), `rejectReason`.
  - `useAutoRefresh` silently refetches when a registration is submitted/decided; `useHighlightTarget` flashes a card arrived at from a notification.
- **Handlers**:
  - `load()` — fetches the list for the current tab.
  - `handleApproveConfirm` — `adminRegistrationApi.approve(id)`; creates the account and emails login credentials, then reloads.
  - `handleRejectConfirm` — requires a typed reason, then `adminRegistrationApi.reject(id, reason)` (emails the applicant the reason), then reloads.
  - `handleDeleteConfirm` — `adminRegistrationApi.remove(id)` permanently deletes the request (not the created account), then reloads.
- **Child (in-file) components**: `Detail` (icon + text row), `SectionTitle` (small heading), `Field` (label/value pair) — all used inside the detail modal.

---

### `pages/admin-settings/`
Site branding / theme settings. Used by admins.

- **Main component (`AdminSettingsPage`)**: Inside `PageHero`. Cards for: light/dark mode toggle, primary colour picker (+ hex input), secondary colour picker (+ hex input), logo upload/preview/remove, and a "reset branding" button.
- **Key state/data**: Reads/writes global branding via `useBranding()` (`mode`, `primaryColor`, `secondaryColor`, `logoUrl`, setters, `resetBranding`). Local `hexInput` / `hexInputSecondary` mirror the pickers.
- **Handlers**:
  - `normalizeHex(value)` / `applyHex` / `applyHexSecondary` — validate and apply typed hex codes on blur.
  - Colour picker `onChange` — sets primary/secondary immediately.
  - `handleLogoChange` — reads the chosen image as a base64 data URL and sets it as the logo.
  - `handleRemoveLogo` — clears the logo and the file input.
  - `resetBranding` — restores default theme.

---

### `pages/profile/`
"My account" page showing the logged-in user's details. Used by all roles.

- **Main component (`ProfilePage`)**: A gradient hero, an identity card (avatar/initials, name, email, role + active chips), an "Account" details card, a role-specific details card, an uploaded-documents section (non-admins), an admin/owner contact card (non-admins), and a suspension banner if the account is locked.
- **Key state/data**:
  - `profile` — loaded from `profileApi.me()`; `loading` shows a spinner.
  - Derived role-specific rows: driver (license number), rental (type, company, ABN, minimum rental days), mechanic (shop name, address, ABN).
- **Handlers / helpers**:
  - `roleLabel`, `formatDate`, `initials` — display helpers.
  - `InfoRow` / `SectionCard` — small in-file layout components.
  - "Email owner/admin" button sets `window.location.href` to a `mailto:` link for the admin/owner contact.

---

### `pages/notifications/`
Full notifications list. Used by all roles.

- **Main component (`NotificationsPage`)**: Inside `PageHero`. Lists all notifications as cards (unread ones have a coloured left border and "New" chip), with per-item delete and a "Mark all read" action. Supports being deep-linked with `?focus=<id>` to scroll-to and briefly highlight one item.
- **Key state/data**: Reads `notifications`, `unreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification` from `useNotifications()`. Local `deleteId` (delete confirm), `highlightId`, and `itemRefs` for scroll-into-view. `focusId` from the URL query.
- **Handlers**:
  - `handleOpen(n)` — marks it read and navigates via `resolveNotificationTarget(n, role)` (falls back to `n.link`).
  - `confirmDelete` — deletes the notification via `deleteNotification` and toasts success.
  - A `useEffect` scrolls to and flashes the focused notification for ~2.2s.

---

### `pages/activity/`
Activity log / audit trail of who did what. Used by rental **owners** (their whole account, including each staff member) and **admins** (across all rentals). Rental **staff** are blocked.

- **Main component (`ActivityPage`)**: Inside `PageHero`. A paginated list of activity entries. Each row shows the actor's name, an owner/staff tag, (for admins) the rental name, a summary, an icon by category, and a "time ago" label. Rows with a `link` are clickable.
- **Key state/data**:
  - `entries` — loaded via `listActivity()`; **polled every 30s**.
  - `isAdmin` / `isStaff` derived from role (`normalizeRole` + `allowed_nav_paths`). Staff see an "owner only" message.
  - `page`, `pageSize`, `loading`; `paginated` slices the list client-side.
- **Handlers / helpers**:
  - `timeAgo(iso)` and `visualFor(action)` (maps action category → icon + colour).
  - Row click navigates to `e.link`.
  - `Pagination` controls change page / page size.

---

### `pages/drivers/`
Drivers management list. Used by admins (and staff with the permission) to manage driver accounts.

- **Main component (`DriversPage`)**: A searchable, status-filterable, paginated table of drivers. Row click opens a read-only detail popup with the driver's info, uploaded documents, and their related booking requests. Delete needs confirmation.
- **Key state/data**:
  - `drivers` from `driversApi.list()`; `requests` from `listIncomingRequests()` (to show each driver's bookings in the detail popup).
  - `search`, `statusFilter` (all/active/inactive), `page`, `rowsPerPage`.
  - `selected` (detail popup), `deleteDialogOpen` + `driverIdToDelete`. `useAutoRefresh` keeps the list live.
- **Handlers**:
  - `filterDrivers()` — case-insensitive filter over name/email/phone plus status.
  - `handleDeleteClick(id)` / `handleDeleteConfirm()` — confirm then `driversApi.remove(id)` and update state + toast.
  - `handleRowsPerPageChange` — resets to page 1.
  - Row click opens detail; edit navigates to `/drivers/edit/:id`.
- **Child components (`components/`)**:
  - `DriversToolbar` — search box, status dropdown, "Add driver" button.
  - `DriversTable` — the data table (name/avatar, phone, license, status chip, edit/delete icons).
  - `DriversEmptyState` — card shown when there are zero drivers.
  - `DriversNoResults` — card shown when search/filter matches nothing.
  - `DriversSkeleton` — animated placeholder rows during load.

---

### `pages/drivers/add/`
Create a new driver account. Used by admins.

- **Main component (`DriversAddPage`)**: A form for full name, email, phone, license number, status, and initial password. Submits then returns to the drivers list.
- **Key state/data**: `formData` (the six fields), `saving`. No fetch on load.
- **Handlers**: `handleChange` updates fields; `handleSubmit` calls `driversApi.create(formData)`, toasts, and navigates to the list. Cancel goes back.

---

### `pages/drivers/edit/`
Edit an existing driver. Used by admins.

- **Main component (`DriversEditPage`)**: Loads the driver by `:id` and pre-fills the same fields as Add, plus a required "suspension reason" field that appears when status is set to inactive. Password is optional (blank keeps current).
- **Key state/data**: `id` param, `loading` (initial fetch via `driversApi.get(id)`), `formData` (with `suspensionReason`), `saving`.
- **Handlers**: `handleChange`; `handleSubmit` validates the suspension reason when inactive, calls `driversApi.update(id, ...)` (sends password only if non-empty), toasts, navigates back.

---

### `pages/mechanics/`
Mechanics management list. Used by admins.

- **Main component (`MechanicsPage`)**: A searchable (non-paginated) table of mechanics. Row click opens a read-only detail popup with mechanic + workshop info, documents, and their recent maintenance jobs (up to 8). Delete needs confirmation.
- **Key state/data**: `mechanics` from `mechanicsApi.list()`; `jobs` from `listMaintenanceRequests()` (filtered by mechanic email in the popup); `search`, `selected`, `toDelete`, `deleting`. `useAutoRefresh` keeps it live; highlight support for notification deep-links.
- **Handlers**: Inline case-insensitive filter over name/email/shop/phone; row click opens detail; edit → `/mechanics/edit/:id`; `handleDeleteConfirm` calls `mechanicsApi.remove(id)`, updates state, toasts.
- **Child components**: None (table is inline in this page).

---

### `pages/mechanics/add/`
Create a new mechanic account. Used by admins.

- **Main component (`MechanicsAddPage`)**: A form for full name, email, phone, shop name, shop address, ABN, status, and password. ABN is validated.
- **Key state/data**: `formData` (eight fields), `saving`, `abnError`.
- **Handlers**: `handleChange` (clears `abnError` on ABN edit); `handleSubmit` validates ABN via `isValidAbn`, then `mechanicsApi.create(formData)`, toasts, navigates to the list.

---

### `pages/mechanics/edit/`
Edit an existing mechanic. Used by admins.

- **Main component (`MechanicsEditPage`)**: Loads the mechanic by `:id`, pre-fills the same eight fields, adds a required "suspension reason" when status is inactive. ABN validated; password optional.
- **Key state/data**: `id`, `loading` (fetch via `mechanicsApi.get(id)`), `formData` (+ `suspensionReason`), `saving`, `abnError`.
- **Handlers**: `handleChange`; `handleSubmit` validates ABN and (if inactive) the reason, calls `mechanicsApi.update(id, ...)` (password only if non-empty), toasts, navigates back.

---

### `pages/rentals/`
Rentals management list (all rental businesses). Used by admins.

- **Main component (`RentalsPage`)**: Searchable, status-filterable, paginated table of rentals. Row click opens a read-only detail modal (contact, company, ABN, documents, associated staff). Delete needs confirmation.
- **Key state/data**: `rentals` from `rentalsApi.list()`; `search`, `statusFilter`, `page`, `rowsPerPage`, `selected`, `deleteDialogOpen` + `rentalIdToDelete`. `useAutoRefresh` + `useHighlightTarget` (jumps to and flashes the target row's page).
- **Handlers**:
  - `filterRentals()` — filters by status + search over contact name/company/email.
  - `handleRowsPerPageChange` — resets to page 1.
  - `handleDeleteClick` / `handleDeleteConfirm` / `handleDeleteCancel` — confirm then `rentalsApi.remove(id)`, update state, toast.
  - Add → rentals-add route; row edit → rentals-edit route.
- **Child components (`components/`)**:
  - `RentalsToolbar` — search, status dropdown, "Add" button.
  - `RentalsTable` — DataTable (contact name, phone, minimum rental days, status chip, edit/delete); supports `highlightId`.
  - `RentalsEmptyState` — no-rentals card with add button.
  - `RentalsNoResults` — no-search-results card.
  - `RentalsSkeleton` — animated loading placeholder rows.

---

### `pages/rentals/add/`
Create a new rental business account. Used by admins.

- **Main component (`RentalsAddPage`)**: Form with a company/individual toggle. Company shows company name + ABN; shared fields are contact name, email, phone, password; optional certificate upload; minimum rental days; status.
- **Key state/data**: `formData` (rentalType, companyName, abn, contactName, email, phone, certificate file + name, minimumRentalDays, status, password), `saving`, `abnError`.
- **Handlers**: `handleChange`; `handleRentalTypeChange` (resets company-only fields); `handleCertificateSelect` (stores file + name); `handleSubmit` validates ABN if company, calls `rentalsApi.create(...)`, navigates to list.

---

### `pages/rentals/edit/`
Edit an existing rental business. Used by admins.

- **Main component (`RentalsEditPage`)**: Same layout as Add, loaded by `:id`, plus a `suspensionReason` field shown when status is inactive. Password optional (reset only if typed).
- **Key state/data**: `formData` (+ `suspensionReason`), `loading` (fetch via `rentalsApi.get(id)`), `saving`, `abnError`, `id`.
- **Handlers**: `handleChange`, `handleRentalTypeChange`, `handleCertificateSelect`; `handleSubmit` validates ABN (company) and reason (inactive), calls `rentalsApi.update(id, ...)`, navigates to list.

---

### `pages/rental-staff/`
A rental **owner's** own staff list. Used by the primary rental owner account (role `rental` with no `allowed_nav_paths`); other accounts are redirected to the dashboard.

- **Main component (`RentalStaffPage`)**: Searchable, paginated table of the owner's staff. Row click opens a read-only detail modal (name, email, phone, allowed menus). Delete needs confirmation.
- **Key state/data**: `staff` from `listRentalStaff(user.id)`; `search`, `page`, `rowsPerPage`, `viewId`, `deleteDialogOpen` + `idToDelete`. `useHighlightTarget` for notification deep-links; `isMainRental` guard.
- **Handlers**: `filterStaff()` (name/email/phone); `formatAllowedMenus` / `formatAllMenus` (truncated vs full menu list); `handleDeleteClick` / `handleDeleteConfirm` (calls `deleteRentalStaff`); add → staff-add route, edit → staff-edit route.
- **Child components**: Inline toolbar (search + add), `DataTable`, empty-state card, detail `Dialog`, delete `Dialog`, `Pagination`.

---

### `pages/rental-staff/add/`
Owner creates a new staff member. Used by the rental owner.

- **Main component (`RentalStaffAddPage`)**: Form for first name, last name, email, phone, password, plus checkboxes choosing which rental menus the staff can access. Guarded to the main rental account.
- **Key state/data**: field states + `allowedPaths[]`, `submitting`, `error`; `GRANTABLE_RENTAL_NAV` lists the checkbox options; parent = `user.id`.
- **Handlers**: `togglePath(path)` adds/removes a menu; `handleSubmit` validates required fields, calls `addRentalStaff(parentId, {...})` (defaults to at least Dashboard), navigates to the staff list.

---

### `pages/rental-staff/edit/`
Owner edits an existing staff member. Used by the rental owner.

- **Main component (`RentalStaffEditPage`)**: Loads staff by `:id`; edit name, phone, and allowed menus. Email is read-only; password optional. Guarded to main rental account.
- **Key state/data**: field states + `allowedPaths`, `loaded`, `notFound`, `submitting`; data via `getRentalStaffById(id)`, save via `updateRentalStaff(id, ...)`.
- **Handlers**: `togglePath`; `handleSubmit` validates, calls `updateRentalStaff`, navigates to the list. Redirects to list if not found.

---

### `pages/admin-rental-staff/`
Admin view of **all** rental staff across every rental. Used by admins.

- **Main component (`AdminRentalStaffPage`)**: Searchable, paginated table with a per-rental filter dropdown. Row click opens a read-only detail modal (name, email, phone, rental, allowed menus, documents). Delete needs confirmation.
- **Key state/data**: `staff` from `adminRentalStaffApi.list()`; `search`, `rentalFilter`, `page`, `rowsPerPage`, `viewId`, `deleteDialogOpen` + `idToDelete`; `rentalOptions` (distinct rentals for the filter). `useAutoRefresh` + `useHighlightTarget`.
- **Handlers**: `filterStaff()` (name/email/rental/phone); `formatMenus`; `handleDeleteConfirm` calls `adminRentalStaffApi.remove(id)`; add/edit navigate to admin staff routes.
- **Child components**: Inline toolbar (search + rental filter + add), `DataTable` (with rental chip), empty-state card, detail `Dialog` (with document previews), delete `Dialog`, `Pagination`.

---

### `pages/admin-rental-staff/add/`
Admin creates staff for a chosen rental. Used by admins.

- **Main component (`AdminRentalStaffAddPage`)**: Form with a required rental dropdown (active rentals only), full name, email, phone, password, and allowed-menu checkboxes.
- **Key state/data**: `rentals` from `rentalsApi.list()` (active only); `rentalId`, `fullName`, `email`, `phone`, `password`, `allowedPaths`, `submitting`, `error`.
- **Handlers**: `togglePath`; `handleSubmit` validates rental + required fields, calls `adminRentalStaffApi.create({...})` (status active, defaults menus to at least Dashboard), navigates to admin staff list.

---

### `pages/admin-rental-staff/edit/`
Admin edits any staff member. Used by admins.

- **Main component (`AdminRentalStaffEditPage`)**: Loads staff by `:id`; can reassign rental (dropdown of all rentals), edit name/phone, change status (inactive shows a required reason), reset password (optional), and adjust allowed menus. Email read-only.
- **Key state/data**: `rentals` (all), field states + `status`, `suspensionReason`, `allowedPaths`, `loaded`, `notFound`, `submitting`, `error`, `id`; data via `adminRentalStaffApi.get(id)`, save via `adminRentalStaffApi.update(id, ...)`.
- **Handlers**: `togglePath`; `handleSubmit` validates fields and (if inactive) the reason, calls update (password only if typed), navigates to admin staff list. Redirects to list if not found.

---

### `pages/fleet/`
A rental's own vehicle inventory ("My fleet"). Used by rental owner/staff.

- **Main component (`FleetPage`)**: Searchable, status-filterable, paginated table of the rental's vehicles. Row click opens a read-only details modal. Delete needs confirmation.
- **Key state/data**: vehicles from `listFleet()` — **auto-refreshed every ~25s and immediately on notifications**; `search`, `statusFilter` (available / rented / pending_return / maintenance — mirrored in the URL `?status=` for deep-linking), pagination, `viewVehicleId` (details modal), delete-confirm state.
- **Handlers**: `handleRowsPerPageChange` (reset paging); `handleDeleteClick` / `handleDeleteConfirm` (calls `removeFleetVehicle()` + updates state); `setStatusFilter` (updates URL); `setViewVehicleId` (open details).
- **Child components (`components/`)**:
  - `FleetToolbar` — search, status dropdown, "Add vehicle" button.
  - `FleetVehicleTable` — main data table (make/model + thumbnail, rego, status, distance, trips, oil/rego dates, price/day, edit/delete); supports `highlightId`.
  - `FleetVehicleDetails` — read-only modal content (image gallery + fleet info + service/registration; plus rented-by or in-maintenance sections when relevant).
  - `FleetVehicleCard` — card-style vehicle view (available for card layouts).
  - `FleetEmptyState` — no-vehicles card with add button.
  - `FleetNoResults` — no-search-results card.
  - `FleetSkeleton` — animated loading placeholders.
  - `InsuranceField` — insurance-type picker (4 preset Australian types or free-text custom); reused by add/edit and admin-vehicles.
  - `VehicleImageUpload` — multi-image uploader storing photos as base64 data URLs; reused by add/edit and admin-vehicles.

---

### `pages/fleet/add/`
Add a vehicle to your fleet. Used by rental owner/staff.

- **Main component (`FleetAddPage`)**: Multi-section form: vehicle details (make/model/year/rego/insurance/price/min days/odometer), service & registration dates, image upload (≥1 required), status, and a maintenance note (required when status is maintenance).
- **Key state/data**: `form` fields, image URLs array, per-field `errors`, `saving`. Creates via `addFleetVehicle()`.
- **Handlers**: `handleChange` (update + clear error); `validate()` (all fields required; note required if maintenance); `handleImagesChange` (update images + clear image error once ≥1); `handleSubmit` validates then `addFleetVehicle()` and navigates to the fleet list.

---

### `pages/fleet/edit/`
Edit one of your fleet vehicles. Used by rental owner/staff.

- **Main component (`FleetEditPage`)**: Same form as Add, pre-filled from the API. Shows a loading spinner while fetching.
- **Key state/data**: `id`, loaded via `getFleetVehicle(id)` (abort-safe); saves via `updateFleetVehicle(id, data)` (clears the maintenance note when status isn't maintenance). Loads existing images.
- **Handlers**: `handleChange`, `validate`, `handleImagesChange` (same as Add); `handleSubmit` validates then updates and navigates back to the list.

---

### `pages/admin-vehicles/`
System-wide vehicle list across all rentals. Used by admins.

- **Main component (`AdminVehiclesPage`)**: Full-page table with search (vehicle/rego/rental) and a status filter mirrored in the URL. Row click opens a read-only detail modal showing vehicle + owning-rental + maintenance info. Delete needs confirmation. No pagination — all rows shown.
- **Key state/data**: rows from `adminVehiclesApi.list()` (each row includes `rentalName`, `rentalId`, insurance, maintenance details); `search`, `statusFilter`, `selected`. `useAutoRefresh` keeps it live.
- **Handlers**: `handleDeleteConfirm` calls `adminVehiclesApi.remove(id)` + updates state + toast; `setSelected` opens details; `setStatusFilter` updates URL; `setSearch` filters via `useMemo`.

---

### `pages/admin-vehicles/add/`
Admin adds a vehicle and assigns it to a rental. Used by admins.

- **Main component (`AdminVehiclesAddPage`)**: Same vehicle form as fleet Add, but with a required "owning rental" dropdown.
- **Key state/data**: `rentals` from `rentalsApi.list()` (for the dropdown); the vehicle `form` fields; `saving`, `errors`. Creates via `adminVehiclesApi.create()` (with explicit `rentalId`).
- **Handlers**: `handleChange`; `validate()` (same as fleet plus requires `rentalId`); `handleImagesChange`; `handleSubmit` creates then navigates to the admin vehicles list; `rentalLabel()` formats dropdown labels (company or contact name).

---

### `pages/admin-vehicles/edit/`
Admin edits a vehicle and can change its owning rental. Used by admins.

- **Main component (`AdminVehiclesEditPage`)**: Loads the vehicle and the rentals list in parallel (`Promise.all`, abort-safe), pre-fills the form, allows editing all fields including `rentalId`.
- **Key state/data**: vehicle via `adminVehiclesApi.get(id)`, options via `rentalsApi.list()`; saves via `adminVehiclesApi.update(id, data)` (clears the maintenance note when status isn't maintenance). Loading spinner while fetching.
- **Handlers**: `handleChange`, `validate` (requires `rentalId`), `handleImagesChange`, `handleSubmit` updates then navigates to the admin vehicles list.
- **Child components**: Reuses `VehicleImageUpload` and `InsuranceField` from `fleet/components/`.

---

### `pages/vehicles/`
Browse rentals to book a car. Used by drivers (and any browsing user).

- **Main component (`VehiclesPage`)**: A paginated grid of rental companies and individual owners (two sections). Clicking a rental opens its vehicle listing.
- **Key state/data**: `rentals` from `browseListRentals()`; `vehicleCountByRental` (available count per rental); `loading`.
- **Handlers**: `handleRentalClick()` navigates to the rental detail page (`vehicles/rental` with the rentalId).
- **Child components (`components/`)**:
  - `RentalCard` — clickable card for one rental (company/person icon, name, available-vehicle count chip, "View vehicles").
  - `VehicleRentalCard` — (used by the rental sub-page) card for a single bookable vehicle.
  - `VehiclesEmptyState` — "no vehicles available" placeholder.

---

### `pages/vehicles/rental/`
Vehicles offered by one specific rental, where drivers submit booking requests. Used by drivers.

- **Main component (`VehiclesRentalPage`)**: Paginated vehicle cards for the selected rental. Selecting a vehicle opens a rental-request dialog (date range + vehicle details + identity verification). Tracks which vehicles the driver already has open requests for, to prevent duplicates.
- **Key state/data**: `rental` via `browseGetRental(rentalId)`; `vehicles` via `browseListVehicles(rentalId)`; `openByVehicle` (per-vehicle request state: pending / info_requested / none) via `getOpenRequestsByVehicle()`; `requestDialog` (vehicle + start/end dates); `verification` (submitted ID docs/details); `detailsVehicle` (details dialog); `page`, `pageSize` (8/page).
- **Handlers**:
  - `refreshOpenRequests()` — reloads per-vehicle request states.
  - `openRequestDialog(vehicle)` / `closeRequestDialog()` — open/reset the booking modal.
  - `handleSubmitRequest()` — `submitBookingRequest(...)` with dates/vehicle/rental/verification; optimistically marks the vehicle pending.
  - `handleProvideInfo()` — routes to My Requests to update info the rental asked for.
  - `handleBack()`, pagination handlers.
- **Child components**: `VehicleRentalCard` (button changes: "Request rental" / "Pending request" (disabled) / "Provide info"), `VehiclesEmptyState`.

---

### `pages/my-requests/`
A driver's booking requests + incoming early-return decisions. Used by drivers.

- **Main component (`MyRequestsPage`)**: Two tabs — **My requests** (the driver's submitted requests, status-filterable) and **Incoming requests** (early-return requests from rental owners awaiting the driver's confirm/decline). Paginated; status filter and tab mirrored in the URL.
- **Key state/data**: `requests` via `listMyRequests()`; `tab` ('mine'/'incoming'), `filter` (status), `page`/`pageSize` (10), `viewId` (detail dialog), `cancelId`/`deleteId`/`provideId` (dialogs), `returnAction` ({id, confirm|decline}), `verification`, `busy`, `feedback`.
- **Handlers**:
  - `load()` — refresh via `listMyRequests()`.
  - `handleReturnAction()` — `confirmReturn()` or `cancelReturn()` for an incoming early-return.
  - `handleCancelConfirm()` — `cancelRequest()` on a pending/info_requested request.
  - `handleDeleteConfirm()` — `deleteMyRequest()` on a finished request.
  - `submitProvide()` — `provideBookingInfo()` to answer a rental's info request.
  - `setFilter` / `switchTab` — update filters + URL; `toast()` shows feedback.

---

### `pages/my-trips/`
A driver's active and completed rentals. Used by drivers.

- **Main component (`MyTripsPage`)**: "Running" trips (active) shown in full, plus a paginated "Completed" history. Status filter (all/running/completed) mirrored in the URL. Handles the return workflow (early-return requests, period-ended completions, confirmations).
- **Key state/data**: `trips` via `listMyTrips()` — **polled every 30s**; `statusFilter`, `page`/`pageSize` (10, completed only), `viewId`, `deleteId`, `actionDialog` ({id, request|complete}), `busy`, `feedback`; derived `runningTrips`/`completedTrips`.
- **Handlers**:
  - `refreshTrips()` — reload list.
  - `handleDeleteConfirm()` — `deleteMyRequest()`.
  - `handleCancelReturn()` — `cancelReturn()` (withdraw the driver's early-return request).
  - `handleActionConfirm()` — `requestReturn()` (ask to return early) or `completeTrip()`.
  - `changeStatus()` — filter + URL; `renderReturnControls()` — shows the right buttons/chips per trip `returnState` (none / requested_by_driver / requested_by_rental / period_ended / driver_completed).

---

### `pages/rental-requests/`
Rental owner/staff view of incoming booking requests + early-return confirmations. Used by rental owner/staff.

- **Main component (`RentalRequestsPage`)**: Two tabs — **Requests** (bookings from drivers, status-filterable: pending/approved/running/rejected/request_info/completed) and **Incoming requests** (early-return requests from drivers to confirm). Pending requests have approve/reject/request-info actions. Paginated; tab + status mirrored in URL.
- **Key state/data**: `requests` via `listIncomingRequests()`; `tab`, `statusFilter`, `page`/`pageSize` (10), `viewId`, `deleteId`/`confirmReturnId`/`requestReturnId`, `rejectDialog` ({open, requestId, notes}), `infoDialog` ({open, requestId, message}), `feedback`.
- **Handlers**:
  - `reload()` — refresh via `listIncomingRequests()`.
  - `handleApprove()` — `approveRequest()`; optimistically rejects other pending requests for the same vehicle.
  - `handleConfirmReturn()` — `confirmReturn()` (driver returned the car).
  - `handleRequestReturn()` — `requestReturn()` (ask the driver to return early).
  - `handleCancelReturn()` — `cancelReturn()` (decline/withdraw an early-return).
  - `handleRejectWithNotes()` — `rejectRequest()` with a typed reason.
  - `handleRequestInfo()` — `requestMoreInfo()` to ask the driver for more detail.
  - `handleDeleteConfirm()` — `deleteRequest()` (when permitted).
  - `changeStatusFilter()` (filter + URL); `renderReturnControl()` shows the right buttons/chips per request `returnState`.

---

### `pages/maintenance/`
The maintenance hub — role-aware. Rental owner/staff send vehicles for maintenance and manage quotes; mechanics browse open jobs and submit quotes.

- **Main component (`index.tsx`)**: Renders one of two sub-views based on role:
  - **RentalView** — a filterable list of the rental's maintenance requests. Owner/staff can: send a vehicle for maintenance (dialog: pick a vehicle + describe the work), view job details, accept/decline a mechanic's quote, request more info, confirm the vehicle's return after repair, and cancel/delete closed requests.
  - **ActiveRentalsView** (mechanics) — a two-level browse (rentals → vehicles). The mechanic opens a job and submits a quote (price, estimated time in hours/days, optional notes, plus identity verification documents).
- **Key state/data**: `listMaintenanceRequests()` — **polled every 30s**; `listFleet()` for the owner's vehicles (filtered to those not already in maintenance). Jobs are grouped by status (pending, quoted, info_requested, running/accepted, pending_return, completed, cancelled/declined). The rental-side status filter uses URL params for deep-linking. A `maintenanceAvailable()` check gates the whole page (feature availability guard).
- **Handlers (rental)**: `submitSend()` → `createMaintenanceRequest(vehicleId, workDescription)`; `acceptQuote(jobId)`; `declineQuote(jobId, reason)`; `requestMaintenanceInfo(jobId, message)`; `confirmMaintenanceReturn(jobId)` (→ vehicle available again); `cancelMaintenanceRequest(jobId)`; `deleteMaintenanceRequest(jobId)`.
- **Handlers (mechanic)**: `submitQuote(jobId, { quotedPrice, estimatedValue, estimatedUnit, mechanicNotes, idDocuments, verifiedDetails })`.
- **`shared.tsx` (helpers used by the index and the other maintenance pages)**: exports `JobCard` (reusable job card — vehicle thumbnail, make/model/rego, status chip, work description, quote/mechanic details), `STATUS_COLOR` map, `StatusChip`, `duration(job)` (formats the time estimate), and `money(value)` (currency formatting).

---

### `pages/maintenance-requests/`
A mechanic's "My requests" dashboard — every quote they've sent and its status. Used by mechanics.

- **Main component**: Lists the mechanic's own maintenance requests grouped by status, with a status filter bar (All / Quoted / Info requested / Running / Awaiting return / Completed / Declined / Cancelled). Actions are context-specific per status.
- **Key state/data**: `listMaintenanceRequests()` filtered client-side to `mechanicId === user.id`; single load on mount (no polling).
- **Handlers**:
  - `cancelQuote(jobId)` — withdraw a quote while still "quoted".
  - `completeMaintenance(jobId)` — mark the repair finished (→ pending_return).
  - `provideMaintenanceInfo(jobId, documents, verifiedDetails)` — answer a rental's info request with docs + verified identity.
  - `deleteMaintenanceRequest(jobId)` — permanently remove a declined/cancelled/completed request.

---

### `pages/maintenance-history/`
A mechanic's repairs view — active and completed jobs. Used by mechanics.

- **Main component**: Two sections — **Running** (status running/accepted/pending_return; "Complete work" button on those still in progress, a waiting message once done) and **Completed** (jobs the rental has confirmed returned). Clicking a card opens a detail dialog (vehicle info, description, price, estimate, notes; plus a "Complete work" button if still completable).
- **Key state/data**: `listMaintenanceRequests()` — **polled every 30s**; client-filtered to `mechanicId === user.id` and status in RUNNING_STATES (`running`, `accepted`, `pending_return`) or `completed`. COMPLETABLE_STATES = `running`, `accepted`. No pagination.
- **Handlers**: `completeMaintenance(jobId)` — marks the repair finished (→ pending_return; notifies the rental to confirm the return).

---

### `pages/live-map/`
Real-time GPS map. Rental staff/admins watch their fleet's live positions; drivers report and see their own location. Used by rental/admin (fleet view) and drivers (own location).

- **Main component**: A Leaflet map (OpenStreetMap tiles) centered on tracked vehicles. Two live data sources: an HTTP poll every 30s (`fetchTrackedLocations()` → vehicles with last-known position + `stale` flag) and, per vehicle, a WebSocket (`createTrackingSocket(vehicleId, { onPosition })`) that pushes live GPS updates (overriding the polled position).
- **Markers**: green car pin = actively rented with live GPS; amber car pin = stale (position hasn't updated recently); blue marker = the driver's own device location. Click a marker for a popup (vehicle label, driver name, last update, stale warning).
- **Key state/data**: `gpsStatus` (idle / prompt / loading / live / denied / lost / disabled / insecure); tracked-locations list; live positions from the sockets.
- **Handlers / behavior**:
  - `requestLocation()` — asks the browser for geolocation (drivers), then `watchPosition()` (high accuracy); handles denial/errors with status messages.
  - Map centers on the driver's position if known, else defaults to Perth, WA. When the set of tracked vehicles changes the map auto-fits bounds, but live position updates do **not** re-pan (so the user's manual panning isn't interrupted).
  - Access: drivers only request/see their own location; rental/admin see fleet vehicles immediately with a legend explaining the green car markers.

---

### `pages/distance-summary/`
Aggregate distance/trips stats (currently a placeholder). Used by drivers/rental staff.

- **Main component**: Renders four states — loading (skeletons), error (with a retry button), empty (no data), and data (two stat cards: "Total distance (km)" and "Trips"). Transitions animate with framer-motion.
- **Key state/data**: `fetchSummary()` — currently a stub resolving to `{ totalKm: 0, trips: 0 }` (no real backend endpoint yet); loaded on mount with cancellation support.
- **Handlers**: "Retry" reloads the data. i18n keys drive title/subtitle/empty/error text.

---


---

# Frontend — Components (Reusable UI)

This documents every reusable component under `frontend/src/components/`, grouped by subfolder. These are the shared building blocks (buttons, dialogs, forms, layout, dashboards, onboarding steps, etc.) used across the "Wheels of Australia" app. Most are thin, styled wrappers around Material-UI (MUI) with framer-motion animations pulled from `lib/animations`.

---

## Animated

Small wrappers that add framer-motion enter/exit animations to plain content.

### `components/Animated/AnimatedCard.tsx`
An MUI Card that fades/slides in using the shared `cardVariants` animation.
- Props: `title` — heading text; `subtitle` — small text under the title; `actions` — buttons shown at the card bottom; `elevation` — MUI shadow depth (default 2); `children` — card body; `className` — extra CSS class.

### `components/Animated/AnimatedList.tsx`
A `<ul>`/`<ol>` that staggers its children in one after another; ships with a matching item component.
- `AnimatedList` props: `component` — `'ul'` or `'ol'` (default `ul`); `children`; `className`; `style`.
- `AnimatedListItem` (named export) props: `children`; `className`; `style` — a single `<li>` that animates in/out; place inside `AnimatedList`.

### `components/Animated/AnimatedModal.tsx`
A full-featured animated MUI Dialog with title, subtitle, close button, and Confirm/Cancel actions.
- Props: `title`, `subtitle`, `closable` (show X button, default true), `onClose`, `onConfirm`, `onCancel`, `confirmText`/`cancelText`, `confirmColor`, `loading` (disables buttons + spinner), `showActions`, `customActions` (replace default buttons), `dividers` (default true) plus all MUI Dialog props.
- `DialogTransition` — internal forwardRef component that runs the modal's motion animation as the dialog's transition.
- `handleClose` — calls `onClose` only when not `loading`.
- `handleCancel` — runs `onCancel` then `onClose` (blocked while loading).

### `components/Animated/AnimatedPage.tsx`
Wraps a whole page in the shared page enter/exit animation; use for standalone pages outside the route layout.
- Props: `children`; `className`; `style`.

### `components/Animated/index.ts`
Barrel file re-exporting the four components above and their prop types.

---

## Auth

Login/registration UI and identity-verification building blocks.

### `components/Auth/AuthPageLayout/AuthPageLayout.tsx`
The centered white "card" layout every auth screen (login, signup, success) sits on. Always renders in the light theme so text is readable even in dark mode, over a solid primary-colour background.
- Props: `children` — form/content; `header` — branded banner pinned to the top; `icon` — circular icon above the title; `title`/`subtitle`; `maxWidth` (default 450); `fixedCardHeight` — when true, card is capped to the viewport and content scrolls inside (used by signup); `footer` — content pinned to the card bottom (only when `fixedCardHeight`).
- `hexToRgba` — helper turning a hex colour + alpha into an `rgba()` string (used for the icon glow).

### `components/Auth/BrandHeader/BrandHeader.tsx`
The gradient "Wheels of Australia" banner with car icon shown at the top of login/registration cards.
- Props: `subtitle` — small tagline line (default "Car Rental Digital Platform").

### `components/Auth/DocumentUploadZone/DocumentUploadZone.tsx`
A drag-and-drop / click file upload area with idle, uploading (progress bar), success, and error states.
- Props: `accept` (default `image/*,.pdf`); `maxSizeMb` (default 10); `onFileSelect` — async callback given the chosen file; `status`/`progress` — optional controlled state; `errorMessage`; `disabled`.
- `handleFile` — validates size, then simulates progress while awaiting `onFileSelect`, switching to success or error.
- `handleDrop` / `handleDragOver` / `handleDragLeave` — manage the drag highlight and pass the dropped file to `handleFile`.
- `handleInputChange` — handles the hidden `<input type=file>` selection and clears its value so the same file can be re-picked.
- Note: uses a fixed element id, so only one can exist per page (use `RegistrationFileInput` for multiple).

### `components/Auth/FaceVerification/FaceVerificationCapture.tsx`
Shows a live webcam circle (via `react-webcam`) and a Capture button for a selfie verification step.
- Props: `onCapture` — called when the user captures; `loading`; `preview` — optional custom preview node instead of the built-in webcam.
- `handleUserMedia` — marks the camera ready once the stream starts.
- `handleUserMediaError` — turns raw camera errors into friendly messages (permission denied, no camera, HTTPS needed); if camera fails, the flow can still continue with a simulated capture.

### `components/Auth/FaceVerification/FaceVerificationConsent.tsx`
Consent screen requiring the user to tick a biometric-consent checkbox before continuing.
- Props: `onConsent` — called when they agree; `loading`; `consentText` and `checkboxLabel` — overridable copy.
- Internal state `agreed` gates the "I agree, continue" button.

### `components/Auth/FaceVerification/FaceVerificationResult.tsx`
The outcome screen for face verification — either a "try again" prompt or an "account locked" message.
- Props: `type` — `'retry'` or `'lock'`; `attemptCount`/`maxAttempts` — show remaining tries; `onRetry`; `lockMessage` — text shown on lock.

### `components/Auth/Login/Login.tsx`
The full login page: email + password fields (with show/hide toggle) inside `AuthPageLayout`, plus role sign-up links.
- `handleInputChange` — updates the `email`/`password` form state.
- `handleSubmit` — calls `login()`, shows a toast, then computes where to redirect: it uses the `from` route only if the user's role (and, for rental staff, their granted nav paths) may access it, otherwise the role's default landing page.

### `components/Auth/OtpInput/OTPInput.tsx`
A one-time-password entry field (single accessible input styled for spaced digits).
- Props: `length` (default 6); `value`/`onChange` — controlled string; `onComplete` — fires when all digits entered; `error`; `disabled`; `digitsOnly` (default true).
- `handleChange` — strips spaces/non-digits, caps at `length`, and fires `onComplete` when full.
- `handleKeyDown` — Backspace deletes the last digit.

### `components/Auth/Register/Register.tsx`
The driver self-registration form (name, email, phone, licence number, ID document upload) with client-side validation and a success screen.
- `SignInLink` — small internal component: "Already have an account? Sign in".
- `handleChange` — updates the form and clears that field's error.
- `validate` — checks required fields, email format, phone length, and that a document was attached.
- `handleSubmit` — on valid input, calls `registrationApi.submit()` with the details + document (keyed by the chosen doc type); on field errors, maps them back onto the form; on success, shows the "awaiting admin approval" screen.

### `components/Auth/RegistrationFileInput/RegistrationFileInput.tsx`
A compact single-file picker for registration forms; unlike `DocumentUploadZone`, it makes a unique input id so several can coexist on one form.
- Props: `label`; `accept` (default `image/*,.pdf`); `maxSizeMb` (default 10); `required`; `value` — currently selected File (controlled); `onSelect`; `error` — external error message.
- `handleChange` — reads the picked file, enforces the size limit (own error), then calls `onSelect`.

---

## Common

The main library of shared UI widgets. Most are styled MUI wrappers.

### `components/Common/Alert/index.tsx`
A styled MUI Alert that can optionally be closable, collapsible, and carry a title/custom actions.
- Props: `title`; `closable`; `collapsible`; `defaultExpanded`; `onClose`; `actions`; plus MUI `severity`/`variant`.
- `handleClose` — hides the alert and calls `onClose`.
- `handleToggleExpand` — expands/collapses the body when `collapsible`.

### `components/Common/Breadcrumbs/index.tsx`
A breadcrumb trail; last item is plain text, earlier items are clickable links, with an optional leading Home crumb.
- Props: `items` — array of `{ label, href?, icon?, onClick? }`; `showHome`; `homeHref`; `homeLabel`; `maxItems`.
- `handleClick` — prevents default, then runs the item's `onClick` or navigates to its `href`.

### `components/Common/Button/index.tsx`
The app's standard button — an MUI Button that shows a spinner and disables itself when `loading`.
- Props: `variant`; `color`; `size`; `disabled`; `loading` (spinner + disabled); `onClick`; `type`; `fullWidth`; `startIcon`/`endIcon`; `sx`.

### `components/Common/Card/index.tsx`
A plain (non-animated) MUI Card with optional header title/subtitle and footer actions.
- Props: `title`; `subtitle`; `actions`; `elevation` (default 2); `children`; `className`.

### `components/Common/Checkbox/index.tsx`
An MUI Checkbox with an optional label, description line, and helper/error text.
- Props: `label`; `helperText`; `error`; `description`; `onChange(checked, event)`; plus MUI checkbox props.
- `handleChange` — passes the new checked boolean (and event) up through `onChange`.

### `components/Common/Container/index.tsx`
An MUI Container with convenience props for centering and simple styling.
- Props: `centered` — vertically/horizontally centre children; `minHeight`; `padding`; `background`; `shadow`; `rounded`; plus MUI container props (`maxWidth` default `lg`).

### `components/Common/DatePicker/index.tsx`
A date picker (wraps `react-datepicker`) rendered inside an MUI TextField, with a calendar icon and clear button.
- Props: `label`; `value`/`onChange(date|null)`; `error`/`helperText`; `disabled`; `clearable`; `placeholder`; `minDate`/`maxDate`; `fullWidth`; `size`; `variant`; `format` (default `MM/dd/yyyy`); `inline` — show the calendar always-open below the field (use inside modals to avoid clipping).
- `handleClear` — clears the selected date.
- `CustomInput` — the TextField shown as the picker's trigger (popover mode).
- `HiddenInput` — an invisible input used in `inline` mode so the library has a target while the visible field is shown separately.

### `components/Common/DetailFields.tsx`
Two tiny helpers for detail popups. `SectionTitle` — an overline-style section heading. `Field` — a labelled value row that shows an em-dash when the value is empty.

### `components/Common/Dialog/index.tsx`
A non-animated modal dialog with title/subtitle, close button, and Confirm/Cancel actions (same API shape as `AnimatedModal`).
- Props: `title`; `subtitle`; `closable`; `onClose`/`onConfirm`/`onCancel`; `confirmText`/`cancelText`; `confirmColor`; `loading`; `showActions`; `customActions`; `dividers`; plus MUI Dialog props.
- `handleClose`/`handleCancel`/`handleConfirm` — all no-op while `loading`; cancel also closes.

### `components/Common/Divider/index.tsx`
An MUI Divider with optional centered label text and configurable spacing/colour/thickness.
- Props: `label` — centers text between two lines; `spacing`; `color`; `thickness`; plus MUI `orientation`/`variant`.

### `components/Common/DocumentPreview/index.tsx`
Shows one uploaded document as a compact clickable row (icon + label + filename + "Open"); opens the file in a new tab.
- Props: `doc` — a `RegistrationDocument` (`doc_type_display`, `original_name`, `file_url`). When there's no file, it renders as a non-clickable row.

### `components/Common/EmptyState/index.tsx`
A friendly "nothing here" placeholder with icon, title, description, and an optional action button.
- Props: `title`/`description`/`icon` (all default from `type`); `action` — `{ label, onClick, variant?, color? }`; `type` — `'empty'|'search'|'error'` (picks default icon/text); `size`.
- `getDefaultIcon`/`getDefaultTitle`/`getDefaultDescription` — supply defaults based on `type`.
- `getIconSize`/`getPadding` — scale by `size`.

### `components/Common/LanguageSelector/index.tsx`
A dropdown to switch the app language via i18next (currently English only; others commented out).
- `handleLanguageChange` — calls `i18n.changeLanguage(...)` with the picked code.

### `components/Common/Loading/index.tsx`
A flexible loading indicator: spinner, linear bar, or skeleton rows, optionally full-screen with an overlay.
- Props: `type` — `'circular'|'linear'|'skeleton'`; `size`; `text`; `fullScreen`; `overlay`; `rows`/`height` (skeleton only).
- `getSize` — maps small/medium/large to pixel sizes.
- `renderLoading` — renders the chosen indicator variant.

### `components/Common/NavigationLoader/NavigationLoader.tsx`
A full-screen branded loading splash (app name + animated concentric rings + "Loading…" dots) shown during navigation/route loading. No props.

### `components/Common/PageHero/index.tsx`
The shared page header: a full-width primary→secondary gradient banner with title/subtitle/actions, followed by the page body tucked just under it. Used on every main list/content page.
- Props: `title`; `subtitle`; `actions` — right-side node (e.g. a button); `children` — page body; `disableContentGutter` — remove the body's horizontal padding.

### `components/Common/Pagination/index.tsx`
A pagination bar with page buttons, a "showing X–Y of Z" info line, and a rows-per-page selector.
- Props: `currentPage`; `totalPages`; `totalItems`; `pageSize`; `pageSizeOptions` (default `[5,10,25,50]`); `showPageSizeSelector`; `showInfo`; `onChange(page, pageSize?)`; `onPageSizeChange(size)`; plus MUI pagination styling props.
- `handlePageChange` — reports the new page.
- `handlePageSizeChange` — reports the new size and resets to page 1.
- Exports `DEFAULT_PAGE_SIZE_OPTIONS`.

### `components/Common/Paper/index.tsx`
An MUI Paper "panel" with an optional header (title/subtitle/action) and divider, plus padding controls.
- Props: `title`; `subtitle`; `padding` (default 3); `noPadding`; `bordered`; `headerAction`; `showDivider`; `elevation`; plus MUI Paper props.

### `components/Common/PasswordField/index.tsx`
A drop-in password TextField with a built-in show/hide (eye) toggle and optional leading lock icon.
- Props: `showLockIcon` (default true); plus all MUI TextField props. Internal `show` state toggles the input type.

### `components/Common/PhoneNumberInput/index.tsx`
A phone-number field with a country-code dropdown (flag + dial code) attached to its left. Controlled — the parent owns both the country and the number.
- Props: `countryIso`/`onCountryChange`; `phone`/`onChange` (standard event); `name`; `label`; `required`; `error`/`helperText`; `placeholder`; `sx`.
- `sanitizePhone` — keeps digits only, strips a typed `+` and any re-typed dial code, caps at `PHONE_MAX_DIGITS`.
- `isValidPhoneNumber` (exported) — true when 8–11 digits.
- `handleCountry`/`handlePhone` — update country and cleaned phone value.
- Also exports `PHONE_MIN_DIGITS`, `PHONE_MAX_DIGITS`, `PHONE_LENGTH_ERROR`.

### `components/Common/Select/index.tsx`
A styled MUI Select taking an options array, supporting single/multiple selection (chips for multi), a placeholder, icons, and a loading spinner.
- Props: `label`; `options` — `{ value, label, disabled?, icon? }[]`; `value`; `onChange(value)`; `helperText`; `loading`; `multiple`; `placeholder`; `startIcon`; plus MUI select props.
- `handleChange` — passes the selected value(s) up.
- `renderValue` — renders the placeholder, chips (multi), or the single option's icon+label.

### `components/Common/Table/index.tsx`
A generic, typed data table (`DataTable<T>`) driven by a columns config, with optional row click, sticky header, and per-row highlight-flash support.
- Props: `columns` — `{ id, label, width?, align?, render(row) }[]`; `data`; `getRowId(row)`; `onRowClick(row)`; `size`; `minWidth`; `stickyHeader`; `rowSx(row)`; `containerSx`; `highlightId` — row id to briefly flash (e.g. opened from a notification, uses `recordHighlight`).

### `components/Common/Tabs/index.tsx`
A styled MUI Tabs bar built from a tabs config, supporting icons and numeric/text badges.
- Props: `tabs` — `{ label, value, icon?, disabled?, badge?, badgeColor? }[]`; `value`/`onChange(value)`; `fullWidth`; `centered`; `scrollable`; plus MUI tabs props.
- `handleChange` — reports the newly selected tab value.

### `components/Common/TextField/index.tsx`
An enhanced MUI TextField with start/end icons, a help tooltip icon, and an optional password show/hide toggle.
- Props: `variant`; `showPasswordToggle`; `helpText` — tooltip on a help icon; `startIcon`/`endIcon`; plus MUI TextField props.
- `handleTogglePassword` — flips password visibility.
- `endAdornment` (memoised) — assembles the help icon, custom end icon, and password toggle into the end adornment.

### `components/Common/Toast/index.tsx`
The `ToastProvider` — app-wide snackbar/toast system. Wrap the app; children call the toast hook to show messages.
- `showToast(message, severity)` plus `showSuccess`/`showError`/`showWarning`/`showInfo` — open a top-centered snackbar; each accepts a string or an error object.
- `hideToast` — closes it.
- `formatMessage` — turns various API error shapes (a `message` field, `non_field_errors`, `errors` map, field-keyed arrays, or raw objects) into a readable string.

### `components/Common/Toast/ToastContext.ts`
Defines `ToastContext` and the `ToastContextType` interface (the five `show*` functions). No UI.

### `components/Common/Toast/useToast.ts`
The `useToast()` hook — returns the toast functions; throws if used outside a `ToastProvider`.

---

## Dashboard

Role-specific dashboard pages (stat cards + charts + recent-activity feeds).

### `components/Dashboard/DashboardView/DashboardView.tsx`
The main dashboard, adapting its content to the logged-in role (driver, rental owner/staff, or admin/fallback). Shows a welcome hero, clickable stat cards, trend/status charts, and a live recent-activity feed. Data auto-refreshes every 30s and immediately on new notifications; rental staff only see sections they're granted.
- `statusColor`/`timeAgo` — map a status to a chip colour, and format a relative time.
- `LiveBadge` — a small pulsing "Live" indicator signalling auto-refresh.
- `ChartEmptyState` — placeholder shown when a chart has no data.
- Effects fetch fleet, incoming requests, and maintenance (rental); staff count (main rental owner); the driver's own requests/trips; and the count of active rental providers (driver).
- Memoised values compute counts (maintenance, pending requests, rented vehicles), the vehicles-by-status and requests/trips-by-month chart data, the recent-activity list, and the stat-card set per role.
- `activityRowHref`/`rentalRequestsHref` — build deep-links (with `?status=` and `?highlight=`) so clicking a row/card opens the destination page pre-filtered and flashing that record.

### `components/Dashboard/MechanicDashboard.tsx`
The mechanic's dashboard: stat cards (vehicles repaired, active rentals to quote, pending requests, notifications), a "repairs per month" bar chart, a "my requests by status" chart, and a live recent-maintenance-jobs feed. Polls maintenance data every 30s.
- `statusColor`/`timeAgo`/`LiveBadge` — same helpers as above (chip colour, relative time, live indicator).
- Memoised values compute completed repairs, distinct active rentals with pending jobs, pending quotes, the 5 most recent jobs, repairs bucketed over the last 6 months, and the mechanic's own quotes grouped by status.
- Each stat card / chart row navigates to the relevant maintenance route.

---

## Home

### `components/Home/HomeView/HomeView.tsx`
A generic starter/demo landing view (feature cards for Dashboard/Settings/Analytics + a "Get Started" section). Appears to be boilerplate template content, built from the shared `Card`/`Button`. No props.

---

## Landing

### `components/Landing/LandingPage.tsx`
The public marketing landing page: sticky header with a Register dropdown, a gradient hero, Features grid, Roles grid (with per-role sign-up buttons), an About/CTA band, and a footer. Always renders in the light auth theme.
- `FEATURES`/`ROLES` — static content arrays for the feature cards and role cards.
- `openRegister`/`closeRegister`/`goRegister` — open/close the Register menu and navigate to the chosen sign-up route.
- `scrollTo` — smooth-scrolls to an in-page section (Features/Roles/About).
- `registerMenu` — the Driver/Rental/Mechanic sign-up dropdown.
- `FooterCol` — internal component rendering one footer column of link buttons.

---

## Layout

The authenticated app shell (sidebar + top navbar + scrolling content).

### `components/Layout/Layout.tsx`
The overall app frame: a sidebar (permanent on desktop, temporary drawer on mobile) plus a sticky navbar and a single scrolling content area. Suspended non-admin users get no navigation at all (locked to their profile).
- Props: `children` — the routed page.
- `handleDrawerToggle`/`handleDrawerClose` — open/close the mobile drawer.
- `handleSidebarToggle` — collapse/expand the desktop sidebar (280px vs 64px).
- An effect scrolls the content back to top on route change.

### `components/Layout/Navbar/index.tsx`
The sticky top bar: sidebar/menu toggle buttons, a notifications bell (with unread badge + `NotificationCentre` popover), and a user avatar menu with logout.
- Props: `onMenuClick`; `showMenuButton`; `onSidebarToggle`.
- `handleProfileMenuOpen`/`handleMenuClose` — open/close the avatar menu.
- `handleLogout` — logs out and navigates to login.
- The bell only shows if the user may use notifications; opening a notification deep-links to its record (role-aware) or falls back to the notifications page.

### `components/Layout/Sidebar/index.tsx`
The navigation drawer: brand/logo header, the role-filtered nav items list, and a footer; supports permanent/temporary variants and a collapsed (icon-only) mode.
- Props: `open`; `onClose`; `variant` — `'permanent'|'temporary'`; `width`; `collapsed`.
- `ICON_MAP` — maps nav-item icon names to MUI icon components.
- `visibleItems` (memo) — the nav items the current user's role/grants allow (via `getVisibleNavItems`).
- `activePath` (memo) — picks the single most-specific matching nav path to highlight.
- `handleNavigation` — navigates and (on mobile/temporary) closes the drawer.

---

## Notifications

### `components/Notifications/NotificationCentre.tsx`
The bell dropdown (Popover) listing the last 24 hours of notifications, with per-item icon/colour, unread highlighting, "mark all read", and "view all".
- Props: `anchorEl`/`open`/`onClose` — popover control; `notifications`; `unreadCount`; `onMarkAsRead(id)`; `onMarkAllAsRead`; `onViewAll`; `onOpenNotification(n)` — receives the whole notification so the parent can resolve a role-aware destination.
- `recent` — filters notifications to the last day; clicking an item marks it read, closes the popover, and opens it.

### `components/Notifications/notificationDisplay.tsx`
Shared display maps/helpers for notifications (used by the bell and the notifications page).
- `NOTIFICATION_ICON_MAP` — icon per notification type. `NOTIFICATION_COLOR_MAP` — accent colour per type.
- `relativeTime(iso)` — "just now / N min ago / N hr ago / N days ago", or a date past 30 days.

### `components/Notifications/recordHighlight.ts`
The "flash the record a notification points at" utility used by list/table pages.
- `HIGHLIGHT_ATTR` — the data attribute stamped on the highlighted DOM node.
- `highlightAttrProps(active)` — spreads that attribute onto an element when it's the target.
- `highlightSx` — the temporary pulsing ring/tint animation (an MUI `sx` value).
- `useHighlightTarget(ready)` — reads the `?highlight=<id>` URL param and, once data is loaded, flashes the matching row/card and scrolls it into view; returns `{ highlightId, activeId, isHighlighted(id) }`.

---

## Onboarding

A generic step wizard plus the individual driver-onboarding steps.

### `components/Onboarding/OnboardingWizard/OnboardingWizard.tsx`
A reusable multi-step wizard: an MUI Stepper header, animated step transitions, and Back/Next (Cancel/Finish at the ends).
- Props: `steps` — `{ id, label, render(ctx) }[]` where `ctx` gives each step `onNext`/`onBack`; `onComplete`; `onCancel`.
- `handleNext` — advances, or calls `onComplete` on the last step.
- `handleBack` — goes back, or calls `onCancel` from the first step.

### `components/Onboarding/steps/StepDocumentUpload.tsx`
Onboarding step: upload an ID document via `DocumentUploadZone`, then show a "click Next" hint.
- Props: `onNext`; `onDocumentUploaded(file)`.
- `handleFileSelect` — reports the file up and marks it uploaded.

### `components/Onboarding/steps/StepFaceVerification.tsx`
Onboarding step orchestrating the face-verification flow through phases: consent → capture → retry/lock. Uses the three `FaceVerification` components; locks after 3 attempts.
- `handleConsent`/`handleCapture`/`handleRetry` — advance between phases and track the attempt count.

### `components/Onboarding/steps/StepOCRReview.tsx`
Onboarding step: editable form of details extracted from the uploaded document (name, DOB, document number, expiry, nationality).
- Props: `onNext`; `initialData` (OCR pre-fill); `onDataChange(data)`.
- `handleChange(field)` — updates one field and reports the whole object up.

### `components/Onboarding/steps/StepOTP.tsx`
Onboarding step: enter the OTP code (via `OTPInput`) and verify.
- Props: `onNext`; `message` — where the code was sent; `length` (default 6).
- `handleComplete` — stores the entered code and clears the error.
- `handleVerify` — errors if incomplete, otherwise calls `onNext`.

### `components/Onboarding/steps/StepWelcome.tsx`
Onboarding step: a welcome screen explaining the process with a "Get started" button.
- Props: `onNext`.

---

## Requests

### `components/Requests/IdentityVerification.tsx`
Identity-verification block shown before submitting a request: upload one of passport / CNIC / driving licence, run OCR to read the details, let the user check/correct them, and require a confirmation checkbox. Uploading a new document replaces the previous one.
- Props: `value` — the current `VerificationResult` (`documents`, `details`, `confirmed`); `onChange(next)`; `title` — heading override.
- `handleFile(docType, file)` — reads the file to a data URL, runs OCR (`readDocument`), fills the detail fields, and shows a warning if OCR failed, the file doesn't look like an ID, or the detected type doesn't match the chosen slot.
- `setDetail(field, value)` — edits one detail field and un-confirms.
- Exports helpers `emptyVerification()` and `isVerificationComplete(v)` (needs ≥1 document and `confirmed`).


---

# Frontend — App Infrastructure (Context, Hooks, Routing, Lib, Constants, Utils)

This section covers the "plumbing" of the React app: how login state is held, how the app talks to the server, how pages are protected by role, animations, translations, and shared helpers.

---

## Entry points

### `src/main.tsx`
The very first file the browser runs. It finds the `<div id="root">` in the HTML and renders the whole `<App />` inside React's `StrictMode`. It also imports the global CSS and `./i18n` (which starts the translation system).

### `src/App.tsx`
Builds the "provider stack" — the nested wrappers that give every page access to shared features. From outside in: `QueryClientProvider` (data caching) → `BrandingProvider` (theme/colors) → `BrowserRouter` (URL routing) → `AuthProvider` (who is logged in) → `LocationTrackingProvider` (driver GPS) → `NotificationProvider` (bell/alerts) → `ToastProvider` (pop-up messages) → the actual pages via `<AppRoutes />`.
- `GlobalToastSetup` — a tiny helper component that hands the toast function to the API client (`setGlobalToast`) so network errors can show pop-ups even though the API code lives outside React.

---

## Contexts (shared state)

A "context" is a box of data any component can read without passing it down manually. Each context has a Provider (puts data in) and a hook (reads it out).

### `src/context/AuthContext.tsx`
Holds "who is logged in" for the whole app.
- `AuthProvider` — wraps the app and exposes: `user`, `isAuthenticated`, `loading`, `error`, and the actions `login(email, password)`, `register(data)`, and `logout()`. Internally it just adapts the real logic from the `useAuth` hook (below) into a stable shape.
- `AuthContextType` — the TypeScript description of what the context provides.
- Note: the actual login/logout logic lives in `hooks/auth/useAuth.ts`; this file is the context wrapper around it.

### `src/context/hooks/useAuth.ts`
- `useAuth()` — the hook components call to read auth state. It reads `AuthContext` and throws a clear error if used outside `AuthProvider`. (This is the one pages import to get `user`, `login`, `logout`, etc.)

### `src/context/BrandingContext.tsx`
Controls the app's look (light/dark mode, primary/secondary colors, logo). The theme is a **global** setting the admin configures; the server is the source of truth.
- `BrandingState` — the shape: `mode` ('light'/'dark'), `primaryColor`, `secondaryColor`, `logoUrl`.
- `loadBranding()` / `saveBranding()` — read/write a local cache (`localStorage`) so the app paints instantly before the server value arrives.
- `BrandingProvider` — on startup loads the global branding from the server (`getBranding`) and applies it; builds the actual MUI theme with `createAppTheme`; wraps children in MUI's `ThemeProvider`.
- Setters `setMode`, `setPrimaryColor`, `setSecondaryColor`, `setLogoUrl`, `resetBranding` — update the look immediately (optimistic) and **debounce** saving to the server (`schedulePersist`, ~500ms after the last change) so dragging a color picker doesn't spam the backend. Only admins can actually save (backend enforces it).
- `useBranding()` — hook to read/update branding from any component.

### `src/context/NotificationContext.tsx`
Holds the user's notifications (the bell). 
- `NotificationProvider` — loads notifications for the signed-in user and keeps them fresh.
  - `refresh()` — first asks the backend to generate any "due" reminders (drivers/rentals/mechanics each have their own sync call), then fetches the notification list. Skips everything for signed-out, suspended, or ungranted-staff users (so no needless errors).
  - Polls every 30 seconds so the bell stays current without a reload.
  - `markAsRead(id)`, `markAllAsRead()`, `deleteNotification(id)` — update the screen instantly (optimistic) and tell the backend; if the backend call fails, the optimistic change stays.
  - `unreadCount` — how many are unread (drives the red badge).
  - `latestNotificationId` — the id of the newest notification; admin pages watch this to auto-refresh their data when something changes.
- `useNotifications()` — hook to read all of the above.

### `src/context/LocationTrackingContext.tsx`
Runs the driver's live GPS reporting in the background (only for signed-in, non-suspended drivers with an active trip).
- `LocationTrackingProvider` — watches for an active running trip (`listMyRequests`, re-checked every 60s); while one exists it reads the device GPS (`navigator.geolocation.watchPosition`).
  - Opens a live WebSocket for the trip's vehicle and pushes the position over it (fast, ~every 3s); if the socket isn't open it falls back to the throttled HTTP report (~45s) so tracking never fully breaks.
  - Shows a banner if the driver blocks location (with a strike warning) or if the site isn't on a secure (HTTPS) connection.
  - Does nothing for non-drivers or signed-out users.

---

## Hooks (reusable logic)

### `src/hooks/auth/useAuth.ts`
The real authentication engine (used by `AuthContext`). Built on React Query.
- Keeps `user` in state, seeded from the cached profile (`sessionUtils.getUser()`).
- On mount: loads the cached user, then re-checks with the backend (`authApi.me()`) so status changes made after login (e.g. an admin suspending the account, or a GPS auto-suspension) take effect on the next load.
- Listens for session changes made outside React — another tab logging out, the API client clearing an expired token, tab focus/visibility — and re-syncs `user` so a guarded page redirects to login instead of showing stale content.
- `loginMutation` → calls `authApi.login`; on success caches the user (tokens are set as HttpOnly cookies by the backend, never stored in JS).
- `registerMutation` → intentionally throws (self-signup is approval-based via the registration pages, not this hook).
- `logoutMutation` → clears the local session, clears the React Query cache, and redirects to `/login` (best-effort backend logout too).
- Returns `user`, `isAuthenticated`, loading/error flags, and `login`/`register`/`logout` actions.

### `src/hooks/common/useGenericMutation.ts`
- `useGenericMutation({...})` — a reusable wrapper around React Query's `useMutation` for create/update/delete calls. It auto-invalidates the query keys you list (so lists refresh), shows a success toast, shows an error toast (optional), and runs optional success/error callbacks. Cuts repetitive code in the CRUD pages.

### `src/hooks/useAutoRefresh.ts`
- `useAutoRefresh(reload)` — keeps a page's data in sync without a manual reload. It calls your `reload` function on a 25-second timer AND immediately whenever a new notification arrives (a hint that something changed). Used mainly by admin pages. It tracks `reload` via a ref so the timer doesn't reset each render.

### `src/hooks/useReducedMotion.ts`
- `useReducedMotion()` — returns `true` if the user's system/browser is set to "reduce motion." Used to shorten or turn off animations for accessibility.

### `src/hooks/useTranslate.ts`
- `useTranslate()` — a friendlier wrapper over `react-i18next`'s `useTranslation`. Returns `t` (translate function), the current language, `changeLanguage(lng)`, and a loading flag.

### Index files (`src/hooks/index.ts`, `hooks/auth/index.ts`, `hooks/api/index.ts`, `context/hooks/index.ts`)
Simple re-export "barrels" so other files can import from a folder path instead of a deep file path. No logic of their own.

---

## Routing (which page shows for which URL, and who's allowed)

### `src/routes/components/AppRoutes.tsx`
The master list of every URL → page mapping.
- Shows a "Loading…" screen while auth state is being determined.
- Wraps all routes in `AnimatedPageLayout` (page transitions).
- Root `/`: shows the public landing page for visitors; signed-in users are redirected to their dashboard (or to OTP verification if a phone check is pending).
- Login/Register are wrapped in `PublicRoute` (only for signed-out users).
- Every app page is wrapped in `ProtectedRoute`; role-specific pages pass `requiredRole` (e.g. `driver`, `mechanic`, `rental`, `admin`).
- Includes an old-route redirect (`/auth/login` → `/login`), a 404 page, and a catch-all that sends unknown URLs to `/404`.

### `src/routes/guards/ProtectedRoute.tsx`
- `ProtectedRoute` — gate for signed-in pages. Rules, in order:
  1. While auth loads → show "Loading…".
  2. Not signed in → redirect to `/login` (remembering where they came from).
  3. Suspended (non-admin) → force them to `/profile` (which shows the suspension reason).
  4. `requiredRole` set and the user isn't that role (admins always pass) → show the "No access" page.
  5. Rental **staff**: even if a section is hidden in the menu, block reaching it by typing the URL unless it's in their granted paths (`isStaffPathAllowed`).
  - Otherwise renders the page, normally inside the app `Layout` (or bare when `noLayout` is set, e.g. the OTP screen).

### `src/routes/guards/PublicRoute.tsx`
- `PublicRoute` — gate for pages only signed-out users should see (login/register). If already signed in, it redirects to the dashboard (or to OTP verification when appropriate).

### `src/routes/components/AnimatedPageLayout.tsx`
- `AnimatedPageLayout` — wraps the current page with enter/exit animations (via Framer Motion), and briefly shows a `NavigationLoader` during route changes so there's no blank flash. Respects reduced-motion.

### `src/routes/index.ts`
Barrel that re-exports `AppRoutes` (and related) for clean imports.

---

## Lib (third-party setup)

### `src/lib/api/client.ts`
The single configured `axios` instance every service uses to talk to the backend.
- `API_BASE_URL` — comes from `VITE_API_BASE_URL` (env), with a hardcoded fallback.
- `apiClient` — axios with `withCredentials: true` so the browser automatically sends the HttpOnly login cookies on every request (no manual token header).
- `setGlobalToast(fn)` — lets the app hand in the toast function so this non-React file can show pop-ups.
- Response interceptor:
  - On **401** (and only if there's a cached session): quietly POSTs to `/auth/jwt/refresh/` to get a fresh cookie and replays the original request; if refresh fails → auto-logout. It skips this for the refresh call itself and for anonymous requests, to avoid infinite loops.
  - `handleAutoLogout(msg)` — drops the cached user, shows a message, and redirects to `/login` (unless already there).
  - `handleGlobalErrors(error)` — turns other error codes into friendly toasts (400/422 validation, 403 forbidden, 404 not found, 409 conflict, 429 too many, 5xx server, and "network error" when there's no response). Read-only 403/404s are silenced (pages handle those with empty states); a request can opt out of toasts with `suppressErrorToast: true`.

### `src/lib/react-query/client.ts`
- `queryClient` — the React Query cache config: data is "fresh" for 5 minutes, kept 10 minutes, no retry on 4xx errors (retry others up to 3× with backoff), don't refetch on window focus, do refetch on reconnect; mutations retry once. Re-exports the query keys.

### `src/lib/react-query/queryKeys.ts`
- `queryKeys` — a central factory of cache key arrays (auth, dashboard, and example product/order keys) so caching is consistent.
- `getInvalidationKeys` — helper lists of which caches to refresh after certain updates.

### `src/lib/animations/constants.ts`
- `TRANSITION` — standard durations (fast 0.15s, normal 0.25s, page 0.35s, slow 0.5s).
- `EASING` — standard easing curves (easeOut, easeOutBack, easeInOut).

### `src/lib/animations/variants.ts`
Ready-made Framer Motion animation "variants" used across the app:
- `pageVariants` (route changes), `cardVariants`, `listVariants` + `listItemVariants` (staggered lists), `modalVariants` + `backdropVariants`, `fadeVariants`, `slideUpVariants`.
- `reducedMotionVariants` — near-instant versions used when the user prefers reduced motion.

### `src/lib/animations/index.ts`
Barrel re-exporting the variants and constants.

---

## Constants (fixed data & rules)

### `src/constants/roles.ts`
The four app roles and role helpers.
- `AppRole` — `'admin' | 'driver' | 'rental' | 'mechanic'`.
- `ROLES` — display labels per role.
- `normalizeRole(role)` — lowercases an API role string into a known `AppRole` (or undefined).
- `hasRole(userRole, allowed)` — is the user one of the allowed roles?
- `canAccess(userRole, allowed)` — like `hasRole`, but **admin always passes**.

### `src/constants/nav.ts`
Defines the sidebar and the rental-staff permission rules.
- `NAV_ITEMS` — the flat list of every sidebar destination (path, label key, icon, which roles may see it).
- `ROLE_NAV_ORDER` — the exact menu order shown to each role.
- `GRANTABLE_RENTAL_NAV` — which menu items a rental **owner** may grant to a staff sub-account (excludes owner-only tools and Profile).
- `isStaffPathAllowed(allowedPaths, pathname)` — whether a rental staff member may open a URL (Profile always allowed; staff-management + activity log never; everything else must be granted; a granted parent path also covers its sub-pages).
- `getVisibleNavItems(user, items)` — the menu items a given user actually sees, in order (rental staff get only their granted ones).
- `canUseNotifications(user)` — whether the user may use the bell/notifications (rental staff need the grant; everyone else can).
- `landingPathForUser(user, roleDefault)` — where to send a user after login (rental staff → first granted page, others → their role default).

### `src/constants/routes.ts`
The single source of URL paths.
- `ROUTES` — all path strings, grouped (top-level, `AUTH`, `USER`, `RENTAL`, `ADMIN`) plus edit-base helpers.
- `ROUTE_LABELS` + `getRouteLabel(route)` — human labels for paths.
- `getDefaultRouteForRole(role)` — the default landing route per role (admin → admin dashboard; others → `/dashboard`).
- `requiredRoleForPath(pathname)` / `isPathAllowedForRole(pathname, role)` — decide whether a "return to where you came from" redirect is safe for the user's role (prevents bouncing someone onto an access-denied page).
- `RoutePath` — a TypeScript type of all valid paths.

### `src/constants/rentalStatusFilters.ts`
- `RentalStatusFilter` — the shape of a booking status-filter option.
- `RENTAL_STATUS_FILTERS` — the shared filter list (All, Pending, Info requested, Running [also covers legacy "approved"], Completed, Rejected) used by both the rental dashboard and the requests page so they filter identically.
- `matchesRentalStatusFilter(status, filter)` — whether a booking's status belongs under a chosen filter.

### `src/constants/countryCodes.ts`
A static list of country dial codes (e.g. +61 Australia) used by the phone-number input.

---

## Utils (small helpers)

### `src/utils/session.ts`
- `sessionUtils` — manages the **local** session cache. Important: login tokens are NOT stored here — they live in HttpOnly cookies the browser handles. This only caches the (non-sensitive) user profile so the app can render role-based menus instantly on reload.
  - `setUser` / `getUser` / `removeUser` — store/read/remove the cached user profile.
  - `isAuthenticated()` — true if a cached user exists (the backend is the real authority; an expired cookie causes a 401 → auto-logout).
  - `setPendingPhoneVerification` / `hasPendingPhoneVerification` / `clearPendingPhoneVerification` — track that a just-registered user still needs to verify their phone (so the back button returns them to OTP, not the dashboard).
  - `clearSession()` — wipe local session data (cookies are cleared server-side on logout).
  - `initializeSession()` — return the current cached user + auth flag.

### `src/utils/abn.ts`
Australian Business Number helpers (an ABN is 11 digits).
- `ABN_ERROR` — the standard error message.
- `normalizeAbn(value)` — remove spaces.
- `isValidAbn(value)` — true if exactly 11 digits.

### `src/utils/i18n.ts`
Translation/formatting helpers.
- `getLanguageFromNavigator()` — the browser's language code.
- `getSupportedLanguage(lang)` — clamp to a supported language (currently only `en`).
- `formatTranslationKey(namespace, key)` — build a `namespace.key` string.
- `formatLocalizedDate(date, locale)` / `formatLocalizedDateTime(date, locale)` — nicely formatted date / date-time strings via `Intl.DateTimeFormat`.

### `src/utils/index.ts`
Barrel re-exporting the utils.

---

## i18n (translations)

### `src/i18n/index.ts`
Starts the translation system (`i18next` + `react-i18next`).
- Loads translation JSON at runtime over HTTP from `/public/locales/{lang}/{namespace}.json` (so editing those files changes the text without a rebuild).
- Detects the user's language (localStorage → browser → HTML tag), caches the choice, falls back to English, and currently supports only `en` with the `common` namespace.

---

## Types

### `src/types/index.ts`
Generic, app-wide TypeScript shapes (some are boilerplate/example types): `User`, `AuthState`, `ApiResponse<T>`, `PaginationParams`, `PaginatedResponse<T>`, and base component prop types (`BaseComponentProps`, `ButtonProps`). Note: most real, feature-specific types live under `services/*/types.ts`; this file holds generic ones.

---

## Theme

### `src/assets/styles/theme.ts`
- `ThemeMode` — `'light' | 'dark'`.
- `createAppTheme({ mode, primaryColor, secondaryColor })` — builds the Material-UI theme object (palette, typography, component defaults) from the branding settings. Called by `BrandingProvider` so the whole UI recolors when the admin changes branding.
