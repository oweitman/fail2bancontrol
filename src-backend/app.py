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

# Marker used by the fail2ban server to delimit pickle messages.
END_MARKER = b"<F2B_END_COMMAND>"
STATIC_ROOT = os.path.abspath(os.getenv("STATIC_ROOT", "public"))
IPV4_RE = re.compile(
    r"^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$")

# -------- helpers -------------------------------------------------------------


def _collect_ips(obj):
    """Sammelt rekursiv IPv4-Adressen aus beliebigen fail2ban Antworten (list/tuple/str)."""
    ips = set()

    def walk(x):
        if isinstance(x, (list, tuple)):
            for it in x:
                walk(it)
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, (bytes, bytearray)):
            try:
                s = x.decode("utf-8", errors="ignore")
            except Exception:
                s = ""
            for token in re.split(r"[\s,;]+", s.strip()):
                if IPV4_RE.match(token):
                    ips.add(token)
        else:
            s = str(x)
            # Tokens aus Whitespace/Komma/Strichpunkt trennen
            for token in re.split(r"[\s,;]+", s.strip()):
                if IPV4_RE.match(token):
                    ips.add(token)
    walk(obj)
    # sortiert zurückgeben
    return sorted(ips, key=lambda ip: tuple(int(p) for p in ip.split(".")))


def _safe_join_static(relpath: str) -> str:
    abs_path = os.path.abspath(os.path.join(STATIC_ROOT, relpath.lstrip("/")))
    # prevent directory traversal
    if not abs_path.startswith(STATIC_ROOT + os.sep) and abs_path != STATIC_ROOT:
        return ""
    return abs_path


def _is_valid_ipv4(ip: str) -> bool:
    return bool(re.match(r"^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$", ip or ""))


def _bool(v, default=False):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        return v.strip().lower() in ("1", "true", "yes", "on")
    return default


def _json(self, status=200, obj=None, ctype="application/json"):
    self.send_response(status)
    self.send_header("Content-Type", ctype)
    self.end_headers()
    if obj is not None:
        self.wfile.write(json.dumps(obj).encode())

# -------- socket bridge -------------------------------------------------------


def send_command(command):
    """
    Send a command to the fail2ban socket and return the unpickled response.
    Accepts a string (e.g. "status sshd") or a list of args (["status","sshd"]).
    """
    if isinstance(command, str):
        args = command.strip().split()
    else:
        args = command

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
    """Recursively flatten nested lists/tuples to a newline-separated string."""
    if isinstance(resp, (list, tuple)):
        parts = [flatten_response(item) for item in resp]
        return "\n".join(part for part in parts if part)
    return str(resp)

# -------- parsers -------------------------------------------------------------


def parse_global_status(output_or_resp):
    # structured preferred
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

    # fallback text
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
    # structured
    if not isinstance(output_or_resp, str):
        d = _normalize_structured_response(output_or_resp)
        if d:
            filt = d.get("Filter", {})
            act = d.get("Actions", {})

            def g(obj, *keys, default=0):
                for k in keys:
                    if k in obj:
                        return obj[k]
                return default

            currently_failed = int(
                g(filt, "Currently failed", "currently failed", default=0) or 0)
            total_failed = int(
                g(filt, "Total failed", "total failed", default=0) or 0)
            file_list_raw = g(filt, "File list", "file list", default=[])
            file_list = _process_file_list(file_list_raw)

            currently_banned = int(
                g(act, "Currently banned", "currently banned", default=0) or 0)
            total_banned = int(
                g(act, "Total banned", "total banned", default=0) or 0)
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

    # fallback text
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
            "fileList": file_list,
        },
        "actions": {
            "currentlyBanned": currently_banned,
            "totalBanned": total_banned,
            "bannedIPList": banned_ip_list,
        },
    }


def _process_file_list(file_list_raw):
    """Converts file_list_raw to a list of {path, exists} objects."""
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

# -------- HTTP handler --------------------------------------------------------


class Handler(BaseHTTPRequestHandler):
    """HTTP request handler for the Fail2ban web interface."""

    # ------------------------------ GET --------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API endpoints
        if path.startswith("/api/"):
            parts = path[len("/api/"):].strip("/").split("/")
            try:
                # --- existing ---
                if len(parts) == 1 and parts[0] == "status":
                    raw = send_command(["status"])
                    result = parse_global_status(raw)
                    _json(self, 200, result)
                    return

                if len(parts) == 1 and parts[0] == "jails":
                    raw = send_command(["status"])
                    result = parse_global_status(raw)
                    _json(self, 200, result["list"])
                    return

                if len(parts) == 1 and parts[0] == "banned":
                    # maps to: fail2ban-client banned
                    raw = send_command(["banned"])
                    ips = _collect_ips(raw)
                    _json(self, 200, {"ips": ips, "count": len(ips)})
                    return

                if len(parts) == 3 and parts[0] == "jail" and parts[2] == "status":
                    jail = parts[1]
                    raw = send_command(["status", jail])
                    result = parse_jail_status(raw)
                    _json(self, 200, result)
                    return

                if len(parts) == 1 and parts[0] == "file":
                    qs = parse_qs(parsed.query)
                    file_path = qs.get("path", [""])[0]
                    try:
                        lines_param = int(qs.get("lines", ["0"])[0])
                    except ValueError:
                        lines_param = 0

                    abs_path = os.path.abspath(file_path)
                    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
                        _json(self, 404, {
                              "error": "File not found", "path": file_path})
                        return

                    try:
                        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                            if lines_param == 0:
                                content_lines = f.readlines()
                            elif lines_param > 0:
                                content_lines = [next(f) for _ in range(
                                    lines_param) if not f.closed]
                            else:
                                content_lines = f.readlines()[lines_param:]
                    except Exception as e:
                        _json(self, 500, {"error": str(e)})
                        return

                    _json(self, 200, {
                        "path": file_path,
                        "exists": True,
                        "lines": [line.rstrip("\n") for line in content_lines]
                    })
                    return

                # --- NEW: /api/version ---
                if len(parts) == 1 and parts[0] == "version":
                    raw = send_command(["version"])
                    _json(self, 200, {
                          "version": flatten_response(raw).strip()})
                    return

                # --- NEW: logging get ---
                if len(parts) == 1 and parts[0] == "loglevel":
                    raw = send_command(["get", "loglevel"])
                    _json(self, 200, {
                          "loglevel": flatten_response(raw).strip()})
                    return

                # --- NEW: database gets ---
                if len(parts) == 2 and parts[0] == "db" and parts[1] == "file":
                    raw = send_command(["get", "dbfile"])
                    _json(self, 200, {"dbfile": flatten_response(raw).strip()})
                    return

                if len(parts) == 2 and parts[0] == "db" and parts[1] == "maxmatches":
                    raw = send_command(["get", "dbmaxmatches"])
                    _json(self, 200, {
                          "dbmaxmatches": flatten_response(raw).strip()})
                    return

                if len(parts) == 2 and parts[0] == "db" and parts[1] == "purgeage":
                    raw = send_command(["get", "dbpurgeage"])
                    _json(self, 200, {
                          "dbpurgeage": flatten_response(raw).strip()})
                    return

            except Exception as e:
                _json(self, 500, {"error": str(e)})
                return

        # Static files
        if path == "/" or path == "":
            rel = "index.html"
        elif path.startswith("/public/"):
            rel = path[len("/public/"):]
        else:
            rel = path.lstrip("/")

        file_path = _safe_join_static(rel)
        if not file_path:
            _json(self, 404, {"error": "Not found (path)"})
            return

        if os.path.exists(file_path) and os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_types = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".mjs": "application/javascript",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".map": "application/json",
                ".woff": "font/woff",
                ".woff2": "font/woff2",
                ".ttf": "font/ttf",
            }
            ctype = content_types.get(ext, "application/octet-stream")
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                _json(self, 500, {"error": str(e)}, ctype="application/json")
        else:
            _json(self, 404, {"error": "Not found"})

    # ------------------------------ POST -------------------------------------
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if not path.startswith("/api/"):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
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
            data = {}

        try:
            # ------- existing jail ban/unban -------
            if len(parts) == 3 and parts[0] == "jail" and parts[2] in ("ban", "unban"):
                jail = parts[1]
                action = parts[2]
                ip = data.get("ip", "")
                if not _is_valid_ipv4(ip):
                    _json(self, 400, {
                          "error": "A valid IPv4 address must be provided in the body as \"ip\""})
                    return
                cmd = ["set", jail, "banip" if action ==
                       "ban" else "unbanip", ip]
                raw = send_command(cmd)
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

            # ------- NEW: BASIC server control -------
            if len(parts) == 2 and parts[0] == "server" and parts[1] == "start":
                raw = send_command(["start"])
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

            if len(parts) == 2 and parts[0] == "server" and parts[1] == "restart":
                raw = send_command(["restart"])
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

            if len(parts) == 2 and parts[0] == "server" and parts[1] == "reload":
                # Body: { "restart": bool, "unban": bool, "all": bool }
                flags = []
                if _bool(data.get("restart", False)):
                    flags.append("--restart")
                if _bool(data.get("unban",   False)):
                    flags.append("--unban")
                if _bool(data.get("all",     False)):
                    flags.append("--all")
                cmd = ["reload"] + flags
                raw = send_command(cmd)
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": cmd})
                return

            if len(parts) == 2 and parts[0] == "server" and parts[1] == "stop":
                raw = send_command(["stop"])
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

            if len(parts) == 1 and parts[0] == "version":
                raw = send_command(["version"])
                _json(self, 200, {"version": flatten_response(raw).strip()})
                return

            # ------- NEW: jail-level restart/reload -------
            if len(parts) == 3 and parts[0] == "jail" and parts[2] == "restart":
                jail = parts[1]
                # maps to: restart [--unban] [--if-exists] <JAIL>
                flags = []
                if _bool(data.get("unban", False)):
                    flags.append("--unban")
                if _bool(data.get("ifExists", False)):
                    flags.append("--if-exists")
                cmd = ["restart"] + flags + [jail]
                raw = send_command(cmd)
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": cmd})
                return

            if len(parts) == 3 and parts[0] == "jail" and parts[2] == "reload":
                jail = parts[1]
                # maps to: reload [--restart] [--unban] [--if-exists] <JAIL>
                flags = []
                if _bool(data.get("restart", False)):
                    flags.append("--restart")
                if _bool(data.get("unban",   False)):
                    flags.append("--unban")
                if _bool(data.get("ifExists", False)):
                    flags.append("--if-exists")
                cmd = ["reload"] + flags + [jail]
                raw = send_command(cmd)
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": cmd})
                return

            # ------- NEW: global unban -------
            # POST /api/unban/all  ->  unban --all
            if len(parts) == 2 and parts[0] == "unban" and parts[1] == "all":
                raw = send_command(["unban", "--all"])
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": ["unban", "--all"]})
                return

            # POST /api/unban/<ip>  ->  unban <ip>
            if len(parts) == 2 and parts[0] == "unban" and _is_valid_ipv4(parts[1]):
                ip = parts[1]
                raw = send_command(["unban", ip])
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": ["unban", ip]})
                return

            # POST /api/unban  with body { "ip": "1.2.3.4" }  ->  unban <ip>
            if len(parts) == 1 and parts[0] == "unban":
                ip = data.get("ip", "")
                if not _is_valid_ipv4(ip):
                    _json(self, 400, {
                          "error": "Body must contain a single valid IPv4 as \"ip\""})
                    return
                raw = send_command(["unban", ip])
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": ["unban", ip]})
                return

            # ------- NEW: logging set -------
            if len(parts) == 1 and parts[0] == "loglevel":
                # POST to set: { "level": "INFO" } or { "level": 20 }
                level = data.get("level", None)
                if level is None:
                    _json(self, 400, {"error": "Body must contain \"level\""})
                    return
                if isinstance(level, int):
                    lvl_str = str(level)
                else:
                    lvl_str = str(level).strip().upper()
                # Accepted by fail2ban: CRITICAL, ERROR, WARNING, NOTICE, INFO, DEBUG, TRACEDEBUG, HEAVYDEBUG or 50-5
                cmd = ["set", "loglevel", lvl_str]
                raw = send_command(cmd)
                _json(self, 200, {"result": flatten_response(
                    raw).strip(), "command": cmd})
                return

            # ------- NEW: database set/get -------
            if len(parts) == 2 and parts[0] == "db" and parts[1] == "maxmatches":
                # POST set: { "value": 10 } ; GET is handled in do_GET
                value = data.get("value", None)
                if value is None:
                    _json(self, 400, {
                          "error": "Body must contain \"value\" (int)"})
                    return
                try:
                    ival = int(value)
                except Exception:
                    _json(self, 400, {"error": "\"value\" must be an integer"})
                    return
                raw = send_command(["set", "dbmaxmatches", str(ival)])
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

            if len(parts) == 2 and parts[0] == "db" and parts[1] == "purgeage":
                # POST set: { "seconds": 86400 } ; GET is handled in do_GET
                seconds = data.get("seconds", None)
                if seconds is None:
                    _json(self, 400, {
                          "error": "Body must contain \"seconds\" (int)"})
                    return
                try:
                    ival = int(seconds)
                except Exception:
                    _json(self, 400, {
                          "error": "\"seconds\" must be an integer"})
                    return
                raw = send_command(["set", "dbpurgeage", str(ival)])
                _json(self, 200, {"result": flatten_response(raw).strip()})
                return

        except Exception as e:
            _json(self, 500, {"error": str(e)})
            return

        _json(self, 404, {"error": "Not found"})

# -------- boot ---------------------------------------------------------------


def run():
    """Entry point to start the HTTP server."""
    port = int(os.getenv("PORT", "9000"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Server running on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
