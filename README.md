# Fail2ban Web Control

## Introduction

This project provides a lightweight **web-based control panel** for managing **Fail2ban**.
It allows you to:

-   View the global status of Fail2ban
-   See active jails and their details
-   Ban/unban IP addresses

The application is containerized with Docker and connects directly to the `fail2ban.sock` socket file shared from your running Fail2ban instance.

---

## 1) Clone the repository

```bash
git clone https://github.com/oweitman/fail2bancontrol fail2banwebcontrol
cd fail2banwebcontrol
```

---

## 2) Build the Docker image

Create a file `build-image.sh` in the repository root with the following content:

```bash
#!/usr/bin/env bash
docker build -t fail2banwebcontrol .
```

Make it executable and run:

```bash
chmod +x build-image.sh
./build-image.sh
```

---

## 3) Provide the Fail2ban socket

You must share the Fail2ban socket file with this container so it can communicate with the Fail2ban service.

Mount the directory containing the socket from inside the fail2ban container. if fail2ban is installed in the host-system you can skip this part and mount the path directly,

```yaml
volumes:
    - /path/to/directory:/var/run/fail2ban
    - ./path/to/logfile:/path/in/container/logfile    
```

## 4) Run with Docker Compose **or** via `docker run`

### Option A – Docker Compose

`docker-compose.yml` example:

```yaml
version: '3.9'
services:
    fail2banwebcontrol:
        image: fail2banwebcontrol:latest
        container_name: fail2banwebcontrol

        ports:
            - '9191:9000'

        volumes:
            # directory mount
            - '/path/to/directory:/var/run/fail2ban'
            - ./path/to/logfile:/path/in/container/logfile

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
  --name fail2banwebcontrol \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  -v /path/to/logfile:/path/in/container/logfile \
  --restart unless-stopped \
  fail2banwebcontrol:latest
```

## 5) Access the UI

Open:

```
http://<host>:9191
```

---

## Features

### See active jails and their details

![Jail View](img/jail.png)

-   Number of current and total number of blocked and failed IPs
-   All referred Files of this jail.
-   all current banned IPs.
-   Unban an IP address
-   Ban an IP address

### Access the log files of a jail

If the respective log file has been mapped to the fail2banWebControl container sld volume with the same path, this log file can be displayed and continuously monitored.

Example:

```yaml
volumes:
    - ./path/to/socket.sock:/path/in/container/socket.sock
    - ./path/to/logfile:/path/in/container/logfile
```
## Available API

### GET `/api/status`

Returns the **global** fail2ban status: number of jails and their names.

* **Response 200**

  Body: 

    ```json
    {
    "jails": 3,
    "list": ["sshd", "nginx-http-auth", "recidive"]
    }
    ```

* **Errors**

  * `500`: `{ "error": "<message>" }` if the socket call fails

---

### GET `/api/jails`

Returns the **array of jail names**.

* **Response 200**

  * Body: `["sshd", "nginx-http-auth", ...]`

* **Errors**

  * `500`: `{ "error": "<message>" }`

---

### GET `/api/jail/{jail}/status`

Returns detailed status for a specific jail.

* **Path params**

  * `jail` — jail name (case-sensitive as known to fail2ban)

* **Response 200**

  * Body:

    ```json
    {
        "filter": {
            "currentlyFailed": 2,
            "totalFailed": 431,
            "fileList": [
                { "path": "/var/log/auth.log", "exists": true },
                { "path": "/var/log/secure",   "exists": false }
            ]
        },
        "actions": {
            "currentlyBanned": 1,
            "totalBanned": 37,
            "bannedIPList": ["203.0.113.7"]
        }
    }
    ```

* **Errors**

  * `500`: `{ "error": "<message>" }` (e.g., unknown jail, socket error)

---

### POST `/api/jail/{jail}/ban`

Bans a single IPv4 address in the given jail.

* **Path params**

  * `jail` — jail name

* **Request Body (JSON)**

  ```json
  { "ip": "198.51.100.42" }
  ```

  * Must be a **valid IPv4** address (IPv6 is not accepted by this API).

* **Response 200**

  ```json
  { "result": "<fail2ban textual response>" }
  ```

* **Errors**

  * `400`: `{ "error": "A valid IPv4 address must be provided in the body as \"ip\"" }`
  * `500`: `{ "error": "<message>" }` (socket or fail2ban error)
  * `404`: `{ "error": "Not found4" }` if the route does not match

---

### POST `/api/jail/{jail}/unban`

Unbans a single IPv4 address in the given jail.

* **Path params**

  * `jail` — jail name

* **Request Body (JSON)**

  ```json
  { "ip": "198.51.100.42" }
  ```

* **Response 200**

  ```json
  { "result": "<fail2ban textual response>" }
  ```

* **Errors**

  * Same as for **ban**.

---

### GET `/api/file?path=<abs-path>&lines=<n>`

Reads a file from the host filesystem.

* **Query params**

  * `path` (required): absolute or relative path (resolved to absolute); must point to a regular file.
  * `lines` (optional, integer):

    * `0` or omitted → **entire file**
    * Positive `n` → **first *n* lines**
    * Negative `-n` → **last *n* lines**

* **Response 200**

  * Body:

    ```json
    {
      "path": "/var/log/nginx/access.log",
      "exists": true,
      "lines": ["<line 1>", "<line 2>", "..."]
    }
    ```

* **Errors**

  * `404`: `{ "error": "File not found", "path": "<given path>" }`
  * `500`: `{ "error": "<message>" }` (I/O error, encoding error)

> Security note: The code resolves to an absolute path and requires the path to exist and be a file. There is no allow-list; consider hardening behind a proxy.

## Notes & Troubleshooting

-   **Permission denied**: If you get this error, your container user may not have permissions to read the socket.
    Quick fix: run the container as `root` (default in Dockerfile).
    Alternative: adjust socket file permissions or match the group ID inside the container.

-   **Verify the socket inside the container**:

    ```bash
    docker exec -it fail2banwebcontrol ls -l /var/run/fail2ban
    ```

-   **Port mapping**: The internal app port is controlled by `PORT` (default `9000`). External port is defined in Docker Compose or `docker run` (`9191:9000` in examples).

## Changelog

### Version 1.2.0

-   Feature FileView

### Version 1.1.0

-   Move gui to mui/react

### Version 1.0.0

-   Initial release
