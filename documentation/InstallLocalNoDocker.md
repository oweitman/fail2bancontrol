# Fail2banControl – Local Installation (Without Docker)

This guide explains how to run Fail2banControl locally on a Linux system without using Docker.

---

## ⚠️ Important Note

Running without Docker is **only supported on Linux**, because the application communicates directly with the Fail2ban **Unix domain socket**.

---

## Requirements

- Linux system
- Python 3.12 or newer
- Running Fail2ban service
- Access to the Fail2ban socket
- Downloaded project (via Git or ZIP)
- Built frontend located in `src-frontend/dist` (included in github)

---

## Download the Project

### Option 1: Using Git

```bash
git clone <REPOSITORY-URL>
```

### Option 2: Download ZIP from GitHub

1. Open the repository on GitHub
2. Click **Code → Download ZIP**
3. Extract the archive

---

## Copy Files to a Neutral Directory

The application should run independently from the repository directory.

Recommended location:

```bash
/opt/fail2bancontrol
```

### Create target directory

```bash
sudo mkdir -p /opt/fail2bancontrol
```

### Copy backend

```bash
sudo cp src-backend/app.py /opt/fail2bancontrol/app.py
```

### Copy frontend

```bash
sudo mkdir -p /opt/fail2bancontrol/public
sudo cp -r src-frontend/dist/* /opt/fail2bancontrol/public/
```

> If you downloaded a ZIP file, make sure you run these commands inside the extracted folder.

---

## Environment Variables

The backend supports the following environment variables:

### `F2B_SOCKET`

Path to the Fail2ban socket.

Default:

```bash
/var/run/fail2ban/fail2ban.sock
```

---

### `STATIC_ROOT`

Path to static frontend files.

Example:

```bash
/opt/fail2bancontrol/public
```

---

### `PORT`

HTTP server port.

Default:

```bash
9000
```

---

### `TZ` (optional)

Timezone setting.

Example:

```bash
Europe/Berlin
```

---

## Verify Fail2ban Socket

```bash
ls -l /var/run/fail2ban/fail2ban.sock
```

If the socket is located elsewhere, adjust `F2B_SOCKET` accordingly.

---

## Start the Application

```bash
cd /opt/fail2bancontrol

export F2B_SOCKET=/var/run/fail2ban/fail2ban.sock
export STATIC_ROOT=/opt/fail2bancontrol/public
export PORT=9000
export TZ=Europe/Berlin

python3 app.py
```

---

## Access the Web Interface

Open your browser:

```text
http://localhost:9000
```

---

## Complete Example

```bash
git clone <REPOSITORY-URL>
cd fail2bancontrol

sudo mkdir -p /opt/fail2bancontrol

sudo cp src-backend/app.py /opt/fail2bancontrol/app.py
sudo mkdir -p /opt/fail2bancontrol/public
sudo cp -r src-frontend/dist/* /opt/fail2bancontrol/public/

cd /opt/fail2bancontrol

export F2B_SOCKET=/var/run/fail2ban/fail2ban.sock
export STATIC_ROOT=/opt/fail2bancontrol/public
export PORT=9000

python3 app.py
```

---

## Run as a Systemd Service

To run Fail2banControl as a background service, create the following file:

```bash
sudo nano /etc/systemd/system/fail2bancontrol.service
```

### Service configuration

```ini
[Unit]
Description=Fail2banControl Web UI
After=network.target fail2ban.service
Wants=fail2ban.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/fail2bancontrol
Environment=F2B_SOCKET=/var/run/fail2ban/fail2ban.sock
Environment=STATIC_ROOT=/opt/fail2bancontrol/public
Environment=PORT=9000
Environment=TZ=Europe/Berlin
ExecStart=/usr/bin/python3 /opt/fail2bancontrol/app.py
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Enable and start service

```bash
sudo systemctl daemon-reload
sudo systemctl enable fail2bancontrol
sudo systemctl start fail2bancontrol
```

### Check status

```bash
sudo systemctl status fail2bancontrol
```

### View logs

```bash
journalctl -u fail2bancontrol -f
```

### Stop / restart

```bash
sudo systemctl stop fail2bancontrol
sudo systemctl restart fail2bancontrol
```

---

## Notes

### Python dependencies

The backend uses only Python standard library modules. No additional packages are required.

---

### Permissions

If you see errors like:

```text
Permission denied (socket)
```

The user does not have access to the Fail2ban socket.

Possible solutions:

- Run the service as root
- Adjust socket permissions or groups

---

### Port behavior

Without Docker, the application runs directly on the configured port (default: 9000).

---

### Difference to Docker setup

| Docker               | Local                    |
| -------------------- | ------------------------ |
| External port 9191   | Direct port 9000         |
| Socket mounted       | Socket accessed directly |
| Isolated environment | Uses host system         |

---

## Optional: Run as non-root user

If you want to run the service with a dedicated user:

```ini
User=fail2bancontrol
Group=fail2bancontrol
```

You must ensure that this user has:

- Read access to `/opt/fail2bancontrol`
- Access to `/var/run/fail2ban/fail2ban.sock`
