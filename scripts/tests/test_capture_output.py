"""Output descriptor regressions, using only benign temporary directories."""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import capture_output


class OutputDescriptorTests(unittest.TestCase):
    def test_parent_replaced_before_write_and_install(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            root = base / "selected"
            outside = base / "unrelated"
            outside.mkdir()
            with capture_output.output_stage(root) as stage:
                root.rename(base / "pinned-root")
                root.symlink_to(outside, target_is_directory=True)
                stage.write("note.md", b"benign")
                stage.write("frame.png", b"frame", frame=True)
                stage.install("result")
            self.assertEqual(list(outside.iterdir()), [])
            self.assertEqual((base / "pinned-root/result/note.md").read_bytes(), b"benign")
            self.assertEqual((base / "pinned-root/result/frames/frame.png").read_bytes(), b"frame")

    def test_parent_replaced_before_failed_install_cleanup(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            root = base / "selected"
            outside = base / "unrelated"
            outside.mkdir()
            (outside / "result").mkdir()
            with self.assertRaises(OSError):
                with capture_output.output_stage(root) as stage:
                    stage.write("run.log", b"benign")
                    stage.write("a.png", b"benign", frame=True)
                    root.rename(base / "pinned-root")
                    root.symlink_to(outside, target_is_directory=True)
                    with mock.patch.object(
                        capture_output.os, "rename", side_effect=OSError("failure")
                    ):
                        stage.install("result")
            self.assertEqual(list((base / "pinned-root").iterdir()), [])
            self.assertTrue((outside / "result").is_dir())
            self.assertEqual(len(list(outside.iterdir())), 1)

    def test_existing_empty_and_symlink_destinations_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "existing").mkdir()
            (root / "linked").symlink_to(root / "existing", target_is_directory=True)
            for slug in ["existing", "linked"]:
                with self.subTest(slug=slug), self.assertRaises(FileExistsError):
                    with capture_output.output_stage(root) as stage:
                        stage.install(slug)
            self.assertTrue((root / "linked").is_symlink())
            self.assertEqual(sorted(p.name for p in root.iterdir()), ["existing", "linked"])

    def test_output_name_traversal_and_duplicate_write(self):
        with tempfile.TemporaryDirectory() as td:
            with capture_output.output_stage(Path(td)) as stage:
                for name in ["../outside", "/absolute", "", ".", ".."]:
                    with self.subTest(name=name), self.assertRaises(ValueError):
                        stage.write(name, b"benign")
                stage.write("note.md", b"original")
                with self.assertRaises(FileExistsError):
                    stage.write("note.md", b"replacement")
            self.assertEqual(list(Path(td).iterdir()), [])

    def test_changed_reservation_is_not_removed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with capture_output.output_stage(root) as stage:
                os.mkdir("reservation", dir_fd=stage.root_fd)
                info = os.stat("reservation", dir_fd=stage.root_fd)
                os.rename(
                    "reservation", "original", src_dir_fd=stage.root_fd, dst_dir_fd=stage.root_fd
                )
                os.mkdir("reservation", dir_fd=stage.root_fd)
                stage._remove_reservation("reservation", info)
                self.assertTrue((root / "reservation").exists())
                stage._remove_reservation("missing", info)
