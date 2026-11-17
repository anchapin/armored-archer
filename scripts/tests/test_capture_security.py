"""Input-boundary and decoder branch regressions, using benign temp fixtures only."""

import contextlib
import io
import json
import os
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import capture_input
import publish_capture_evidence as publisher
import test_publish_capture_evidence as fixtures
import validate_capture_frames as validator
from test_capture_visual_evidence import write_png


def chunk(tag, payload):
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload))
    )


def png(header=(16, 16, 8, 2, 0, 0, 0), pixels=None, extra=b""):
    if pixels is None:
        pixels = b"".join(
            b"\0" + bytes((12, 34, 56)) * 8 + bytes((45, 67, 89)) * 8 for _ in range(16)
        )
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", *header))
        + chunk(b"IDAT", zlib.compress(pixels))
        + extra
        + chunk(b"IEND", b"")
    )


class DecoderBranches(unittest.TestCase):
    def test_filters_reconstruct_expected_rows(self):
        previous = bytearray([20, 30, 40, 50, 60, 70])
        for filter_type in range(5):
            expected = bytearray([10, 20, 30, 80, 90, 100])
            encoded = bytearray()
            for i, value in enumerate(expected):
                left = expected[i - 3] if i >= 3 else 0
                up = previous[i]
                upleft = previous[i - 3] if i >= 3 else 0
                if filter_type == 0:
                    predict = 0
                elif filter_type == 1:
                    predict = left
                elif filter_type == 2:
                    predict = up
                elif filter_type == 3:
                    predict = (left + up) // 2
                else:
                    p = left + up - upleft
                    predict = min(
                        [
                            (abs(p - left), 0, left),
                            (abs(p - up), 1, up),
                            (abs(p - upleft), 2, upleft),
                        ]
                    )[2]
                encoded.append((value - predict) & 255)
            validator._unfilter_line(filter_type, encoded, previous, 3)
            self.assertEqual(encoded, expected)
        with self.assertRaises(validator.UnreadableFrame):
            validator._predictor(9, 0, 0, 0)
        self.assertEqual(validator._paeth(10, 20, 30), 10)
        self.assertEqual(validator._paeth(30, 20, 10), 30)
        self.assertEqual(validator._paeth(30, 10, 20), 20)

    def test_valid_rgb_and_rgba(self):
        self.assertEqual(validator.decode_pixels(png())[:2], (16, 16))
        raw = b"".join(
            b"\0" + bytes((12, 34, 56, 255)) * 8 + bytes((45, 67, 89, 255)) * 8 for _ in range(16)
        )
        self.assertEqual(validator.decode_pixels(png((16, 16, 8, 6, 0, 0, 0), raw)), (16, 16, 2))

    def test_invalid_formats(self):
        for header in [
            (0, 16, 8, 2, 0, 0, 0),
            (16, 0, 8, 2, 0, 0, 0),
            (16, 16, 16, 2, 0, 0, 0),
            (16, 16, 8, 0, 0, 0, 0),
            (16, 16, 8, 2, 1, 0, 0),
            (16, 16, 8, 2, 0, 1, 0),
            (16, 16, 8, 2, 0, 0, 1),
            (100000, 100000, 8, 2, 0, 0, 0),
        ]:
            with self.subTest(header=header), self.assertRaises(validator.UnreadableFrame):
                validator.decode_pixels(png(header))
        with self.assertRaises(validator.UnreadableFrame):
            validator._image_format(None)

    def test_bad_streams_and_chunks(self):
        valid = png()
        fixtures = [
            b"bad",
            valid[:20],
            valid[:-12],
            valid + b"trailing",
            valid[:8] + chunk(b"IDAT", b"") + valid[8:],
            valid[:33] + valid[8:33] + valid[33:],
            png(extra=chunk(b"ABCD", b"")),
            png(pixels=b"\0"),
            png(pixels=b"\0" * 1000),
            valid[:-12] + chunk(b"IEND", b"x"),
        ]
        for data in fixtures:
            with (
                self.subTest(length=len(data)),
                self.assertRaises((validator.UnreadableFrame, zlib.error)),
            ):
                validator.decode_pixels(data)
        self.assertEqual(validator.decode_pixels(png(extra=chunk(b"tEXt", b"ok")))[:2], (16, 16))

    def test_cli_output_and_errors_in_process(self):
        with tempfile.TemporaryDirectory() as td:
            frame = Path(td) / "a.png"
            write_png(frame, 64, 36, alt_colour=(90, 70, 40))
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(validator.main(["--dir", td, "--json"]), 0)
            self.assertEqual(json.loads(out.getvalue())["result"], "PASS")
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(validator.main([str(frame)]), 0)
            self.assertIn("RESULT: PASS", out.getvalue())
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(validator.main([]), 2)
            frame.write_bytes(b"bad")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(validator.main([str(frame)]), 1)
            self.assertEqual(
                validator.validate_frame(Path(td) / "not-png.txt")["status"], "unreadable"
            )


class InputBoundaries(unittest.TestCase):
    def test_traversal_absolute_and_symlinks(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            folder = base / "inside"
            folder.mkdir()
            outside = base / "outside"
            outside.write_bytes(b"benign")
            with self.assertRaises(ValueError):
                capture_input.read_regular(folder / ".." / "outside")
            with self.assertRaises(ValueError):
                capture_input.read_regular(outside, within=folder)
            (folder / "link").symlink_to(outside)
            with self.assertRaises(OSError):
                capture_input.read_regular(folder / "link")
            (base / "linked-folder").symlink_to(folder, target_is_directory=True)
            with self.assertRaises(OSError):
                capture_input.read_regular(base / "linked-folder" / "file")
            with self.assertRaises(ValueError):
                capture_input.read_regular(folder)
            pipe = folder / "fifo"
            os.mkfifo(pipe)
            with self.assertRaises(ValueError):
                capture_input.read_regular(pipe)
            with mock.patch.object(capture_input, "MAX_INPUT_BYTES", 2):
                with self.assertRaises(ValueError):
                    capture_input.read_regular(outside)


class PublisherSecurityTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.PublisherTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)

    def test_unrelated_log_manifest_and_frames_rejected(self):
        f = self.fixture
        for field in ["log", "validation", "frames"]:
            old = getattr(f.args, field)
            setattr(f.args, field, str(f.base / "unrelated"))
            with self.subTest(field=field), self.assertRaises(ValueError):
                publisher.publish(f.args)
            setattr(f.args, field, old)
        self.assertFalse(Path(f.args.root).exists())

    def test_symlinked_input_rejected_before_output(self):
        f = self.fixture
        for target in [f.log, f.manifest, f.frames / publisher.EXPECTED[0]]:
            original = target.read_bytes()
            outside = f.base / "outside-fixture"
            outside.write_bytes(original)
            target.unlink()
            target.symlink_to(outside)
            with self.subTest(target=target), self.assertRaises(OSError):
                publisher.publish(f.args)
            self.assertFalse(Path(f.args.root).exists())
            target.unlink()
            target.write_bytes(original)

    def test_bad_slug_and_symlink_output_root(self):
        f = self.fixture
        for slug in ["../escape", "/absolute", "..", ".", ""]:
            f.args.slug = slug
            with self.subTest(slug=slug), self.assertRaises(ValueError):
                publisher.publish(f.args)
        f.args.slug = "good"
        real = f.base / "real"
        real.mkdir()
        Path(f.args.root).symlink_to(real, target_is_directory=True)
        with self.assertRaises(OSError):
            publisher.publish(f.args)
        self.assertEqual(list(real.iterdir()), [])

    def test_replacement_after_snapshot_does_not_change_saved_bytes(self):
        f = self.fixture
        old = (f.frames / publisher.EXPECTED[0]).read_bytes()
        original = publisher.tempfile.TemporaryDirectory

        def change_after_reads(*args, **kwargs):
            (f.frames / publisher.EXPECTED[0]).write_bytes(b"replaced after read")
            return original(*args, **kwargs)

        with mock.patch.object(
            publisher.tempfile, "TemporaryDirectory", side_effect=change_after_reads
        ):
            destination = publisher.publish(f.args)
        self.assertEqual((destination / "frames" / publisher.EXPECTED[0]).read_bytes(), old)

    def test_revalidation_catches_forged_frame(self):
        f = self.fixture
        write_png(f.frames / publisher.EXPECTED[0], 1, 1)
        with self.assertRaises(ValueError):
            publisher.publish(f.args)

    def test_cli_failure_and_success(self):
        f = self.fixture
        argv = []
        for key, value in vars(f.args).items():
            if isinstance(value, list):
                for item in value:
                    argv.extend(["--" + key.replace("_", "-"), item])
            else:
                argv.extend(["--" + key.replace("_", "-"), value])
        self.assertEqual(publisher.main(argv), 0)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(publisher.main(argv), 1)


class OutputParentTests(unittest.TestCase):
    def test_symlink_parent_cannot_create_output_beneath_target(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            real = base / "real"
            real.mkdir()
            (base / "link").symlink_to(real, target_is_directory=True)
            with self.assertRaises(OSError):
                capture_input.open_directory(base / "link" / "unwanted", create=True)
            self.assertEqual(list(real.iterdir()), [])

    def test_fd_pins_parent_during_regular_file_open(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            inside = base / "inside"
            inside.mkdir()
            (inside / "frame.png").write_bytes(b"original")
            outside = base / "outside"
            outside.mkdir()
            (outside / "frame.png").write_bytes(b"unrelated")
            original_open = capture_input.os.open

            def replace_parent(path, flags, *args, **kwargs):
                if path == "frame.png":
                    inside.rename(base / "pinned")
                    inside.symlink_to(outside, target_is_directory=True)
                return original_open(path, flags, *args, **kwargs)

            with mock.patch.object(capture_input.os, "open", side_effect=replace_parent):
                self.assertEqual(capture_input.read_regular(inside / "frame.png"), b"original")
