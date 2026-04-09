#!/usr/bin/env python3
"""
Unit tests for parse_godot_coverage.py.

Tests HTML report generation with Jinja2 templating.
"""

import json
import os
import sys
import tempfile
import unittest

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parse_godot_coverage import generate_html_report, parse_coverage_json


class TestParseGodotCoverage(unittest.TestCase):
    """Test suite for Godot coverage parsing and HTML generation."""

    def test_parse_coverage_json_reads_file(self):
        """Test that parse_coverage_json reads and parses coverage.json file."""
        # Create a temporary coverage.json file
        sample_data = {
            "autoloads/combat_manager.gd": {
                "executable_lines": [1, 2, 3],
                "executed_lines": [1, 2],
                "percentage": 66.67,
                "covered_count": 2,
                "total_count": 3
            },
            "autoloads/game_manager.gd": {
                "executable_lines": [1, 2, 3, 4],
                "executed_lines": [1, 2, 3, 4],
                "percentage": 100.0,
                "covered_count": 4,
                "total_count": 4
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(sample_data, f)
            temp_file = f.name

        try:
            # Parse the file
            result = parse_coverage_json(temp_file)

            # Verify structure
            self.assertIsInstance(result, dict)
            self.assertEqual(len(result), 2)
            self.assertIn("autoloads/combat_manager.gd", result)
            self.assertIn("autoloads/game_manager.gd", result)

            # Verify data structure
            combat_data = result["autoloads/combat_manager.gd"]
            self.assertEqual(combat_data["percentage"], 66.67)
            self.assertEqual(combat_data["covered_count"], 2)
            self.assertEqual(combat_data["total_count"], 3)

        finally:
            os.unlink(temp_file)

    def test_generate_html_report_creates_file(self):
        """Test that generate_html_report creates an HTML file."""
        # Create sample coverage data
        coverage_data = {
            "autoloads/combat_manager.gd": {
                "executable_lines": [1, 2, 3],
                "executed_lines": [1, 2],
                "percentage": 66.67,
                "covered_count": 2,
                "total_count": 3
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            temp_file = f.name

        try:
            # Generate HTML report
            generate_html_report(coverage_data, temp_file)

            # Verify file exists
            self.assertTrue(os.path.exists(temp_file))

            # Verify HTML contains expected content
            with open(temp_file) as f:
                html_content = f.read()
                self.assertIn("Godot Coverage Report", html_content)
                self.assertIn("autoloads/combat_manager.gd", html_content)

        finally:
            if os.path.exists(temp_file):
                os.unlink(temp_file)

    def test_generate_html_report_includes_badges(self):
        """Test that HTML report includes coverage badges with correct classes."""
        # Create test data with 80% coverage (should be green)
        coverage_data = {
            "autoloads/test.gd": {
                "executable_lines": [1, 2, 3, 4, 5],
                "executed_lines": [1, 2, 3, 4],
                "percentage": 80,
                "covered_count": 4,
                "total_count": 5
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            temp_file = f.name

        try:
            # Generate HTML report
            generate_html_report(coverage_data, temp_file)

            # Verify badge class and percentage
            with open(temp_file) as f:
                html_content = f.read()
                self.assertIn("badge-success", html_content)
                self.assertIn("80%", html_content)

        finally:
            if os.path.exists(temp_file):
                os.unlink(temp_file)

    def test_color_scheme_applied(self):
        """Test that CSS has correct color classes for covered and uncovered lines."""
        coverage_data = {
            "autoloads/test.gd": {
                "executable_lines": [1, 2, 3],
                "executed_lines": [1],
                "percentage": 33.33,
                "covered_count": 1,
                "total_count": 3
            }
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            temp_file = f.name

        try:
            # Generate HTML report
            generate_html_report(coverage_data, temp_file)

            # Verify CSS classes
            with open(temp_file) as f:
                html_content = f.read()
                # Check for covered line styling (green)
                self.assertIn("background-color: #22C55E", html_content)
                # Check for uncovered line styling (red)
                self.assertIn("background-color: #EF4444", html_content)

        finally:
            if os.path.exists(temp_file):
                os.unlink(temp_file)


if __name__ == '__main__':
    unittest.main()
