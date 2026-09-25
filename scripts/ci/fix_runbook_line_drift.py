#!/usr/bin/env python3
"""Fix line-drift citations across docs/runbooks/.

For each `<file>.ts:<line>` citation that the audit script flags as broken,
find the new line of the symbol the citation mentions and update the
citation.

Symbols extracted from each citation line (in order):
  - Backtick-wrapped identifiers: `fooBar`
  - snake_case / camelCase identifiers ≥ 8 chars
  - armored_archer_* metric names

The new line is the first occurrence of any extracted symbol in the cited
file. If multiple candidates exist, prefer the function/method definition
(matches `export function NAME`, `function NAME`, or `const NAME =`)
followed by `NAME(`, then the first reference. When no candidate resolves
to a unique new line, the citation is left untouched for human review.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
RUNBOOK_DIR = REPO_ROOT / "docs" / "runbooks"
BACKEND_SRC = REPO_ROOT / "backend" / "src"

CITATION_RE = re.compile(r"([A-Za-z0-9_./-]+\.(?:ts|yml)):(\d+)")
BACKTICK_RE = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]+)`")
METRIC_RE = re.compile(r"\b(armored_archer_[a-z0-9_]+)\b")
IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]{3,}")
CAMEL_RE = re.compile(r"[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*")
SNAKE_RE = re.compile(r"[a-z][a-z0-9]*(?:_[a-z0-9]+)+")


def resolve(frag: str) -> Optional[Path]:
    """Resolve a backend/ fragment to an absolute file path."""
    base = (BACKEND_SRC / frag).resolve()
    if base.is_file():
        return base
    rel = (BACKEND_SRC.parent / frag).resolve()
    if rel.is_file():
        return rel
    parts = Path(frag).parts
    for i in range(len(parts)):
        candidate = (BACKEND_SRC / Path(*parts[i:])).resolve()
        if candidate.is_file():
            return candidate
    return None


def candidates(line: str, frag: str) -> set[str]:
    """Extract candidate symbols a citation may be pointing to."""
    cands: set[str] = set()
    cands |= set(BACKTICK_RE.findall(line))
    cands |= set(METRIC_RE.findall(line))
    pathtoks = set(re.findall(r"[A-Za-z0-9_]+", frag))
    for tok in CAMEL_RE.findall(line) + SNAKE_RE.findall(line):
        if len(tok) >= 8 and tok not in pathtoks:
            cands.add(tok)
    return {c for c in cands if IDENT_RE.fullmatch(c)}


def find_new_line(path: Path, symbols: set[str]) -> Optional[int]:
    """Find the best 1-based line number where any of `symbols` appears in `path`.

    Prefers function/method definition style lines so the citation points
    to the symbol's declaration rather than a passing reference.
    """
    text = path.read_text()
    declaration: Optional[int] = None
    reference: Optional[int] = None
    for i, line in enumerate(text.splitlines(), 1):
        hit = next((s for s in symbols if s in line), None)
        if hit is None:
            continue
        if (
            re.search(rf"export\s+function\s+{re.escape(hit)}\b", line)
            or re.search(rf"function\s+{re.escape(hit)}\b", line)
            or re.search(rf"const\s+{re.escape(hit)}\s*=", line)
            or re.search(rf"\b{re.escape(hit)}\s*\(", line)
        ):
            declaration = i
            break
        if reference is None:
            reference = i
    return declaration or reference


def main() -> int:
    updated = 0
    skipped: list[str] = []
    for runbook in sorted(RUNBOOK_DIR.glob("*.md")):
        text = runbook.read_text()
        new_text = text

        # Iterate over citations in order. Replace each `<file>:<line>`
        # whose `<line>` no longer hosts the mentioned symbol with the
        # new line.
        for match in list(CITATION_RE.finditer(text)):
            frag, lineno = match.group(1), int(match.group(2))
            # We need the full surrounding citation context to extract
            # candidate symbols; use the entire paragraph (the citation
            # usually sits inside a fenced code block line).
            start = text.rfind("\n", 0, match.start()) + 1
            end = text.find("\n", match.end())
            if end == -1:
                end = len(text)
            line = text[start:end]

            path = resolve(frag)
            if path is None:
                continue
            cands = candidates(line, frag)
            if not cands:
                skipped.append(f"{runbook.name}: {frag}:{lineno} (no candidates extracted from line: {line.strip()[:80]})")
                continue
            src_lines = path.read_text().splitlines()
            if not (0 < lineno <= len(src_lines)):
                # Stale line number; recompute.
                new_lineno = find_new_line(path, cands)
                if new_lineno:
                    new_text = re.sub(
                        rf"{re.escape(frag)}:{lineno}",
                        f"{frag}:{new_lineno}",
                        new_text,
                        count=1,
                    )
                    updated += 1
                continue
            cited = src_lines[lineno - 1]
            if any(c in cited for c in cands):
                continue
            new_lineno = find_new_line(path, cands)
            if new_lineno is None or new_lineno == lineno:
                skipped.append(f"{runbook.name}: {frag}:{lineno} (no candidate match for {cands})")
                continue
            new_text = re.sub(
                rf"{re.escape(frag)}:{lineno}",
                f"{frag}:{new_lineno}",
                new_text,
                count=1,
            )
            updated += 1

        if new_text != text:
            runbook.write_text(new_text)

    print(f"Updated {updated} line-drift citations across docs/runbooks/")
    for s in skipped:
        print(f"  SKIP {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
