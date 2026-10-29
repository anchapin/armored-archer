#!/usr/bin/env bash
# Issue #1660 step 3: ratchet guard on the registered autoload count.
# Every autoload is instantiated at startup on every platform, so the count
# only goes DOWN as trims land - never raise MAX_AUTOLOADS without an issue
# reference (mirrors the data/gut-baseline.json ratchet rule in AGENTS.md).
set -euo pipefail

MAX_AUTOLOADS="${MAX_AUTOLOADS:-50}"

COUNT=$(python3 - <<'PY'
import re
s = open('project.godot').read()
m = re.search(r'\[autoload\]\n(.*?)(?:\n\[|\Z)', s, re.S)
if not m:
    print(-1)
else:
    print(sum(1 for l in m.group(1).strip().splitlines() if '=' in l))
PY
)

if [ "$COUNT" -lt 0 ]; then
  echo "::error::Could not parse [autoload] section of project.godot"
  exit 1
fi

echo "Registered autoloads: $COUNT (ceiling $MAX_AUTOLOADS)"
if [ "$COUNT" -gt "$MAX_AUTOLOADS" ]; then
  echo "::error::Autoload count $COUNT exceeds ceiling $MAX_AUTOLOADS (issue #1660). New autoloads need a trim elsewhere or an issue-referenced ceiling change in scripts/check-autoload-count.sh."
  exit 1
fi
echo "Autoload count within ceiling"
