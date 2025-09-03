# Fail2ban Web Control

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/oweitman/fail2bancontrol/dockerhub.yml?branch=main)](https://github.com/oweitman/fail2bancontrol/actions/workflows/dockerhub.yml)
[![Github Issues](https://img.shields.io/github/issues/oweitman/fail2bancontrol?style=flat)](https://github.com/oweitman/fail2bancontrol/issues)
[![Github Pull Requests](https://img.shields.io/github/issues-pr/oweitman/fail2bancontrol?style=flat)](https://github.com/oweitman/fail2bancontrol/pulls)<br>
[![Arch](https://img.shields.io/badge/arch-amd64%20%7C%20arm64-blue)](https://hub.docker.com/r/oweitman/fail2bancontrol)
[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/oweitman/fail2bancontrol/latest?style=flat)](https://hub.docker.com/r/oweitman/fail2bancontrol)
[![Docker Pulls](https://img.shields.io/docker/pulls/oweitman/fail2bancontrol?style=flat)](https://hub.docker.com/r/oweitman/fail2bancontrol)
[![Docker Stars](https://img.shields.io/docker/stars/oweitman/fail2bancontrol?style=flat)](https://hub.docker.com/r/oweitman/fail2bancontrol)<br>
[![Source](https://img.shields.io/badge/source-github-blue?style=flat)](https://github.com/oweitman/fail2bancontrol)
[![GitHub Release](https://img.shields.io/github/v/release/oweitman/fail2bancontrol?style=flat)](https://github.com/oweitman/fail2bancontrol)
[![GitHub forks](https://img.shields.io/github/forks/oweitman/fail2bancontrol)](https://github.com/oweitman/fail2bancontrol/network)
[![GitHub stars](https://img.shields.io/github/stars/oweitman/fail2bancontrol)](https://github.com/oweitman/fail2bancontrol/stargazers)
![GitHub License](https://img.shields.io/github/license/oweitman/fail2bancontrol)

## Introduction

This project provides a lightweight **web-based control panel** for managing **Fail2ban**.
It allows you to:

-   View the global status of Fail2ban
-   See active jails and their details
-   Ban/unban IP addresses

The application is containerized with Docker and connects directly to the `fail2ban.sock` socket file shared from your running Fail2ban instance.

## Installation

There are two installation options:

---

### A) Directly from Docker Hub

#### 1) Provide the Fail2ban socket

You must share the Fail2ban socket file with this container so it can communicate with the Fail2ban service.

Mount the directory containing the socket from inside the fail2ban container. if fail2ban is installed in the host-system you can skip this part and mount the path directly,

```yaml
volumes:
    - /path/to/directory:/var/run/fail2ban
    - ./path/to/logfile:/path/in/container/logfile
```

#### 2) Run the container

##### Option A – Docker Compose

`docker-compose.dockerhub` (rename it to docker-compose) example:

```yaml
version: '3.9'

services:
    fail2bancontrol:
        image: oweitman/fail2bancontrol
        container_name: fail2bancontrol

        ports:
            - '9191:9000'
        volumes:
            # Include sock file from host (adjust path!)
            - ./path/to/socket.sock:/path/in/container/socket.sock
            # Include log file from host (adjust path!)
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

##### Option B – Direct `docker run`

```bash
docker run -d \
  --name fail2bancontrol \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  -v /path/to/logfile:/path/in/container/logfile \
  --restart unless-stopped \
  oweitman/fail2bancontrol
```

#### 3) Access the UI

Open:

```
http://<host>:9191
```

---

### B) Container is created locally

#### 1) Clone the repository

```bash
git clone https://github.com/oweitman/fail2bancontrol fail2bancontrol
cd fail2bancontrol
```

---

#### 2) Build the Docker image

Create a file `build-image.sh` in the repository root with the following content:

```bash
#!/usr/bin/env bash
docker build -t fail2bancontrol .
```

Make it executable and run:

```bash
chmod +x build-image.sh
./build-image.sh
```

---

#### 3) Provide the Fail2ban socket

You must share the Fail2ban socket file with this container so it can communicate with the Fail2ban service.

Mount the directory containing the socket from inside the fail2ban container. if fail2ban is installed in the host-system you can skip this part and mount the path directly,

```yaml
volumes:
    - /path/to/directory:/var/run/fail2ban
    - ./path/to/logfile:/path/in/container/logfile
```

#### 4) Run the container

##### Option A – Docker Compose

`docker-compose.local` (rename it to docker-compose) example:

```yaml
version: '3.9'
services:
    fail2bancontrol:
        image: fail2bancontrol:latest
        container_name: fail2bancontrol

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

##### Option B – Direct `docker run`

```bash
docker run -d \
  --name fail2bancontrol \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  -v /path/to/logfile:/path/in/container/logfile \
  --restart unless-stopped \
  fail2bancontrol:latest
```

#### 5) Access the UI

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

If the respective log file has been mapped to the fail2bancontrol container sld volume with the same path, this log file can be displayed and continuously monitored.

Example:

```yaml
volumes:
    - ./path/to/socket.sock:/path/in/container/socket.sock
    - ./path/to/logfile:/path/in/container/logfile
```

## API

**Errors**

The API uses standard HTTP codes. Error body shape:

```json
{ "error": "<message>" }
```

---

### Status & Discovery

#### GET `/api/status`

Global Fail2ban status.

**200**

```json
{
    "jails": 3,
    "list": ["sshd", "nginx-http-auth", "recidive"]
}
```

**500** Socket/call failure.

---

#### GET `/api/jails`

Array of jail names (same as `status.list`).

**200**

```json
["sshd", "nginx-http-auth", "recidive"]
```

**500** On failure.

---

#### GET `/api/jail/{jail}/status`

Detailed status for a **single jail**.

**Path params**

-   `jail` — exact jail name

**200**

```json
{
    "filter": {
        "currentlyFailed": 2,
        "totalFailed": 431,
        "fileList": [
            { "path": "/var/log/auth.log", "exists": true },
            { "path": "/var/log/secure", "exists": false }
        ]
    },
    "actions": {
        "currentlyBanned": 1,
        "totalBanned": 37,
        "bannedIPList": ["1.2.3.4"]
    }
}
```

**500** Unknown jail or socket error.

---

#### GET `/api/banned`

Collects **all banned IPv4 addresses** across Fail2ban output.

**200**

```json
{ "ips": ["1.2.3.4", "1.2.3.5"], "count": 2 }
```

---

### Ban / Unban

#### POST `/api/jail/{jail}/ban`

Ban a **single IPv4** in a jail.

**Body**

```json
{ "ip": "1.2.3.4" }
```

**200**

```json
{ "result": "<fail2ban textual response>" }
```

**400** Invalid/missing IPv4.
**500** Socket/fail2ban error.

---

#### POST `/api/jail/{jail}/unban`

Unban a **single IPv4** in a jail.

**Body**

```json
{ "ip": "1.2.3.4" }
```

**200**

```json
{ "result": "<fail2ban textual response>" }
```

**400/500** As above.

---

#### Global Unban helpers

-   **POST** `/api/unban/all` → runs `unban --all`

    -   **200**

        ```json
        { "result": "<response>", "command": ["unban", "--all"] }
        ```

-   **POST** `/api/unban/{ip}` → runs `unban <ip>`

    -   **200**

        ```json
        { "result": "<response>", "command": ["unban", "1.2.3.4"] }
        ```

    -   **400** if `{ip}` is not a valid IPv4.

-   **POST** `/api/unban` with body `{ "ip": "1.2.3.4" }`

    -   **200**

        ```json
        { "result": "<response>", "command": ["unban", "1.2.3.4"] }
        ```

    -   **400** invalid/missing IPv4.

> **Note:** IPv6 is **not** accepted by these endpoints.

---

### Server Control

#### POST `/api/server/start`

#### POST `/api/server/restart`

#### POST `/api/server/stop`

**200**

```json
{ "result": "<fail2ban textual response>" }
```

---

#### POST `/api/server/reload`

Reload with optional flags.

**Body (all optional booleans)**

```json
{ "restart": false, "unban": false, "all": false }
```

Maps to:

-   `--restart` if `restart: true`
-   `--unban` if `unban: true`
-   `--all` if `all: true`

**200**

```json
{
    "result": "<response>",
    "command": ["reload", "--restart", "--all"] // example
}
```

---

### Jail-Level Control

#### POST `/api/jail/{jail}/restart`

**Body (optional)**

```json
{ "unban": false, "ifExists": false }
```

→ `restart [--unban] [--if-exists] <JAIL>`

**200**

```json
{
    "result": "<response>",
    "command": ["restart", "--if-exists", "sshd"]
}
```

---

#### POST `/api/jail/{jail}/reload`

**Body (optional)**

```json
{ "restart": false, "unban": false, "ifExists": false }
```

→ `reload [--restart] [--unban] [--if-exists] <JAIL>`

**200**

```json
{
    "result": "<response>",
    "command": ["reload", "--restart", "sshd"]
}
```

---

### Version & Logging

#### GET `/api/version`

Returns Fail2ban version (raw textual response collapsed to a string).

**200**

```json
{ "version": "1.1.0" }
```

> Also available as **POST** `/api/version` (same response).

---

#### GET `/api/loglevel`

**200**

```json
{ "loglevel": "loglevel\nINFO" }
```

> Many “get” responses are **raw Fail2ban text**, often a **name line + value line**.
> In clients you may need to split on `\n` and read the **second line**.

---

#### POST `/api/loglevel`

Set log level.

**Body**

```json
{ "level": "INFO" } // or { "level": 20 }
```

Accepted values are those supported by Fail2ban:
`CRITICAL`, `ERROR`, `WARNING`, `NOTICE`, `INFO`, `DEBUG`, `TRACEDEBUG`, `HEAVYDEBUG` or numeric `50..5`.

**200**

```json
{ "result": "<response>", "command": ["set", "loglevel", "INFO"] }
```

**400** Missing/invalid `level`.

---

### Database Settings

#### GET `/api/db/file`

**200**

```json
{ "dbfile": "dbfile\n/var/lib/fail2ban/fail2ban.sqlite3" }
```

#### GET `/api/db/maxmatches`

**200**

```json
{ "dbmaxmatches": "dbmaxmatches\n10" }
```

#### POST `/api/db/maxmatches`

**Body**

```json
{ "value": 10 }
```

**200**

```json
{ "result": "<response>" }
```

**400** Missing or non-integer `value`.

---

#### GET `/api/db/purgeage`

**200**

```json
{ "dbpurgeage": "dbpurgeage\n86400" }
```

#### POST `/api/db/purgeage`

**Body**

```json
{ "seconds": 86400 }
```

**200**

```json
{ "result": "<response>" }
```

**400** Missing or non-integer `seconds`.

---

### File Read

#### GET `/api/file?path=<abs-path>&lines=<n>`

Read a file from the host filesystem.

**Query**

-   `path` (required) — absolute or relative (resolved to absolute)
-   `lines` (optional, integer)

    -   `0` or omitted → entire file
    -   positive `n` → first `n` lines
    -   negative `-n` → last `n` lines

**200**

```json
{
    "path": "/var/log/nginx/access.log",
    "exists": true,
    "lines": ["<line 1>", "<line 2>", "..."]
}
```

**404** File not found.

**500** I/O or decoding error.

> **Security note:** The path is resolved to an absolute path and must exist and be a regular file. There is **no allow-list**; protect this endpoint appropriately (e.g., via reverse proxy auth/ACLs).

---

### Static Files (non-API)

-   `/` → serves `index.html` from `STATIC_ROOT`
-   `/public/<path>` → serves from `STATIC_ROOT/<path>`
    Unknown static paths → `404`.

---

### Notes & Limitations

-   IP validation is **IPv4 only** for ban/unban endpoints.
-   Several “get” endpoints return **raw textual Fail2ban output** collapsed into a single string; clients often need to split lines and use the second line for the value.
-   All commands are executed through the Fail2ban UNIX socket defined by `F2B_SOCKET`.

## Notes & Troubleshooting

-   **Permission denied**: If you get this error, your container user may not have permissions to read the socket.
    Quick fix: run the container as `root` (default in Dockerfile).
    Alternative: adjust socket file permissions or match the group ID inside the container.

-   **Verify the socket inside the container**:

    ```bash
    docker exec -it fail2bancontrol ls -l /var/run/fail2ban
    ```

-   **Port mapping**: The internal app port is controlled by `PORT` (default `9000`). External port is defined in Docker Compose or `docker run` (`9191:9000` in examples).

## Changelog

<!-- CHANGELOG:INSERT -->
### v1.6.0 — 2025-09-03

-   add more api endpoints
-   add server control buttons start, stop, restart, reload
-   change theme switch button
-   add server version
-   add dbfile location
-   add log level slider
-   add dbmaxmatches
-   add dbpurgeage
-   add eslint
-   fix eslint errors
-   improve refresh between overview and jails
-   improve design
-   add testscript for banned ips
-   add some more documentations

### v1.5.1 — 2025-08-28

-   recreate frontend sources
-   improve release script

### v1.5.0 – 2025-08-28

-   add version
-   add workflow actions for release and version

### Version 1.4.0

-   improve backend logic für prod and dev
-   add footer with links

### Version 1.3.0

-   automate docker push

### Version 1.2.0

-   Feature FileView

### Version 1.1.0

-   Move gui to mui/react

### Version 1.0.0

-   Initial release
