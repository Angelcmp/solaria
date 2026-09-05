#!/usr/bin/env python3
"""Mock de la API de GitHub Releases para el benchmark del instalador.

Rutas:
  /repos/<owner>/<repo>/releases/tags/<tag>  -> release.json
  /repos/<owner>/<repo>/releases/latest       -> release.json
  /assets/<file>                              -> archivo del asset

Env: MOCK_TAG (ej. v9.9.9-bench), BASE_URL (ej. http://host:8000),
     ASSET_DIR (dir con tarball/.deb/SHA256SUMS.txt).
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

TAG = os.environ.get("MOCK_TAG", "v9.9.9-bench")
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000")
ASSET_DIR = os.environ.get("ASSET_DIR", ".")

VER = TAG[1:] if TAG.startswith("v") else TAG
ASSETS = [
    f"solaria-{VER}-linux-x86_64.tar.gz",
    f"solaria-agent_{VER}_amd64.deb",
    "SHA256SUMS.txt",
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if "/releases/tags/" in path or path.endswith("/releases/latest"):
            payload = {
                "tag_name": TAG,
                "assets": [
                    {
                        "name": name,
                        "browser_download_url": f"{BASE_URL}/assets/{name}",
                    }
                    for name in ASSETS
                ],
            }
            self._send(200, json.dumps(payload))
        elif path.startswith("/assets/"):
            name = path[len("/assets/"):]
            fpath = os.path.join(ASSET_DIR, os.path.basename(name))
            if os.path.isfile(fpath):
                with open(fpath, "rb") as fh:
                    self._send(200, fh.read(), "application/octet-stream")
            else:
                self._send(404, "no existe")
        else:
            self._send(404, "ruta desconocida")


if __name__ == "__main__":
    port = int(os.environ.get("MOCK_PORT", "8000"))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
