#!/usr/bin/env python3
"""
Calculate Godot test coverage proxy from GUT JUnit XML output.

Note: This uses pass rate as a coverage proxy because GDScript/Godot
does not provide line coverage instrumentation. This is documented as
acceptable in REQUIREMENTS.md.
"""
import xml.etree.ElementTree as ET
import sys
import json


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

    return {
        'pass_rate': round(pass_rate, 2),
        'total_tests': total,
        'failures': failures,
        'errors': errors,
        'subsystems': subsystems
    }


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
            'error': f'Invalid XML: {str(e)}',
            'pass_rate': 0.0,
            'total_tests': 0,
            'failures': 0,
            'errors': 0
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
