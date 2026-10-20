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

## Release preset and 16 KB check (issue #1725)

`export_presets.cfg` has two Android presets:

- `Android` (preset.0): debug APK, arm64 + armeabi-v7a. Used for playtests and the nightly boot smoke.
- `Android Release` (preset.1): Gradle build, AAB, arm64-v8a only, `target_sdk` 36. Release signing values stay empty in the file; Godot reads `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`, `GODOT_ANDROID_KEYSTORE_RELEASE_USER` and `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD` from the environment. Never commit a keystore or password.

Facts to keep in mind:

- Play requires new apps and updates to target Android 16 (API 36) from Aug 31 2026. Godot 4.6's Gradle template defaults to `compileSdk`/`targetSdk` 35, so a release build must raise `compileSdk` (and build tools) to 36 in `android/build/config.gradle` after the template is installed. The release workflow (not yet written) will patch this at build time instead of committing the template.
- Play requires 16 KB page-size support for native code. `python3 scripts/ci/check_elf_alignment.py <file.apk|file.aab>` checks every 64-bit `.so` for LOAD alignment >= 16384. The stock Godot 4.6 `android_release.apk` template passes (arm64-v8a and x86_64 `libgodot_android.so`, `libc++_shared.so`).
- New personal Play developer accounts must run a closed test with 12+ testers for 14 continuous days before production access.
- Preset check: `godot4 --headless --editor --script scripts/validate_android_export_preset.gd`.
