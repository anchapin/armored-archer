#!/usr/bin/env bash
# Boot the exported debug APK on the running emulator and assert it starts.
# Run by android-emulator-runner (which executes inline scripts line by line,
# so multi-line logic lives here). Failures surface as ::error:: annotations
# because step logs need admin access to read.
set -euo pipefail

PKG=com.armoredarcher.game
APK=export/android/armored-archer.apk

# Collect before android-emulator-runner tears down the emulator. Diagnostics
# are best-effort and must not replace the assertion's original exit status.
DIAGNOSTICS=android-boot-diagnostics
mkdir -p "$DIAGNOSTICS"
collect_diagnostics() {
	local result=$?
	trap - EXIT
	set +e
	timeout 20s adb logcat -d -b all -v threadtime > "$DIAGNOSTICS/logcat-all.txt" 2>&1
	timeout 20s adb logcat -d -b crash -v threadtime > "$DIAGNOSTICS/logcat-crash.txt" 2>&1
	grep -Ei 'com\.armoredarcher\.game|AndroidRuntime|F/libc|DEBUG|godot|vulkan' \
		"$DIAGNOSTICS/logcat-all.txt" > "$DIAGNOSTICS/logcat-game.txt" || true
	timeout 20s adb shell dumpsys activity exit-info "$PKG" > "$DIAGNOSTICS/exit-info.txt" 2>&1
	timeout 20s adb shell dumpsys activity activities > "$DIAGNOSTICS/activities.txt" 2>&1
	timeout 20s adb shell getprop > "$DIAGNOSTICS/device-properties.txt" 2>&1
	timeout 20s adb exec-out screencap -p > "$DIAGNOSTICS/screen.png" 2> "$DIAGNOSTICS/screencap-error.txt"
	printf 'boot-smoke exit status: %s\n' "$result" > "$DIAGNOSTICS/result.txt"
	if [ "$result" -ne 0 ]; then
		echo '::group::Game and crash log tail (full buffers in artifact)'
		tail -80 "$DIAGNOSTICS/logcat-game.txt" "$DIAGNOSTICS/logcat-crash.txt"
		echo '::endgroup::'
	fi
	exit "$result"
}
trap collect_diagnostics EXIT

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
	DIAG=$(adb logcat -d -v brief | grep -E "armoredarcher|AndroidRuntime|F/libc|DEBUG|[Gg]odot|[Vv]ulkan|ActivityManager.*(died|crash|Force)" | cut -c1-220 | tail -14)
	fail "Game process not running 60s after launch" "$DIAG"
fi
echo "Game process alive: $PID"

if ! adb logcat -d | grep -q "Godot Engine v4.6"; then
	fail "Godot engine banner not found in logcat" "$(adb logcat -d | tail -12)"
fi
echo "Godot engine banner confirmed in logcat"

adb exec-out screencap -p > boot-smoke.png
