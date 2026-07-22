"""
DRY settings loader that applies environment-specific overrides.
Uses DJANGO_ENV to determine which environment configuration to apply.
"""

import os
from .base import *

# Get environment from environment variable
DJANGO_ENV = env("DJANGO_ENV", default="local")

# Environment-specific overrides
if DJANGO_ENV == "local":
    # Local development without Docker
    DEBUG = env.bool("DEBUG", default=True)
    
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': env("DB_NAME", default="backend_local"),
            'USER': env("DB_USER", default="postgres"),
            'PASSWORD': env("DB_PASSWORD", default="postgres"),
            'HOST': env("DB_HOST", default="localhost"),
            'PORT': env("DB_PORT", default="5432"),
        }
    }
    
    CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ])
    
    CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")

    # No Docker locally — the channel layer talks to a Redis on localhost.
    CHANNEL_LAYERS["default"]["CONFIG"]["hosts"] = [
        env("CHANNEL_REDIS_URL", default="redis://localhost:6379/2")
    ]

elif DJANGO_ENV == "dev":
    # Development with Docker
    DEBUG = env.bool("DEBUG", default=True)
    
    DATABASES = {
        'default': env.db_url("DATABASE_URL", default="postgresql://postgres:postgres@db:5432/backend_dev")
    }
    
    CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ])
    
    CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://redis:6379/0")
    CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://redis:6379/1")

elif DJANGO_ENV == "uat":
    # User Acceptance Testing
    DEBUG = env.bool("DEBUG", default=False)
    
    DATABASES = {
        'default': env.db_url("DATABASE_URL")
    }
    
    CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
    
    CELERY_BROKER_URL = env("CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")

elif DJANGO_ENV == "prod":
    # Production
    DEBUG = env.bool("DEBUG", default=False)
    
    DATABASES = {
        'default': env.db_url("DATABASE_URL")
    }
    
    CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
    
    CELERY_BROKER_URL = env("CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")
    
    # Additional production settings
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

else:
    raise ValueError(f"Unknown DJANGO_ENV: {DJANGO_ENV}")

# Override CORS settings from environment
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=CORS_ALLOWED_ORIGINS)
# Cookie-based JWT auth requires the browser to send credentials cross-origin and
# the API to allow them, so this defaults True. With credentials, CORS cannot use
# a wildcard origin — CORS_ALLOWED_ORIGINS must list the exact SPA origin(s).
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", default=True)

# --- Local/LAN development convenience -------------------------------------
# When testing on a phone over the same WiFi, the laptop's LAN IP changes every
# time the network changes, which would otherwise break ALLOWED_HOSTS and CORS
# on each switch (forcing a .env edit). While DEBUG is on, trust any host and
# match any private-range LAN origin (on any port) by regex, so phone-on-WiFi
# testing keeps working without touching .env after a WiFi change. This is a
# dev-only relaxation — production runs with DEBUG=False and the explicit lists.
if DEBUG:
    ALLOWED_HOSTS = ["*"]
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^https?://localhost:\d+$",
        r"^https?://127\.0\.0\.1:\d+$",
        r"^https?://192\.168\.\d{1,3}\.\d{1,3}:\d+$",
        r"^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$",
        r"^https?://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:\d+$",
    ]
