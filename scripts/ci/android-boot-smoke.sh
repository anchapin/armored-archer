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
# Read-only snapshots around launch retain configuration/overlay/package evidence
# for assets-path relaunches. Each read is bounded and best-effort; no device
# settings, launch arguments, sleep interval, or pass/fail assertions change.
collect_configuration_state() {
	local phase=$1
	timeout 5s adb shell am get-config > "$DIAGNOSTICS/$phase-configuration.txt" 2>&1 || true
	timeout 5s adb shell cmd overlay list --user 0 > "$DIAGNOSTICS/$phase-overlays.txt" 2>&1 || true
	timeout 5s adb shell dumpsys package "$PKG" > "$DIAGNOSTICS/$phase-package.txt" 2>&1 || true
	timeout 5s adb shell dumpsys window displays > "$DIAGNOSTICS/$phase-displays.txt" 2>&1 || true
}
collect_diagnostics() {
	local result=$?
	trap - EXIT
	set +e
	timeout 20s adb logcat -d -b all -v threadtime > "$DIAGNOSTICS/logcat-all.txt" 2>&1
	# Keep the full buffer above and a focused timeline without discarding events
	# from system processes that can trigger the game's configuration relaunch.
	grep -Ei 'wm_.*(config|relaunch|pause|stop|destroy)|configuration|OverlayManager|ResourcesManager|PackageManager|com\.armoredarcher\.game|godot|vulkan|renderer' \
		"$DIAGNOSTICS/logcat-all.txt" > "$DIAGNOSTICS/logcat-configuration-lifecycle.txt" || true
	timeout 20s adb logcat -d -b crash -v threadtime > "$DIAGNOSTICS/logcat-crash.txt" 2>&1
	grep -Ei 'com\.armoredarcher\.game|AndroidRuntime|F/libc|DEBUG|godot|vulkan' \
		"$DIAGNOSTICS/logcat-all.txt" > "$DIAGNOSTICS/logcat-game.txt" || true
	timeout 20s adb shell dumpsys activity exit-info "$PKG" > "$DIAGNOSTICS/exit-info.txt" 2>&1
	timeout 20s adb shell dumpsys activity activities > "$DIAGNOSTICS/activities.txt" 2>&1
	timeout 20s adb shell getprop > "$DIAGNOSTICS/device-properties.txt" 2>&1
	timeout 20s adb exec-out screencap -p > "$DIAGNOSTICS/screen.png" 2> "$DIAGNOSTICS/screencap-error.txt"
	collect_configuration_state after-smoke
	# Post-smoke only: no new work before launch or the 60-second assertions.
	# Read-only and best-effort; no resets, settings changes, or new assertions.
	timeout 5s adb shell dumpsys SurfaceFlinger --list > "$DIAGNOSTICS/after-smoke-surfaces.txt" 2>&1 || true
	timeout 5s adb shell dumpsys gfxinfo "$PKG" > "$DIAGNOSTICS/after-smoke-gfxinfo.txt" 2>&1 || true
	timeout 5s adb shell dumpsys display > "$DIAGNOSTICS/after-smoke-render-displays.txt" 2>&1 || true
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
collect_configuration_state before-launch
# Preserve package/overlay activity before the existing log-clear boundary.
timeout 20s adb logcat -d -b all -v threadtime > "$DIAGNOSTICS/logcat-before-launch.txt" 2>&1 || true
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
