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


class CanonicalBoundaryTests(unittest.TestCase):
    def test_allowed_names_are_preserved(self):
        names = [
            "1875",
            "issue-1875",
            "name with spaces",
            " leading ",
            ".hidden",
            "a..b",
            "naïve-名字",
            "back\\slash",
            "line\nbreak",
            "quote'\"$`",
            "-option",
            "...",
        ]
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for name in names:
                with self.subTest(name=name):
                    with capture_output.output_stage(root) as stage:
                        self.assertEqual(stage._checked_basename(name), name)
                        stage.write("note.md", b"fixture")
                        stage.install(name)
                    self.assertEqual((root / name / "note.md").read_bytes(), b"fixture")

    def test_invalid_and_existing_names_still_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "regular").write_bytes(b"original")
            (root / "broken-link").symlink_to(root / "missing")
            with capture_output.output_stage(root) as stage:
                for name in ["", ".", "..", "../escape", "a/b", "/absolute", "nul\0name"]:
                    with self.subTest(name=name), self.assertRaises(ValueError):
                        stage.install(name)
                for name in ["regular", "broken-link"]:
                    with self.subTest(name=name), self.assertRaises(FileExistsError):
                        stage.install(name)
            self.assertEqual((root / "regular").read_bytes(), b"original")
            self.assertTrue((root / "broken-link").is_symlink())

    def test_canonical_parent_and_basename_must_match(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with capture_output.output_stage(root) as stage:
                for destination in [str(root) + "-sibling/name", str(root / "different")]:
                    with self.subTest(destination=destination):
                        with mock.patch.object(
                            capture_output.os.path, "realpath", side_effect=[str(root), destination]
                        ):
                            with self.assertRaises(ValueError):
                                stage.install("name")
                self.assertFalse((root / "name").exists())

    def test_parent_replacement_after_check_cannot_redirect_install(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            root = base / "selected"
            outside = base / "unrelated"
            outside.mkdir()
            with capture_output.output_stage(root) as stage:
                original = stage._checked_basename

                def replace_after_check(slug):
                    checked = original(slug)
                    root.rename(base / "pinned")
                    root.symlink_to(outside, target_is_directory=True)
                    return checked

                with mock.patch.object(stage, "_checked_basename", side_effect=replace_after_check):
                    stage.install("result")
            self.assertTrue((base / "pinned/result").is_dir())
            self.assertEqual(list(outside.iterdir()), [])
