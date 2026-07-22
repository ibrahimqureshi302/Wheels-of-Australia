# Backend setup – Wheels of Australia

Get the Django REST API running locally or with Docker.

## Prerequisites

- **Option A (recommended):** Docker and Docker Compose  
- **Option B:** Python 3.12+, PostgreSQL, Redis

## Quick start (Docker)

From the **backend** directory:

```bash
cd backend

# 1. Create environment file from template
make setup-env

# 2. (Optional) Edit .env and set at least:
#    - SECRET_KEY (e.g. run: python -c "import secrets; print(secrets.token_urlsafe(50))")
#    - CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# 3. Build and start services (web, db, redis, celery)
make build
make dev

# 4. If you see "database backend_dev does not exist", create it (db container must be running):
make create-db

# 5. Run migrations (first time or after pulling new migrations)
make migrate

# 6. Create an admin user to log in with
make createsuperuser
```

API base URL: **http://localhost:8000/api**

- Health: http://localhost:8000/api/health/
- Swagger: http://localhost:8000/api/docs/
- Auth: http://localhost:8000/api/auth/login/

## Create an admin user (optional)

```bash
make createsuperuser
```

Use the email/password you set when connecting from the frontend or Swagger.

## Connect the frontend

In the **frontend** project set the API base URL:

```bash
# .env or .env.local in frontend
VITE_API_BASE_URL=http://localhost:8000/api
```

Then run the frontend (`npm run dev`). Login uses the backend API; sign in with the superuser you created above, or add accounts via Django admin.

## Local run (no Docker)

1. Create a Python virtualenv and install deps:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Copy and edit env:

   ```bash
   cp env.example .env
   # Set DJANGO_ENV=local
   # Set DB_* for local PostgreSQL and CELERY_* for local Redis (or disable Celery)
   ```

3. Run migrations and server:

   ```bash
   export DJANGO_SETTINGS_MODULE=core.settings
   python manage.py migrate
   python manage.py runserver
   ```

API: http://localhost:8000/api

## Useful commands

| Command            | Description                    |
|--------------------|--------------------------------|
| `make dev`         | Start dev stack (Docker)      |
| `make down`        | Stop all services             |
| `make logs`        | Follow logs                   |
| `make migrate`     | Apply migrations              |
| `make makemigrations` | Create migrations          |
| `make shell`       | Django shell                  |
| `make test`        | Run tests                     |

## Troubleshooting

**Error: `database "backend_dev" does not exist`**

The PostgreSQL container may have been first started without `POSTGRES_DB=backend_dev`, so the database was never created. With the **db** container running, from the **backend** directory run:

```bash
make create-db
```

Then run `make migrate` and restart your services if needed.

## Auth and frontend alignment

- Backend exposes: `POST /api/auth/login/`, `POST /api/auth/register/`, `POST /api/auth/jwt/refresh/`, etc.
- Login response: `{ user, access, refresh }` with `user` containing `id`, `email`, `first_name`, `last_name`, `full_name`, `role`, `role_display`, `date_joined`, `is_active`, `phone_number`, `allowed_nav_paths` (for rental staff menu).
- Roles: admin, driver, rental, mechanic. Create accounts via `make createsuperuser` or the Django admin.
