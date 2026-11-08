"""On-demand IP Info lookups with a shared, bounded 24-hour memory cache."""
import ipaddress
import json
import socket
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

CACHE_TTL = 24 * 60 * 60
MAX_CACHE_ENTRIES = 4096
_cache = OrderedDict()
_lock = threading.Lock()


class LookupError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def lookup_ip(value, force=False):
    try:
        address = ipaddress.ip_address(value)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
    except ValueError:
        raise LookupError(400, "Please provide a valid IP address.") from None
    if not address.is_global or address.is_multicast:
        raise LookupError(400, "Only public unicast IP addresses can be looked up.")
    ip = str(address)
    # Serialize lookups so simultaneous clicks cannot duplicate provider requests.
    # Other API endpoints continue to run in independent HTTP handler threads.
    with _lock:
        now = time.monotonic()
        for key in list(_cache):
            if now - _cache[key][0] >= CACHE_TTL:
                del _cache[key]
        if not force and ip in _cache:
            _cache.move_to_end(ip)
            return {**_cache[ip][1], "cached": True}

        url = 'https://ip-info.com/json?' + urlencode({"ip": ip})
        try:
            with urlopen(url, timeout=10) as response:
                data = json.loads(response.read(128 * 1024))
        except HTTPError as exc:
            if exc.code == 429:
                raise LookupError(429, "IP Info rate limit reached. Please try again later.") from None
            raise LookupError(502, "IP Info could not complete the lookup.") from None
        except (TimeoutError, socket.timeout):
            raise LookupError(504, "IP Info lookup timed out. Please try again.") from None
        except (URLError, OSError):
            raise LookupError(502, "IP Info is currently unavailable. Please try again.") from None
        except (ValueError, UnicodeError):
            raise LookupError(502, "IP Info returned an invalid response.") from None

        if not isinstance(data, dict) or data.get("ip") != ip or "error" in data:
            raise LookupError(502, "IP Info returned an invalid response.")
        result = {
            "data": data,
            "queriedAt": datetime.now(timezone.utc).isoformat(timespec='seconds'),
            "source": url,
        }
        _cache[ip] = (time.monotonic(), result)
        _cache.move_to_end(ip)
        while len(_cache) > MAX_CACHE_ENTRIES:
            _cache.popitem(last=False)
        return {**result, "cached": False}
