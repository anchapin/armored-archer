#!/usr/bin/env python3
"""Check that native libraries in an APK/AAB support 16 KB memory pages.

Google Play requires apps with native code to support 16 KB page sizes
(issue #1725). Every PT_LOAD segment of each 64-bit .so must have
p_align >= 16384. Usage: check_elf_alignment.py <file.apk|file.aab>
Exit 0 when all libraries pass, 1 on any failure or when none are found.
"""
import struct
import sys
import zipfile

PT_LOAD = 1
MIN_ALIGN = 16384


def load_alignments(data: bytes) -> list[int] | None:
    """Return p_align of each PT_LOAD segment, or None if not a 64-bit LE ELF."""
    if len(data) < 64 or data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        return None
    e_phoff = struct.unpack_from("<Q", data, 32)[0]
    e_phentsize, e_phnum = struct.unpack_from("<HH", data, 54)
    aligns = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type = struct.unpack_from("<I", data, off)[0]
        if p_type == PT_LOAD:
            aligns.append(struct.unpack_from("<Q", data, off + 48)[0])
    return aligns


def check(path: str) -> tuple[list[str], list[str]]:
    """Return (passed, failed) library names."""
    passed, failed = [], []
    with zipfile.ZipFile(path) as z:
        for name in sorted(z.namelist()):
            if not name.endswith(".so"):
                continue
            aligns = load_alignments(z.read(name))
            if aligns is None:
                continue  # 32-bit libs cannot be checked here and are not shipped in release
            if aligns and min(aligns) >= MIN_ALIGN:
                passed.append(name)
            else:
                failed.append(f"{name} (LOAD align {sorted(set(aligns))})")
    return passed, failed


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    passed, failed = check(argv[1])
    for name in passed:
        print(f"OK    {name}")
    for name in failed:
        print(f"FAIL  {name}")
        print(f"::error::Not 16 KB aligned: {name}")
    if not passed and not failed:
        print("::error::No 64-bit native libraries found to check")
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
