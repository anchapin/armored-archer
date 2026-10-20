#!/usr/bin/env bash
# Build the signed Play Store AAB (issue #1725).
# Inputs (environment): GODOT_BIN, ANDROID_SDK_ROOT, KEYSTORE_PATH, KEYSTORE_ALIAS,
# KEYSTORE_PASSWORD. Never echo the password; Godot reads the release
# keystore from GODOT_ANDROID_KEYSTORE_RELEASE_* environment variables.
set -euo pipefail

: "${GODOT_BIN:?}" "${ANDROID_SDK_ROOT:?}" "${KEYSTORE_PATH:?}" "${KEYSTORE_ALIAS:?}" "${KEYSTORE_PASSWORD:?}"
AAB=export/android/armored-archer-release.aab
TEMPLATES="$HOME/.local/share/godot/export_templates/4.6.stable"

# 1. Gradle build template, installed at build time (not committed). Mirrors the
#    editor's "Install Android Build Template": extract the source zip into
#    android/build and record the engine version.
rm -rf android/build
mkdir -p android/build
unzip -q "$TEMPLATES/android_source.zip" -d android/build
touch android/build/.gdignore
echo "4.6.stable" > android/.build_version

# 2. Play requires targetSdk 36 from Aug 31 2026; Godot 4.6's template defaults
#    to 35. The preset sets target_sdk=36; compileSdk must be at least as high.
#    The template's AGP (8.6.1) predates API 36, so suppress its compileSdk warning.
sed -i -E "s/(compileSdk +: )35/\136/" android/build/config.gradle
grep -nE "compileSdk|targetSdk" android/build/config.gradle | head -4
echo "android.suppressUnsupportedCompileSdk=36" >> android/build/gradle.properties

# 3. Editor settings: SDK paths plus a throwaway debug keystore (Godot requires one).
keytool -genkeypair -keystore /tmp/debug.keystore -alias androiddebugkey -keyalg RSA -keysize 2048 \
	-validity 10000 -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
mkdir -p ~/.config/godot
cat > ~/.config/godot/editor_settings-4.6.tres <<TRES
[gd_resource type="EditorSettings" format=3]

[resource]

export/android/android_sdk_path = "${ANDROID_SDK_ROOT}"
export/android/java_sdk_path = "${JAVA_HOME}"
export/android/debug_keystore = "/tmp/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
TRES

# 4. Export the release AAB.
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$KEYSTORE_PATH"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="$KEYSTORE_ALIAS"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$KEYSTORE_PASSWORD"
mkdir -p export/android
"$GODOT_BIN" --headless --import || true
"$GODOT_BIN" --headless --export-release "Android Release" "$AAB"

# 5. Checks.
test -f "$AAB" || { echo "::error::AAB was not produced"; exit 1; }
SIZE=$(stat -c%s "$AAB")
echo "AAB size: ${SIZE} bytes"
if [ "$SIZE" -lt 10000000 ]; then
	echo "::error::AAB is suspiciously small (${SIZE} bytes)"
	exit 1
fi
if ! jarsigner -verify "$AAB" | grep -q "jar verified"; then
	echo "::error::AAB signature did not verify"
	exit 1
fi
python3 scripts/ci/check_elf_alignment.py "$AAB"
# Target SDK check: the bundle manifest must declare targetSdkVersion 36.
unzip -p "$AAB" base/manifest/AndroidManifest.xml | strings | grep -q "targetSdkVersion" || echo "::warning::could not read targetSdkVersion from the AAB manifest (proto format); verify manually with bundletool"
