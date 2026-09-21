#!/usr/bin/env python3
"""
Unit tests for scripts/gut_coverage_gate.py (issue #1097).

Exercises the gate's threshold + exit-code logic on synthetic Phase-13
GUT coverage JSON fixtures. These tests run in plain Python (no Godot
required) and protect against regressions in the gate's threshold math
(which replaced the heuristic func-count proxy in the prior
`.github/workflows/test.yml`'s `godot-coverage-gate` job).
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

REPO_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
GATE = os.path.join(REPO_ROOT, "scripts", "gut_coverage_gate.py")
THRESHOLDS = os.path.join(REPO_ROOT, "data", "coverage-thresholds.json")


def _write_coverage(tmpdir, name, covered_lines, total_lines):
    """Build a minimal Phase-13 coverage.json fixture."""
    body = {
        "_comment": "synthetic test fixture",
        "coverage": {
            f"res://autoloads/{name}.gd": {
                "file": f"res://autoloads/{name}.gd",
                "executable_lines": list(range(1, total_lines + 1)),
                "executed_lines": list(range(1, covered_lines + 1)),
                "covered_count": covered_lines,
                "total_count": total_lines,
                "percentage": round(100.0 * covered_lines / max(total_lines, 1), 2),
            }
        },
    }
    p = os.path.join(tmpdir, "coverage.json")
    with open(p, "w") as f:
        json.dump(body, f)
    return p


def _run_gate(coverage_path, threshold):
    proc = subprocess.run(
        [
            sys.executable,
            GATE,
            "--input",
            coverage_path,
            "--thresholds-file",
            THRESHOLDS,
            "--threshold",
            str(threshold),
        ],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return proc


class TestGatePass(unittest.TestCase):
    """Coverage above threshold → gate exits 0 (PASSED)."""

    def test_above_threshold_passes(self):
        with tempfile.TemporaryDirectory() as td:
            cov = _write_coverage(td, "CombatManager", covered_lines=90, total_lines=100)
            proc = _run_gate(cov, threshold=40)
            self.assertEqual(
                proc.returncode, 0, msg=f"stdout={proc.stdout}\nstderr={proc.stderr}"
            )
            self.assertIn("PASSED", proc.stdout)

    def test_exactly_threshold_passes(self):
        """Coverage === threshold is PASS (gate is >=)."""
        with tempfile.TemporaryDirectory() as td:
            cov = _write_coverage(td, "CombatManager", covered_lines=40, total_lines=100)
            proc = _run_gate(cov, threshold=40)
            self.assertEqual(proc.returncode, 0)


class TestGateFail(unittest.TestCase):
    """Coverage below threshold → gate exits 1 (FAILED)."""

    def test_below_threshold_fails(self):
        with tempfile.TemporaryDirectory() as td:
            cov = _write_coverage(td, "CombatManager", covered_lines=30, total_lines=100)
            proc = _run_gate(cov, threshold=40)
            self.assertEqual(proc.returncode, 1)
            # Gate output: PASSED message → stdout, FAILED message → stderr
            # (the leading ❌ emoji precedes the FAILED word).
            combined = proc.stdout + proc.stderr
            self.assertTrue(
                "FAILED" in combined or "❌" in combined,
                msg=f"unexpected output:\nstdout={proc.stdout!r}\nstderr={proc.stderr!r}",
            )

    def test_zero_coverage_fails(self):
        with tempfile.TemporaryDirectory() as td:
            cov = _write_coverage(td, "CombatManager", covered_lines=0, total_lines=100)
            proc = _run_gate(cov, threshold=40)
            self.assertEqual(proc.returncode, 1)


class TestGateValidation(unittest.TestCase):
    """Bad-input handling: exit codes per the gate's contract."""

    def test_missing_file_exits_1(self):
        proc = subprocess.run(
            [
                sys.executable,
                GATE,
                "--input",
                "/nonexistent/coverage.json",
                "--thresholds-file",
                THRESHOLDS,
                "--threshold",
                "40",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(proc.returncode, 1)

    def test_wrong_top_level_schema_exits_2(self):
        """coverage.json must have a top-level "coverage" object."""
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "coverage.json")
            with open(p, "w") as f:
                f.write('{"some_other_key": {}}')
            proc = _run_gate(p, threshold=40)
            self.assertEqual(proc.returncode, 2)
            self.assertIn("expected Phase-13 schema", proc.stderr)

    def test_schema_with_string_coverage_field_exits_2(self):
        """The 'coverage' key must hold an OBJECT, not a string (schema
        violation → exit 2 — gate exits before computing coverage)."""
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "coverage.json")
            with open(p, "w") as f:
                f.write('{"coverage": "this should be a dict, not a string"}')
            proc = _run_gate(p, threshold=40)
            self.assertEqual(proc.returncode, 2)
            self.assertIn("must be an object", proc.stderr)


if __name__ == "__main__":
    unittest.main()
