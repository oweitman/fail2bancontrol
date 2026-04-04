# API

**Errors**

The API uses standard HTTP codes. Error body shape:

```json
{ "error": "<message>" }
```

---

## Status & Discovery

### GET `/api/status`

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

### GET `/api/jails`

Array of jail names (same as `status.list`).

**200**

```json
["sshd", "nginx-http-auth", "recidive"]
```

**500** On failure.

---

### GET `/api/jail/{jail}/status`

Detailed status for a **single jail**.

**Path params**

- `jail` — exact jail name

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
    },
    "extra": {
        "maxlines": "1",
        "maxmatches": "8",
        "maxretry": "8",
        "findtime": "600",
        "bantime": "7200"
    }
}
```

**500** Unknown jail or socket error.

---

### GET `/api/banned`

Collects **all banned IPv4 addresses** across Fail2ban output.

**200**

```json
{ "ips": ["1.2.3.4", "1.2.3.5"], "count": 2 }
```

---

## Ban / Unban

### POST `/api/jail/{jail}/ban`

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

### POST `/api/jail/{jail}/unban`

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

### Global Unban helpers

- **POST** `/api/unban/all` → runs `unban --all`
    - **200**

        ```json
        { "result": "<response>", "command": ["unban", "--all"] }
        ```

- **POST** `/api/unban/{ip}` → runs `unban <ip>`
    - **200**

        ```json
        { "result": "<response>", "command": ["unban", "1.2.3.4"] }
        ```

    - **400** if `{ip}` is not a valid IPv4.

- **POST** `/api/unban` with body `{ "ip": "1.2.3.4" }`
    - **200**

        ```json
        { "result": "<response>", "command": ["unban", "1.2.3.4"] }
        ```

    - **400** invalid/missing IPv4.

> **Note:** IPv6 is **not** accepted by these endpoints.

---

## Server Control

### POST `/api/server/start`

### POST `/api/server/restart`

### POST `/api/server/stop`

**200**

```json
{ "result": "<fail2ban textual response>" }
```

---

### POST `/api/server/reload`

Reload with optional flags.

**Body (all optional booleans)**

```json
{ "restart": false, "unban": false, "all": false }
```

Maps to:

- `--restart` if `restart: true`
- `--unban` if `unban: true`
- `--all` if `all: true`

**200**

```json
{
    "result": "<response>",
    "command": ["reload", "--restart", "--all"] // example
}
```

---

## Jail-Level Control

### POST `/api/jail/{jail}/restart`

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

### POST `/api/jail/{jail}/reload`

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

## Jail - Level Settings

### POST `/api/jail/{jail}/{settings}`

The following parameters are possible as {setting}

- findtime
- bantime
- maxretry
- maxmatches
- maxlines

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

## Version & Logging

### GET `/api/version`

Returns Fail2ban version (raw textual response collapsed to a string).

**200**

```json
{ "version": "1.1.0" }
```

> Also available as **POST** `/api/version` (same response).

---

### GET `/api/loglevel`

**200**

```json
{ "loglevel": "loglevel\nINFO" }
```

> Many “get” responses are **raw Fail2ban text**, often a **name line + value line**.
> In clients you may need to split on `\n` and read the **second line**.

---

### POST `/api/loglevel`

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

## Database Settings

### GET `/api/db/file`

**200**

```json
{ "dbfile": "dbfile\n/var/lib/fail2ban/fail2ban.sqlite3" }
```

### GET `/api/db/maxmatches`

**200**

```json
{ "dbmaxmatches": "dbmaxmatches\n10" }
```

### POST `/api/db/maxmatches`

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

### GET `/api/db/purgeage`

**200**

```json
{ "dbpurgeage": "dbpurgeage\n86400" }
```

### POST `/api/db/purgeage`

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

## File Read

### GET `/api/file?path=<abs-path>&lines=<n>`

Read a file from the host filesystem.

**Query**

- `path` (required) — absolute or relative (resolved to absolute)
- `lines` (optional, integer)
    - `0` or omitted → entire file
    - positive `n` → first `n` lines
    - negative `-n` → last `n` lines

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

## Static Files (non-API)

- `/` → serves `index.html` from `STATIC_ROOT`
- `/public/<path>` → serves from `STATIC_ROOT/<path>`
  Unknown static paths → `404`.

---

## Notes & Limitations

- IP validation is **IPv4 only** for ban/unban endpoints.
- Several “get” endpoints return **raw textual Fail2ban output** collapsed into a single string; clients often need to split lines and use the second line for the value.
- All commands are executed through the Fail2ban UNIX socket defined by `F2B_SOCKET`.
