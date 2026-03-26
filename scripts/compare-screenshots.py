#!/usr/bin/env python3
"""
Screenshot comparison script using ImageMagick.

Compares two screenshots and outputs JSON with pass/fail result based on
pixel difference threshold.
"""

import argparse
import subprocess
import sys
import json
import os


def parse_imagemagick_output(output: str) -> float:
    """
    Parse ImageMagick compare output for difference value.

    ImageMagick outputs "X (Y)" where Y is normalized difference 0-1.
    """
    output = output.strip()
    if '(' in output:
        diff_str = output.split('(')[1].split(')')[0]
        try:
            return float(diff_str)
        except ValueError:
            return 1.0  # Max difference if parse fails
    return 1.0  # Max difference if format unexpected


def main():
    parser = argparse.ArgumentParser(
        description='Compare screenshots using ImageMagick'
    )
    parser.add_argument(
        '--current',
        required=True,
        help='Path to current screenshot'
    )
    parser.add_argument(
        '--baseline',
        required=True,
        help='Path to baseline screenshot'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Path to save difference image'
    )
    parser.add_argument(
        '--threshold',
        type=float,
        default=0.01,
        help='Maximum allowed difference (default: 0.01 = 1%%)'
    )

    args = parser.parse_args()

    # Validate input files exist
    if not os.path.exists(args.current):
        print(json.dumps({
            'error': f'Current screenshot not found: {args.current}',
            'passed': False
        }))
        sys.exit(1)

    if not os.path.exists(args.baseline):
        print(json.dumps({
            'error': f'Baseline screenshot not found: {args.baseline}',
            'passed': False
        }))
        sys.exit(1)

    # Run ImageMagick compare command
    cmd = [
        'compare',
        '-metric', 'RMSE',
        '-fuzz', '1%',
        args.current,
        args.baseline,
        args.output
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    # Parse difference from stderr (ImageMagick writes metric to stderr)
    difference = parse_imagemagick_output(result.stderr)

    # Compare against threshold
    passed = difference <= args.threshold

    output_json = {
        'passed': passed,
        'difference': difference,
        'threshold': args.threshold,
        'current': args.current,
        'baseline': args.baseline,
        'diff_output': args.output
    }

    print(json.dumps(output_json, indent=2))
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()
