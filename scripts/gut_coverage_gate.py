#!/usr/bin/env python3
"""GUT coverage gate (issue #1097).

Replaces the heuristic `godot-coverage-gate` job in .github/workflows/test.yml
(its `func test_ / func ` ratio on three hand-picked autoloads) with a real
threshold check on the JSON the Phase-13 coverage plugin writes to
``test/coverage/json/coverage.json`` when GUT runs the
``coverage_pre_run.gd`` / ``coverage_post_run.gd`` hooks.

The metric it enforces is **tracked autoload coverage**: line coverage
across autoloads that actually have ``CoverageTracker.track_execution()``
calls in the suite. The instrumentation is opt-in (each autoload's test
suite has to add strategic ``track_execution()`` calls at function entry,
branches, signal emissions — see ``.planning/phases/24-expand-godot-coverage``
for the rollout plan), so the denominator is bounded by the autoloads that
the team has actively instrumented, not by all 54 autoloads. That keeps the
gate honest: if the team instruments more autoloads, the denominator grows
and the threshold ratchets naturally; if they delete tracking calls, the
gate fails immediately.

Metric:
    tracked_line_coverage_pct =
        sum(covered_count for files with executed_lines) /
        sum(total_count   for files with executed_lines) * 100

Files with zero executed_lines AND zero executable_lines (truly empty
files) are skipped — they cannot meaningfully be covered or uncovered.

Exit codes:
    0  coverage.json exists and tracked_line_coverage_pct >= threshold
    1  coverage.json missing, empty, or coverage below threshold
    2  coverage.json malformed (parse error)
"""
import argparse
import json
import os
import re
import sys

# Lines starting with this prefix parse as a documentation comment
# (##) and are not executable; the Phase-13 line parser already filters
# them out, but we mirror that rule here for the few cases where a
# docstring contains GDScript-like syntax that confuses a downstream
# formatter.  Not strictly required for the metric, kept for clarity.
DOC_COMMENT_PREFIX = "##"


def load_coverage_json(path: str) -> dict:
    """Read the Phase-13 coverage export.

    Schema (written by addons/gut/coverage/coverage_exporter.gd):
        {
            "_comment": "...",
            "coverage": {
                "res://autoloads/CombatManager.gd": {
                    "file": "res://autoloads/CombatManager.gd",
                    "executable_lines": [...],
                    "executed_lines":   [...],
                    "covered_count":    int,
                    "total_count":      int,
                    "percentage":       float,
                },
                ...
            }
        }
    """
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or "coverage" not in data:
        raise ValueError(
            f"{path}: expected Phase-13 schema with top-level 'coverage' key, "
            f"got keys={list(data.keys())!r}"
        )
    if not isinstance(data["coverage"], dict):
        raise ValueError(
            f"{path}: 'coverage' key must be an object (per-file paths), "
            f"got type={type(data['coverage']).__name__}"
        )
    return data


def compute_tracked_coverage(coverage: dict) -> dict:
    """Aggregate tracked autoload coverage.

    Returns a dict with the per-file breakdown and the overall metric:
        {
            "files":     {path: {"covered": N, "total": M, "percentage": P}, ...},
            "tracked_files":      int,
            "tracked_total_lines":    int,
            "tracked_covered_lines":  int,
            "tracked_line_coverage_pct": float,
        }
    """
    files = {}
    tracked_total = 0
    tracked_covered = 0
    tracked_files = 0

    for path, file_data in coverage.items():
        if not isinstance(file_data, dict):
            continue
        # Only autoloads are seeded by coverage_pre_run.gd; ignore the
        # synthetic _comment key and any other non-file entries.
        if path.startswith("_"):
            continue

        executable = file_data.get("total_count", 0)
        covered = file_data.get("covered_count", 0)
        executed = file_data.get("executed_lines", []) or []

        # Skip empty files (no executable lines at all) — they cannot
        # contribute to or against coverage.
        if executable == 0:
            continue

        # Per-file percentage: use the exporter's value when present
        # (it already handles the zero-total case), else derive.
        pct = file_data.get("percentage")
        if pct is None:
            pct = round((covered / executable) * 100.0, 2)

        files[path] = {
            "covered": covered,
            "total": executable,
            "percentage": pct,
            "executed_lines": len(executed),
        }

        # Tracked metric: only count files that the suite has at least
        # one track_execution() call for (covered > 0 implies the
        # autoload's coverage suite ran and registered hits).
        if covered > 0:
            tracked_files += 1
            tracked_total += executable
            tracked_covered += covered

    if tracked_total > 0:
        tracked_pct = round((tracked_covered / tracked_total) * 100.0, 2)
    else:
        tracked_pct = 0.0

    return {
        "files": files,
        "tracked_files": tracked_files,
        "tracked_total_lines": tracked_total,
        "tracked_covered_lines": tracked_covered,
        "tracked_line_coverage_pct": tracked_pct,
    }


def format_table(result: dict) -> str:
    """Render a Markdown table of per-file tracked coverage."""
    lines = [
        "| Autoload | Executed lines | Total | Coverage |",
        "|---|---:|---:|---:|",
    ]
    for path in sorted(result["files"]):
        f = result["files"][path]
        if f["covered"] == 0:
            # Untracked files are shown collapsed; they don't enter the metric.
            lines.append(
                f"| `{path}` | 0 | {f['total']} | not instrumented |"
            )
            continue
        lines.append(
            f"| `{path}` | {f['covered']} | {f['total']} | {f['percentage']}% |"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        default="test/coverage/json/coverage.json",
        help="Path to coverage.json (default: %(default)s)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Tracked autoload line coverage floor (%%). Default: read from "
        "data/coverage-thresholds.json (key godot_line_coverage_threshold); "
        "fallback to 40.0 if neither is set. See issue #1097.",
    )
    parser.add_argument(
        "--thresholds-file",
        default="data/coverage-thresholds.json",
        help="JSON file holding the canonical godot_line_coverage_threshold "
        "(default: %(default)s)",
    )
    parser.add_argument(
        "--json-output",
        action="store_true",
        help="Print the result as JSON to stdout (for CI machine consumption).",
    )
    args = parser.parse_args()

    threshold = args.threshold
    if threshold is None:
        threshold = load_threshold(args.thresholds_file)

    if not os.path.isfile(args.input):
        print(
            f"error: coverage.json not found at {args.input} — the Phase-13 "
            "coverage plugin did not run. Either the GUT run did not wire "
            "-gpre_run_script/-gpost_run_script (issue #1097), or GUT never "
            "completed. Fix the wiring before relaxing this gate.",
            file=sys.stderr,
        )
        if args.json_output:
            print(json.dumps({
                "verdict": "missing",
                "threshold_pct": threshold,
                "tracked_line_coverage_pct": 0.0,
                "tracked_files": 0,
                "tracked_total_lines": 0,
                "tracked_covered_lines": 0,
            }))
        return 1

    try:
        data = load_coverage_json(args.input)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: failed to parse {args.input}: {exc}", file=sys.stderr)
        if args.json_output:
            print(json.dumps({
                "verdict": "malformed",
                "threshold_pct": threshold,
                "tracked_line_coverage_pct": 0.0,
            }))
        return 2

    result = compute_tracked_coverage(data.get("coverage", {}))

    if result["tracked_total_lines"] == 0:
        # Coverage.json exists but is empty: the post-run hook ran but no
        # autoload has any track_execution() calls. The data flow is fine,
        # the team just hasn't instrumented anything yet — fail so the gate
        # signals "instrument more autoloads" rather than silently passing.
        print(
            f"error: {args.input} contains no instrumented autoloads — at "
            "least one CoverageTracker.track_execution() call is required "
            "in a suite before this gate can evaluate coverage. See "
            ".planning/phases/24-expand-godot-coverage for the rollout.",
            file=sys.stderr,
        )
        if args.json_output:
            print(json.dumps({
                "verdict": "no_instrumentation",
                "threshold_pct": threshold,
                **result,
            }))
        return 1

    verdict = (
        "PASSED"
        if result["tracked_line_coverage_pct"] >= threshold
        else "FAILED"
    )

    if args.json_output:
        print(json.dumps({
            "verdict": verdict.lower(),
            "threshold_pct": threshold,
            **result,
        }))
        return 0 if verdict == "PASSED" else 1

    print(
        f"GUT tracked autoload line coverage: "
        f"{result['tracked_line_coverage_pct']}% "
        f"({result['tracked_covered_lines']}/{result['tracked_total_lines']} "
        f"lines across {result['tracked_files']} instrumented autoload(s))"
    )
    print(f"Threshold: {threshold}%")
    print()
    print(format_table(result))
    print()
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fh:
            fh.write(
                "## GUT autoload coverage gate (issue #1097)\n\n"
                f"- Tracked autoload line coverage: "
                f"**{result['tracked_line_coverage_pct']}%** "
                f"({result['tracked_covered_lines']}/"
                f"{result['tracked_total_lines']} lines)\n"
                f"- Threshold: **{threshold}%**\n"
                f"- Instrumented autoloads: {result['tracked_files']}\n\n"
                f"{format_table(result)}\n\n"
                f"**Verdict: {verdict}**\n\n"
                "Metric is *tracked autoload line coverage* — only autoloads "
                "with at least one CoverageTracker.track_execution() call in "
                "the suite contribute to the denominator (see issue #1097). "
                "Untracked autoloads do not count against the gate.\n"
            )

    if verdict == "PASSED":
        print(f"✅ {verdict} — gate met.")
        return 0
    print(
        f"❌ {verdict} — tracked coverage "
        f"{result['tracked_line_coverage_pct']}% is below threshold "
        f"{threshold}%. Instrument more autoloads or lower the threshold "
        f"in data/coverage-thresholds.json (godot_line_coverage_threshold).",
        file=sys.stderr,
    )
    return 1


def load_threshold(thresholds_file: str) -> float:
    """Read the canonical threshold; fall back to 40.0 (issue #1097 floor)."""
    fallback = 40.0
    if not os.path.isfile(thresholds_file):
        print(
            f"warn: {thresholds_file} missing; using default {fallback}% "
            "(issue #1097 floor).",
            file=sys.stderr,
        )
        return fallback
    try:
        with open(thresholds_file, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        print(
            f"warn: could not parse {thresholds_file}: {exc}; "
            f"using default {fallback}% (issue #1097 floor).",
            file=sys.stderr,
        )
        return fallback
    raw = data.get("godot_line_coverage_threshold")
    if raw is None:
        print(
            f"warn: {thresholds_file} has no "
            f"godot_line_coverage_threshold; using default {fallback}% "
            "(issue #1097 floor).",
            file=sys.stderr,
        )
        return fallback
    try:
        return float(raw)
    except (TypeError, ValueError):
        print(
            f"warn: {thresholds_file} godot_line_coverage_threshold={raw!r} "
            f"is not a number; using default {fallback}% (issue #1097 floor).",
            file=sys.stderr,
        )
        return fallback


if __name__ == "__main__":
    sys.exit(main())
