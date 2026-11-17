#!/usr/bin/env python3
"""Validate captured gameplay frames (issue #1860).

Reads PNG frames written by the #1766/#1779 gameplay screenshot spike
(``scripts/gameplay_screenshot_spike.gd``) and reports, per frame:

  * the real pixel size read from the PNG header (IHDR),
  * the number of distinct colours found in the decoded pixels,
  * the file size on disk.

The validator is deliberately dependency-free (Python standard library only:
``zlib`` + ``struct``) so it can run anywhere the repo's other shell scripts
run, and it never "repairs" a frame: a frame that cannot be decoded is
reported as ``status: "unreadable"`` and makes the caller fail.

A frame counts as a PLACEHOLDER when it is 1x1 (or smaller) or when it is
uniform (a single distinct colour). Those are exactly the failure modes the
headless dummy renderer produces (see ``scripts/screenshot_capture.gd``, which
substitutes a 1x1 placeholder), so they must never be committed as
"evidence".

Usage:
    scripts/validate_capture_frames.py FRAME.png [FRAME.png ...] [--json]
    scripts/validate_capture_frames.py --dir /path/to/frames [--json]

Exit codes:
    0  every frame is readable and is NOT a placeholder
    1  at least one frame is a placeholder (1x1 / uniform / unreadable)
    2  usage error
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
import zlib
from pathlib import Path

SAMPLE_STRIDE = 8  # same sampling stride as scripts/gameplay_screenshot_spike.gd
MAX_DIMENSION = 1  # anything this small is a placeholder
MAX_UNIFORM_COLORS = 1  # a single distinct colour is a blank frame


class UnreadableFrame(Exception):
    """Raised when a PNG cannot be decoded by this minimal decoder."""


def _read_chunks(data: bytes):
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise UnreadableFrame("not a PNG file (bad signature)")
    offset = 8
    first = True
    while offset + 12 <= len(data):
        (length,) = struct.unpack(">I", data[offset : offset + 4])
        ctype = data[offset + 4 : offset + 8]
        start = offset + 8
        end = start + length
        if end + 4 > len(data):
            raise UnreadableFrame("truncated PNG chunk")
        payload = data[start:end]
        (crc,) = struct.unpack(">I", data[end : end + 4])
        if zlib.crc32(ctype + payload) & 0xFFFFFFFF != crc:
            raise UnreadableFrame("PNG chunk CRC mismatch")
        if first and (ctype != b"IHDR" or length != 13):
            raise UnreadableFrame("invalid first IHDR chunk")
        if not first and ctype == b"IHDR":
            raise UnreadableFrame("duplicate IHDR chunk")
        first = False
        yield ctype, payload
        offset = end + 4
        if ctype == b"IEND":
            if length or offset != len(data):
                raise UnreadableFrame("invalid IEND or trailing PNG data")
            return
    raise UnreadableFrame("PNG is missing a complete IEND chunk")


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def _unfilter_line(filter_type: int, line: bytearray, previous: bytearray, channels: int) -> None:
    """Reverse the PNG per-scanline filter in place for one row."""
    stride = len(line)
    if filter_type == 1:  # Sub
        for i in range(channels, stride):
            line[i] = (line[i] + line[i - channels]) & 0xFF
    elif filter_type == 2:  # Up
        for i in range(stride):
            line[i] = (line[i] + previous[i]) & 0xFF
    elif filter_type == 3:  # Average
        for i in range(stride):
            left = line[i - channels] if i >= channels else 0
            line[i] = (line[i] + ((left + previous[i]) >> 1)) & 0xFF
    elif filter_type == 4:  # Paeth
        for i in range(stride):
            left = line[i - channels] if i >= channels else 0
            upleft = previous[i - channels] if i >= channels else 0
            line[i] = (line[i] + _paeth(left, previous[i], upleft)) & 0xFF
    elif filter_type != 0:
        raise UnreadableFrame(f"unknown PNG filter type {filter_type}")


def _sample_row(line: bytearray, width: int, channels: int, colours: set) -> None:
    """Add every SAMPLE_STRIDE-th pixel of a row to the colour set."""
    for x in range(0, width, SAMPLE_STRIDE):
        base = x * channels
        pixel = bytes(line[base : base + channels])
        colours.add(pixel)


def decode_png(path: Path):
    """Return (width, height, sampled distinct colours) for a PNG frame."""
    data = path.read_bytes()
    width = height = 0
    bit_depth = color_type = interlace = 0
    idat = bytearray()
    for ctype, payload in _read_chunks(data):
        if ctype == b"IHDR":
            width, height, bit_depth, color_type, _comp, _filt, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
            if _comp != 0 or _filt != 0:
                raise UnreadableFrame("unsupported PNG compression/filter method")
        elif ctype == b"IDAT":
            idat += payload
        elif ctype == b"IEND":
            continue
        elif ctype[0] & 32 == 0:
            raise UnreadableFrame("unsupported critical PNG chunk")
    if width == 0 or height == 0:
        raise UnreadableFrame("PNG header has no dimensions")
    if bit_depth != 8:
        raise UnreadableFrame(f"unsupported PNG bit depth {bit_depth}")
    if color_type not in (2, 6):
        raise UnreadableFrame(f"unsupported PNG colour type {color_type}")
    if interlace != 0:
        raise UnreadableFrame("interlaced PNGs are not supported")

    channels = 3 if color_type == 2 else 4
    stride = width * channels
    expected = (stride + 1) * height
    if expected > 64 * 1024 * 1024:
        raise UnreadableFrame("PNG exceeds 64 MiB decoded-frame limit")
    decoder = zlib.decompressobj()
    raw = decoder.decompress(bytes(idat), expected + 1)
    if len(raw) != expected or not decoder.eof or decoder.unused_data:
        raise UnreadableFrame("invalid PNG pixel data length or stream")

    colours = set()
    previous = bytearray(stride)
    pos = 0
    for y in range(height):
        filter_type = raw[pos]
        pos += 1
        line = bytearray(raw[pos : pos + stride])
        pos += stride
        _unfilter_line(filter_type, line, previous, channels)
        previous = line
        if y % SAMPLE_STRIDE == 0:
            _sample_row(line, width, channels, colours)
    return width, height, len(colours)


def validate_frame(path: Path) -> dict:
    record = {
        "file": path.name,
        "path": str(path),
        "bytes": 0,
        "status": "ok",
    }
    try:
        record["bytes"] = path.stat().st_size
        width, height, colours = decode_png(path)
    except (UnreadableFrame, zlib.error, OSError, struct.error, ValueError) as exc:
        record.update(
            {
                "status": "unreadable",
                "width": 0,
                "height": 0,
                "distinct_colors": 0,
                "error": str(exc),
                "placeholder": True,
                "placeholder_reason": "unreadable frame",
            }
        )
        return record

    record.update({"width": width, "height": height, "distinct_colors": colours})
    reasons = []
    if width <= MAX_DIMENSION or height <= MAX_DIMENSION:
        reasons.append(f"frame is {width}x{height} (placeholder-sized)")
    if colours <= MAX_UNIFORM_COLORS:
        reasons.append(f"frame is uniform ({colours} distinct colour(s))")
    if reasons:
        record["status"] = "placeholder"
        record["placeholder"] = True
        record["placeholder_reason"] = "; ".join(reasons)
    return record


def collect(paths, directory) -> list:
    frames: list = []
    if directory:
        frames.extend(sorted(Path(directory).glob("*.png")))
    for raw in paths:
        frames.append(Path(raw))
    return frames


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", nargs="*", help="PNG frame paths to validate")
    parser.add_argument("--dir", help="directory of PNG frames to validate")
    parser.add_argument("--json", action="store_true", help="emit JSON only")
    args = parser.parse_args(argv)

    frames = collect(args.frames, args.dir)
    if not frames:
        print("no frames given", file=sys.stderr)
        return 2

    records = [validate_frame(path) for path in frames]
    failures = [r for r in records if r.get("placeholder")]
    payload = {
        "frames": records,
        "frames_total": len(records),
        "placeholders": len(failures),
        "result": "FAIL" if failures else "PASS",
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        for record in records:
            print(
                f"{record['file']:<40} {record['width']}x{record['height']}"
                f" colours={record['distinct_colors']:<4}"
                f" bytes={record['bytes']:<8} {record['status']}"
            )
        print(
            f"RESULT: {payload['result']} ({len(records)} frame(s), {len(failures)} placeholder(s))"
        )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
