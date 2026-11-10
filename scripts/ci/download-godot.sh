#!/usr/bin/env bash
# Bounded Godot 4.6 setup. Optional URL is for local fixture testing.
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 DESTINATION [URL]" >&2
  exit 2
fi
destination=$1
url=${2:-https://github.com/godotengine/godot/releases/download/4.6-stable/Godot_v4.6-stable_linux.x86_64.zip}
mkdir -p "$(dirname "$destination")"
staging=$(mktemp -d "$(dirname "$destination")/.godot-download.XXXXXX")
trap 'rm -rf "$staging"' EXIT

# Retry only curl's default transient failures, never the tests or whole job.
# Keep certificate checks enabled and do not print response/redirect headers.
curl --fail --location --show-error --silent \
  --connect-timeout 15 --max-time 120 \
  --retry 2 --retry-delay 2 --retry-max-time 360 \
  --output "$staging/godot.zip.part" \
  --write-out 'Godot download: HTTP %{http_code}, %{size_download} bytes, %{time_total}s\n' \
  "$url"
unzip -tq "$staging/godot.zip.part"
unzip -p "$staging/godot.zip.part" Godot_v4.6-stable_linux.x86_64 > "$staging/godot"
chmod +x "$staging/godot"
version=$("$staging/godot" --headless --version)
if [[ ! "$version" =~ ^4\.6\.stable\. ]]; then
  echo "Unexpected Godot version: $version" >&2
  exit 1
fi
mv "$staging/godot" "$destination"
printf 'Godot ready: %s\n' "$version"
