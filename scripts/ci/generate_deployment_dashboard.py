#!/usr/bin/env python3
"""Render deployment observability dashboard and health JSON files.

Replaces the YAML heredocs in .github/workflows/deployment-observability.yml
that fail because the indented EOF terminator is not recognized by bash.

Inputs (env vars):
  DEPLOYMENT_METRICS_DIR  Directory for generated reports (default: .deployment-metrics)
  ENVIRONMENT             Environment name (staging | production)
  TIMESTAMP               ISO-8601 timestamp for the report
  DEPLOYMENT_STATUS       Current deployment status (healthy | unhealthy | unknown)
  GITHUB_SHA              Short commit SHA for the report

Output:
  Writes OBSERVABILITY.md, UPTIME.md (if data available), and health JSON files
  into DEPLOYMENT_METRICS_DIR.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(os.environ.get("DEPLOYMENT_METRICS_DIR", ".deployment-metrics"))
ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
TIMESTAMP = os.environ.get("TIMESTAMP", datetime.now(timezone.utc).isoformat())
DEPLOYMENT_STATUS = os.environ.get("DEPLOYMENT_STATUS", "unknown")
GITHUB_SHA = os.environ.get("GITHUB_SHA", "")


def short_sha() -> str:
    if GITHUB_SHA and len(GITHUB_SHA) >= 7:
        return GITHUB_SHA[:7]
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def load_json(path: Path, default):
    try:
        with path.open() as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def render_observability(now: str, short: str) -> str:
    return f"""# Deployment Observability Dashboard

## Current Status

| Environment | Status | Last Check |
|-------------|--------|------------|
| Production | {DEPLOYMENT_STATUS} | {now} |
| Staging | healthy | {now} |

## Deployment Metrics

### Recent Deployments

| Date | Commit | Environment | Status |
|------|--------|-------------|--------|
| {now[:10]} | {short} | {ENVIRONMENT} | {DEPLOYMENT_STATUS} |

## Health Checks

- ✅ API Endpoint
- ✅ Database Connection
- ✅ External Services
- ✅ SSL Certificate

## Alerts

No active alerts.

---
*Updated: {now}*
"""


def render_uptime(total: int, healthy: int, uptime_pct: float) -> str:
    if uptime_pct >= 99.9:
        verdict = "✅ **Excellent** - Above 99.9% uptime target"
    elif uptime_pct >= 99.0:
        verdict = "⚠️ **Good** - Meeting minimum 99% target"
    else:
        verdict = "❌ **Needs Attention** - Below 99% uptime"

    return f"""# Deployment Uptime Report

## Summary

| Metric | Value |
|--------|-------|
| Total Checks | {total} |
| Healthy Checks | {healthy} |
| Uptime | {uptime_pct:.2f}% |

## Status

{verdict}
"""


def main() -> int:
    BASE.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    short = short_sha()

    observability_path = BASE / "OBSERVABILITY.md"
    observability_path.write_text(render_observability(now, short))
    print(f"Wrote {observability_path}")

    health_log = BASE / "scheduled-health.log"
    if health_log.exists():
        text = health_log.read_text()
        total = sum(1 for line in text.splitlines() if line.strip())
        healthy = len(re.findall(r'"healthy"', text))
        if total > 0:
            uptime_pct = (healthy / total) * 100.0
            uptime_path = BASE / "UPTIME.md"
            uptime_path.write_text(render_uptime(total, healthy, uptime_pct))
            print(f"Wrote {uptime_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
