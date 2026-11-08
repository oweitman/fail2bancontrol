"""Provider-independent cache and HTTP contract tests: python3 -m unittest discover -s test."""
import io
from concurrent.futures import ThreadPoolExecutor
import json
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src-backend'))
import ip_lookup
import app


class IPLookupTests(unittest.TestCase):
    def setUp(self):
        ip_lookup._cache.clear()
        self.provider = patch('ip_lookup.urlopen').start()
        self.provider.return_value.__enter__.side_effect = lambda: io.BytesIO(
            json.dumps({'ip': '8.8.8.8', 'asn': 15169, 'city': None}).encode())
        self.addCleanup(patch.stopall)

    def test_cache_and_forced_refresh_keep_actual_query_time(self):
        first = ip_lookup.lookup_ip('8.8.8.8')
        cached = ip_lookup.lookup_ip('8.8.8.8')
        self.assertFalse(first['cached'])
        self.assertTrue(cached['cached'])
        self.assertEqual(first['queriedAt'], cached['queriedAt'])
        self.provider.assert_called_once_with('https://ip-info.com/json?ip=8.8.8.8', timeout=10)
        self.assertFalse(ip_lookup.lookup_ip('8.8.8.8', force=True)['cached'])
        self.assertEqual(self.provider.call_count, 2)

    def test_exact_24_hour_expiry(self):
        with patch('ip_lookup.time.monotonic', return_value=100):
            first = ip_lookup.lookup_ip('8.8.8.8')
        with patch('ip_lookup.time.monotonic', return_value=100 + 86400 - 1):
            self.assertTrue(ip_lookup.lookup_ip('8.8.8.8')['cached'])
        with patch('ip_lookup.time.monotonic', return_value=100 + 86400):
            self.assertFalse(ip_lookup.lookup_ip('8.8.8.8')['cached'])
        self.assertEqual(self.provider.call_count, 2)
        self.assertTrue(first['queriedAt'].endswith('+00:00'))

    def test_invalid_and_nonpublic_addresses_never_reach_provider(self):
        for ip in ['example.com', '', '127.0.0.1', '10.0.0.1', '192.0.2.1', '::1', 'ff0e::1', '224.0.0.1']:
            with self.subTest(ip=ip), self.assertRaises(ip_lookup.LookupError) as error:
                ip_lookup.lookup_ip(ip)
            self.assertEqual(error.exception.status, 400)
        self.provider.assert_not_called()

    def test_ipv6_and_mapped_ipv4(self):
        self.provider.return_value.__enter__.side_effect = lambda: io.BytesIO(b'{"ip":"2001:4860:4860::8888"}')
        self.assertFalse(ip_lookup.lookup_ip('2001:4860:4860:0:0:0:0:8888')['cached'])
        self.provider.return_value.__enter__.side_effect = lambda: io.BytesIO(b'{"ip":"8.8.8.8"}')
        ip_lookup.lookup_ip('::ffff:8.8.8.8')
        self.assertTrue(ip_lookup.lookup_ip('8.8.8.8')['cached'])

    def test_failed_refresh_preserves_cache(self):
        first = ip_lookup.lookup_ip('8.8.8.8')
        self.provider.side_effect = URLError('offline')
        with self.assertRaises(ip_lookup.LookupError):
            ip_lookup.lookup_ip('8.8.8.8', force=True)
        self.assertEqual(ip_lookup.lookup_ip('8.8.8.8')['queriedAt'], first['queriedAt'])

    def test_errors_are_not_cached(self):
        cases = [
            (TimeoutError(), 504), (URLError('offline'), 502),
            (HTTPError('', 429, 'rate limit', {}, None), 429),
            (HTTPError('', 500, 'failure', {}, None), 502),
        ]
        for error, status in cases:
            with self.subTest(error=error):
                self.provider.side_effect = error
                with self.assertRaises(ip_lookup.LookupError) as raised:
                    ip_lookup.lookup_ip('8.8.8.8')
                self.assertEqual(raised.exception.status, status)
                self.assertFalse(ip_lookup._cache)

    def test_invalid_provider_payloads_are_not_cached(self):
        for payload in [b'not JSON', b'[]', b'{"ip":"1.1.1.1"}', b'{"error":"failure"}']:
            with self.subTest(payload=payload):
                self.provider.return_value.__enter__.side_effect = lambda: io.BytesIO(payload)
                with self.assertRaises(ip_lookup.LookupError):
                    ip_lookup.lookup_ip('8.8.8.8')
                self.assertFalse(ip_lookup._cache)

    def test_cache_is_bounded(self):
        with patch('ip_lookup.MAX_CACHE_ENTRIES', 1):
            ip_lookup.lookup_ip('8.8.8.8')
            self.provider.return_value.__enter__.side_effect = lambda: io.BytesIO(b'{"ip":"1.1.1.1"}')
            ip_lookup.lookup_ip('1.1.1.1')
        self.assertEqual(list(ip_lookup._cache), ['1.1.1.1'])


class HTTPContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}/api/ip-info'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_force_and_no_browser_caching(self):
        with patch('app.lookup_ip', return_value={'cached': False}) as lookup:
            with urlopen(self.base + '?ip=8.8.8.8&force=1') as response:
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertEqual(json.load(response), {'cached': False})
            lookup.assert_called_once_with('8.8.8.8', force=True)

    def test_slow_provider_does_not_block_status(self):
        started = threading.Event()
        release = threading.Event()

        def slow_lookup(*args, **kwargs):
            started.set()
            release.wait(5)
            return {"cached": False}

        with patch('app.lookup_ip', side_effect=slow_lookup), patch('app.send_command', return_value=''):
            with ThreadPoolExecutor(max_workers=1) as pool:
                pending = pool.submit(urlopen, self.base + '?ip=8.8.8.8')
                try:
                    self.assertTrue(started.wait(2))
                    with urlopen(self.base.replace('/ip-info', '/status'), timeout=2) as response:
                        self.assertEqual(response.status, 200)
                finally:
                    release.set()
                    pending.result(timeout=3).close()

    def test_bad_parameters(self):
        for query in ['', '?ip=', '?ip=8.8.8.8&ip=1.1.1.1', '?ip=8.8.8.8&force=yes', '?ip=8.8.8.8&other=1']:
            with self.subTest(query=query), self.assertRaises(HTTPError) as raised:
                urlopen(self.base + query)
            self.assertEqual(raised.exception.code, 400)


if __name__ == '__main__':
    unittest.main()
