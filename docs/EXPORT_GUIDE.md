# Armored Archer export guide

## Android debug playtests

Use [Android debug playtest](ANDROID_PLAYTEST.md) for the maintained Godot 4.6
Linux setup, export and USB install procedure. It includes the exact SDK packages,
ADB authorization checks and Advanced Protection guidance.

The checked-in `Android` preset uses:

- Godot 4.6 `[preset.0]` sections and current Android option names
- APK export without Gradle, ARMv7 and ARM64
- Package `com.armoredarcher.game`, display name `Armored Archer`
- Internet permission and the local editor's debug signing

No Play Console account or release keystore is required for a USB debug playtest.
No signing credentials belong in version control. SDKs, JDK 17 and matching Godot
export templates must be installed locally; the preset cannot supply them.

From a configured checkout with Godot 4.6 in `GODOT`:

```bash
mkdir -p export/android
"$GODOT" --headless --editor --path . \
  --script scripts/validate_android_export_preset.gd
"$GODOT" --headless --path . --export-debug Android \
  export/android/armored-archer.apk
```

Validation checks the config and actual editor option schema. A successful
validation is not evidence of APK build success or physical-phone behavior.

## Play Store releases

Publication is a separate task, not configured by this debug preset. New Play
apps require a release-signed AAB, Play App Signing and a configured Console app
and testing track. Prepare signing through Godot's release settings and keep
credentials private. Do not manually re-sign a debug APK using old SHA1 commands.

Sources: [Godot 4.6 Android export](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_android.html),
[Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).

## iOS status

There is currently **no active Godot 4.6 iOS export preset**. The earlier file used
unrecognized `[presets.N]` sections and legacy option names. Its inactive iOS
block is preserved verbatim in `docs/reference/ios-export-preset.legacy.cfg` for a
later migration, not as an executable preset.

Recreate and validate an iOS preset on a Mac with Xcode, the matching Godot export
templates and appropriate signing. This Android repair does not activate guessed
iOS signing defaults, create a release certificate or claim App Store readiness.
