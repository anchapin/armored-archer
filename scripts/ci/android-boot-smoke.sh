#!/usr/bin/env bash
# Boot the exported debug APK on the running emulator and assert it starts.
# Run by android-emulator-runner (which executes inline scripts line by line,
# so multi-line logic lives here). Failures surface as ::error:: annotations
# because step logs need admin access to read.
set -euo pipefail

PKG=com.armoredarcher.game
APK=export/android/armored-archer.apk

fail() {
	echo "::error::$1: $(printf '%s' "$2" | tr '\n' '|' | cut -c1-900)"
	exit 1
}

adb shell input keyevent 82 || true
echo "abilist: $(adb shell getprop ro.product.cpu.abilist || true)"

OUT=$(adb install -r "$APK" 2>&1) || fail "adb install failed" "$OUT"
adb logcat -c
# Resolve the launcher activity instead of hardcoding it: "am start -n" on the
# Godot activity name was rejected as not exported (SecurityException).
OUT=$(adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 2>&1) || fail "monkey launch failed" "$OUT"
if ! echo "$OUT" | grep -q "Events injected: 1"; then
	fail "launcher intent not delivered" "$OUT $(adb shell cmd package resolve-activity --brief "$PKG" 2>&1)"
fi

echo "Launched; settling..."
sleep 60

PID=$(adb shell pidof "$PKG" || true)
if [ -z "$PID" ]; then
	fail "Game process not running 60s after launch (autoload crash on device path?)" \
		"$(adb logcat -d | grep -iE 'fatal|AndroidRuntime|godot|vulkan|signal|abi' | tail -12)"
fi
echo "Game process alive: $PID"

if ! adb logcat -d | grep -q "Godot Engine v4.6"; then
	fail "Godot engine banner not found in logcat" "$(adb logcat -d | tail -12)"
fi
echo "Godot engine banner confirmed in logcat"

adb exec-out screencap -p > boot-smoke.png
