#!/bin/sh
set -e

# Wait for Postgres to actually accept connections — depends_on's
# service_healthy already gates container start order, but this is a cheap
# extra guard against a slow-to-warm host-bridged Postgres.
python - <<'PY'
import os, socket, sys, time

host = os.environ.get("DB_HOST", "postgres")
port = int(os.environ.get("DB_PORT", "5432"))
deadline = time.time() + 30
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            sys.exit(0)
    except OSError:
        time.sleep(1)
print(f"WARNING: could not reach {host}:{port} within 30s — continuing anyway", file=sys.stderr)
PY

# Only the web process (daphne, or `manage.py runserver` in dev) owns
# migrations/static — celery worker/beat use this same image+entrypoint
# but must never race the same migration.
if [ "$1" != "celery" ]; then
    echo "Running migrations..."
    python manage.py migrate --noinput
    echo "Collecting static files..."
    python manage.py collectstatic --noinput
fi

exec "$@"
