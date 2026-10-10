"""Regression tests for compose bind preflight, without Docker or host changes."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "ports", Path(__file__).parents[1] / "check_compose_ports.py"
)
PORTS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PORTS)


class ComposePortsTest(unittest.TestCase):
    def test_normalized_ranges_udp_and_ephemeral(self):
        config = {
            "services": {
                "test": {
                    "ports": [
                        {"published": "6831-6832", "protocol": "udp", "host_ip": "127.0.0.1"},
                        {"target": 80},
                        {"published": "0"},
                    ]
                }
            }
        }
        self.assertEqual(
            PORTS.desired_binds(config),
            [("127.0.0.1", 6831, "udp", "test"), ("127.0.0.1", 6832, "udp", "test")],
        )

    def test_invalid_config_fails(self):
        with self.assertRaises(ValueError):
            PORTS.desired_binds({"services": {"test": {"ports": ["80:80"]}}})
        with self.assertRaises(ValueError):
            PORTS.desired_binds({"services": {"test": {"ports": [{"published": "70000"}]}}})

    def test_ss_tcp_udp_ipv6(self):
        self.assertEqual(
            PORTS.socket_binds("LISTEN 0 128 [::]:7350 [::]:* users:pid=12", "tcp")[0][:3],
            ("::", 7350, "tcp"),
        )
        self.assertEqual(
            PORTS.socket_binds("UNCONN 0 0 0.0.0.0:6831 0.0.0.0:*", "udp")[0][:3],
            ("0.0.0.0", 6831, "udp"),
        )
        with self.assertRaises(ValueError):
            PORTS.socket_binds("not socket output", "tcp")

    def test_native_wildcard_and_address_scope(self):
        desired = [("127.0.0.1", 5433, "tcp", "postgres")]
        socket = [("127.0.0.2", 5433, "tcp", "other interface")]
        self.assertEqual(PORTS.conflicts(desired, socket, []), [])
        self.assertTrue(PORTS.conflicts(desired, [("::", 5433, "tcp", "native process")], []))
        self.assertEqual(PORTS.conflicts(desired, [("0.0.0.0", 5433, "udp", "UDP only")], []), [])

    def test_same_service_idempotent_other_service_conflicts(self):
        desired = [("", 5433, "tcp", "postgres")]
        sockets = [("0.0.0.0", 5433, "tcp", "docker-proxy")]
        owned = [("0.0.0.0", 5433, "tcp", "postgres", "/db")]
        self.assertEqual(PORTS.conflicts(desired, sockets, owned), [])
        self.assertTrue(
            PORTS.conflicts(desired, sockets, [("0.0.0.0", 5433, "tcp", "nakama", "/wrong")])
        )
        self.assertTrue(PORTS.conflicts(desired, [], [("0.0.0.0", 5433, "tcp", None, "/foreign")]))

    def test_container_ownership_stopped_and_protocol(self):
        container = {
            "State": {"Running": True},
            "Config": {
                "Labels": {
                    "com.docker.compose.project": "backend",
                    "com.docker.compose.service": "db",
                }
            },
            "NetworkSettings": {"Ports": {"5432/tcp": [{"HostIp": "0.0.0.0", "HostPort": "5433"}]}},
            "Name": "/db",
        }
        self.assertEqual(PORTS.container_binds([container], "backend")[0][3], "db")
        self.assertIsNone(PORTS.container_binds([container], "ci")[0][3])
        container["State"]["Running"] = False
        self.assertEqual(PORTS.container_binds([container], "backend"), [])

    def test_inspection_failure_returns_two(self):
        with (
            patch("sys.argv", ["check"]),
            patch.object(PORTS, "run", side_effect=RuntimeError("probe failed")),
        ):
            self.assertEqual(PORTS.main(), 2)

    def test_dev_uses_resolved_config_no_env_port_guess(self):
        config = {"name": "backend", "services": {"redis": {"ports": [{"published": "6380"}]}}}
        calls = []

        def fake_run(argv, cwd):
            calls.append((argv, cwd))
            if "config" in argv:
                return json.dumps(config)
            return ""

        with patch("sys.argv", ["check"]), patch.object(PORTS, "run", side_effect=fake_run):
            self.assertEqual(PORTS.main(), 0)
        self.assertEqual(calls[0][1], PORTS.ROOT / "backend")
        self.assertEqual(calls[0][0], ["docker", "compose", "config", "--format", "json"])

    def test_ci_explicit_project_and_same_service(self):
        config = {
            "name": "ci-armored-archer",
            "services": {"postgres": {"ports": [{"published": "5432"}]}},
        }
        calls = []

        def fake_run(argv, cwd):
            calls.append((argv, cwd))
            if "config" in argv:
                return json.dumps(config)
            return ""

        with (
            patch("sys.argv", ["check", "--profile", "ci", "--all"]),
            patch.object(PORTS, "run", side_effect=fake_run),
        ):
            self.assertEqual(PORTS.main(), 0)
        self.assertIn("ci-armored-archer", calls[0][0])
        self.assertEqual(calls[0][1], PORTS.ROOT)

    def test_subprocess_failure_is_not_empty_probe(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                PORTS.run(["python3", "-c", "raise SystemExit(1)"], directory)


if __name__ == "__main__":
    unittest.main()
