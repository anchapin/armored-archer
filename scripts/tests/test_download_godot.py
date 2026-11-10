"""Loopback-only regression fixtures for the bounded Godot downloader."""

import io
import os
import subprocess
import tempfile
import threading
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HELPER = Path(__file__).parents[1] / "ci" / "download-godot.sh"


def archive(version="4.6.stable.official.fixture"):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as output:
        output.writestr("Godot_v4.6-stable_linux.x86_64", f"#!/bin/sh\necho {version}\n")
    return data.getvalue()


class DownloadGodotTest(unittest.TestCase):
    def run_fixture(self, statuses, body, success):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                status = statuses[min(len(requests), len(statuses) - 1)]
                requests.append(status)
                self.send_response(status)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            worker = threading.Thread(target=server.serve_forever)
            worker.start()
            try:
                with tempfile.TemporaryDirectory() as directory:
                    destination = Path(directory) / "godot4"
                    destination.write_text("previous binary")
                    result = subprocess.run(
                        ["bash", str(HELPER), str(destination),
                         f"http://127.0.0.1:{server.server_port}/godot.zip"],
                        text=True, capture_output=True, timeout=20, check=False,
                    )
                    self.assertEqual(result.returncode == 0, success, result.stderr)
                    self.assertIn("Godot download: HTTP", result.stdout)
                    self.assertEqual(list(Path(directory).glob(".godot-download.*")), [])
                    if success:
                        self.assertIn("Godot ready: 4.6.stable.", result.stdout)
                        self.assertTrue(destination.stat().st_mode & 0o111)
                    else:
                        self.assertEqual(destination.read_text(), "previous binary")
            finally:
                server.shutdown()
                worker.join()
        return requests

    def test_success(self):
        self.assertEqual(self.run_fixture([200], archive(), True), [200])

    def test_transient_503_then_success(self):
        self.assertEqual(self.run_fixture([503, 200], archive(), True), [503, 200])

    def test_persistent_503_stops_after_two_retries(self):
        self.assertEqual(self.run_fixture([503], b"unavailable", False), [503] * 3)

    def test_404_is_terminal(self):
        self.assertEqual(self.run_fixture([404], b"missing", False), [404])

    def test_truncated_zip_is_terminal(self):
        self.assertEqual(self.run_fixture([200], archive()[:30], False), [200])

    def test_invalid_archive_is_terminal(self):
        self.assertEqual(self.run_fixture([200], b"not a zip", False), [200])

    def test_wrong_version_does_not_replace_binary(self):
        self.assertEqual(self.run_fixture([200], archive("4.5.stable.fixture"), False), [200])

    def test_timeout_propagates_and_retains_bounded_curl_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            curl = root / "curl"
            curl.write_text("#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$CURL_ARGS\"\nexit 28\n")
            curl.chmod(0o700)
            args = root / "args"
            destination = root / "godot4"
            env = dict(os.environ, PATH=f"{root}:{os.environ['PATH']}", CURL_ARGS=str(args))
            result = subprocess.run(
                ["bash", str(HELPER), str(destination)], env=env,
                capture_output=True, text=True, timeout=5, check=False,
            )
            self.assertEqual(result.returncode, 28)
            self.assertFalse(destination.exists())
            self.assertEqual(list(root.glob(".godot-download.*")), [])
            options = args.read_text().splitlines()
            for flag, value in [("--connect-timeout", "15"), ("--max-time", "120"),
                                ("--retry", "2"), ("--retry-max-time", "360")]:
                self.assertEqual(options[options.index(flag) + 1], value)
            self.assertNotIn("--retry-all-errors", options)


if __name__ == "__main__":
    unittest.main()
