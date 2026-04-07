#!/bin/bash
# Automatically fix invalid UID references in scene files
# Usage: ./scripts/fix_uid_references.sh [--dry-run]

set -e

DRY_RUN=""
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "DRY RUN MODE - No changes will be made"
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Scanning for invalid UID references..."

# Find all .tscn files
find scenes -name "*.tscn" -type f | while read -r scene_file; do
  echo "Checking: $scene_file"

  # Extract all uid references from [ext_resource] lines
  grep -oP '(?<=uid=")[^"]*(?=")' "$scene_file" | while read -r uid; do
    # Skip if it's a hash UID (looks like uid://ca77d1erwjhbw)
    if [[ "$uid" =~ ^uid://[a-z0-9]+$ ]]; then
      continue
    fi

    # This looks like a human-readable UID that might be invalid
    # e.g., uid://game_over_scene
    if [[ "$uid" =~ ^uid://[a-z_]+$ ]]; then
      # Find the path this UID refers to
      path=$(grep -B1 "uid=\"$uid\"" "$scene_file" | grep -oP '(?<=path=")[^"]*(?=")' || true)

      if [[ -n "$path" && -f "$path" ]]; then
        # Get the actual UID from the referenced file
        actual_uid=$(head -1 "$path" | grep -oP '(?<=uid=")[^"]*(?=")' || echo "")

        if [[ -n "$actual_uid" ]]; then
          echo "  Fixing: $uid -> $actual_uid (from $path)"

          if [[ -z "$DRY_RUN" ]]; then
            sed -i "s|uid=\"$uid\"|uid=\"$actual_uid\"|g" "$scene_file"
          else
            echo "    [Would update: $scene_file]"
          fi
        fi
      fi
    fi
  done
done

if [[ -z "$DRY_RUN" ]]; then
  echo ""
  echo "Fixes applied. Rescanning Godot filesystem..."
  # Trigger rescan if Godot MCP is available
  echo "Please rescan filesystem in Godot Editor or run: File > Rescan"
fi
