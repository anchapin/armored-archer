#!/bin/bash
# Cleanup script for act (GitHub Actions local runner)
# Removes all act containers, networks, and cache to prevent port conflicts

set -e

# Script directory (for sourcing the shared act lock helper)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Act invocation lock (issues #992 / #1028): wiping ~/.cache/act while an
# act invocation is running corrupts it — serialize with ci-local.sh and
# run-ci-locally.sh.
# shellcheck source=scripts/lib/act-lock.sh
source "${SCRIPT_DIR}/lib/act-lock.sh"

echo "Cleaning up act resources..."

# Remove all act containers
echo "Removing act containers..."
docker ps -a --filter "name=act-" --format "{{.ID}}" 2>/dev/null | xargs -r docker rm -f || echo "No act containers to remove"

# Remove all act networks
echo "Removing act networks..."
docker network ls --filter "name=act-" --format "{{.ID}}" 2>/dev/null | xargs -r docker network rm || echo "No act networks to remove"

# Optional: Clean up act cache
if [ "$1" = "--cache" ]; then
  echo "Cleaning up act cache..."
  # Hold the act lock while wiping the shared cache (issue #992).
  run_with_act_lock rm -rf "${HOME}/.cache/act/"*
fi

echo "Act cleanup complete!"
