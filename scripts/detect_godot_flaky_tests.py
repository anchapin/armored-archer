#!/usr/bin/env python3
"""
Flaky Test Detection for Godot GDScript Tests

This script runs Godot tests multiple times to identify non-deterministic failures.
It works with the existing Godot test framework and generates reports.

Usage:
    python3 scripts/detect_godot_flaky_tests.py [--runs=N] [--godot=GODOT_EXECUTABLE]

Options:
    --runs=N            Number of times to run each test (default: 3)
    --godot=PATH        Path to Godot executable (default: godot4)
    --verbose           Show detailed output
    --output=FILE       Output results to JSON file
"""

import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path

# Configuration
DEFAULT_RUNS = 3
DEFAULT_GODOT = "godot4"
PROJECT_ROOT = Path(__file__).parent.parent
TEST_DIR = PROJECT_ROOT / "test"
DATA_DIR = PROJECT_ROOT / "data"
HISTORY_FILE = DATA_DIR / "godot-flaky-test-history.json"


@dataclass
class TestRun:
    """Represents a single test execution"""
    timestamp: str
    success: bool
    duration_ms: int
    error: str | None = None


@dataclass
class FlakyTestResult:
    """Represents the result of flaky test analysis"""
    test_name: str
    runs: int
    failures: int
    failure_rate: float
    history: list[TestRun] = field(default_factory=list)


@dataclass
class DetectionSummary:
    """Summary of the flaky test detection run"""
    total_tests: int
    flaky_tests: int
    runs_per_test: int
    flaky_threshold: float
    execution_time_seconds: float


@dataclass
class DetectionResult:
    """Complete detection result"""
    flaky_tests: list[FlakyTestResult]
    summary: DetectionSummary


class GodotFlakyTestDetector:
    """Detector for flaky tests in Godot GDScript test suite"""

    def __init__(self, runs: int = DEFAULT_RUNS, godot_executable: str = DEFAULT_GODOT,
                 verbose: bool = False):
        self.runs = runs
        self.godot_executable = godot_executable
        self.verbose = verbose
        self.results: dict[str, FlakyTestResult] = {}
        self.start_time = 0.0

    def _parse_godot_test_output(self, output: str) -> dict[str, bool]:
        """Parse Godot test output to determine which tests passed/failed"""
        test_results = {}

        # Look for [PASS] and [FAIL] markers in output
        for line in output.split('\n'):
            if '[PASS]' in line:
                # Extract test name from "[PASS] test_name"
                match = re.search(r'\[PASS\]\s+(.+)', line)
                if match:
                    test_name = match.group(1).strip()
                    test_results[test_name] = True
            elif '[FAIL]' in line:
                # Extract test name from "[FAIL] test_name: error_message"
                match = re.search(r'\[FAIL\]\s+([^:]+)', line)
                if match:
                    test_name = match.group(1).strip()
                    test_results[test_name] = False

        return test_results

    def _run_godot_tests(self) -> tuple[bool, str, int]:
        """Run the Godot test suite and return success status and output"""
        test_script = TEST_DIR / "run_all_tests.gd"

        if not test_script.exists():
            print(f"Error: Test script not found at {test_script}")
            return False, "", 0

        start_time = time.time()

        try:
            result = subprocess.run(
                [self.godot_executable, "--headless", "--script", str(test_script)],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True,
                timeout=120
            )
            duration = int((time.time() - start_time) * 1000)

            # Combine stdout and stderr
            output = result.stdout + result.stderr

            # Check for failures in output
            has_failures = "Failed: [1-9]" in output or "[FAIL]" in output

            if self.verbose:
                print(f"Godot tests completed in {duration}ms")
                print(f"Exit code: {result.returncode}")

            return not has_failures, output, duration

        except subprocess.TimeoutExpired:
            print("Error: Godot tests timed out after 120 seconds")
            return False, "", 120000
        except FileNotFoundError:
            print(f"Error: Godot executable '{self.godot_executable}' not found")
            print("Please install Godot 4.x or specify the correct path with --godot")
            return False, "", 0
        except Exception as e:
            print(f"Error running Godot tests: {e}")
            return False, "", 0

    def _extract_test_names(self) -> list[str]:
        """Extract all test function names from test files"""
        test_files = list(TEST_DIR.glob("test_*.gd"))
        test_names = []

        for test_file in test_files:
            content = test_file.read_text()
            # Match "func test_" pattern
            for match in re.finditer(r'func\s+(test_\w+)', content):
                test_names.append(match.group(1))

        return test_names

    def _extract_individual_test_results(self, output: str) -> dict[str, TestRun]:
        """Parse test results from Godot output for individual tests"""
        results = {}

        for line in output.split('\n'):
            if '[PASS]' in line:
                match = re.search(r'\[PASS\]\s+(.+)', line)
                if match:
                    test_name = match.group(1).strip()
                    results[test_name] = TestRun(
                        timestamp=datetime.now().isoformat(),
                        success=True,
                        duration_ms=0  # We don't have per-test timing in this output
                    )
            elif '[FAIL]' in line:
                match = re.search(r'\[FAIL\]\s+([^:]+):\s*(.*)', line)
                if match:
                    test_name = match.group(1).strip()
                    error = match.group(2).strip()
                    results[test_name] = TestRun(
                        timestamp=datetime.now().isoformat(),
                        success=False,
                        duration_ms=0,
                        error=error[:200]  # Truncate long errors
                    )

        return results

    def detect_flaky_tests(self) -> DetectionResult:
        """Run detection algorithm to find flaky tests"""
        self.start_time = time.time()

        print("🔍 Starting Godot flaky test detection...")
        print(f"   Runs per test: {self.runs}")
        print(f"   Godot executable: {self.godot_executable}")
        print()

        # Get test names
        test_names = self._extract_test_names()
        print(f"📝 Found {len(test_names)} tests to analyze")

        # Run tests multiple times
        all_runs: list[dict[str, TestRun]] = []

        for run_num in range(1, self.runs + 1):
            print(f"\n🔄 Run {run_num}/{self.runs}...")

            _success, output, duration = self._run_godot_tests()

            if self.verbose:
                print(f"   Tests completed in {duration}ms")

            # Parse individual test results
            test_results = self._extract_individual_test_results(output)
            all_runs.append(test_results)

            # Show failures for this run
            failures = [name for name, result in test_results.items() if not result.success]
            if failures:
                print(f"   ❌ Failures: {', '.join(failures[:5])}")
                if len(failures) > 5:
                    print(f"      ... and {len(failures) - 5} more")
            else:
                print("   ✅ All tests passed")

        # Analyze results
        print("\n📊 Analyzing results...")

        # Get all unique test names across all runs
        all_test_names = set()
        for run_results in all_runs:
            all_test_names.update(run_results.keys())

        for test_name in all_test_names:
            history = []
            failures = 0

            for run_results in all_runs:
                if test_name in run_results:
                    run_result = run_results[test_name]
                    history.append(run_result)
                    if not run_result.success:
                        failures += 1
                else:
                    # Test didn't run in this iteration
                    history.append(TestRun(
                        timestamp=datetime.now().isoformat(),
                        success=False,
                        duration_ms=0,
                        error="Test did not run"
                    ))
                    failures += 1

            failure_rate = failures / self.runs

            self.results[test_name] = FlakyTestResult(
                test_name=test_name,
                runs=self.runs,
                failures=failures,
                failure_rate=failure_rate,
                history=history
            )

        # Find flaky tests (those with any failures)
        flaky_tests = [
            result for result in self.results.values()
            if result.failures > 0
        ]
        flaky_tests.sort(key=lambda x: x.failure_rate, reverse=True)

        execution_time = time.time() - self.start_time

        # Save history
        self._save_history(flaky_tests)

        return DetectionResult(
            flaky_tests=flaky_tests,
            summary=DetectionSummary(
                total_tests=len(all_test_names),
                flaky_tests=len(flaky_tests),
                runs_per_test=self.runs,
                flaky_threshold=0.0,  # Any failure is considered flaky
                execution_time_seconds=execution_time
            )
        )

    def _save_history(self, flaky_tests: list[FlakyTestResult]) -> None:
        """Save flaky test history to file"""
        DATA_DIR.mkdir(exist_ok=True)

        existing_history: dict[str, dict] = {}

        if HISTORY_FILE.exists():
            try:
                existing_history = json.loads(HISTORY_FILE.read_text())
            except json.JSONDecodeError:
                existing_history = {}

        # Update history with new results
        for result in flaky_tests:
            if result.test_name not in existing_history:
                existing_history[result.test_name] = {
                    "test_name": result.test_name,
                    "runs": 0,
                    "failures": 0,
                    "failure_rate": 0.0,
                    "history": []
                }

            existing = existing_history[result.test_name]

            # Add new history entries
            for run in result.history:
                existing["history"].append(asdict(run))

            # Keep last 30 runs
            existing["history"] = existing["history"][-30:]

            # Recalculate stats
            total_runs = len(existing["history"])
            total_failures = sum(1 for h in existing["history"] if not h["success"])

            existing["runs"] = total_runs
            existing["failures"] = total_failures
            existing["failure_rate"] = total_failures / total_runs if total_runs > 0 else 0.0

        HISTORY_FILE.write_text(json.dumps(existing_history, indent=2))
        print(f"\n💾 History saved to {HISTORY_FILE}")

    def print_results(self, result: DetectionResult) -> None:
        """Print results in human-readable format"""
        flaky_tests = result.flaky_tests
        summary = result.summary

        print("\n" + "=" * 60)
        print("📊 GODOT FLAKY TEST DETECTION RESULTS")
        print("=" * 60)

        print("\n📈 Summary:")
        print(f"   Total tests analyzed: {summary.total_tests}")
        print(f"   Flaky tests found: {summary.flaky_tests}")
        print(f"   Runs per test: {summary.runs_per_test}")
        print(f"   Total execution time: {summary.execution_time_seconds:.1f}s")

        if not flaky_tests:
            print("\n✅ No flaky tests detected!")
            return

        print("\n⚠️  FLAKY TESTS DETECTED:")
        print("-" * 60)

        for test in flaky_tests:
            status = "🔴" if test.failure_rate >= 0.5 else "🟡"
            print(f"\n{status} {test.test_name}")
            print(f"   Failure rate: {(test.failure_rate * 100):.0f}% ({test.failures}/{test.runs} runs)")

            if self.verbose and test.history:
                print("   Run history:")
                for i, run in enumerate(test.history[:10], 1):
                    icon = "✅" if run.success else "❌"
                    print(f"     {icon} Run {i}")

        print("\n" + "-" * 60)
        print("\n💡 Recommendations:")
        print("   1. Review the flaky tests and identify non-deterministic behavior")
        print("   2. Check for race conditions in async code")
        print("   3. Look for shared mutable state between tests")
        print("   4. Consider adding proper setup/teardown for test isolation")
        print("")

    def print_ci_format(self, result: DetectionResult) -> None:
        """Print results in CI-friendly format"""
        flaky_tests = result.flaky_tests
        summary = result.summary

        print("FLAKY_TEST_DETECTION_START")
        print(f"total_tests={summary.total_tests}")
        print(f"flaky_tests={summary.flaky_tests}")
        print(f"runs_per_test={summary.runs_per_test}")
        print(f"execution_time_seconds={summary.execution_time_seconds:.1f}")

        if flaky_tests:
            print("flaky_tests=" + ",".join(t.test_name.replace(" ", "_") for t in flaky_tests))
        else:
            print("flaky_tests=")

        print("FLAKY_TEST_DETECTION_END")

        # Exit with error if flaky tests found
        if flaky_tests:
            print(f"\n❌ Found {len(flaky_tests)} flaky tests!", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Detect flaky tests in Godot GDScript test suite"
    )
    parser.add_argument(
        "--runs", "-n", type=int, default=DEFAULT_RUNS,
        help=f"Number of times to run each test (default: {DEFAULT_RUNS})"
    )
    parser.add_argument(
        "--godot", "-g", type=str, default=DEFAULT_GODOT,
        help=f"Path to Godot executable (default: {DEFAULT_GODOT})"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--output", "-o", type=str,
        help="Output results to JSON file"
    )
    parser.add_argument(
        "--ci-mode", action="store_true",
        help="Output in CI-friendly format"
    )

    args = parser.parse_args()

    detector = GodotFlakyTestDetector(
        runs=args.runs,
        godot_executable=args.godot,
        verbose=args.verbose
    )

    result = detector.detect_flaky_tests()

    if args.ci_mode:
        detector.print_ci_format(result)
    else:
        detector.print_results(result)

    if args.output:
        output_data = {
            "flaky_tests": [asdict(t) for t in result.flaky_tests],
            "summary": asdict(result.summary)
        }
        Path(args.output).write_text(json.dumps(output_data, indent=2))
        print(f"\n💾 Results saved to {args.output}")


if __name__ == "__main__":
    main()
