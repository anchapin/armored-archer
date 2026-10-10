#!/usr/bin/env bash
# Check the resolved compose host binds before starting services.
# --profile dev (default) or ci; --all is accepted for compatibility.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/check_compose_ports.py" "$@"
