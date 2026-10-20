"""Local preview server that behaves like Vercel: unknown URLs get 404.html.

Usage: python3 serve.py [port]    (default 4173)
"""
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
NOT_FOUND = (ROOT / "404.html").read_bytes()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(NOT_FOUND)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(NOT_FOUND)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f"Serving http://localhost:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
