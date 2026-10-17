#!/usr/bin/env python3
"""Contract test for the Alertmanager receiver wiring (issue #1659).

Every ${VAR} referenced in backend/alertmanager.yml must be:
  1. documented in backend/.env.example, and
  2. present in the docker-compose alertmanager `environment:` block.

A variable referenced by the template but missing from either contract
renders as an empty string at envsubst time - a silently broken receiver
(this exact bug class put warning/info Slack alerts on the wrong channel
and left smtp_smarthost empty before #1659).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "backend" / "alertmanager.yml"
ENV_EXAMPLE = ROOT / "backend" / ".env.example"
COMPOSE = ROOT / "backend" / "docker-compose.yml"


def template_vars() -> set:
    return set(re.findall(r"\$\{([A-Z_][A-Z0-9_]*)\}", TEMPLATE.read_text()))


def env_example_keys() -> set:
    keys = set()
    for line in ENV_EXAMPLE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            keys.add(line.split("=", 1)[0].strip())
    return keys


def compose_env_keys() -> set:
    return set(re.findall(r"^\s*- ([A-Z_][A-Z0-9_]*)=\$\{", COMPOSE.read_text(), re.M))


def main() -> int:
    refs = template_vars()
    if not refs:
        print("error: no ${VAR} references found in template - is the path right?")
        return 1
    example = env_example_keys()
    compose = compose_env_keys()
    fail = False
    for var in sorted(refs):
        if var not in example:
            print(f"FAIL: {var} referenced in template but missing from backend/.env.example")
            fail = True
        if var not in compose:
            print(f"FAIL: {var} referenced in template but missing from docker-compose environment block")
            fail = True
    if fail:
        return 1
    print(f"OK: all {len(refs)} template-referenced variables are in both contracts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
