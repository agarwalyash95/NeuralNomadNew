"""
Testing settings - extends base settings.

Tests run against the SAME PostgreSQL engine as dev and production (Django
creates and destroys a disposable `test_<DB_NAME>` database automatically).
No SQLite, no disabled migrations: the knowledge app's pgvector extension,
JSON field lookups, and every migration must be exercised exactly as they
run for real — an engine-split test suite proves nothing about production.
Requires the docker-compose postgres service to be up, same as runserver.
"""

from .base import *

DEBUG = True

# Disable password hashing in tests for speed
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable throttling in tests
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []

# Use local memory for cache/celery in tests — no real Redis required
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
