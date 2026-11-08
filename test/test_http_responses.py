"""Regression tests for browser disconnects and normal development shutdown."""
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src-backend'))
import app


class ResponseTests(unittest.TestCase):
    def make_handler(self):
        handler = app.Handler.__new__(app.Handler)
        handler.path = '/api/ip-info?ip=8.8.8.8'
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.wfile = Mock()
        handler.close_connection = False
        return handler

    def test_cancelled_ip_lookup_does_not_attempt_another_response(self):
        for failure in (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            for stage in ('headers', 'body'):
                with self.subTest(failure=failure, stage=stage):
                    handler = self.make_handler()
                    if stage == 'headers':
                        handler.end_headers.side_effect = failure()
                    else:
                        handler.wfile.write.side_effect = failure()
                    with patch('app.lookup_ip', return_value={'cached': True}):
                        handler.do_GET()
                    handler.send_response.assert_called_once_with(200)
                    self.assertTrue(handler.close_connection)
                    self.assertLessEqual(handler.wfile.write.call_count, 1)

    def test_genuine_backend_failure_still_returns_500(self):
        handler = self.make_handler()
        with patch('app.lookup_ip', side_effect=RuntimeError('lookup failed')):
            handler.do_GET()
        handler.send_response.assert_called_once_with(500)
        handler.wfile.write.assert_called_once_with(b'{"error": "lookup failed"}')

    def test_serialization_failure_does_not_send_partial_headers(self):
        handler = self.make_handler()
        with self.assertRaises(TypeError):
            app._json(handler, obj={'invalid': object()})
        handler.send_response.assert_not_called()

    def test_other_write_errors_are_not_hidden(self):
        handler = self.make_handler()
        handler.wfile.write.side_effect = OSError('unexpected write failure')
        with self.assertRaises(OSError):
            app._json(handler, obj={'ok': True})

    def test_successful_json_response_is_unchanged(self):
        handler = self.make_handler()
        app._json(handler, obj={'cached': False})
        handler.send_response.assert_called_once_with(200)
        handler.send_header.assert_any_call('Cache-Control', 'no-store')
        handler.wfile.write.assert_called_once_with(b'{"cached": false}')

    def test_disconnected_static_file_response_is_not_retried(self):
        handler = self.make_handler()
        handler.path = '/'
        handler.wfile.write.side_effect = BrokenPipeError()
        with patch('app.os.path.exists', return_value=True), patch('app.os.path.isfile', return_value=True), patch('builtins.open', return_value=io.BytesIO(b'frontend')):
            handler.do_GET()
        handler.send_response.assert_called_once_with(200)
        self.assertTrue(handler.close_connection)

    def test_ctrl_c_closes_server_without_traceback(self):
        with patch('app.ThreadingHTTPServer') as server_type, patch('builtins.print') as output:
            server = server_type.return_value.__enter__.return_value
            server.serve_forever.side_effect = KeyboardInterrupt()
            app.run()
        server_type.return_value.__exit__.assert_called_once()
        output.assert_any_call('\nServer stopped.')


if __name__ == '__main__':
    unittest.main()
