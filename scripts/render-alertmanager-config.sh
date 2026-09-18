#!/usr/bin/env bash
# scripts/render-alertmanager-config.sh — render alertmanager.yml from
# ALERTMANAGER_* env vars (issue #1094).
#
# Why this script exists:
#   The upstream `prom/alertmanager:v0.26.0` image is a `FROM scratch`
#   scratch-build with ONLY the alertmanager binary — no shell, no awk,
#   no envsubst. So the `$${VAR}` placeholders in backend/alertmanager.yml
#   cannot be resolved inside the container at boot, only on the host
#   before `docker compose up`. This script does the host-side render:
#
#     ./scripts/render-alertmanager-config.sh   # write alertmanager.yml.rendered
#
# docker-compose mounts the rendered file (see backend/docker-compose.yml
# alertmanager `volumes:` block — `./alertmanager.yml.rendered:/etc/alertmanager/alertmanager.yml`).
#
# Prerequisites (already in CI / local dev images):
#   - bash 4+ (parameter-expansion used)
#   - gettext's `envsubst` (Mac: `brew install gettext && brew link gettext`;
#     Linux: apt/dnf install gettext-base; Alpine: apk add gettext)
#
# Fail-fast: any ALERTMANAGER_* env var set to __SET_VIA_DOTENV__ (the
# #1096 sentinel) makes us fail before writing the rendered file. Combined
# with scripts/alertmanager-validate.sh that runs as a precondition,
# the operator gets a clear fail before any container is created.
#
# Idempotent: re-running the script overwrites the previous .rendered file.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
TEMPLATE="$BACKEND_DIR/alertmanager.yml"
RENDERED="$BACKEND_DIR/alertmanager.yml.rendered"
ENV_FILE="$BACKEND_DIR/.env"

ok()   { echo "  [render-am] OK $*"; }
err()  { echo "  [render-am] ERR $*" >&2; }
hdr()  { echo ""; echo "[render-am] $*"; }

if ! command -v envsubst >/dev/null 2>&1; then
    err "envsubst not found. Install gettext:"
    echo "    macOS:  brew install gettext && brew link --force gettext"
    echo "    Debian/Ubuntu:  sudo apt-get install -y gettext-base"
    echo "    RHEL/Fedora:  sudo dnf install -y gettext"
    echo "    Alpine (in CI):  apk add --no-cache gettext"
    exit 1
fi

if [ ! -f "$TEMPLATE" ]; then
    err "Template not found at $TEMPLATE"
    exit 1
fi

# Load the .env file into the current shell WITHOUT `set -a; . ./.env; set +a`:
# backend/.env.example ships unquoted placeholder values like
# HMAC_SECRET=<change_me_...> which the shell rejects as a syntax error during
# sourcing. Docker Compose's env_file directive parses with a tolerant
# parser (handles quoted/unquoted, ignores invalid lines). We do the same
# here with a minimal Python pass — Node is already required for the project
# (backend/package.json) and Python is universal on macOS + Linux. This
# yields a clean key=value map with the unquoted-angle value preserved as-is.
# Defensive: missing .env is a hard fail.
if [ ! -f "$ENV_FILE" ]; then
    err ".env not found at $ENV_FILE. Copy backend/.env.example → backend/.env first."
    exit 1
fi
# shellcheck disable=SC1090
eval "$(
    python3 - "$ENV_FILE" <<'PYEOF'
import sys
from pathlib import Path
p = Path(sys.argv[1])
for raw in p.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith('#'):
        continue
    if '=' not in line:
        continue
    k, _, v = line.partition('=')
    k = k.strip()
    if not k or not k.replace('_', '').isalnum():
        continue
    v = v.strip()
    # strip surrounding quotes (single/double) so `KEY="x"` becomes `x`
    if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
        v = v[1:-1]
    # Wrap in single quotes for export. Escape any literal single quotes
    # (close the existing quote, insert an escaped quote, reopen). This
    # handles BOTH the .env's existing quoted values (e.g.
    # `URL="https://...?key=abc"`) AND the unquoted placeholder values
    # (e.g. `SMTP_PASSWORD=your_smtp_password_here` containing angle brackets
    # that would otherwise be globbed by the shell).
    v = v.replace("'", "'\\''")
    print(f"export {k}='{v}'")
PYEOF
)"

# Fail-fast on any sentinel — mirrors the in-container guard in
# backend/docker-compose.yml alertmanager entrypoint.
fail=0
while IFS='=' read -r var val; do
    case "$var" in
        ALERTMANAGER_*)
            if [ "$val" = "__SET_VIA_DOTENV__" ] || [ -z "$val" ]; then
                err "$var is still the __SET_VIA_DOTENV__ placeholder (or empty)."
                fail=1
            fi
            ;;
    esac
done < <(env)

if [ "$fail" = "1" ]; then
    err "Refusing to render alertmanager.yml with placeholders. Edit backend/.env."
    exit 1
fi

hdr "Rendering $RENDERED from $TEMPLATE (envsubst)"
# envsubst expands ONLY $VAR and ${VAR} references; anything else is left
# alone, so the YAML structure (anchors, multiline, etc.) is preserved.
# We also escape the bash variable to avoid command-injection via a crafted
# ALERTMANAGER_ value (the upstream container ignores any \ character, so a
# backslash would only matter at the YAML parser level; alertmanager does
# not evaluate env-style expansions inside a string literal).
envsubst < "$TEMPLATE" > "$RENDERED"
ok "Wrote $RENDERED ($(wc -l < "$RENDERED") lines, $(wc -c < "$RENDERED") bytes)"

# Sanity: every ${ALERTMANAGER_*} that appeared in the template is GONE from
# the rendered file (no remaining unresolved placeholders).
leftover=$(rtk grep -c '\${ALERTMANAGER_' "$RENDERED" || true)
if [ "$leftover" -gt 0 ]; then
    err "$leftover unresolved \${ALERTMANAGER_*} placeholders remain in the rendered file. Check envsubst + .env."
    exit 1
fi
ok "No leftover placeholders"

echo ""
echo "Next: cd $BACKEND_DIR && docker compose up -d alertmanager"
