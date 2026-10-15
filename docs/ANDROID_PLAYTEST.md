# Android debug playtest (Godot 4.6, Linux)

This is a local debug build, not a Play Store release. No Play Console account,
release keystore, payment, backend deployment or security downgrade is required.
The `Android` export preset is checked in. Physical-phone behavior still needs
verification; parsing a preset is not proof that an APK builds or runs.

## Toolchain

Install the Godot **4.6 stable editor** and matching **4.6 stable export templates**.
In Godot, use **Editor > Manage Export Templates > Download and Install**.
Use OpenJDK **17** and Android Studio's SDK, not an old Linux-distribution SDK.
Godot 4.6 documents these packages:

- Platform-tools 35.0.0 or later
- Build-tools 35.0.1 and platform Android 35
- Command-line tools (latest)
- CMake 3.10.2.4988404 and NDK 28.1.13356709

If `sdkmanager` is already installed, the official package command is:

```bash
sdkmanager --sdk_root="$HOME/Android/Sdk" \
  'platform-tools' 'build-tools;35.0.1' 'platforms;android-35' \
  'cmdline-tools;latest' 'cmake;3.10.2.4988404' 'ndk;28.1.13356709'
```

Review and accept any SDK license terms yourself. In Godot's **Editor Settings >
Export > Android**, set **Java SDK Path** to the OpenJDK 17 installation and
**Android SDK Path** to your SDK directory (often `$HOME/Android/Sdk`).
Godot uses a local debug keystore for debug exports; do not add signing secrets
to `export_presets.cfg` or version control.

Sources: [Godot 4.6 download](https://godotengine.org/download/archive/4.6-stable/),
[Godot 4.6 Android setup](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_android.html).

## Build from a clean checkout

The SSH clone assumes your GitHub SSH access is already configured. Use a new
folder so existing uncommitted work is untouched. Replace the Godot path with
the actual downloaded editor executable:

```bash
git clone git@github.com:anchapin/armored-archer.git armored-archer-playtest
cd armored-archer-playtest
git switch main
git pull --ff-only
GODOT="$HOME/Downloads/Godot_v4.6-stable_linux.x86_64"
"$GODOT" --version
mkdir -p export/android
"$GODOT" --headless --editor --path . \
  --script scripts/validate_android_export_preset.gd
"$GODOT" --headless --path . --export-debug Android \
  export/android/armored-archer.apk
```

Stop if validation or export fails. Do not install a stale APK from an earlier
failed build. The validator checks preset syntax and actual editor option names;
it does not validate SDK installation, build success or physical-device behavior.

The preset uses APK format, Gradle off, `com.armoredarcher.game`, display name
`Armored Archer`, ARMv7 and ARM64, Internet permission, and normal debug signing.
No production reward, backend URL, login or security setting is changed.

Source: [Godot command line](https://docs.godotengine.org/en/4.6/tutorials/editor/command_line_tutorial.html).

## Install over USB with protection left on

On the phone, enable Developer options and USB debugging. Connect it to your own
trusted Linux PC, unlock it and approve that PC's RSA authorization prompt.
Do not enable installation from unknown sources or disable Advanced Protection.

```bash
ADB="$HOME/Android/Sdk/platform-tools/adb"
"$ADB" devices
```

Continue only when the intended phone shows `device`, not `unauthorized` or
`offline`. With multiple devices connected, specify `-s SERIAL` before `install`.
Then, from the repository directory:

```bash
"$ADB" install -r export/android/armored-archer.apk
```

Open Armored Archer on the phone and test campaign movement, aiming, firing,
menus and touch-control placement. The MVP campaign can continue offline when
login is unavailable; this is not evidence that online PvP or purchases work.

Google **account** Advanced Protection explicitly allows installs through ADB.
Android 16 **device** Advanced Protection is a different setting; its docs do not
explicitly promise that exception. If installation is blocked, keep protection
on and record the error, Android version and which protection setting is enabled.
A Play Store internal-testing track is a separate protection-on option, not
configured by this debug preset.

If Ubuntu cannot see the phone, check the official Linux USB permissions/udev
instructions. On `INSTALL_FAILED_UPDATE_INCOMPATIBLE` or another signing mismatch,
do not automatically uninstall the existing app: that can erase local progress.
After testing, disable USB debugging and revoke this PC's USB debugging
authorization in Developer options.

Sources: [ADB](https://developer.android.com/tools/adb),
[Linux USB setup](https://developer.android.com/studio/run/device),
[account Advanced Protection](https://support.google.com/accounts/answer/9764949?hl=en),
[device Advanced Protection](https://support.google.com/android/answer/16339980?hl=en),
[Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

## iOS status

The old inactive iOS block is archived verbatim in
`docs/reference/ios-export-preset.legacy.cfg`. It is not an active Godot 4.6 preset.
This Android repair does not guess iOS signing defaults or claim iOS export is
ready. Recreate that preset on a Mac with Xcode and verify signing separately.
