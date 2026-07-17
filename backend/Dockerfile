# NeuralNomad backend — Django + Celery, served via daphne (already an
# installed dependency; no Channels app is actually wired, but daphne is a
# perfectly capable production ASGI server here). See requirements-docker.txt
# for why this doesn't use requirements.txt.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libpq for psycopg2, build tools for anything that needs to compile.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

COPY . .

# Normalize line endings — this repo is edited on Windows, and a CRLF
# shebang line breaks `sh` inside the Linux container with a cryptic
# "no such file or directory" error.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
