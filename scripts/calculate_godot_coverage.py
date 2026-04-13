#!/usr/bin/env python3
"""
Calculate Godot test coverage proxy from GUT JUnit XML output.

Note: This uses pass rate as a coverage proxy because GDScript/Godot
does not provide line coverage instrumentation. This is documented as
acceptable in REQUIREMENTS.md.
"""
import json
import sys
import xml.etree.ElementTree as ET


def load_autoload_mapping(mapping_path="data/autoload-to-test-mapping.json"):
    """Load autoload-to-test mapping configuration."""
    try:
        with open(mapping_path) as f:
            return json.load(f)
    except FileNotFoundError:
        return {"autoloads": {}, "version": "1.0.0"}


def parse_junit_xml(xml_path):
    """Parse JUnit XML file and extract test results."""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # Count total tests, failures, and errors
    tests = root.findall('.//testcase')
    total = len(tests)
    failures = len(root.findall('.//failure'))
    errors = len(root.findall('.//error'))

    # Calculate pass rate as coverage proxy
    pass_rate = ((total - failures - errors) / total) * 100 if total > 0 else 0

    # Count tests by subsystem
    subsystems = {}
    for test in tests:
        classname = test.get('classname', '')
        # Extract subsystem from classname (e.g., "res://test/suites/player/test_player_stats_manager")
        if '/' in classname:
            parts = classname.split('/')
            if len(parts) >= 3:
                subsystem = parts[2]  # "player", "combat", etc.
            else:
                subsystem = 'unknown'
        else:
            subsystem = 'unknown'
        subsystems[subsystem] = subsystems.get(subsystem, 0) + 1

    # Extract test objects for autoload coverage calculation
    test_objects = [
        {
            "classname": test.get('classname', ''),
            "name": test.get('name', ''),
            "failure": test.find('failure') is not None,
            "error": test.find('error') is not None
        }
        for test in tests
    ]

    return {
        'pass_rate': round(pass_rate, 2),
        'total_tests': total,
        'failures': failures,
        'errors': errors,
        'subsystems': subsystems,
        'test_objects': test_objects
    }


def calculate_autoload_coverage(junit_tests, autoload_mapping):
    """Calculate per-autoload coverage from JUnit test results."""
    autoloads = autoload_mapping.get("autoloads", {})
    autoload_results = {}

    for autoload_name, autoload_info in autoloads.items():
        test_file = autoload_info.get("test_file", "")
        # Remove .gd extension for matching (XML doesn't include it)
        test_file_base = test_file.replace('.gd', '')
        # Find tests for this autoload (match with or without .gd extension)
        autoload_tests = [
            t for t in junit_tests
            if test_file_base in t.get("classname", "")
        ]

        total = len(autoload_tests)
        failures = len([t for t in autoload_tests if t.get("failure")])
        errors = len([t for t in autoload_tests if t.get("error")])
        pass_rate = ((total - failures - errors) / total * 100) if total > 0 else 0.0

        autoload_results[autoload_name] = {
            "tests": total,
            "failures": failures,
            "errors": errors,
            "pass_rate": round(pass_rate, 2),
            "test_file": test_file,
            "critical": autoload_info.get("critical", False)
        }

    return autoload_results


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            'error': 'Usage: python3 calculate_godot_coverage.py <junit_xml_path>',
            'pass_rate': 0.0,
            'total_tests': 0,
            'failures': 0,
            'errors': 0
        }))
        sys.exit(1)

    xml_path = sys.argv[1]

    try:
        result = parse_junit_xml(xml_path)

        # Load autoload mapping and calculate per-autoload coverage
        autoload_mapping = load_autoload_mapping()
        autoload_results = calculate_autoload_coverage(result.get('test_objects', []), autoload_mapping)
        result['autoloads'] = autoload_results

        print(json.dumps(result, indent=2))
    except FileNotFoundError:
        print(json.dumps({
            'error': f'File not found: {xml_path}',
            'pass_rate': 0.0,
            'total_tests': 0,
            'failures': 0,
            'errors': 0
        }))
        sys.exit(1)
    except ET.ParseError as e:
        print(json.dumps({
            'error': f'Invalid XML: {e!s}',
            'pass_rate': 0.0,
            'total_tests': 0,
            'failures': 0,
            'errors': 0
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
