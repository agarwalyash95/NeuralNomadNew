"""
Development settings - extends base settings
"""

from .base import *

DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']

# Database settings are inherited from base.py (Azure PostgreSQL)
INSTALLED_APPS += [
#    'debug_toolbar',
]

INTERNAL_IPS = ['127.0.0.1']
# Add the Debug Toolbar middleware to the list
#MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')

MIDDLEWARE += [
#    'django_debug_toolbar.middleware.DebugToolbarMiddleware',
]



# Email backend for development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Disable SSL in development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Enable all CORS origins in development
CORS_ALLOW_ALL_ORIGINS = True

# Logging in development
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'loggers': {
        # ... your other loggers ...
        
        # Add this block to silence the file watcher ticks
        'django.utils.autoreload': {
            'level': 'INFO',
            'propagate': False,
        },
    },
}
