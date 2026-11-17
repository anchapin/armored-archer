"""Regression tests for checked output and complete capture manifests."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "publisher", ROOT / "scripts/publish_capture_evidence.py"
)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.frames = self.base / "frames"
        self.frames.mkdir()
        for name in publisher.EXPECTED:
            (self.frames / name).write_bytes(b"already validated fixture")
        self.validation = {
            "frames_total": 5,
            "result": "PASS",
            "frames": [
                {
                    "file": name,
                    "status": "ok",
                    "width": 640,
                    "height": 360,
                    "distinct_colors": 2,
                    "bytes": 25,
                }
                for name in publisher.EXPECTED
            ],
        }
        self.manifest = self.base / "validation.json"
        self.log = self.base / "run.log"
        self.log.write_text("Vulkan 1.3 - Forward Mobile - Using Device #0: llvmpipe\n")
        self.args = SimpleNamespace(
            frames=str(self.frames),
            validation=str(self.manifest),
            log=str(self.log),
            root=str(self.base / "evidence"),
            slug="test",
            version="4.6.stable",
            command="timeout 180 xvfb-run godot --path .",
            stage="1_3",
            title="test",
            summary=json.dumps({"result": "PASS", "captures": 5, "errors_logged": 0}),
            observed=["automated smoke"],
            not_assessed=["Windows"],
        )
        self.save()

    def save(self):
        self.manifest.write_text(json.dumps(self.validation))

    def test_success_and_actual_renderer(self):
        destination = publisher.publish(self.args)
        self.assertEqual(len(list((destination / "frames").glob("*.png"))), 5)
        note = (destination / "note.md").read_text()
        self.assertIn("Vulkan 1.3 - Forward Mobile", note)
        self.assertNotIn("software OpenGL); NOT a GPU run", note)
        self.assertEqual(
            json.loads((destination / "validation.json").read_text())["frames"][0]["path"],
            str(destination / "frames" / publisher.EXPECTED[0]),
        )

    def test_existing_evidence_preserved(self):
        destination = publisher.publish(self.args)
        before = {str(p): p.read_bytes() for p in destination.rglob("*") if p.is_file()}
        with self.assertRaises(FileExistsError):
            publisher.publish(self.args)
        self.assertEqual(
            before, {str(p): p.read_bytes() for p in destination.rglob("*") if p.is_file()}
        )

    def test_blocked_root_writes_nothing(self):
        root = Path(self.args.root)
        root.write_text("preserve")
        with self.assertRaises(OSError):
            publisher.publish(self.args)
        self.assertEqual(root.read_text(), "preserve")

    def test_copy_failure_cleans_staging(self):
        with mock.patch.object(
            publisher.shutil, "copyfile", side_effect=OSError("injected disk failure")
        ):
            with self.assertRaises(OSError):
                publisher.publish(self.args)
        self.assertEqual(list(Path(self.args.root).iterdir()), [])

    def test_rename_failure_cleans_reservation(self):
        with mock.patch.object(Path, "rename", side_effect=OSError("injected rename failure")):
            with self.assertRaises(OSError):
                publisher.publish(self.args)
        self.assertEqual(list(Path(self.args.root).iterdir()), [])

    def test_missing_frame(self):
        (self.frames / publisher.EXPECTED[-1]).unlink()
        with self.assertRaises(ValueError):
            publisher.publish(self.args)
        self.assertFalse(Path(self.args.root).exists())

    def test_extra_frame(self):
        (self.frames / "extra.png").write_bytes(b"extra")
        with self.assertRaises(ValueError):
            publisher.publish(self.args)

    def test_mismatched_summary_or_validation(self):
        for summary in (
            {"result": "FAIL", "captures": 5, "errors_logged": 0},
            {"result": "PASS", "captures": 1, "errors_logged": 0},
        ):
            with self.subTest(summary=summary):
                self.args.summary = json.dumps(summary)
                with self.assertRaises(ValueError):
                    publisher.publish(self.args)

    def test_unknown_renderer_is_not_invented(self):
        self.log.write_text("no device metadata\n")
        destination = publisher.publish(self.args)
        self.assertIn("Not identified in runtime log", (destination / "note.md").read_text())


if __name__ == "__main__":
    unittest.main()
