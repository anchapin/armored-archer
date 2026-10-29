# Armored Archer - Google Play Store Description

## Short Description (80 characters max)
Epic archer RPG adventure with turn-based combat, gear progression, and PvP battles!

## Description

Armored Archer is a free-to-play mobile RPG combining strategic turn-based combat, gear progression, and competitive PvP battles. Build your ultimate archer, customize your loadout, and dominate the arena!

## Features

**Epic Campaign Journey**
- Battle through challenging stages across multiple biomes
- Face off against unique bosses with special abilities
- Earn powerful gear and rewards as you progress
- Experience an engaging storyline

**Turn-Based Tactical Combat**
- Master the thumb-drag aiming mechanic for precision shooting
- Strategize with elemental damage types and effects
- Equip and upgrade armor, weapons, and accessories
- Transmog your gear with cosmetic skins

**Competitive PvP**
- Test your skills against players worldwide
- Climb seasonal leaderboards for exclusive rewards
- Participate in asynchronous PvP battles
- Earn ranking points and seasonal prizes

**Character Progression**
- Level up your character to unlock new abilities
- Allocate stat points to customize your playstyle
- Collect and upgrade legendary gear sets
- Combine gear pieces for powerful bonuses

**Cosmetic Shop**
- Purchase cosmetic skins to personalize your character
- Support development with optional purchases
- Unlock exclusive items through gameplay

## Why You'll Love It

✓ **Strategic Depth**: Plan your moves carefully in turn-based combat
✓ **Customization**: Build your unique archer with thousands of gear combinations
✓ **Progression**: Constant rewards and progression keep you engaged
✓ **Fair Play**: Skill-based gameplay with no pay-to-win mechanics
✓ **Beautiful Art**: Stunning visuals and character designs

## Screenshots

[Add 2-8 screenshots showing:]
1. Main menu/UI
2. Character selection screen
3. Combat gameplay
4. Gear inventory
5. Shop interface
6. PvP leaderboard
7. Stage selection
8. Character customization

## Google Play Store Details

**Category:** Role Playing
**Content Rating:** Teen (Fantasy Violence, Mild Language)
**Downloads:** [Will be updated after launch]
**Size:** [Estimated size after build]
**In-App Purchases:** Yes (Cosmetic items only)
**Ads:** None

## What's New

### Version 1.0.0
- Initial release
- Campaign mode with multiple biomes
- Turn-based combat system
- Gear progression and customization
- Asynchronous PvP battles
- Seasonal leaderboards
- Cosmetic shop with gem system
- Regular content updates planned

## Permissions

**Required:**
- Internet access: Required for multiplayer and cloud saves

**Optional:**
- None

## Privacy Policy

Privacy Policy URL: https://anchapin.github.io/armored-archer/docs/privacy-policy.html

## Support

Need help? Contact us at: [Add support email]

Follow us for updates:
- Twitter: @ArmoredArcherGame
- Discord: [Add Discord link]
- Website: [Add website URL]

---

**Download Armored Archer now and begin your epic journey!**

Note: Armored Archer is free to play with optional in-app purchases for cosmetic items. No pay-to-win mechanics. No advertisements.

## Additional Notes

**Performance:** Optimized for Android 8.0+ devices
**Storage:** Requires ~200MB free space
**Internet:** Constant internet connection required
**Age:** Rated Teen for mild fantasy violence

---

## Play-Store release plan (issue #1725)

**Status: plan only.** This section is documentation. No export preset, workflow,
script, keystore, credential or store submission was changed or produced by it.
Nothing here contains a secret value, and no signing key was generated.

**Ownership.** Alex owns the Play Console account, the release keystore and its
credentials, the CI secret configuration, and every decision flagged
"DECISION FOR ALEX" below. This repository only owns the build definition and
the checks.

### 1. Verified current state

All rows below were read from this worktree (base commit `86dcece9`), not assumed.

- Export preset: one preset, `name="Android"`, `platform="Android"` -
  `export_presets.cfg:3-6`.
- Preset header comment, as quoted in the issue: "Godot 4.6 Android debug
  playtest preset. No release signing credentials." - `export_presets.cfg:1`.
- Output is an APK: `export_path="export/android/armored-archer.apk"` -
  `export_presets.cfg:13`; `gradle_build/export_format=0` (0 = APK, 1 = AAB) -
  `export_presets.cfg:22` and Godot's own option enum "Export APK,Export AAB" -
  `godot 4.6-stable platform/android/export/export_plugin.cpp:2118`.
- Gradle build is off: `gradle_build/use_gradle_build=false` -
  `export_presets.cfg:21`.
- No release signing material is tracked: no `keystore/release*` keys exist in
  `export_presets.cfg`, and the repo's own validator asserts those three keys
  stay empty - `scripts/validate_android_export_preset.gd:46-47`.
- `package/signed=true` - debug signing only - `export_presets.cfg:29`.
- Architectures: `armeabi-v7a=true`, `arm64-v8a=true`, `x86=false`,
  `x86_64=false` - `export_presets.cfg:23-26`. armeabi-v7a is still exported.
- Engine: Godot 4.6 - `project.godot:19` (`config/features=...("4.6", ...)`) and
  `GODOT_VERSION: 4.6-stable` - `.github/workflows/android-export.yml:18`.
- CI exports a **debug** APK with the same preset:
  `--export-debug "Android" export/android/armored-archer.apk` -
  `.github/workflows/android-export.yml:83`; the job only asserts the file exists
  and is over 10 MB - `.github/workflows/android-export.yml:85-94`.
- CI installs `platforms;android-34` and `build-tools;34.0.0` -
  `.github/workflows/android-export.yml:62`, while the maintained local
  toolchain documents Platform 35, Build-Tools 35.0.1 and NDK 28.1.13356709 -
  `docs/ANDROID_PLAYTEST.md:15-18` (also `docs/ANDROID_PLAYTEST.md:23-25`).
- Target SDK today: the preset has no `gradle_build/target_sdk` key, and Godot
  only exposes the min/target SDK options when the Gradle build is enabled
  (`export_plugin.cpp:2230`, `:2234`). With Gradle off, the shipped target SDK
  is the export template's: Godot 4.6 ships `targetSdk : 35` in its Android
  Gradle config - `platform/android/java/app/config.gradle:9` - and its editor
  default is `DEFAULT_TARGET_SDK_VERSION = 35` -
  `platform/android/export/export_plugin.cpp:290` (min SDK default 24, `:289`).
- 16 KB page size: there is **no** alignment check anywhere in this repo. A
  repository-wide grep for `armeabi|gradle_build|use_gradle_build|target_sdk|
  16 KB|page size|zipalign|check_elf_alignment` finds only the preset, the
  validator, the CI export job and prose docs - no `zipalign` or
  `check_elf_alignment` invocation exists.

### 2. Requirement baseline (verified against the live sources on 2026-10-29)

- **AAB is mandatory for new apps.** Godot 4.6 Android export docs: "All new
  apps uploaded to Google Play after August 2021 must be an AAB (Android App
  Bundle) file. Uploading an AAB or APK to Google's Play Store requires you to
  sign using a non-debug keystore file."
  <https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_android.html>
  Engine coupling: Godot rejects AAB without Gradle - "Export AAB" is only
  valid when "Use Gradle Build" is enabled - `export_plugin.cpp:2036-2037`.
  So proposal (a) cannot be done without turning the Gradle build on.
- **Target SDK.** Google Play: "Starting August 31 2026: New apps and app
  updates must target Android 16 (API level 36) or higher to be submitted to
  Google Play" (Wear OS / Android Automotive excepted to API 35, Android TV /
  Android XR to API 34). "Existing apps must target Android 15 (API level 35)
  or higher to remain available to new users..." Extensions to
  November 1, 2026 are available.
  <https://developer.android.com/google/play/requirements/target-sdk>
- **16 KB page size.** Google Play compatibility requirement: "all apps
  targeting Android 15 (API level 35) and higher must support 16 KB memory page
  sizes on 64-bit devices on Google Play. Starting February 1, 2027, if your
  app updates don't support 16 KB memory page sizes, you won't be able to
  release these updates."
  <https://developer.android.com/guide/practices/page-sizes>
  The same page documents the two checks used below: `check_elf_alignment.sh
  APK_NAME.apk` (prints ALIGNED / UNALIGNED per arm64-v8a shared library) and
  `zipalign -v -c -P 16 4 APK_NAME.apk` ("Verification successful"), plus
  `readelf -l` LOAD-segment checks for `align 2**14`.
- **Godot's 16 KB status.** Godot merged "[Android] Add support for 16 KB page
  sizes, update to NDK r28b" (godotengine/godot#106358, merged 2025-05-15,
  milestone 4.5), which is why the maintained local toolchain pins NDK
  28.1.13356709 - `docs/ANDROID_PLAYTEST.md:18`. Godot 4.6 is therefore
  expected to ship 16 KB-aligned native libraries, but that is an upstream
  claim, not a fact about our artifact: it still has to be measured on the
  built AAB/APK (proposal (b)).

### 3. Contradictions and gaps found while grounding this plan

1. **Target SDK moved.** The issue's premise predates the current policy. The
   value verified today is **API 36** (Android 16) for new apps and app
   updates, not API 35. Godot 4.6's own default is still 35
   (`export_plugin.cpp:290`), so the current engine default does **not** satisfy
   the current Play policy. This must be resolved before submission.
2. **16 KB enforcement wording moved.** The page today states the hard
   enforcement date as **February 1, 2027** for app updates that do not support
   16 KB page sizes (the requirement itself still applies to every app
   targeting API 35+). If the issue quotes an earlier enforcement date, treat
   the live page as authoritative.
3. **Repo SDK versions disagree with each other.** CI installs
   `build-tools;34.0.0` / `platforms;android-34`
   (`.github/workflows/android-export.yml:62`) while the local toolchain
   documents Build-Tools 35.0.1 / Platform 35 (`docs/ANDROID_PLAYTEST.md:16`).
   The 16 KB verification command `zipalign -c -P 16` requires Build-Tools
   35.0.0 or newer, so the CI image must be bumped before that check can run
   there. This is a proposal only; no workflow was edited.
4. **AAB signing is not Godot's own signing.** For an AAB export Godot
   reports "AAB signing is not supported" (`export_plugin.cpp:3231`); the
   signature comes from the Gradle build. Godot passes the release keystore
   into Gradle as the properties `release_keystore_file`,
   `release_keystore_alias`, `release_keystore_password`
   (`platform/android/java/app/config.gradle:334-350`), sourced from the
   preset options `keystore/release`, `keystore/release_user`,
   `keystore/release_password` or their environment-variable equivalents
   `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`, `GODOT_ANDROID_KEYSTORE_RELEASE_USER`,
   `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD` (`export_plugin.cpp:2149-2151`,
   `:2783-2784`, and the environment-variable table in the Godot 4.6 export
   docs). This is what makes a CI-secret-driven release build possible at all.
5. **The debug preset contract is asserted in code.** The validator expects
   the exact current shape (`scripts/validate_android_export_preset.gd:30-45`),
   including `use_gradle_build=false`, `export_format=0` and
   `armeabi-v7a=true`. Any preset change for (a), (c) or (d) must update that
   contract in the same change, or CI breaks.

### 4. Proposal (a): release preset shape - DECISION FOR ALEX

Shape of the intended release preset (design only, not applied):

- A **separate** preset (for example `Android Release`) so the maintained
  debug playtest preset in `export_presets.cfg` keeps working for
  `docs/ANDROID_PLAYTEST.md` and for the CI export job.
- `gradle_build/use_gradle_build=true` (required for AAB -
  `export_plugin.cpp:2036-2037`).
- `gradle_build/export_format=1` (AAB - `export_plugin.cpp:2118`).
- `gradle_build/min_sdk` / `gradle_build/target_sdk` set explicitly, since
  these options only exist in Gradle mode (`export_plugin.cpp:2230`).
- A release `export_path` under `export/android/` ending in `.aab`.
- Release signing values supplied at build time, never committed: the three
  `keystore/release*` options stay empty in the tracked preset (the validator
  enforces this, `scripts/validate_android_export_preset.gd:46-47`) and are
  supplied through CI environment variables / a keystore file fetched from a
  secret store.

**DECISION FOR ALEX - release signing and the CI secret.** Options:

- **A1 - CI secret + keystore file (recommended).** Alex creates and owns the
  release keystore outside the repo and stores it in the CI secret store;
  CI writes it to a temporary path and exports the three
  `GODOT_ANDROID_KEYSTORE_RELEASE_*` variables at build time. Nothing about
  the keystore, its alias or its passwords is decided, requested or recorded
  by this repository.
- **A2 - Local release build, no CI signing.** Alex exports the release AAB on
  a machine Alex controls and uploads it manually. No signing secret ever
  exists in CI. Simplest, least automation.
- **A3 - Play App Signing with an upload key held only by Alex.** Alex
  generates an upload key, signs the bundle locally or in a private runner,
  and Play re-signs with the app signing key. This repo already records that
  new Play apps require "a release-signed AAB, Play App Signing and a
  configured Console app and testing track" - `docs/EXPORT_GUIDE.md:33-38`.

This change contains **no** credential value, **no** keystore creation step and
**no** CI secret configuration; all three remain Alex's to decide and perform.

### 5. Proposal (b): 16 KB alignment verification - CI step design

Design only. No workflow file was modified; this is the shape the step should
take when it is implemented.

- **Trigger.** A release-shaped build, not the nightly debug APK. The existing
  `export` job produces a debug APK with the non-Gradle preset
  (`.github/workflows/android-export.yml:83`), which does not exercise the
  Gradle/AAB path. A dedicated release-build job is the right home for this
  check.
- **Inputs.** The built `.aab` (and, for comparison, the debug `.apk`).
- **Steps.**
  1. `check_elf_alignment.sh <bundle>` - Google's script prints ALIGNED /
     UNALIGNED per arm64-v8a shared library. For an `.aab` the shared
     libraries are read out of the bundle first (`unzip` the `base/lib/` and
     per-ABI `lib/` entries into a temp directory) and each `libgodot_android.so`
     is checked individually.
  2. `readelf -l <lib>.so` and assert every LOAD segment shows `align 2**14`;
     a value of `2**13` or lower is a failure, per the Android page-size guide.
  3. `zipalign -v -c -P 16 4 <apk>` for the APK path, requiring
     "Verification successful". This needs Android Build-Tools 35.0.0 or newer
     (`docs/ANDROID_PLAYTEST.md:16`); the CI image currently installs
     `build-tools;34.0.0` (`.github/workflows/android-export.yml:62`), so the
     toolchain must be bumped as part of the implementation.
  4. Fail the job with an actionable message naming the offending library and
     its alignment, so a red build points at a specific `.so`.
- **Expected result on 4.6.** Godot's Android libraries are built with NDK
  r28b since 4.5 (godotengine/godot#106358), so the arm64-v8a library should
  already report ALIGNED. The check exists to prove that per artifact and to
  catch a future template or plugin regression, not because a failure is
  expected.
- **Failure handling.** Do not paper over an UNALIGNED library. If a library
  is unaligned, the fix is a new export template / NDK, not a wrapper flag.

### 6. Proposal (c): dropping armeabi-v7a - DECISION FOR ALEX

Current state: armeabi-v7a is still exported (`export_presets.cfg:23`), and
the CI emulator job is documented as relying on the arm-only APK
(`.github/workflows/android-export.yml:104-113`).

**DECISION FOR ALEX - keep or drop armeabi-v7a.** Options:

- **C1 - Keep both ABIs (status quo).** Zero risk to the debug playtest path
  and to the CI boot-smoke job. Costs extra build time and, for APK
  downloads, extra size; for AAB the size effect is largely handled by Play's
  per-device ABI splitting.
- **C2 - Drop armeabi-v7a, ship arm64-v8a only.** Halves the native library
  payload and removes an ABI that only old 32-bit devices need. Consequences
  to plan for: `export_presets.cfg:23` flips to `false`, the validator
  contract changes (`scripts/validate_android_export_preset.gd:35`), the CI
  boot-smoke comment and job assumptions change
  (`.github/workflows/android-export.yml:104-113`), and any real device
  coverage of 32-bit-only hardware is lost.
- **C3 - Drop armeabi-v7a only for the Play release preset**, keeping it in
  the debug playtest preset. Two presets, two ABI sets, more surface area to
  keep in sync.

The decision needs device data this repository does not have: the Play Console
device catalog / install analytics for `com.armoredarcher.game`, plus the
minimum Android version of the existing playtest fleet. That data is Alex's
to pull; this plan deliberately does not invent a percentage.

### 7. Proposal (d): target SDK per current Play policy

- Policy value verified on 2026-10-29: **Android 16 / API level 36** for new
  apps and app updates, from August 31 2026
  (<https://developer.android.com/google/play/requirements/target-sdk>).
- Engine value verified on 2026-10-29: Godot 4.6 defaults to **35**
  (`export_plugin.cpp:290`, `platform/android/java/app/config.gradle:9`).
- Therefore the Godot default does not meet the current Play policy, and the
  gap must be closed deliberately rather than by accident.
- **DECISION FOR ALEX - how to reach API 36.** Options:
  - **D1 - `gradle_build/target_sdk=36` in the release preset.** Smallest
    change. Godot will warn: "Target SDK 36 is higher than the default version
    35. This may work, but wasn't tested and may be unstable."
    (`export_plugin.cpp:3089-3098`), so the release build must be smoke-tested
    on a real device and in the emulator before upload.
  - **D2 - Ship 35 and use the Play extension.** The policy page states an
    extension to November 1, 2026 is available. This is a temporary
    reprieve, not a policy that matches a 2026-10 submission, and Play's
    deadline for API 36 still applies to new apps.
  - **D3 - Custom Android source-template build with `targetSdk 36`.** Most
    control, most work: it means building the export templates from source
    (NDK/CMake, `docs/ANDROID_PLAYTEST.md:18`) and owning that build. Out of
    scope for this issue unless D1 and D2 both fail.

### 8. Sequenced plan (design - do not execute as part of this issue)

1. Alex pulls the device analytics that decision (c) needs and answers (c).
2. Alex confirms the signing path (A1 / A2 / A3) and the target SDK path
   (D1 / D2 / D3). Nothing else can be finalised before these two answers.
3. Add the release preset (Gradle on, AAB format, explicit min/target SDK,
   arm64/armeabi per decision (c)), and update the validator contract
   `scripts/validate_android_export_preset.gd:30-45` in the same change.
4. Align the Android SDK versions in CI with the documented toolchain
   (Build-Tools 35.0.1, Platform 35, NDK 28.1.13356709) - needed by
   `zipalign -P 16` and by the Gradle build.
5. Implement the 16 KB alignment step of proposal (b) against the release
   bundle; wire it to fail the build on an UNALIGNED library.
6. Implement the CI signing path chosen in step 2, using only secret-store
   references and environment variables - no values in the repository, no
   keystore in the repository, no keystore in build logs.
7. Produce an internal-test AAB, verify it installs and boots on a real
   device (the emulator job at `.github/workflows/android-export.yml:116-143`
   covers the engine banner only), and confirm Play Console accepts the
   bundle (target SDK, 16 KB eligibility, signing).
8. Run the closed/internal test track, then promote to production.
9. Update `docs/APP_SUBMISSION_CHECKLIST.md`, `docs/EXPORT_GUIDE.md` and
   `docs/ANDROID_PLAYTEST.md` to point at the release preset so the debug and
   release paths stay distinguishable.

### 9. Commands to run when implementing (design only, not run here)

```bash
# 16 KB alignment of the built bundle (proposal (b))
unzip -o app-release.aab 'base/lib/*' 'lib/*' -d aab-libs
check_elf_alignment.sh app-release.aab      # ALIGNED / UNALIGNED per library
readelf -l aab-libs/lib/arm64-v8a/libgodot_android.so | grep LOAD
zipalign -v -c -P 16 4 app-release.apk      # needs Build-Tools >= 35.0.0
```

### 10. Sources

- Godot 4.6 Android export:
  <https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_android.html>
- Godot 4.6 `EditorExportPlatformAndroid` options:
  <https://docs.godotengine.org/en/4.6/classes/class_editorexportplatformandroid.html>
- Godot 4.6-stable source (`platform/android/export/export_plugin.cpp`,
  `platform/android/java/app/config.gradle`):
  <https://github.com/godotengine/godot/tree/4.6-stable/platform/android>
- Godot 16 KB page size support (godotengine/godot#106358, merged 2025-05-15,
  milestone 4.5):
  <https://github.com/godotengine/godot/pull/106358>
- Google Play target API level requirement:
  <https://developer.android.com/google/play/requirements/target-sdk>
- Android 16 KB page sizes (compatibility requirement, `zipalign`,
  `check_elf_alignment.sh`):
  <https://developer.android.com/guide/practices/page-sizes>
