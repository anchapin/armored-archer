#!/usr/bin/env bash
# Runbook Citation Freshness Audit (issue #1148, #1425)
#
# Walks docs/runbooks/*.md and verifies every code citation against the
# current backend source:
#   1. <file>.ts[#symbol] / <file>.yml[#symbol] citations — when a symbol is
#      given (file#symbol or file:line#symbol) the audit checks that the
#      symbol exists anywhere in the file. Line numbers are kept as human
#      hints only and excluded from the pass/fail decision.
#      Legacy format: file:line without a symbol → falls back to line-number
#      check and is marked as LEGACY so it can be migrated off deliberately.
#   2. grep commands targeting backend/src — every pattern alternative must
#      match in at least one listed file, and every listed file must match at
#      least one alternative (a 3am grep that returns nothing is drift).
#   3. armored_archer_* metric names — names grepped from the live /metrics
#      endpoint must be produced by backend/src; names quoted in PromQL are
#      checked against backend/src ∪ alerting/prometheus ymls (alert-vocabulary
#      split is tracked separately, see issue #1074).
#
# Exits non-zero (CI-failing) when any citation has drifted.
#
# Usage:
#   bash scripts/audit-runbook-citations.sh            # audit the repo this script lives in
#   bash scripts/audit-runbook-citations.sh <repo-root>  # audit another checkout
#   bash scripts/audit-runbook-citations.sh --help     # show this help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

REPO_ROOT="${1:-$DEFAULT_REPO_ROOT}"
cd "$REPO_ROOT"

python3 - <<'PYEOF'
import glob, os, re, sys

runbooks = sorted(glob.glob("docs/runbooks/*.md"))
fails, passes, legacy = [], 0, 0

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read().splitlines()

def resolve_src(name):
    cands = [name] if name.startswith("backend/") else (
        [f"backend/{name}"] if name.endswith(".yml") else
        [f"backend/src/modules/{name}", f"backend/src/{name}", name]
    )
    for c in cands:
        if os.path.isfile(c):
            return c
    return None

CAMEL = re.compile(r"[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*")
SNAKE = re.compile(r"[a-z][a-z0-9]*(?:_[a-z0-9]+)+")
IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]{3,}")
METRIC = re.compile(r"\b(armored_archer_[a-z0-9_]+)\b")

# allowlist sources for alert-vocabulary metric names (promql citations quote alert exprs)
yml_blob = ""
for pat in ("backend/*.yml", "backend/config/*.yml", "backend/grafana/provisioning/**/*.yml"):
    for p in glob.glob(pat, recursive=True):
        try:
            yml_blob += open(p, encoding="utf-8").read()
        except OSError:
            pass

src_files = [os.path.join(r, f) for r, _, fs in os.walk("backend/src")
             for f in fs if f.endswith(".ts")]
src_blob = ""
for p in src_files:
    try:
        src_blob += open(p, encoding="utf-8").read()
    except OSError:
        pass

def check(label, ok, detail, is_legacy=False):
    global passes, legacy
    if ok:
        passes += 1
    else:
        fails.append((label, detail, is_legacy))
    if is_legacy and ok:
        legacy += 1

for rb in runbooks:
    lines = read(rb)
    joined, buf = [], ""
    for ln in lines:
        s = ln.rstrip()
        if s.endswith("\\"):
            buf += s[:-1] + " "
        else:
            joined.append(buf + ln)
            buf = ""
    if buf:
        joined.append(buf)

    # --- A. Citation patterns ---
    # Symbol-anchored citations (primary format, #1425):
    #   file.ts#symbol        — symbol anchor only
    #   file.ts:123#symbol   — line hint + symbol anchor
    # Legacy line-number citations (to be migrated):
    #   file.ts:123          — line number only (no symbol)
    for i, ln in enumerate(lines, 1):
        # Symbol-anchored: file#symbol or file:line#symbol
        for m in re.finditer(r"([A-Za-z0-9_./-]+\.(?:ts|yml))(?::(\d+))?(#([A-Za-z_][A-Za-z0-9_]*))", ln):
            frag = m.group(1)
            lineno = int(m.group(2)) if m.group(2) else None
            symbol = m.group(4)
            path = resolve_src(frag)
            base_label = f"{rb}:{i}"

            if path is None:
                check(f"{base_label} symbol citation {frag}#{symbol}", False,
                      f"file not found under backend/ (tried: {[c for c in [f'backend/{frag}', f'backend/src/modules/{frag}', f'backend/src/{frag}', frag] if not c.startswith('backend/')]})")
                continue

            src = read(path)
            content = "\n".join(src)

            # Symbol-anchored: check symbol exists anywhere in file
            # Word-boundary match: a rename that merely extends the old name
            # (rpcRevenueCatWebhook -> rpcRevenueCatWebhookV2) must still fail.
            symbol_ok = re.search(r'(?<![A-Za-z0-9_])' + re.escape(symbol) + r'(?![A-Za-z0-9_])', content) is not None
            check(f"{base_label} symbol {frag}#{symbol}", symbol_ok,
                  f"symbol '{symbol}' not found in {frag}" if not symbol_ok else "",
                  is_legacy=False)

        # Legacy line-number citations: file:line (no symbol) — marked as LEGACY
        for m in re.finditer(r"([A-Za-z0-9_./-]+\.(?:ts|yml)):(\d+)(?![0-9#])", ln):
            frag = m.group(1)
            lineno = int(m.group(2))
            path = resolve_src(frag)
            base_label = f"{rb}:{i}"

            if path is None:
                check(f"{base_label} LEGACY citation {frag}:{lineno}", False,
                      "file not found under backend/", is_legacy=True)
                continue

            src = read(path)
            content = "\n".join(src)

            if not (0 < lineno <= len(src)):
                check(f"{base_label} LEGACY citation {frag}:{lineno}", False,
                      f"line {lineno} out of range (file has {len(src)})",
                      is_legacy=True)
                continue

            cands = set(re.findall(r"`([A-Za-z_][A-Za-z0-9_.]+)`", ln))
            cands |= set(METRIC.findall(ln))
            pathtoks = set(re.findall(r"[A-Za-z0-9_]+", frag))
            for tok in CAMEL.findall(ln) + SNAKE.findall(ln):
                if len(tok) >= 8 and tok not in pathtoks and tok in content:
                    cands.add(tok)
            cands = {c for c in cands if IDENT.fullmatch(c)}
            if cands:
                ok = any(c in src[lineno - 1] for c in cands)
                check(f"{base_label} LEGACY citation {frag}:{lineno}", ok,
                      "LEGACY: no mentioned symbol sits on the cited line ("
                      + ", ".join(sorted(cands)) + "); line reads: " + src[lineno-1].strip()[:80],
                      is_legacy=True)
            else:
                check(f"{base_label} LEGACY citation {frag}:{lineno}", True, "",
                      is_legacy=True)

    # --- B. grep patterns targeting backend/src ---
    for ln in joined:
        if "grep" not in ln or "backend/src" not in ln:
            continue
        m = re.search(r'grep\s+(?:-[A-Za-z]+\s+)*"([^"]+)"(.*)', ln)
        if not m:
            continue
        pat, rest = m.group(1), m.group(2)
        alts = [a for a in re.split(r"\\\||\|", pat) if a]
        targets = re.findall(r"(backend/src/\S+?\.ts\b|backend/src/)", rest)
        if not targets or not alts:
            continue
        label = f'{rb} grep "{pat}"'
        dir_mode = any(t == "backend/src/" for t in targets)
        if dir_mode:
            missing = [a for a in alts if a not in src_blob]
            check(label, not missing, f"alternatives not found anywhere in backend/src: {missing}")
        else:
            for f in targets:
                if not os.path.isfile(f):
                    check(label, False, f"target file missing: {f}")
                    continue
                content = open(f, encoding="utf-8").read()
                if not any(a in content for a in alts):
                    check(label + f" [{os.path.basename(f)}]", False,
                          f"no alternative matches in {f}: {alts}")
            for a in alts:
                if not any(a in open(f, encoding="utf-8").read() for f in targets if os.path.isfile(f)):
                    check(label, False, f"alternative matches nowhere in listed targets: {a}")

    # --- D. armored_archer_* metric-name citations ---
    for i, ln in enumerate(lines, 1):
        if "docker network" in ln:
            continue
        for name in METRIC.findall(ln):
            if "curl" in ln and "grep" in ln:
                check(f"{rb}:{i} metrics-endpoint grep {name}", name in src_blob,
                      "name not produced by backend/src (live /metrics would return nothing)")
            else:
                check(f"{rb}:{i} metric ref {name}",
                      name in src_blob or name in yml_blob,
                      "name found neither in backend/src nor alerting/prometheus ymls")

print("=" * 72)
if fails:
    print(f"BROKEN CITATIONS: {len(fails)}")
    for label, detail, is_legacy in fails:
        prefix = "LEGACY-FAIL" if is_legacy else "FAIL"
        print(f"  {prefix} {label}: {detail}")
else:
    print("BROKEN CITATIONS: 0")
print(f"PASS: {passes} checks across {len(runbooks)} runbooks")
if legacy > 0:
    print(f"LEGACY: {legacy} passes on uncaptured line-number citations (migrate to symbol anchoring)")
sys.exit(1 if fails else 0)
PYEOF
