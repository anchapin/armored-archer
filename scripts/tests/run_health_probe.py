"""Run real Godot HTTP health-gate regressions against a disposable loopback fixture."""

import http.server
import os
import socket
import subprocess
import tempfile
import threading
import time
from pathlib import Path


class Fixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/timeout/"):
            time.sleep(6)
        if self.path.startswith("/disconnect/"):
            self.connection.shutdown(socket.SHUT_RDWR)
            self.connection.close()
            return
        code = 503 if self.path.startswith("/unavailable/") else 200
        if self.path.startswith("/no-content/"):
            code = 204
        self.send_response(code)
        self.end_headers()

    def log_message(self, *_args):
        pass


def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="health-probe-") as profile:
            env = {
                **os.environ,
                "E2E_TEST": "1",
                "XDG_DATA_HOME": profile,
                "HEALTH_FIXTURE_URL": f"http://127.0.0.1:{server.server_port}",
            }
            result = subprocess.run(
                [
                    os.environ.get("GODOT", "godot"),
                    "--headless",
                    "--path",
                    str(Path(__file__).resolve().parents[2]),
                    "--script",
                    "res://test/smoke/health_probe.gd",
                ],
                env=env,
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
            print(result.stdout)
            print(result.stderr)
            if (
                result.returncode
                or "HEALTH RESULT: failures=0" not in result.stdout
                or "SCRIPT ERROR" in result.stderr
            ):
                raise SystemExit(1)
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


if __name__ == "__main__":
    main()
