# Schlankes Python-Image (Debian slim)
FROM python:3.12-slim

# Prod-Defaults
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=UTC

# System-TZ (für Logs etc.) minimal setzen
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis der App
WORKDIR /app

# Backend unter /app/app.py
COPY app.py /app/app.py

# Frontend unter /public (inkl. index.html)
RUN mkdir -p /app/public
COPY public/ /app/public/

# App-Port
EXPOSE 9000

# Startbefehl
CMD ["python", "-u", "app.py"]
