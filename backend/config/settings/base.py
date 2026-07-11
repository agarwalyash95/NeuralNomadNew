"""
Django base settings for neuralnomad project.
"""

from pathlib import Path
import os
from datetime import timedelta
import sys

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load environment variables from .env
try:
    from dotenv import load_dotenv
    env_path = BASE_DIR / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-development-key-change-in-production")

DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",  # required for pgvector's HnswIndex (knowledge.EntityEmbedding)
    # Third party packages
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "apps.accounts",
    "apps.planner",
    "apps.reference",
    "apps.knowledge",  # Travel Knowledge Engine — generic FKs use django.contrib.contenttypes above
    "apps.bookings",
    "apps.notifications",
    "apps.wallet",
    "apps.attractions",
    "apps.common",
    "apps.forex",
    "apps.homepage",
    "apps.travelpass",
    "apps.visa",
]


MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database Configuration — PostgreSQL only (pgvector image via docker-compose).
# There is deliberately no SQLite fallback: the knowledge app's EntityEmbedding
# (pgvector) and every JSON query path must run against the same engine in
# dev, tests, and production. One engine, no split-brain.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "neuralnomad"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5433"),
        "ATOMIC_REQUESTS": True,
        "CONN_MAX_AGE": 600,
        "OPTIONS": {
            # "sslmode": "require",  # enable for managed/cloud PostgreSQL
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Simple JWT Configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# Spectacular Settings (API Documentation)
SPECTACULAR_SETTINGS = {
    "TITLE": "NeuralNomad API",
    "DESCRIPTION": "AI-Powered Travel Planning & Booking Platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# Channels Configuration
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# Google Places API Key configuration
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

# Absolute base URL this backend is reachable at — used only to build fully-qualified
# URLs (e.g. the photo proxy, see apps.reference.views.place_photo_proxy) for values
# that get persisted to the database and read back outside of a request context.
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")

# LLM (Gemini) — the google-genai client also reads GEMINI_API_KEY from the
# environment directly; exposing it here makes the dependency explicit.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Live travel-search providers (RapidAPI). Mock providers are used unless
# LIVE_PROVIDERS_ENABLED is true AND RAPIDAPI_KEY is set — one env flip to go live.
LIVE_PROVIDERS_ENABLED = os.getenv("LIVE_PROVIDERS_ENABLED", "False").lower() in ("true", "1", "t")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
FLIGHT_PROVIDER = os.getenv("FLIGHT_PROVIDER", "sky_scrapper")
HOTEL_PROVIDER = os.getenv("HOTEL_PROVIDER", "booking_com")
TRAIN_PROVIDER = os.getenv("TRAIN_PROVIDER", "live_train")
BUS_PROVIDER = os.getenv("BUS_PROVIDER", "redbus")
CAB_PROVIDER = os.getenv("CAB_PROVIDER", "booking_taxi")

# Celery — broker/backend/redis packages were already installed but never
# configured, so Celery ran with no settings and nothing was ever scheduled
# (see docs/travel-knowledge-engine-plan.md §4). Values match the Redis
# databases already documented in .env.example.
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    # Previously a management command nothing ever scheduled — the PriceWatch
    # feature promised monitoring and silently did nothing. See apps.planner.tasks.
    "run-price-watches": {
        "task": "apps.planner.tasks.run_price_watches",
        "schedule": 60 * 30,  # every 30 minutes
    },
    "refresh-stale-entities": {
        "task": "apps.reference.tasks.refresh_stale_entities",
        "schedule": 60 * 60 * 3,  # every 3 hours; popularity-ordered, bounded batch per category
    },
    "run-enrichment-pass": {
        "task": "apps.reference.tasks.run_enrichment_pass",
        "schedule": 60 * 60 * 6,  # every 6 hours; small LLM-call batch per category, popularity-ordered
    },
    "run-safety-etiquette-pass": {
        "task": "apps.reference.tasks.run_safety_etiquette_pass",
        "schedule": 60 * 60 * 12,  # every 12 hours; scam/after-dark tips need needs_human_review=True regardless
    },
    "compute-embeddings-backlog": {
        "task": "apps.reference.tasks.compute_embeddings_backlog",
        "schedule": 60 * 15,  # every 15 minutes; small batch per category, source_text_hash skips unchanged rows
    },
    # recompute_popularity_scores lands here once EntityInteractionLog has
    # real traffic — see docs/travel-knowledge-engine-plan.md §4.
}

# Cache — django-redis was installed but CACHES was never configured, so
# Django's default local-memory (per-process, non-shared) cache was silently
# active instead. Used by the Knowledge Engine's caching layer and the photo
# proxy (apps.reference.views.PlacePhotoProxyView).
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            # A cache is an optimization, not a hard dependency — if Redis is
            # down (e.g. not installed/started in local dev), cache.get/set
            # should behave like a permanent miss instead of 500ing every
            # request that touches it.
            "IGNORE_EXCEPTIONS": True,
        },
    }
}
DJANGO_REDIS_LOG_IGNORED_EXCEPTIONS = True

