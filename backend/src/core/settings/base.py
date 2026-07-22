"""
Base Django settings for the project.
Common settings for all environments.
"""

import environ
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

# Initialize environment variables
env = environ.Env()

# Take environment variables from .env file
environ.Env.read_env(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool("DEBUG", default=False)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

# Application definition
DJANGO_APPS = [
    # 'daphne' must be listed before django.contrib.staticfiles so its
    # ASGI-aware runserver takes over in dev (serves HTTP + WebSockets together).
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    # Required because SIMPLE_JWT has ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION
    # on: on each cookie refresh the old refresh token is blacklisted, and logout
    # blacklists the active refresh token so a stolen cookie can't be reused.
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    'django_celery_beat',
    'channels',
]

LOCAL_APPS = [
    'authentication',
    'operations',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Channels (WebSockets) — the channel layer is the message bus that lets one
# connection's message reach the others (e.g. a driver's position push reaching
# every owner/admin watching that vehicle). It's backed by the same Redis that
# Celery uses, on a separate DB (2) so the key spaces never collide. The host is
# overridden per-environment in settings/__init__.py (localhost vs. the `redis`
# service), mirroring how CELERY_BROKER_URL is set.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [env('CHANNEL_REDIS_URL', default='redis://redis:6379/2')],
        },
    },
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise configuration
# Use CompressedStaticFilesStorage instead of CompressedManifestStaticFilesStorage
# to avoid file hashing issues during development
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Media files (user uploads: registration documents, certificates, shop images)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'authentication.User'

# Auth backend: allow restricted (deactivated) END USERS to log in so they can
# see why they're restricted and contact the admin. Staff/superusers with
# is_active=False stay blocked. See authentication.backends.
AUTHENTICATION_BACKENDS = [
    'authentication.backends.RestrictedLoginModelBackend',
]

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # Suspension-aware: a suspended user may only reach /auth/* (profile,
        # logout); every other endpoint is refused. See authentication.authentication.
        'authentication.authentication.SuspensionAwareJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
    'PAGE_SIZE': 20,
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# DRF Spectacular Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Django REST + DRF Starter API',
    'DESCRIPTION': 'A production-ready Django REST API starter with JWT authentication, Celery task queue, Redis cache, and PostgreSQL database.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': '/api/',
    'COMPONENT_SPLIT_REQUEST': True,
    'SORT_OPERATIONS': False,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
        'displayRequestDuration': True,
    },
    'SWAGGER_UI_FAVICON_HREF': '/static/favicon.ico',
    'REDOC_UI_SETTINGS': {
        'hideDownloadButton': False,
    },
    'SECURITY': [
        {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }
    ],
    'AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'TAGS': [
        {'name': 'Authentication', 'description': 'User authentication and JWT token management'},
        {'name': 'Users', 'description': 'User management operations'},
        {'name': 'Health', 'description': 'Application health checks'},
    ],
}

# Simple JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env.int("SIMPLE_JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env.int("SIMPLE_JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)),
    'ROTATE_REFRESH_TOKENS': env.bool("SIMPLE_JWT_ROTATE_REFRESH_TOKENS", default=True),
    'BLACKLIST_AFTER_ROTATION': env.bool("SIMPLE_JWT_BLACKLIST_AFTER_ROTATION", default=True),
    'UPDATE_LAST_LOGIN': env.bool("SIMPLE_JWT_UPDATE_LAST_LOGIN", default=True),
    'ALGORITHM': env("SIMPLE_JWT_ALGORITHM", default="HS256"),
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JWK_URL': None,
    'LEEWAY': 0,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
    'JTI_CLAIM': 'jti',
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}

# ---------------------------------------------------------------------------
# JWT HttpOnly cookie authentication
# ---------------------------------------------------------------------------
# The SPA does NOT store JWTs in localStorage. The access/refresh tokens are
# delivered as HttpOnly cookies (set by login/refresh, cleared by logout) so
# client-side JavaScript can never read them — this is the XSS-hardening the
# frontend relies on. The browser sends them automatically when the SPA uses
# `withCredentials: true`, which is why CORS must allow credentials below.
# SuspensionAwareJWTAuthentication reads the access token from this cookie (it
# still accepts an Authorization: Bearer header too, for tools/Swagger).
AUTH_COOKIE_ACCESS = env("AUTH_COOKIE_ACCESS_NAME", default="access_token")
AUTH_COOKIE_REFRESH = env("AUTH_COOKIE_REFRESH_NAME", default="refresh_token")
AUTH_COOKIE_HTTP_ONLY = True
# Secure=True requires HTTPS — the browser drops a Secure cookie over plain HTTP.
# The current deployment is HTTP, so this defaults False; set AUTH_COOKIE_SECURE=True
# in .env the moment the app is served over HTTPS.
AUTH_COOKIE_SECURE = env.bool("AUTH_COOKIE_SECURE", default=False)
# 'Lax' stops the cookie from being sent on cross-site requests (the primary CSRF
# defense) while still allowing the same-site SPA. For a genuinely cross-site SPA
# set AUTH_COOKIE_SAMESITE=None together with AUTH_COOKIE_SECURE=True (HTTPS).
AUTH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", default="Lax")
AUTH_COOKIE_PATH = "/"
AUTH_COOKIE_DOMAIN = env("AUTH_COOKIE_DOMAIN", default=None) or None

# Email configuration
# Defaults to the console backend (prints emails to the server log) so the
# approval/credential flow works in development with zero setup. Set EMAIL_BACKEND
# and the EMAIL_* / DEFAULT_FROM_EMAIL vars in .env to send real mail via SMTP.
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Wheels of Australia <noreply@woa.local>")

# Public URL of the login page, included in approval emails.
FRONTEND_LOGIN_URL = env("FRONTEND_LOGIN_URL", default="http://localhost:3000/login")

# Google Gemini — used by the identity-document OCR endpoint to classify an
# uploaded ID and extract its fields. The key stays server-side only.
GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
# gemini-2.5-flash is fast (~5s) and reliable on the free tier for this key.
# (gemini-flash-latest currently resolves to the brand-new gemini-3.5-flash,
# which is heavily overloaded — frequent 503s, slow, tiny free quota.)
GEMINI_MODEL = env("GEMINI_MODEL", default="gemini-2.5-flash")

# Celery Configuration
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Celery Beat Schedule
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'cleanup-inactive-users': {
        'task': 'authentication.tasks.cleanup_inactive_users',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
    },
    'generate-user-stats': {
        'task': 'authentication.tasks.generate_user_stats',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6:00 AM
    },
    'generate-vehicle-reminders': {
        'task': 'operations.tasks.generate_vehicle_reminders',
        'schedule': crontab(hour=7, minute=0),  # Daily at 7:00 AM
    },
    # GPS tracking: catch drivers whose location went off during an active rental.
    'monitor-active-trip-locations': {
        'task': 'operations.tasks.monitor_active_trip_locations',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': env("DJANGO_LOG_LEVEL", default="INFO"),
            'propagate': False,
        },
    },
}
