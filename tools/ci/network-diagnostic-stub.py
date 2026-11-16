"""Loopback-only fixture for the actual IPA's native network diagnostics."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import uuid

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        status, data, code = {
            '/v1/health': (200, {'ok': True}, None),
            '/v1/info': (500, {'error': 'internal'}, 'SC_HTTP_500'),
            '/v1/ready': (503, {'ok': False}, 'SC_DB_01'),
        }.get(self.path, (404, {'error': 'not_found'}, 'SC_HTTP_404'))
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Crew-Request-Id', f'sc_{uuid.uuid4()}')
        if code:
            self.send_header('X-Crew-Diagnostic-Code', code)
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_args):
        pass

ThreadingHTTPServer(('127.0.0.1', 8799), Handler).serve_forever()
