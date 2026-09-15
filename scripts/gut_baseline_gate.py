#!/usr/bin/env python3
"""GUT baseline ratchet gate (issue #1082).

Parses a GUT run log (``Failing Tests`` summary line) and the JUnit XML that
GUT emits (``test/results/gut-results.xml``), then compares the failing count
against the committed baseline in ``data/gut-baseline.json``.

Exit codes:
  0 - run completed and failing count is at or below the baseline
  1 - run did not complete (missing log totals / missing XML) OR the failing
      count exceeds the baseline (new failures introduced)

The GUT suite carries a pre-existing failure baseline (issue #894 triage:
~49 failing / 54 risky as of 2026-09-15), so CI gates on "no NEW failures"
instead of zero failures. Ratchet the baseline DOWN as per-suite fix PRs
land; never raise it without team sign-off.

Used by .github/workflows/coverage.yml and scripts/local-godot-tests.sh.
"""

import argparse
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter

LOG_PATTERNS = {
    "tests": re.compile(r"^\s*Tests\s+(\d+)\s*$"),
    "passing": re.compile(r"^\s*Passing Tests\s+(\d+)\s*$"),
    "failing": re.compile(r"^\s*Failing Tests\s+(\d+)\s*$"),
    "risky_pending": re.compile(r"^\s*Risky/Pending\s+(\d+)\s*$"),
}


def parse_gut_log(log_path: str) -> dict:
    """Extract the summary counters GUT prints at the end of a run."""
    counts = {}
    try:
        with open(log_path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                for key, pattern in LOG_PATTERNS.items():
                    match = pattern.match(line)
                    if match:
                        counts[key] = int(match.group(1))
    except OSError as exc:
        raise SystemExit(f"error: cannot read GUT log {log_path}: {exc}") from exc
    return counts


def parse_junit_xml(xml_path: str) -> Counter:
    """Count JUnit testcases by their GUT status attribute."""
    try:
        tree = ET.parse(xml_path)
    except (OSError, ET.ParseError) as exc:
        raise SystemExit(f"error: cannot parse JUnit XML {xml_path}: {exc}") from exc
    return Counter(tc.attrib.get("status", "unknown") for tc in tree.iter("testcase"))


def load_baseline(baseline_path: str) -> dict:
    try:
        with open(baseline_path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"error: cannot load baseline {baseline_path}: {exc}") from exc


def write_summary(log_counts: dict, xml_counts: Counter, baseline: dict, verdict: str) -> None:
    lines = [
        "## GUT suite results (test/suites)",
        "",
        "| Metric | Run | Baseline |",
        "|---|---|---|",
        f"| Tests | {log_counts.get('tests', '?')} | {baseline.get('tests', '?')} |",
        f"| Passing | {log_counts.get('passing', '?')} | {baseline.get('passing', '?')} |",
        f"| Failing | {log_counts.get('failing', '?')} | {baseline.get('failing', '?')} |",
        f"| Risky/Pending | {log_counts.get('risky_pending', '?')} | {baseline.get('risky_pending', '?')} |",
        "",
        f"JUnit XML testcases: {dict(xml_counts)}",
        "",
        f"**Verdict: {verdict}**",
        "",
        "Gate rule: failing must not exceed the baseline (ratchet down as",
        "suites are fixed; see data/gut-baseline.json).",
    ]
    block = "\n".join(lines)
    print(block)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write(block + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", required=True, help="GUT run log (stdout capture)")
    parser.add_argument("--xml", required=True, help="GUT JUnit XML (test/results/gut-results.xml)")
    parser.add_argument("--baseline", required=True, help="baseline JSON (data/gut-baseline.json)")
    args = parser.parse_args()

    if not os.path.isfile(args.xml):
        print(f"error: GUT JUnit XML not found at {args.xml} — did GUT actually run?")
        return 1

    log_counts = parse_gut_log(args.log)
    required = ("tests", "failing")
    missing = [key for key in required if key not in log_counts]
    if missing:
        print(
            f"error: GUT log summary missing {missing} — the suite did not "
            "complete. Inspect the run log before touching the baseline."
        )
        return 1

    xml_counts = parse_junit_xml(args.xml)
    baseline = load_baseline(args.baseline)
    baseline_failing = int(baseline["failing"])

    if log_counts["failing"] > baseline_failing:
        verdict = (
            f"FAILED — {log_counts['failing']} failing tests exceeds the "
            f"baseline of {baseline_failing} "
            f"({log_counts['failing'] - baseline_failing} new failure(s))."
        )
        write_summary(log_counts, xml_counts, baseline, verdict)
        return 1

    verdict = (
        f"PASSED — {log_counts['failing']} failing tests at or below the "
        f"baseline of {baseline_failing}."
    )
    write_summary(log_counts, xml_counts, baseline, verdict)
    return 0


if __name__ == "__main__":
    sys.exit(main())
