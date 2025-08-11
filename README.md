# Fail2ban Web Panel

## Introduction

This project provides a lightweight **web-based control panel** for managing **Fail2ban**.
It allows you to:

* View the global status of Fail2ban
* See active jails and their details
* Ban/unban IP addresses

The application is containerized with Docker and connects directly to the `fail2ban.sock` socket file shared from your running Fail2ban instance.

---

## 1) Clone the repository

```bash
git clone <REPO_URL> fail2banwebpanel
cd fail2banwebpanel
```

---

## 2) Build the Docker image

Create a file `build-image.sh` in the repository root with the following content:

```bash
#!/usr/bin/env bash
docker build -t fail2banwebpanel .
```

Make it executable and run:

```bash
chmod +x build-image.sh
./build-image.sh
```

---

## 3) Provide the Fail2ban socket

You must share the Fail2ban socket file with this container so it can communicate with the Fail2ban service.

Mount the directory containing the socket from inside the fail2ban container. if fil2ban is installed in the host-system you can skip this part and mount the path directly,

```yaml
volumes:
  - /path/to/directory:/var/run/fail2ban
```

## 4) Run with Docker Compose **or** via `docker run`

### Option A – Docker Compose

`docker-compose.yml` example:

```yaml
version: "3.9"
services:
  fail2banwebpanel:
    image: fail2banwebpanel:latest
    container_name: fail2banwebpanel

    ports:
      - "9191:9000"

    volumes:
      # Option A: directory mount
      - "/path/to/directory:/var/run/fail2ban"

    environment:
      TZ: Europe/Berlin

    restart: unless-stopped
```

Start:

```bash
docker compose up -d
```

---

### Option B – Direct `docker run`

```bash
docker run -d \
  --name fail2banwebpanel \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  --restart unless-stopped \
  fail2banwebpanel:latest
```

## 5) Access the UI

Open:

```
http://<host>:9191
```

---

## Notes & Troubleshooting

* **Permission denied**: If you get this error, your container user may not have permissions to read the socket.
  Quick fix: run the container as `root` (default in Dockerfile).
  Alternative: adjust socket file permissions or match the group ID inside the container.

* **Verify the socket inside the container**:

  ```bash
  docker exec -it fail2banwebpanel ls -l /var/run/fail2ban
  ```


* **Port mapping**: The internal app port is controlled by `PORT` (default `9000`). External port is defined in Docker Compose or `docker run` (`9191:9000` in examples).

