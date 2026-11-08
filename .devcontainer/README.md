# Development with VS Code

The devcontainer includes Python 3.12, Node.js 24, and the Python/ESLint extensions.
On creation, `npm ci` installs the frontend dependencies automatically. A separate
Docker volume keeps `node_modules` independent of host packages.

## Starting the environment

1. Install Docker and VS Code with the **Dev Containers** extension
   (`ms-vscode-remote.remote-containers`) on the host.
2. Open the project folder in VS Code. For remote development, first connect through
   **Remote - SSH** to the machine running Docker and hosting the Fail2ban socket,
   then open the project folder there.
3. Check the three host paths under `mounts` in `devcontainer.json`. The existing
   paths under `/home/iobroker/docker/volume/nextcloud/` are retained. The socket
   directory must contain `fail2ban.sock`. Remove unused log mounts if necessary.
   Log files must be available at the paths reported by Fail2ban.
4. Press `Ctrl+Shift+P` and choose **Dev Containers: Reopen in Container**.
   If an older container already exists, choose **Dev Containers: Rebuild and
   Reopen in Container**, or **Rebuild Container** if already connected.
5. Wait for package installation, then choose **Terminal → Run Task → dev: start**.
   This starts the backend and frontend in separate terminals.
6. Open `http://localhost:5173` in your local browser. If VS Code assigns a different
   local port, use the link in its **Ports** view.

Vite proxies `/api` to the backend on port 9000. Frontend changes appear
automatically. After changing Python code, stop and restart the backend task.
Press `Ctrl+C` in the respective terminals to stop the servers.

## Users and permissions

VS Code, Git, and frontend tools run as `vscode`. Dev Containers adjusts this
user's UID/GID to match the local user on Linux, keeping new repository files
accessible from the host. Rebuild the container after changing this configuration.
The setup command fixes ownership only within the dedicated `node_modules` volume.

Only the backend runs with elevated privileges, through `sudo -E`, because the
mounted Fail2ban socket requires them. The development image permits passwordless
sudo for `vscode`. Do not use `sudo git` or start all of VS Code as root.

If an older root-based container has already left Git files owned by another user,
close its Git operations and repair ownership **on the host**, as the repository
owner, before rebuilding:

```bash
cd /path/to/fail2bancontrol
sudo chown -R "$(id -u):$(id -g)" .git
```

This changes ownership without altering Git objects, commits, or the staging index.
If source files are also affected, repair those specific paths on the host as well.

## Starting from container terminals

Backend, from the project directory:

```bash
sudo -E /usr/local/bin/python src-backend/app.py
```

Frontend, from a second terminal:

```bash
cd src-frontend
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

`STATIC_ROOT`, `F2B_SOCKET`, `PORT`, and `TZ` are set in the container. Port 9000
serves the backend API and the built frontend from `dist`; use port 5173 for
frontend development with automatic updates.

## Debugging and checks

Under **Run and Debug**, select **Python backend** and press F5. Stop any running
backend task first to free port 9000. Start the frontend separately through the
**frontend: dev** task.

The backend debug configuration uses `.devcontainer/python-root`, a small wrapper
that launches the Python interpreter through passwordless sudo. VS Code and Git
continue to run as the regular development user.

Run checks in the container:

```bash
python -m unittest discover -s test -v
cd src-frontend
npm run lint
npm run build
```

Equivalent VS Code tasks are **backend: test**, **frontend: lint**, and
**frontend: build**. `npm run build` updates the distributed files under
`src-frontend/dist`.

## Troubleshooting

- **Missing mount path:** Correct host paths in `devcontainer.json`, then rebuild.
  These paths belong to the machine running the Docker daemon.
- **Docker permission denied:** Check `docker info` on the host. VS Code needs access
  to the same daemon. The configuration does not change host permissions.
- **Socket unavailable:** Run `ls -l /var/run/fail2ban/fail2ban.sock` in the container.
  The entire socket directory is mounted so a Fail2ban restart does not invalidate it.
- **Port occupied:** Stop old frontend/backend terminals. Vite explicitly uses port
  5173 and does not silently switch to another port.
- **Missing packages:** Run `npm --prefix src-frontend ci` in the container.
- **Git object permission error:** See the ownership repair above, then rebuild so
  Git runs as the regular development user.

The environment connects to the real Fail2ban instance. Unban actions and runtime
configuration changes affect that instance. Run the existing **docker: build image**
task on the host; the development container does not mount the Docker socket.
