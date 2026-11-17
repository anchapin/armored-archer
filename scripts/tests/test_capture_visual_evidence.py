"""The visual-evidence wrapper must reject placeholder frames (issue #1860).

A placeholder is what Godot's headless dummy renderer produces: a 1x1 image
(see ``scripts/screenshot_capture.gd``) or a uniform frame. Such a frame must
never be written as "evidence", so the wrapper has to fail loudly.
"""

import importlib.util
import os
import shutil
import struct
import subprocess
import tempfile
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR_PATH = ROOT / "scripts/validate_capture_frames.py"
WRAPPER_PATH = ROOT / "scripts/capture-visual-evidence.sh"
EXAMPLE_FRAMES = ROOT / "production/qa/evidence/1860/frames"


def _load_validator():
    spec = importlib.util.spec_from_file_location("validate_capture_frames", VALIDATOR_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_png(path: Path, width: int, height: int, colour=(12, 34, 56), alt_colour=None) -> None:
    """Write a minimal 8-bit RGB PNG (no third-party dependency)."""
    raw = bytearray()
    for _row in range(height):
        raw.append(0)  # filter type: None
        if alt_colour is None:
            raw.extend(bytes(colour) * width)
        else:
            # Two vertical bands, so the frame is non-uniform in every
            # sampled row (the validator samples every 8th pixel).
            split = max(1, width // 2)
            raw.extend(bytes(colour) * split)
            raw.extend(bytes(alt_colour) * (width - split))

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(bytes(raw)))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


class FrameValidatorTests(unittest.TestCase):
    def setUp(self):
        self.validator = _load_validator()

    def test_placeholder_sized_frame_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = Path(tmp) / "01_stage_loaded.png"
            write_png(frame, 1, 1)
            record = self.validator.validate_frame(frame)
        self.assertEqual(record["status"], "placeholder")
        self.assertTrue(record["placeholder"])
        self.assertIn("1x1", record["placeholder_reason"])

    def test_uniform_frame_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = Path(tmp) / "01_stage_loaded.png"
            write_png(frame, 640, 360)
            record = self.validator.validate_frame(frame)
        self.assertEqual(record["status"], "placeholder")
        self.assertEqual(record["distinct_colors"], 1)

    def test_non_uniform_frame_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = Path(tmp) / "01_stage_loaded.png"
            # Two colours make the frame non-uniform.
            write_png(frame, 64, 36, colour=(200, 30, 90), alt_colour=(30, 90, 200))
            record = self.validator.validate_frame(frame)
        self.assertEqual(record["status"], "ok")
        self.assertFalse(record.get("placeholder", False))
        self.assertEqual((record["width"], record["height"]), (64, 36))

    def test_validator_cli_exits_non_zero_on_placeholder(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = Path(tmp) / "01_stage_loaded.png"
            write_png(frame, 1, 1)
            result = subprocess.run(
                ["python3", str(VALIDATOR_PATH), str(frame)],
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertEqual(result.returncode, 1)
        self.assertIn("FAIL", result.stdout)

    def test_malformed_frames_are_structured_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            frame = Path(tmp) / "frame.png"
            write_png(frame, 64, 36, alt_colour=(90, 70, 40))
            valid = frame.read_bytes()
            malformed = [valid[:-12], valid[:29] + b"BAD!" + valid[33:]]
            payload = b"x"
            malformed.append(
                b"\x89PNG\r\n\x1a\n"
                + struct.pack(">I", 1)
                + b"IHDR"
                + payload
                + struct.pack(">I", zlib.crc32(b"IHDR" + payload))
            )
            for data in malformed:
                with self.subTest(length=len(data)):
                    frame.write_bytes(data)
                    record = self.validator.validate_frame(frame)
                    self.assertEqual(record["status"], "unreadable")
                    self.assertTrue(record["error"])

    def test_missing_file_is_structured_failure(self):
        self.assertEqual(
            self.validator.validate_frame(Path("/no/such/frame.png"))["status"], "unreadable"
        )


@unittest.skipUnless(shutil.which("xvfb-run"), "xvfb-run is required for the capture path")
class WrapperFailureTests(unittest.TestCase):
    """The wrapper must not write evidence when a frame is a placeholder."""

    def _run_wrapper_with_stub(self, stub_body: str):
        with tempfile.TemporaryDirectory() as tmp:
            stub = Path(tmp) / "fake-godot"
            stub.write_text(stub_body)
            stub.chmod(0o700)
            evidence_root = Path(tmp) / "evidence"
            result = subprocess.run(
                [
                    "bash",
                    str(WRAPPER_PATH),
                    "--slug",
                    "9999",
                    "--evidence-root",
                    str(evidence_root),
                ],
                env={**os.environ, "GODOT_BINARY": str(stub)},
                text=True,
                capture_output=True,
                check=False,
            )
            note_exists = (evidence_root / "9999" / "note.md").exists()
            return result, note_exists

    STUB = (
        "#!/usr/bin/env bash\n"
        "set -uo pipefail\n"
        'if [ "${1:-}" = "--version" ]; then echo "4.6.stable.official.fake"; exit 0; fi\n'
        'for arg in "$@"; do\n'
        '  case "$arg" in\n'
        "    --out-dir=*)\n"
        '      OUT_DIR="${arg#--out-dir=}"\n'
        '      mkdir -p "$OUT_DIR"\n'
        '      python3 -c "import struct,zlib,sys;'
        "w=h=1;raw=b''.join(b'\\x00'+bytes((12,34,56))*w for _ in range(h));"
        "c=lambda t,p: struct.pack('>I',len(p))+t+p+struct.pack('>I',zlib.crc32(t+p)&0xffffffff);"
        "open(sys.argv[1],'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+c(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))"
        "+c(b'IDAT',zlib.compress(raw))+c(b'IEND',b''))\" \"$OUT_DIR/01_stage_loaded.png\"\n"
        '      echo "SPIKE_CAPTURE {\\"step\\":\\"stage_loaded\\",\\"width\\":1,\\"height\\":1,'
        '\\"distinct_colors\\":1,\\"status\\":\\"ok\\"}"\n'
        '      echo "SPIKE_SUMMARY {\\"captures\\":1,\\"errors_logged\\":0,\\"result\\":\\"PASS\\"}"\n'
        "      exit 0 ;;\n"
        "  esac\n"
        "done\n"
        "exit 0\n"
    )

    def test_placeholder_frame_fails_loudly_and_writes_no_evidence(self):
        result, note_exists = self._run_wrapper_with_stub(self.STUB)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("PLACEHOLDER", result.stdout + result.stderr)
        self.assertFalse(
            note_exists,
            "no evidence note may be written for a placeholder capture",
        )

    def test_old_godot_is_rejected(self):
        result, exists = self._run_wrapper_with_stub(self.STUB.replace("4.6.stable", "4.0.stable"))
        self.assertEqual(result.returncode, 3)
        self.assertFalse(exists)

    def test_failed_capture_remains_nonzero(self):
        stub = self.STUB.replace("exit 0 ;;", "exit 7 ;;")
        result, exists = self._run_wrapper_with_stub(stub)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(exists)

    def test_wrapper_output_failure_and_frame_completeness(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            fixtures = base / "fixtures"
            fixtures.mkdir()
            steps = ("stage_loaded", "wave_spawn", "shot_fired", "enemy_death", "boss_spawn")
            for number, step in enumerate(steps, 1):
                write_png(fixtures / f"{number:02d}_{step}.png", 64, 36, alt_colour=(90, 70, 40))
            stub = base / "fake-godot"
            stub.write_text(
                "#!/usr/bin/env python3\n"
                "import sys,os,shutil,pathlib\n"
                "if '--version' in sys.argv: print('4.6.stable.fake');sys.exit(0)\n"
                "for arg in sys.argv:\n"
                " if arg.startswith('--out-dir='):\n"
                "  out=pathlib.Path(arg.split('=',1)[1])\n"
                "  for f in pathlib.Path(os.environ['FIXTURES']).glob('*.png'): shutil.copy(f,out/f.name)\n"
                '  print(\'SPIKE_SUMMARY {"result":"PASS","captures":5,"errors_logged":0}\')\n'
            )
            stub.chmod(0o700)
            evidence_root = base / "evidence"
            command = [
                "bash",
                str(WRAPPER_PATH),
                "--slug",
                "test",
                "--godot",
                str(stub),
                "--evidence-root",
                str(evidence_root),
            ]
            env = {**os.environ, "FIXTURES": str(fixtures)}
            evidence_root.write_text("preserve")
            failed = subprocess.run(command, env=env, capture_output=True, text=True, check=False)
            self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
            self.assertNotIn("Evidence written:", failed.stdout)
            self.assertEqual(evidence_root.read_text(), "preserve")
            evidence_root.unlink()
            success = subprocess.run(command, env=env, capture_output=True, text=True, check=False)
            self.assertEqual(success.returncode, 0, success.stdout + success.stderr)
            note = evidence_root / "test" / "note.md"
            original = note.read_bytes()
            repeated = subprocess.run(command, env=env, capture_output=True, text=True, check=False)
            self.assertEqual(repeated.returncode, 1)
            self.assertEqual(note.read_bytes(), original)
            (fixtures / "05_boss_spawn.png").unlink()
            command[command.index("test")] = "incomplete"
            incomplete = subprocess.run(
                command, env=env, capture_output=True, text=True, check=False
            )
            self.assertEqual(incomplete.returncode, 1, incomplete.stdout + incomplete.stderr)
            self.assertFalse((evidence_root / "incomplete").exists())


if __name__ == "__main__":
    unittest.main()
