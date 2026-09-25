#!/usr/bin/env python3
"""Render build performance dashboard from metrics JSON files.

Replaces the YAML heredoc in .github/workflows/build-performance.yml that
fails on push-to-default-branch because the indented EOF terminator is not
recognized by bash.

Inputs (env vars):
  BUILD_METRICS_DIR  Directory containing latest-stats.json / history.json (default: .build-metrics)
  JOBS_COUNT         Number of jobs in the latest workflow run
  BUILD_TIME         Build step duration
  TEST_TIME          Test step duration
  DEPLOY_TIME        Deploy step duration

Output:
  Writes PERFORMANCE.md into BUILD_METRICS_DIR.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(os.environ.get("BUILD_METRICS_DIR", ".build-metrics"))
JOBS_COUNT = os.environ.get("JOBS_COUNT", "0")
BUILD_TIME = os.environ.get("BUILD_TIME", "N/A")
TEST_TIME = os.environ.get("TEST_TIME", "N/A")
DEPLOY_TIME = os.environ.get("DEPLOY_TIME", "N/A")


def load_json(path: Path, default):
    try:
        with path.open() as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def main() -> int:
    BASE.mkdir(parents=True, exist_ok=True)

    stats = load_json(BASE / "latest-stats.json", {})
    avg_build = stats.get("avg_build_time", "N/A")
    avg_test = stats.get("avg_test_time", "N/A")
    max_build = stats.get("max_build_time", "N/A")

    history = load_json(BASE / "history.json", [])
    history_rows = []
    for entry in history[:10]:
        date = (entry.get("date") or "")[:10]
        history_rows.append(
            f"| {date} | {entry.get('build_time', 'N/A')} min | "
            f"{entry.get('test_time', 'N/A')} min | "
            f"{entry.get('total_time', 'N/A')} min | "
            f"{entry.get('workflow', 'N/A')} | "
            f"{entry.get('conclusion', 'N/A')} |"
        )

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    output = f"""# Build Performance Dashboard

## Summary Statistics (Last 30 Builds)

| Metric | Value |
|--------|-------|
| Average Build Time | {avg_build} minutes |
| Average Test Time | {avg_test} minutes |
| Max Build Time | {max_build} minutes |

## Recent Builds

| Date | Build | Test | Total | Workflow | Status |
|------|-------|------|-------|----------|--------|
{chr(10).join(history_rows)}

## Performance Trends

![Build Time Trend](build-time-trend.png)

## Jobs Breakdown

Latest workflow ran {JOBS_COUNT} jobs:
- Build: {BUILD_TIME} min
- Test: {TEST_TIME} min
- Deploy: {DEPLOY_TIME} min

---
*Updated: {now}*
"""

    out = BASE / "PERFORMANCE.md"
    out.write_text(output)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
