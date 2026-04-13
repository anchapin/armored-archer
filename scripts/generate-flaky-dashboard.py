#!/usr/bin/env python3
"""
Generate flaky test dashboard from JSON results
Reads go-flaky-tests.json and godot-flaky-tests.json and creates markdown dashboard
"""

import datetime
import json
import os


def load_json(filepath):
    """Load JSON file if exists, return empty dict otherwise"""
    try:
        with open(filepath) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

def generate_dashboard():
    """Generate markdown dashboard from flaky test data"""

    # Load flaky test data
    go_data = load_json('data/go-flaky-tests.json')
    godot_data = load_json('data/godot-flaky-tests.json')

    # Extract flaky tests
    go_flaky = go_data.get('flaky_tests', [])
    godot_flaky = godot_data.get('flaky_tests', {})

    # Start building dashboard
    dashboard = "# Flaky Test Dashboard\n\n"
    dashboard += f"**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"

    # Summary section
    dashboard += "## Summary\n\n"
    dashboard += f"- **Go Backend:** {len(go_flaky)} flaky test(s)\n"
    dashboard += f"- **Godot Frontend:** {len(godot_flaky)} flaky test(s)\n"
    dashboard += f"- **Total:** {len(go_flaky) + len(godot_flaky)} flaky test(s)\n\n"

    # Go Backend section
    if go_flaky:
        dashboard += "## Go Backend\n\n"
        dashboard += "| Test Name | Failure Rate | Failures | Runs | File |\n"
        dashboard += "|-----------|--------------|----------|------|------|\n"
        for test in go_flaky:
            name = test.get('name', 'Unknown')
            failure_rate = test.get('failure_rate', 0) * 100
            failures = test.get('failures', 0)
            runs = test.get('runs', 0)
            file = test.get('file', 'N/A')
            dashboard += f"| `{name}` | {failure_rate:.0f}% | {failures}/{runs} | {runs} | {file} |\n"
        dashboard += "\n"
    else:
        dashboard += "## Go Backend\n\n"
        dashboard += "✅ No flaky tests detected\n\n"

    # Godot Frontend section
    if godot_flaky:
        dashboard += "## Godot Frontend\n\n"
        dashboard += "| Test Name | Failure Rate | Failures | Runs |\n"
        dashboard += "|-----------|--------------|----------|------|\n"
        for test_name, test_data in godot_flaky.items():
            failure_rate = test_data.get('failure_rate', 0) * 100
            failures = test_data.get('failures', 0)
            runs = test_data.get('runs', 0)
            dashboard += f"| `{test_name}` | {failure_rate:.0f}% | {failures}/{runs} | {runs} |\n"
        dashboard += "\n"
    else:
        dashboard += "## Godot Frontend\n\n"
        dashboard += "✅ No flaky tests detected\n\n"

    # Metadata section
    dashboard += "---\n\n"
    dashboard += "## Metadata\n\n"
    if go_data:
        dashboard += f"**Go Detection:** {go_data.get('timestamp', 'N/A')} ({go_data.get('runs', 0)} runs, threshold: {go_data.get('threshold', 0)})\n\n"
    if godot_data:
        dashboard += f"**Godot Detection:** {godot_data.get('timestamp', 'N/A')} ({godot_data.get('runs', 0)} runs, threshold: {godot_data.get('threshold', 0)})\n\n"

    # Actions section
    dashboard += "## Actions\n\n"
    if go_flaky or godot_flaky:
        dashboard += "### To Fix Flaky Tests\n\n"
        dashboard += "1. **Investigate:** Review test code and identify race conditions, timing issues, or external dependencies\n"
        dashboard += "2. **Fix:** Add proper synchronization, mocks, or test isolation\n"
        dashboard += "3. **Verify:** Run detection again to confirm the fix\n\n"

        dashboard += "### To Run Quarantined Tests\n\n"
        dashboard += "- **Go:** `go test -tags=flaky ./...`\n"
        dashboard += "- **Godot:** Tests with `skip_if()` calls are skipped in normal runs\n\n"

        dashboard += "### To Update Quarantine List\n\n"
        if go_flaky:
            dashboard += "Run `bash scripts/quarantine-flaky-tests.sh` to automatically apply build tags\n\n"
    else:
        dashboard += "✅ All tests are stable! No action needed.\n\n"

    return dashboard

def main():
    """Main entry point"""
    # Create docs directory if it doesn't exist
    os.makedirs('docs', exist_ok=True)

    # Generate dashboard
    dashboard = generate_dashboard()

    # Write to file
    output_path = 'docs/flaky-tests-dashboard.md'
    with open(output_path, 'w') as f:
        f.write(dashboard)

    # Output to stdout for CI summary
    print(dashboard)

    print(f"\nDashboard written to {output_path}")

if __name__ == '__main__':
    main()
