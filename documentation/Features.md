# Feature Guide and Usage

This document describes the current features of Fail2ban Web Control and how to
use them. Labels shown in bold match the labels in the interface. Installation
guides and the full API reference are linked under
[Further documentation](#further-documentation).

## Contents

- [Architecture and Fail2ban connection](#architecture-and-fail2ban-connection)
- [Server overview and navigation](#server-overview-and-navigation)
- [Server controls](#server-controls)
- [Global settings](#global-settings)
- [Jails and metrics](#jails-and-metrics)
- [Banning and unbanning IP addresses](#banning-and-unbanning-ip-addresses)
- [Information about a banned IP](#information-about-a-banned-ip)
- [Changing jail parameters](#changing-jail-parameters)
- [Viewing and following log files](#viewing-and-following-log-files)
- [Appearance, version, and update notifications](#appearance-version-and-update-notifications)
- [Refresh behavior and storage](#refresh-behavior-and-storage)
- [HTTP API and additional features](#http-api-and-additional-features)
- [Operation and known limitations](#operation-and-known-limitations)
- [Further documentation](#further-documentation)

## Architecture and Fail2ban connection

Fail2ban Web Control consists of a React/MUI frontend and a Python backend.
The browser accesses the backend through its HTTP API. The backend sends
management commands directly to the UNIX socket of an existing Fail2ban instance.

The application does not run its own Fail2ban instance or require a separate
`fail2ban-client` process. The backend must be able to reach and access the socket.
With Docker, mount the entire socket directory into the container. This avoids a
stale file mount when Fail2ban replaces its socket file during a restart.

| Environment variable | Purpose | Backend default |
| --- | --- | --- |
| `F2B_SOCKET` | Path to the Fail2ban socket. | `/var/run/fail2ban/fail2ban.sock` |
| `STATIC_ROOT` | Directory containing the built frontend. | `public`, relative to the working directory. |
| `PORT` | Backend HTTP port. | `9000` |

The production image serves the frontend from `/app/public`. In the devcontainer,
`STATIC_ROOT` points to the built files under `src-frontend/dist`. During
development, Vite serves the interface on port `5173` and proxies `/api` requests
to the backend on port `9000`.

## Server overview and navigation

**Server Overview** brings together the main information:

- Version of the connected Fail2ban instance.
- Path to the Fail2ban database under **DB file**.
- Current **Log level**.
- Global database parameters `dbmaxmatches` and `dbpurgeage`.
- Number and names of the jails discovered when the page loads.
- List of banned IPv4 addresses across all jails under **Banned IPs**.

Jail names appear as chips. Clicking a chip jumps to that jail on the same page.
Clicking a jail's title returns to the server overview. The global IP list contains
each detected IPv4 address once, even if it is banned in multiple jails.

The jail list is loaded when the page opens. After changing the jail configuration,
reload the page so that newly added or removed jails are reflected in navigation.

## Server controls

The following actions are available at the top right of the server overview.
Hover over an icon to see its action name.

| Action | Operation requested through the backend |
| --- | --- |
| **Start fail2ban** | Sends `start` through the Fail2ban socket. |
| **Stop fail2ban** | Sends `stop` through the Fail2ban socket. |
| **Restart fail2ban** | Sends `restart` through the Fail2ban socket. |
| **Reload fail2ban** | Sends `reload` without additional options. |

The overview displays brief notifications for completed HTTP requests or request
errors and reloads its values. The commands supported by the connected instance
depend on Fail2ban.

These actions do not invoke `systemctl` or Docker. In particular, **Start** cannot
launch a fully stopped Fail2ban process whose socket is unavailable. Start that
service or container outside the web interface. After **Stop**, further requests
may therefore fail until Fail2ban is running again.

## Global settings

### Log level

The slider provides these levels:

`CRITICAL` → `ERROR` → `WARNING` → `NOTICE` → `INFO` → `DEBUG`

Changes are sent directly to the backend and then to Fail2ban. No separate Save
button is required. Additional debug levels are not selectable in the slider;
the API can accept other values supported by the connected Fail2ban version.

### Database parameters

| Field | Purpose | Unit/input |
| --- | --- | --- |
| **DB file** | Shows the database path reported by Fail2ban. | Display only. |
| `dbmaxmatches` | Limits the matches stored per ticket in the Fail2ban database. | Nonnegative integer. |
| `dbpurgeage` | Age after which Fail2ban should purge database entries. | Seconds; nonnegative integer. |

Changes to the numeric fields are sent automatically after approximately one
second without further input. The overview then reloads the values. For example,
one day corresponds to `86400` seconds.

These controls change the running Fail2ban state. The application does not write
Fail2ban configuration files. Maintain permanent settings in the Fail2ban
configuration; restarting or reloading the configuration can overwrite runtime
changes.

## Jails and metrics

A separate card appears for each jail discovered when the page loads. It contains
metrics, log files, banned IPs, a manual ban field, and the expandable
**Extra Info** section.

| Section | Value | Meaning |
| --- | --- | --- |
| **Banned** | **Current** | Currently banned addresses reported by the jail status. |
| **Banned** | **Total** | Total number of bans reported by Fail2ban. |
| **Failed** | **Current** | Current failure counter of the filter. |
| **Failed** | **Total** | Total number of failures/matches reported by Fail2ban. |

These numbers come from Fail2ban's status. The application does not calculate
its own historical statistics or store time series.

The refresh icon to the right of the jail title reloads that jail's status and
additional parameters. The cards do not update continuously; use the icon or
reload the page for a fresh snapshot.

## Banning and unbanning IP addresses

### Banning manually

1. Open the desired jail or jump to it using its jail chip.
2. Enter a complete IPv4 address in **Enter IP to Ban**.
3. Click **Ban**.

The input is validated before a ban is requested for that jail. After a successful
request, the input is cleared and the jail status is reloaded. Input and request
errors are displayed next to the field.

Manual banning accepts individual IPv4 addresses. IPv6 addresses, hostnames, and
CIDR networks are not supported here.

### Unbanning a single IP

Each banned IP appears as a chip with two distinct actions:

| Interaction | Result |
| --- | --- |
| Click the chip or IP address. | Opens the IP information dialog. |
| Click the delete icon inside the chip. | Requests an unban. |

**Current scope:** Both the overview and the jail cards currently use the global
unban endpoint for this click. The address is therefore unbanned across jails,
even when the chip appears inside a specific jail. The API also provides an
explicitly jail-specific unban endpoint.

### Removing all bans

The **Delete all banned IPs** icon in an IP list's header executes `unban --all`.
This action applies to the entire Fail2ban instance, including when triggered
inside a jail card. There is no additional confirmation dialog. Check the global
scope before clicking it.

Unbanning removes existing bans. Filters and jail rules remain active and may ban
an address again after new matches.

## Information about a banned IP

### Opening the dialog

Click an IP chip in the overview or a jail to open **IP information: …**. The jail
view remains in the background. Click **Close** to dismiss the dialog.

The frontend requests the information from its own backend. Only this user action
triggers an IP lookup; loading the IP list does not automatically send addresses
to the provider. The backend uses `https://ip-info.com/json?ip=…`. The integrated
lookup does not require an API key.

### Displayed information

| Dialog field | Contents |
| --- | --- |
| **Organization** | Organization associated with the IP according to the provider. |
| **ASN** | Autonomous system number, prefixed with `AS`. |
| **ASN name** | Name of the autonomous system. |
| **ISP** | Internet service provider. |
| **Country** | Country name. |
| **Region** | Region or state. |
| **District** | District or administrative subdivision. |
| **City** | City or town. |
| **Postal code** | Postal code. |
| **Approximate coordinates** | Approximate geographic coordinates. |
| **Time zone** | Time zone of the associated location. |
| **Connection type** | Connection classification supplied by the provider. |
| **Network usage** | Usage classification supplied by the provider. |

Missing values appear as **Unavailable**. The **Source: ip-info.com** link opens
the lookup source in a new tab. The current dialog does not display a network
range/CIDR, and no separate WHOIS/RDAP lookup is integrated.

Location data is approximate and may be incomplete or outdated. It does not
identify a person's exact location or identity. The information provides context
when assessing a ban.

### Timestamp and source

**Queried at** shows the date and time of the completed provider lookup, including
seconds and a time zone. The backend supplies the timestamp in UTC; the browser
formats it in its local time zone. The same line also shows:

- **From server cache**: An existing backend result was reused.
- **Fresh lookup**: The backend retrieved new data from the provider.

A cache hit does not change the original query timestamp. **Queried at** records
when this application retrieved the information, rather than when the provider's
database was updated. The **Time zone** field in the data table instead refers
to the IP's associated location.

### Fixed 24-hour cache

Successful results are stored in backend memory:

- Entries are valid for a fixed **24 hours after successful retrieval**.
- The same entry is shared by all jails and browsers using that backend process.
- Reopening the dialog within that period does not require another provider request.
- After expiry, opening the dialog triggers a new lookup; there is no background refresh.
- The cache holds up to **4096 IP addresses**. When the limit is reached, the least
  recently used entries are evicted, so another lookup may be necessary before
  24 hours have elapsed.
- Restarting the Web Control backend clears the cache.
- Separate backend instances do not share their caches.

The cache duration is fixed, there is no settings menu for it, and IP results are
not persisted in the browser. HTTP responses use `Cache-Control: no-store`.
Reloading the browser page does not clear the backend cache.

### Forcing a new lookup

**Query again** bypasses the backend cache and requests a real provider lookup.
The button is disabled while a request is in progress. A successful lookup replaces
the entry, updates its timestamp, and starts a new 24-hour validity period.

If a request fails, data already displayed in the open dialog remains visible
with its original timestamp. An error message is shown alongside it. Failed
lookups are not cached as successful results, and a failed refresh does not
replace a still-valid cache entry. If the dialog has no previous result, only
the error is displayed.

Invalid or nonpublic IP addresses are rejected. The lookup API supports public
IPv4 and IPv6 addresses; this does not extend the IPv4-only management functions
or global IP list.

The backend handles provider errors, rate limits, and timeouts. Provider requests
use a ten-second timeout. Simultaneous IP lookups are serialized, so another
request may also spend time waiting. Other HTTP requests can be processed
independently.

The provider receives the queried IP and the backend's public address. The browser
does not contact the provider directly for the lookup. Opening the source link,
however, visits the provider directly from the browser.

## Changing jail parameters

Open **Extra Info** to access a jail's additional settings.

| Parameter | Purpose | Unit |
| --- | --- | --- |
| `findtime` | Time window in which Fail2ban counts relevant failures. | Seconds. |
| `bantime` | Duration of a ban. | Seconds. |
| `maxretry` | Number of failures required for a ban within the search window. | Count. |
| `maxmatches` | Maximum number of matches retained with a ticket. | Count. |
| `maxlines` | Maximum lines in the filter buffer, for example for multiline patterns. | Count. |

The interface loads these values from the jail status. Changes are sent to the
backend automatically after approximately one second without further input;
there is no Save button. The interface accepts values starting at `1`. Special
negative Fail2ban values, such as an unlimited ban duration, are not offered here.
The connected Fail2ban instance ultimately determines which values are supported.

Changes apply at runtime. For permanent changes, edit the corresponding jail
configuration outside the application. The web interface does not include an
editor for Fail2ban configuration files.

## Viewing and following log files

### File list and availability

**Filelist** displays the log files reported by Fail2ban for that jail as chips.
The backend checks whether each path exists as a file.

- Existing files can be opened with a click.
- Missing files appear in a warning color and cannot be clicked.
- The existence check does not guarantee read permission.

When using a container, make the files available inside it, preferably through
read-only mounts. Paths must match those reported by Fail2ban. A journal backend
may not supply such file paths; the application does not include a journal browser.

### File dialog

The dialog shows the file path in its title and the contents as preformatted text.
It initially uses approximately 80 percent of the window's width and height and
can be resized depending on the browser. **Close** ends the display and its
periodic requests.

| Control | Function | Default without a saved setting |
| --- | --- | --- |
| **Tail (last lines)** | Shows only the last lines. | Enabled. |
| **Entire file** | Shows the whole file when tail mode is disabled. | Not enabled. |
| **Lines** | Number of last lines; available only in tail mode. | `20`; minimum `1`. |
| **Interval (s)** | Interval between automatic file requests. | `5` seconds; minimum `1`. |

Contents are loaded when the dialog opens and requested again at the selected
interval. This uses HTTP polling rather than a continuous stream. In **Entire
file** mode, every refresh requests the whole file again; tail mode is more
efficient for large files.

Tail mode, line count, and interval are stored in `localStorage` for that browser
and website origin. They survive page reloads and serve as defaults when opening
other files. This does not persist file contents in the browser.

## Appearance, version, and update notifications

### Light and dark appearance

The theme icon on the right of the server overview switches between light and
dark appearance. The interface starts in dark mode. The selection is currently
kept only in page state and is not restored after reloading.

### Version display and project links

The footer shows the application version embedded during the frontend build.
This is separate from the Fail2ban version shown in the server overview.

On loading, the frontend checks the GitHub Releases API for a newer project
version. A successfully retrieved version is cached **in the browser for six
hours**. If a newer version exists, **Update available: …** links to the releases.

This feature does not install updates. Update the application or Docker image
separately. If GitHub is unavailable, the version notification may be absent;
local management remains independent of that check.

Other links lead to the repository, Docker Hub, **Support & Issues**, and releases.
The GitHub version check is a separate browser request, independent of the IP
lookups that run only after a click.

## Refresh behavior and storage

| Data/setting | Refresh or validity | Storage |
| --- | --- | --- |
| Jail list/navigation | When the page loads. | Page state. |
| Server overview | On loading and after related actions. | Page state; the overview request also uses a short 300 ms backend cache. |
| Jail status | On loading, through its refresh icon, and after related actions. | Page state. |
| Open log file | At the configured interval. | Display state. |
| Log viewer settings | Until changed or browser data is cleared. | Browser `localStorage`. |
| IP information | 24 hours; refreshed on opening or through a forced lookup. | Bounded backend memory cache. |
| Latest application version retrieved | Six hours. | Browser `localStorage`. |
| Light/dark selection | Until the page is reloaded. | Page state. |
| Changed Fail2ban parameters | Runtime state of the connected instance. | Fail2ban; no configuration files are written. |

Not every action refreshes every card. If displays differ, refresh the affected
jail or reload the entire page. There is no central setting for periodically
refreshing all status values.

## HTTP API and additional features

The local HTTP API used by the frontend is also available to other clients.
The [API reference](API.md) describes requests, parameters, and responses.

| Area | Features |
| --- | --- |
| Status | Global status, jail list, jail status with parameters, global IPv4 ban list, and combined server overview. |
| Bans | Jail-specific ban/unban and global unban for individual IPv4 addresses or all bans. |
| Server | Start, stop, restart, and reload; reload also accepts optional flags. |
| Jails | Additional jail-specific restart/reload endpoints with optional flags; there are currently no separate UI buttons for these. |
| Settings | Log level, database parameters, and the five jail parameters. |
| Files | Whole file, first lines, or last lines. The interface uses whole file or last lines. |
| IP information | `GET /api/ip-info?ip=…`, optionally with `force=1` to force a lookup. |
| Frontend | Serving built static files through the backend. |

The API is not a separate configuration store. Management calls affect the
connected Fail2ban instance. The application does not include login, user
management, or role checks. The file-reading endpoint also has no path allowlist.
Provide access control in the deployment environment, for example through a
reverse proxy and network access restrictions.

## Operation and known limitations

- The socket connection requires a suitable Linux/UNIX environment and appropriate
  permissions. Socket and log mounts refer to paths on the Docker host.
- IP management functions and the global ban list are currently limited to IPv4.
  The IP lookup API additionally supports public IPv6 addresses.
- **Delete all** acts globally. In the current frontend, clicking the unban icon
  for an individual IP inside a jail card also acts globally.
- The application does not create or delete jails, edit filter rules, or write
  permanent Fail2ban configuration.
- There is no stored event history, charting, or long-term statistics.
- The API reports HTTP/connection errors, but not every management endpoint
  evaluates Fail2ban's result status before returning HTTP success. Check the
  actual state through a fresh status request after making changes.
- Not all components display request errors in a dedicated dialog. File-reading
  errors and some jail request errors are currently logged in the browser console.
  Previously displayed values may remain unchanged in those cases.
- IP lookups require outbound HTTPS access from the backend. The update check
  requires browser access to the GitHub API. Socket-based management does not
  require either external service.

## Further documentation

- [Install using the Docker Hub image](InstallDockerhubDocker.md)
- [Build the Docker image locally](InstallGithubDocker.md)
- [Local installation without Docker](InstallLocalNoDocker.md)
- [HTTP API](API.md)
- [Development with the devcontainer and VS Code](../.devcontainer/README.md)
- [Back to the README](../README.md)
