#!/usr/bin/env python3
"""Fail closed on host bind conflicts, preserving idempotent compose starts."""

import argparse
import ipaddress
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(argv, cwd):
    result = subprocess.run(argv, cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(f"{' '.join(argv[:3])} failed: {result.stderr.strip()}")
    return result.stdout


def overlaps(a, b):
    # Be conservative across IPv4/IPv6 wildcard sockets (dual-stack differs by host).
    if a in ("", "0.0.0.0", "::", "*") or b in ("", "0.0.0.0", "::", "*"):
        return True
    return ipaddress.ip_address(a.split("%")[0]) == ipaddress.ip_address(b.split("%")[0])


def desired_binds(config):
    result = []
    for name, service in config["services"].items():
        for port in service.get("ports", []):
            if not isinstance(port, dict):
                raise ValueError("Compose must return normalized port objects")
            published = port.get("published")
            # An ephemeral host port has no predetermined conflict to check.
            if published is None or str(published) == "0":
                continue
            protocol = port.get("protocol", "tcp")
            if protocol not in ("tcp", "udp"):
                raise ValueError(f"Unsupported protocol: {protocol}")
            parts = str(published).split("-")
            low, high = int(parts[0]), int(parts[-1])
            if len(parts) > 2 or not 1 <= low <= high <= 65535:
                raise ValueError(f"Invalid published port: {published}")
            result.extend(
                (port.get("host_ip") or "", number, protocol, name)
                for number in range(low, high + 1)
            )
    return result


def socket_binds(output, protocol):
    result = []
    for line in output.splitlines():
        fields = line.split()
        if len(fields) < 5:
            raise ValueError("Unrecognized ss output")
        address, port = fields[3].rsplit(":", 1)
        result.append((address.strip("[]"), int(port), protocol, line))
    return result


def container_binds(containers, project):
    result = []
    for container in containers:
        if not container.get("State", {}).get("Running"):
            continue
        labels = container.get("Config", {}).get("Labels") or {}
        service = labels.get("com.docker.compose.service")
        owned = labels.get("com.docker.compose.project") == project
        for target, mappings in (container.get("NetworkSettings", {}).get("Ports") or {}).items():
            protocol = target.rsplit("/", 1)[-1]
            for mapping in mappings or []:
                result.append(
                    (
                        mapping["HostIp"],
                        int(mapping["HostPort"]),
                        protocol,
                        service if owned else None,
                        container.get("Name", "container"),
                    )
                )
    return result


def conflicts(desired, sockets, containers):
    found = []
    for address, port, protocol, service in desired:
        matches = [c for c in containers if c[1:3] == (port, protocol) and overlaps(address, c[0])]
        foreign = [c for c in matches if c[3] != service]
        owned = any(c[3] == service and c[0] == (address or "0.0.0.0") for c in matches)
        if foreign:
            found.append(
                f"{service}: {address or '*'}:{port}/{protocol} held by "
                + ", ".join(c[4] for c in foreign)
            )
        elif not owned:
            for sock in sockets:
                if sock[1:3] == (port, protocol) and overlaps(address, sock[0]):
                    found.append(f"{service}: {address or '*'}:{port}/{protocol} in use: {sock[3]}")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("dev", "ci"), default="dev")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Compatibility flag; all compose binds are always checked",
    )
    args = parser.parse_args()
    cwd = ROOT / "backend" if args.profile == "dev" else ROOT
    compose = ["docker", "compose"]
    if args.profile == "ci":
        compose += ["-f", str(ROOT / ".github/docker-compose.yml"), "-p", "ci-armored-archer"]
    try:
        config = json.loads(run([*compose, "config", "--format", "json"], cwd))
        desired = desired_binds(config)
        sockets = socket_binds(run(["ss", "-H", "-ltnp"], cwd), "tcp")
        sockets += socket_binds(run(["ss", "-H", "-lunp"], cwd), "udp")
        ids = run(["docker", "ps", "-q"], cwd).split()
        containers = json.loads(run(["docker", "inspect", *ids], cwd)) if ids else []
        problems = conflicts(desired, sockets, container_binds(containers, config["name"]))
    except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
        print(f"Port preflight could not verify host binds: {error}", file=sys.stderr)
        return 2
    if problems:
        print("\n".join(problems), file=sys.stderr)
        print(
            "Stop the conflicting service or change the compose host bind. No services started.",
            file=sys.stderr,
        )
        return 1
    print(
        f"Port preflight passed ({len(desired)} resolved {args.profile} binds). "
        "Existing binds owned by the same compose service are allowed. "
        "Another process can still claim a port after this check."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
