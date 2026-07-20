"""
Production settings - extends base settings
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

# Phase 0i: base.py's SECRET_KEY (which SIMPLE_JWT.SIGNING_KEY also derives
# from) falls back to a public, insecure dev string when the env var isn't
# set — fine for local dev, but a silent, dangerous misconfiguration if it
# ever happened in production. Fail loudly here instead.
if SECRET_KEY == "django-insecure-development-key-change-in-production":
    raise ImproperlyConfigured(
        "SECRET_KEY environment variable must be set to a real secret in production "
        "(it also signs JWTs via SIMPLE_JWT.SIGNING_KEY) — refusing to start with the "
        "public development default."
    )

# Production database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'sslmode': 'require',
        },
    }
}

# Phase 0A (docs/planner-complete-audit-and-fix-plan.md): never run a
# multi-second synchronous LLM generation inside a production request —
# regardless of any env override, production always uses durable jobs.
PLANNER_ALLOW_SYNC_GENERATION = False

# Checklist 2.6: production generation runs on durable workers only — no
# daemon-thread fallback. A missing worker surfaces as an honest retryable
# error, never as a thread that dies with the web process.
PLANNER_ALLOW_THREAD_FALLBACK = False
BOOKINGS_ALLOW_MOCK_INVENTORY = False

# Security
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# Phase 0c: get_planner_user's per-session anonymous identity depends on the
# session cookie reaching the backend from the frontend origin. Same-site is
# scheme+registrable-domain (port/subdomain don't count), so this is only
# needed if frontend and backend end up on genuinely different registrable
# domains in production — but it's a strict compatibility increase with no
# downside now that SESSION_COOKIE_SECURE is already True here.
SESSION_COOKIE_SAMESITE = "None"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Email backend for production
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Disable debug toolbar
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'django_debug_toolbar']
MIDDLEWARE = [m for m in MIDDLEWARE if m != 'django_debug_toolbar.middleware.DebugToolbarMiddleware']

# Static files
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Logging in production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
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
        'level': 'WARNING',
    },
}
