#!/bin/bash
# Cleanup script for act (GitHub Actions local runner)
# Removes all act containers, networks, and cache to prevent port conflicts

set -e

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
  rm -rf /home/alex/.cache/act/*
fi

echo "Act cleanup complete!"
