#!/usr/bin/env python3
"""
Detect flaky Godot tests via 3x retry logic
Runs GUT tests multiple times and identifies tests with failure rate >= threshold
"""

import argparse
import subprocess
import json
import xml.etree.ElementTree as ET
import datetime
import os
import sys

def parse_args():
    parser = argparse.ArgumentParser(description='Detect flaky Godot tests')
    parser.add_argument('--runs', type=int, default=3, help='Number of times to run each test (default: 3)')
    parser.add_argument('--threshold', type=float, default=0.33, help='Failure rate threshold (default: 0.33)')
    return parser.parse_args()

def run_gut_tests():
    """Run GUT tests and parse JUnit XML output"""
    try:
        # Run GUT tests
        proc = subprocess.run(
            ['godot4', '--headless', '--script', 'res://test/run_all_tests.gd'],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        # Parse JUnit XML output
        xml_path = 'test/results/gut-results.xml'
        if not os.path.exists(xml_path):
            print(f"Warning: GUT results not found at {xml_path}")
            return {}

        tree = ET.parse(xml_path)
        root = tree.getroot()

        results = {}
        for testcase in root.findall('.//testcase'):
            name = testcase.get('name')
            classname = testcase.get('classname', '')

            # Check if test failed or had an error
            if testcase.find('failure') is not None or testcase.find('error') is not None:
                full_name = f"{classname}.{name}" if classname else name
                results[full_name] = results.get(full_name, 0) + 1

        return results

    except subprocess.TimeoutExpired:
        print("Error: GUT tests timed out")
        return {}
    except Exception as e:
        print(f"Error running GUT tests: {e}")
        return {}

def main():
    args = parse_args()

    print(f"Running Godot flaky test detection...")
    print(f"Runs: {args.runs}, Threshold: {args.threshold}")

    # Create data directory
    os.makedirs('data', exist_ok=True)

    # Track test failures across multiple runs
    failure_counts = {}

    for run in range(1, args.runs + 1):
        print(f"\nRun {run}/{args.runs}...")
        results = run_gut_tests()

        for test_name, failures in results.items():
            failure_counts[test_name] = failure_counts.get(test_name, 0) + failures

    # Identify flaky tests
    flaky_tests = {}
    for test_name, failures in failure_counts.items():
        failure_rate = failures / args.runs
        if failure_rate >= args.threshold:
            flaky_tests[test_name] = {
                'failure_rate': round(failure_rate, 2),
                'failures': failures,
                'runs': args.runs
            }
            print(f"  FLAKY: {test_name} (failure rate: {failure_rate:.2f}, failures: {failures}/{args.runs})")

    # Output JSON
    output = {
        'flaky_tests': flaky_tests,
        'timestamp': datetime.datetime.now().isoformat(),
        'runs': args.runs,
        'threshold': args.threshold
    }

    with open('data/godot-flaky-tests.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nFlaky test detection complete!")
    print(f"Found {len(flaky_tests)} flaky test(s)")
    print("Results written to data/godot-flaky-tests.json")

if __name__ == '__main__':
    main()
