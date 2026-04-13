#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os


class Handler(BaseHTTPRequestHandler):
    def _reply(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ["/", "/health", "/api/health"]:
            self._reply(200, {"ok": True, "service": "noobty-tune-backend-placeholder"})
        else:
            self._reply(404, {"ok": False, "message": "Not Found"})

    def do_HEAD(self):
        if self.path in ["/", "/health", "/api/health"]:
            self.send_response(200)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3101"))
    server = HTTPServer(("127.0.0.1", port), Handler)
    server.serve_forever()
