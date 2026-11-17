#!/usr/bin/env python3
"""Write a complete local screenshot run without replacing existing evidence."""

import argparse
import json
import sys
import tempfile
import zlib
from datetime import datetime, timezone
from pathlib import Path

from capture_input import absolute_parts, open_directory, read_regular
from validate_capture_frames import UnreadableFrame, decode_pixels

STEPS = ("stage_loaded", "wave_spawn", "shot_fired", "enemy_death", "boss_spawn")
EXPECTED = [f"{i:02d}_{step}.png" for i, step in enumerate(STEPS, 1)]


def _input_paths(args):
    run_root = absolute_parts(args.run_root)
    frames = absolute_parts(args.frames)
    if frames != run_root / "frames":
        raise ValueError("frames must be the run-root frames directory")
    if absolute_parts(args.validation) != run_root / "validation.json":
        raise ValueError("validation must be run-root/validation.json")
    if absolute_parts(args.log) != run_root / "run.log":
        raise ValueError("log must be run-root/run.log")
    return run_root, frames


def _validate_manifest(frames, validation, summary):
    names = sorted(p.name for p in frames.glob("*.png"))
    records = validation["frames"]
    valid_records = sorted(r["file"] for r in records) == EXPECTED and all(
        r.get("status") == "ok" for r in records
    )
    valid_summary = (
        summary.get("result") == "PASS"
        and summary.get("captures") == 5
        and summary.get("errors_logged") == 0
    )
    if (
        names != EXPECTED
        or not valid_records
        or not valid_summary
        or validation.get("frames_total") != 5
        or validation.get("result") != "PASS"
    ):
        raise ValueError(
            "expected exactly five validated gameplay capture steps and a matching PASS summary"
        )
    return records


def _snapshot_frames(frames, records):
    snapshots = {name: read_regular(frames / name, within=frames) for name in EXPECTED}
    for record in records:
        data = snapshots[record["file"]]
        width, height, colours = decode_pixels(data)
        if min(width, height, colours) <= 1:
            raise ValueError("publisher frame snapshot is a placeholder")
        record.update(width=width, height=height, distinct_colors=colours, bytes=len(data))
    return snapshots


def publish(args):
    """Stage a complete input snapshot without replacing existing evidence."""
    run_root, frames = _input_paths(args)
    validation = json.loads(read_regular(args.validation, within=run_root))
    records = _validate_manifest(frames, validation, json.loads(args.summary))
    snapshots = _snapshot_frames(frames, records)
    log_bytes = read_regular(args.log, within=run_root)
    root = absolute_parts(args.root)
    if not args.slug or Path(args.slug).name != args.slug or args.slug in (".", ".."):
        raise ValueError("slug must be a single path segment")
    root_fd = open_directory(root, create=True)
    import os

    os.close(root_fd)
    destination = root / args.slug
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(f"existing evidence preserved: {destination}; choose a new slug")
    log = log_bytes.decode("utf-8")
    renderer = [
        line
        for line in log.splitlines()
        if ("Vulkan " in line or "OpenGL " in line or "Rendering Device" in line)
    ]
    runtime = "; ".join(renderer) or "Not identified in runtime log; inspect run.log"
    with tempfile.TemporaryDirectory(prefix=".capture-", dir=root) as temporary:
        staging = Path(temporary) / "output"
        (staging / "frames").mkdir(parents=True)
        for record in records:
            (staging / "frames" / record["file"]).write_bytes(snapshots[record["file"]])
            record["path"] = str(destination / "frames" / record["file"])
        (staging / "validation.json").write_text(json.dumps(validation, indent=2) + "\n")
        (staging / "run.log").write_bytes(log_bytes)
        table = "\n".join(
            f"| `frames/{r['file']}` | {r['width']}x{r['height']} | {r['distinct_colors']} | {r['bytes']} |"
            for r in records
        )
        observed = "\n".join(f"- {line}" for line in args.observed)
        not_assessed = "\n".join(f"- {line}" for line in args.not_assessed)
        note = f"""# Visual evidence: {args.slug}

{args.title}

- Issue / PR: #{args.slug}
- Command run (from project root): `{args.command}`
- Godot version: {args.version}
- Platform: Linux, xvfb-run. This does not force software OpenGL or prove hardware GPU rendering.
- Runtime renderer (reported by Godot): {runtime}
- Stage played: `{args.stage}`
- Generated at (UTC): {datetime.now(timezone.utc).isoformat()}
- Summary: `{args.summary}`

## Frames

Counts below are sampled distinct colours (every eighth pixel), not full-image counts.

| Frame | Size | Sampled colours | Bytes |
| --- | --- | --- | --- |
{table}

## What was observed

{observed}

## What was NOT assessed

- This is an automated gameplay smoke, not broad UI, manual controls or device coverage.
- Windows, Android/iOS, audio, accessibility and changed screens not shown in these frames were not assessed.
{not_assessed}

## How to reproduce

Use a new slug to preserve earlier evidence. The recorded command contains a temporary output directory;
create a new output directory when repeating the underlying capture command.

```sh
./scripts/capture-visual-evidence.sh --slug NEW_SLUG --stage {args.stage}
```
"""
        (staging / "note.md").write_text(note)
        # Exclusive reservation prevents two writers from choosing the same slug.
        # rename replaces only our empty reservation; nonempty destinations fail.
        destination.mkdir()
        try:
            staging.rename(destination)
        except OSError:
            try:
                destination.rmdir()
            except OSError:
                pass
            raise
    return destination


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in (
        "run-root",
        "frames",
        "validation",
        "log",
        "root",
        "slug",
        "version",
        "command",
        "stage",
        "summary",
    ):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--title", default="")
    parser.add_argument("--observed", action="append", default=[])
    parser.add_argument("--not-assessed", action="append", default=[])
    args = parser.parse_args(argv)
    try:
        publish(args)
    except (OSError, ValueError, KeyError, TypeError, UnreadableFrame, zlib.error) as exc:
        print(f"evidence output failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
