#!/usr/bin/env bash
# Runbook Citation Freshness Audit (issue #1148)
#
# Walks docs/runbooks/*.md and verifies every code citation against the
# current backend source:
#   1. <file>.ts:<line> (and <file>.yml:<line>) citations — the file must
#      exist, the line must be in range, and any symbol named on the citation
#      line must actually sit on that source line.
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
fails, passes = [], 0

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

def check(label, ok, detail):
    global passes
    if ok:
        passes += 1
    else:
        fails.append(f"{label}: {detail}")

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

    # --- A. <file>.ts:<line> / <file>.yml:<line> citations ---
    for i, ln in enumerate(lines, 1):
        for m in re.finditer(r"([A-Za-z0-9_./-]+\.(?:ts|yml)):(\d+)", ln):
            frag, lineno = m.group(1), int(m.group(2))
            path = resolve_src(frag)
            label = f"{rb}:{i} citation {frag}:{lineno}"
            if path is None:
                check(label, False, "file not found under backend/")
                continue
            src = read(path)
            if not (0 < lineno <= len(src)):
                check(label, False, f"line {lineno} out of range (file has {len(src)})")
                continue
            content = "\n".join(src)
            cands = set(re.findall(r"`([A-Za-z_][A-Za-z0-9_.]+)`", ln))
            cands |= set(METRIC.findall(ln))
            pathtoks = set(re.findall(r"[A-Za-z0-9_]+", frag))
            for tok in CAMEL.findall(ln) + SNAKE.findall(ln):
                if len(tok) >= 8 and tok not in pathtoks and tok in content:
                    cands.add(tok)
            cands = {c for c in cands if IDENT.fullmatch(c)}
            if cands:
                ok = any(c in src[lineno - 1] for c in cands)
                check(label, ok, "no mentioned symbol sits on the cited line ("
                      + ", ".join(sorted(cands)) + "); line reads: " + src[lineno-1].strip()[:80])
            else:
                check(label, True, "")

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
    for f in fails:
        print("  FAIL " + f)
else:
    print("BROKEN CITATIONS: 0")
print(f"PASS: {passes} checks across {len(runbooks)} runbooks")
sys.exit(1 if fails else 0)
PYEOF
