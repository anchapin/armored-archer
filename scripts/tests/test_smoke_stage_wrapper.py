"""The stage wrapper must not let engine errors or missing completion pass."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class SmokeWrapperTests(unittest.TestCase):
    def run_wrapper(self, output):
        with tempfile.TemporaryDirectory() as tmp:
            binary = Path(tmp) / "fake-godot"
            binary.write_text(
                "#!/usr/bin/env python3\n"
                "import os, sys\n"
                "if '--import' in sys.argv: sys.exit(0)\n"
                "assert os.environ['XDG_DATA_HOME'] != os.environ['ORIGINAL_SAVE']\n"
                "print(" + repr(output) + ")\n"
            )
            binary.chmod(0o700)
            result = subprocess.run(
                ["bash", str(ROOT / "scripts/smoke_stage.sh"), "1", "1"],
                env={**os.environ, "GODOT": str(binary),
                     "XDG_DATA_HOME": tmp, "ORIGINAL_SAVE": tmp},
                text=True, capture_output=True, check=False,
            )
            return result

    def test_clean_marker_and_isolated_save_pass(self):
        self.assertEqual(self.run_wrapper("SMOKE PASS").returncode, 0)

    def test_physics_error_fails_even_with_pass_marker(self):
        result = self.run_wrapper(
            "ERROR: Can't change this state while flushing queries.\nSMOKE PASS"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("runtime errors", result.stdout)

    def test_missing_pass_marker_fails(self):
        result = self.run_wrapper("SMOKE RESULT: alive")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing completion marker", result.stdout)


if __name__ == "__main__":
    unittest.main()
