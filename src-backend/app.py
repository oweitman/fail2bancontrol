#!/usr/bin/env python3
import os
import socket
import pickle
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Path to the fail2ban control socket. It can be overridden via the
# environment variable F2B_SOCKET when running the container. The socket
# must be mounted into the container so that this application can
# communicate with the running fail2ban server.
SOCKET_PATH = os.getenv('F2B_SOCKET', '/var/run/fail2ban/fail2ban.sock')

# Marker used by the fail2ban server to delimit pickle messages. See
# the fail2ban protocol documentation for details【677544076733056†L200-L205】.
END_MARKER = b"<F2B_END_COMMAND>"


def send_command(command):
    """Send a command to the fail2ban socket and return the unpickled response.

    The command can be provided as a string (e.g. "status sshd") or as
    a list of arguments (e.g. ["status", "sshd"]). The function
    serialises the command using Python's pickle module and appends
    the END_MARKER to comply with the fail2ban protocol【677544076733056†L200-L205】.
    It then reads data from the socket until the marker is seen, strips
    the marker, and attempts to unpickle the response. If unpickling
    fails, the raw bytes are returned as a UTF‑8 string.
    """
    if isinstance(command, str):
        args = command.strip().split()
    else:
        args = command
    # Serialise the arguments into a pickle payload. Use protocol 0 (ASCII)
    # to maximise compatibility with older versions of fail2ban, which
    # expect default pickle format【677544076733056†L200-L205】.
    payload = pickle.dumps(list(args), protocol=0)
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.connect(SOCKET_PATH)
        client.sendall(payload + END_MARKER)
        data = b""
        while True:
            chunk = client.recv(4096)
            if not chunk:
                break
            data += chunk
            if END_MARKER in data:
                data = data.replace(END_MARKER, b"")
                break
    try:
        return pickle.loads(data)
    except Exception:
        try:
            return data.decode('utf-8', errors='ignore')
        except Exception:
            return str(data)


def flatten_response(resp):
    """
    Recursively flatten a nested list or tuple into a newline‑separated string.

    Fail2ban often returns complex nested lists via its socket API. To
    make parsing easier, this helper converts any nested structure
    into a flat string where each element is separated by a newline.
    """
    if isinstance(resp, (list, tuple)):
        parts = []
        for item in resp:
            parts.append(flatten_response(item))
        return "\n".join(part for part in parts if part)
    return str(resp)


def parse_global_status(output_or_resp):
    # 1) Preferred: structured answer
    if not isinstance(output_or_resp, str):
        d = _normalize_structured_response(output_or_resp)
        if d:
            jails = int(d.get("Number of jail", 0) or 0)
            jail_list_raw = d.get("Jail list", "")
            if isinstance(jail_list_raw, str):
                lst = [s.strip() for s in jail_list_raw.replace(
                    ',', ' ').split() if s.strip()]
            elif isinstance(jail_list_raw, (list, tuple)):
                lst = [str(x).strip() for x in jail_list_raw if str(x).strip()]
            else:
                lst = []
            return {"jails": jails, "list": lst}

    # 2) Fallback: Text output as before
    output = str(output_or_resp)
    lines = output.splitlines()
    jails = 0
    jail_list = []
    for line in lines:
        m = re.search(r"Number of jail:\s*(\d+)", line)
        if m:
            jails = int(m.group(1))
        m = re.search(r"Jail list:\s*(.+)", line)
        if m:
            jail_list = re.split(r",?\s+", m.group(1).strip())
    jail_list = [j for j in jail_list if j]
    return {"jails": jails, "list": jail_list}


def parse_jail_status(output_or_resp):
    # 1) Structured answer
    if not isinstance(output_or_resp, str):
        d = _normalize_structured_response(output_or_resp)
        if d:
            # In current Fail2ban versions, the data is located under "Filter" / "Actions"
            filt = d.get("Filter", {})
            act = d.get("Actions", {})

            # Helper function: read defensive values
            def g(obj, *keys, default=0):
                for k in keys:
                    if k in obj:
                        return obj[k]
                return default

            currently_failed = int(
                g(filt, "Currently failed", "currently failed", default=0) or 0
            )
            total_failed = int(
                g(filt, "Total failed", "total failed", default=0) or 0
            )

            file_list_raw = g(filt, "File list", "file list", default=[])
            file_list = _process_file_list(file_list_raw)

            currently_banned = int(
                g(act, "Currently banned", "currently banned", default=0) or 0
            )
            total_banned = int(
                g(act, "Total banned", "total banned", default=0) or 0
            )

            banned_raw = g(act, "Banned IP list", "banned IP list", default=[])
            if isinstance(banned_raw, str):
                banned_list = [s.strip()
                               for s in banned_raw.split() if s.strip()]
            elif isinstance(banned_raw, (list, tuple)):
                banned_list = [str(x).strip()
                               for x in banned_raw if str(x).strip()]
            else:
                banned_list = []

            return {
                "filter": {
                    "currentlyFailed": currently_failed,
                    "totalFailed": total_failed,
                    "fileList": file_list,
                },
                "actions": {
                    "currentlyBanned": currently_banned,
                    "totalBanned": total_banned,
                    "bannedIPList": banned_list,
                },
            }

    # 2) Fallback: existing text parser
    output = str(output_or_resp)
    lines = output.splitlines()
    currently_failed = 0
    total_failed = 0
    file_list = []
    currently_banned = 0
    total_banned = 0
    banned_ip_list = []

    for line in lines:
        m = re.search(r"Currently failed:\s*(\d+)", line)
        if m:
            currently_failed = int(m.group(1))
            continue
        m = re.search(r"Total failed:\s*(\d+)", line)
        if m:
            total_failed = int(m.group(1))
            continue
        m = re.search(r"File list:\s*(.+)", line)
        if m:
            raw_files = re.split(r",?\s+", m.group(1).strip())
            file_list = _process_file_list(raw_files)
            continue
        m = re.search(r"Currently banned:\s*(\d+)", line)
        if m:
            currently_banned = int(m.group(1))
            continue
        m = re.search(r"Total banned:\s*(\d+)", line)
        if m:
            total_banned = int(m.group(1))
            continue
        m = re.search(r"Banned IP list:\s*(.+)", line)
        if m:
            banned_ip_list = re.split(r"\s+", m.group(1).strip())
            continue

    banned_ip_list = [ip for ip in banned_ip_list if ip]

    return {
        "filter": {
            "currentlyFailed": currently_failed,
            "totalFailed": total_failed,
            "fileList": file_list,  # now uniform {path, exists}
        },
        "actions": {
            "currentlyBanned": currently_banned,
            "totalBanned": total_banned,
            "bannedIPList": banned_ip_list,
        },
    }


def _process_file_list(file_list_raw):
    """Converts file_list_raw to a list of {path, exists} objects.""""
    if isinstance(file_list_raw, str):
        paths = [s.strip()
                 for s in re.split(r",\s*|\s+", file_list_raw) if s.strip()]
    elif isinstance(file_list_raw, (list, tuple)):
        paths = [str(x).strip() for x in file_list_raw if str(x).strip()]
    else:
        paths = []
    return [{"path": p, "exists": os.path.exists(p)} for p in paths]


def _pairs_to_dict(obj):
    """Recursively converts [("Key", Value), ...] structures into dicts."""
    if isinstance(obj, (list, tuple)):
        if all(isinstance(x, (list, tuple)) and len(x) == 2 for x in obj):
            d = {}
            for k, v in obj:
                d[str(k)] = _pairs_to_dict(v)
            return d
    return obj


def _normalize_structured_response(resp):
    """
    Fail2ban often returns [0, [(k,v), ...]].
    Returns a dict or None if unrecognizable.
    """
    root = resp
    if isinstance(root, (list, tuple)) and len(root) == 2 and isinstance(root[1], (list, tuple)):
        root = root[1]
    if isinstance(root, (list, tuple)) and all(isinstance(x, (list, tuple)) and len(x) == 2 for x in root):
        return _pairs_to_dict(root)
    return None


class Handler(BaseHTTPRequestHandler):
    """HTTP request handler for the Fail2ban web interface.

    This handler implements a minimal API under the `/api/` prefix and
    serves static files from the `public` directory for all other
    paths. Errors are returned as JSON objects with an `error`
    property and HTTP status code 500 or 404 as appropriate.
    """

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        # API endpoints
        if path.startswith("/api/"):
            parts = path[len("/api/"):].strip("/").split("/")
            try:
                if len(parts) == 1 and parts[0] == "status":
                    raw = send_command(["status"])
                    text = flatten_response(raw)
                    result = parse_global_status(raw)
                    self._set_headers()
                    self.wfile.write(json.dumps(result).encode())
                    return
                if len(parts) == 1 and parts[0] == "jails":
                    raw = send_command(["status"])
                    text = flatten_response(raw)
                    result = parse_global_status(raw)
                    self._set_headers()
                    self.wfile.write(json.dumps(result["list"]).encode())
                    return
                if len(parts) == 3 and parts[0] == "jail" and parts[2] == "status":
                    jail = parts[1]
                    raw = send_command(["status", jail])
                    text = flatten_response(raw)
                    result = parse_jail_status(raw)
                    self._set_headers()
                    self.wfile.write(json.dumps(result).encode())
                    return

                if len(parts) == 1 and parts[0] == "file":
                    # Read parameters: ?path=...&lines=...
                    qs = parse_qs(parsed.query)
                    file_path = qs.get("path", [""])[0]
                    try:
                        lines_param = int(qs.get("lines", ["0"])[0])
                    except ValueError:
                        lines_param = 0

                    # Security check: allow absolute paths, but prevent traversal
                    abs_path = os.path.abspath(file_path)
                    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
                        self._set_headers(404)
                        self.wfile.write(json.dumps(
                            {"error": "File not found", "path": file_path}).encode())
                        return

                    try:
                        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                            if lines_param == 0:
                                content_lines = f.readlines()
                            elif lines_param > 0:
                                content_lines = [next(f) for _ in range(
                                    lines_param) if not f.closed]
                            else:
                                # negative -> last n lines
                                content_lines = f.readlines()[lines_param:]
                    except Exception as e:
                        self._set_headers(500)
                        self.wfile.write(json.dumps(
                            {"error": str(e)}).encode())
                        return
                    self._set_headers()
                    self.wfile.write(json.dumps({
                        "path": file_path,
                        "exists": True,
                        "lines": [line.rstrip("\n") for line in content_lines]
                    }).encode())
                    return

            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
                return
        # Static file serving
        if path == "/" or path == "":
            path = "/index.html"
        file_path = os.path.join("public", path.lstrip("/"))
        # Prevent directory traversal
        if not os.path.abspath(file_path).startswith(os.path.abspath("public")):
            self._set_headers(404, "text/plain")
            self.wfile.write(b"Not found1")
            return
        if os.path.exists(file_path) and os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_types = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
            }
            ctype = content_types.get(ext, "application/octet-stream")
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                self._set_headers(200, ctype)
                self.wfile.write(data)
            except Exception as e:
                self._set_headers(500, "text/plain")
                self.wfile.write(str(e).encode())
        else:
            self._set_headers(404, "text/plain")
            self.wfile.write(b"Not found2")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self._set_headers(404, "text/plain")
            self.wfile.write(b"Not found3")
            return
        parts = path[len("/api/"):].strip("/").split("/")
        try:
            length = int(self.headers.get("Content-Length", 0))
        except Exception:
            length = 0
        body = self.rfile.read(length).decode() if length > 0 else ""
        data = {}
        try:
            if body:
                data = json.loads(body)
        except Exception:
            pass
        try:
            if len(parts) == 3 and parts[0] == "jail" and parts[2] in ("ban", "unban"):
                jail = parts[1]
                action = parts[2]
                ip = data.get("ip", "")
                # Simple IPv4 validation
                if not ip or not re.match(r"^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$", ip):
                    self._set_headers(400)
                    self.wfile.write(json.dumps(
                        {"error": "A valid IPv4 address must be provided in the body as \"ip\""}).encode())
                    return
                cmd = ["set", jail, "banip" if action ==
                       "ban" else "unbanip", ip]
                raw = send_command(cmd)
                text = flatten_response(raw)
                self._set_headers()
                self.wfile.write(json.dumps({"result": text.strip()}).encode())
                return
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Not found4"}).encode())


def run():
    """Entry point to start the HTTP server."""
    port = int(os.getenv("PORT", "9000"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Server running on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
