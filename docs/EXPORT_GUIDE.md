# Armored Archer - Export Guide

This guide explains how to export Armored Archer for iOS and Android platforms.

## Prerequisites

### For iOS Export
- **macOS** (required for iOS development)
- **Xcode** 14.0 or later
- **iOS SDK** 14.0 or later
- **Apple Developer Account** ($99/year)
- **Active internet connection** for signing

### For Android Export
- **Windows**, **macOS**, or **Linux**
- **Android Studio** (recommended)
- **Java Development Kit (JDK)** 11 or later
- **Android SDK** with API level 26 or higher
- **Google Play Console account** ($25 one-time fee)

---

## iOS Export Process

### Step 1: Configure Export Preset

1. Open `export_presets.cfg` in a text editor
2. Verify iOS preset configuration:
   ```ini
   [presets.0]
   name="iOS"
   platform="iOS"
   export_path="export/ios/armored-archer.ipa"
   
   [presets.0.options]
   application/bundle_identifier="com.armoredarcher.game"
   application/short_version="1.0.0"
   application/version="1.0.0"
   application/copyright="Copyright © 2025"
   application/export_method="release"
   application/distribution_type="app-store"
   ```

3. Update values as needed:
   - Bundle identifier (must match your Apple Developer account)
   - Version numbers
   - Copyright year
   - Export method (release for App Store, development for testing)

### Step 2: Build in Godot

1. Open the project in Godot 4.x
2. Go to **Project → Export**
3. Select **iOS** preset
4. Configure **Application → Options**:
   - Bundle Identifier: `com.armoredarcher.game`
   - Display Name: `Armored Archer`
   - Short Version: `1.0.0`
   - Version: `1`
5. Click **Export** button
6. Choose export location: `export/ios/armored-archer.ipa`

### Step 3: Open in Xcode (for Development)

1. Navigate to the export folder: `export/ios/`
2. Open the `.xcodeproj` file in Xcode
3. Connect iOS device (iPhone/iPad)
4. Select your device in Xcode
5. Click **Run** button to build and install

### Step 4: Create Archive (for App Store)

1. Open the project in Xcode
2. Select **Generic iOS Device** as target
3. Go to **Product → Archive**
4. Wait for archive to complete
5. In Organizer window, select the archive
6. Click **Distribute App**
7. Choose **App Store Connect**
8. Follow the prompts to upload to App Store Connect
9. Wait for build processing in App Store Connect

### Step 5: Troubleshooting Common Issues

**Issue: Build fails with signing errors**
- Solution: Ensure you have a valid Apple Developer account
- Solution: Check that bundle identifier is correct
- Solution: Verify signing certificates in Xcode

**Issue: App crashes on launch**
- Solution: Test with export method set to "development" first
- Solution: Check Xcode console for error messages
- Solution: Ensure all required assets are included

**Issue: Export size is too large**
- Solution: Use project.godot compression settings
- Solution: Reduce texture quality or use compression
- Solution: Remove unused assets

---

## Android Export Process

### Step 1: Configure Export Preset

1. Open `export_presets.cfg` in a text editor
2. Verify Android preset configuration:
   ```ini
   [presets.1]
   name="Android"
   platform="Android"
   export_path="export/android/armored-archer.apk"
   
   [presets.1.options]
   application/package/unique_name="com.armoredarcher.game"
   application/package/category="Game"
   ```

3. Update values as needed:
   - Package name (must be unique on Play Store)
   - Version numbers

### Step 2: Create Keystore (for Release Build)

You only need to do this once for your app.

1. Open a terminal/command prompt
2. Run the following command:
   ```bash
   keytool -genkey -v -keystore armored-archer-release.keystore \
     -alias armored-archer -keyalg RSA -keysize 2048 -validity 10000
   ```
3. Enter keystore password (remember this!)
4. Answer the questions about your identity
5. **Important**: Store the `.keystore` file and password securely!

### Step 3: Build in Godot (Debug)

1. Open the project in Godot 4.x
2. Go to **Project → Export**
3. Select **Android** preset
4. Configure **Application → Options**:
   - Package Name: `com.armoredarcher.game`
   - Version: `1`
   - Version Code: `1`
5. Click **Export** button
6. Choose export location: `export/android/armored-archer.apk`

### Step 4: Install and Test

1. Enable USB debugging on your Android device
2. Connect device to computer via USB
3. Install the APK:
   ```bash
   adb install export/android/armored-archer.apk
   ```
4. Launch the app on your device
5. Test all features

### Step 5: Build with Keystore (Release)

For release builds, you must sign with your keystore.

**Option A: Sign APK directly**
```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore armored-archer-release.keystore \
  export/android/armored-archer.apk \
  armored-archer
```

**Option B: Use Android App Bundle (Recommended)**
1. Build AAB instead of APK in Godot
2. Sign with jarsigner or apksigner
3. Upload AAB to Google Play Console

### Step 6: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Release Management → App releases**
4. Create a new release or edit existing track
5. Upload the signed APK or AAB
6. Add release notes
7. Review and submit

### Step 7: Troubleshooting Common Issues

**Issue: Installation fails with "Parse Error"**
- Solution: Verify APK was built correctly
- Solution: Check Android SDK version compatibility
- Solution: Ensure minimum Android version is set correctly

**Issue: App crashes on certain devices**
- Solution: Test on multiple Android versions
- Solution: Check for device-specific issues in logs
- Solution: Use adb logcat to view crash logs

**Issue: Google Play Console rejects build**
- Solution: Verify package name is unique
- Solution: Check all metadata is complete
- Solution: Ensure target SDK level is sufficient

---

## Export Best Practices

### Version Management

- Always increment version numbers for each release
- Use semantic versioning: `MAJOR.MINOR.PATCH`
  - MAJOR: Major changes, breaking changes
  - MINOR: New features, backward compatible
  - PATCH: Bug fixes, small changes
- Update version code for Android (must be higher than previous)

### Testing Before Release

1. **Test on multiple devices**:
   - Various screen sizes and resolutions
   - Different Android/iOS versions
   - Different performance tiers

2. **Test key features**:
   - Login and account creation
   - Combat mechanics
   - PvP battles
   - Purchases (IAP)
   - Settings and options

3. **Test edge cases**:
   - Poor network conditions
   - Low battery mode
   - Background mode
   - Screen rotation

### Asset Optimization

- **Textures**: Use compression (WebP, ETC2, ASTC)
- **Audio**: Use compressed formats (Ogg, MP3)
- **Models**: Optimize polygon count
- **Animations**: Use compression where possible

### Size Optimization

- Use project.godot export filters
- Enable texture compression
- Remove unused assets
- Use export_presets.cfg to exclude test files

---

## Export Preset Configuration Reference

### iOS Options

```ini
application/name="Armored Archer"
application/bundle_identifier="com.armoredarcher.game"
application/short_version="1.0.0"
application/version="1.0.0"
application/copyright="Copyright © 2025"
application/category="Games"
application/compatible_minimum="iOS 14.0"
application/export_method="release"
application/distribution_type="app-store"
```

### Android Options

```ini
application/name="Armored Archer"
application/package/unique_name="com.armoredarcher.game"
application/package/category="Game"
application/compatible_min="Android 8.0"
application/icon="res://assets/icons/icon_android.png"
```

---

## Common Export Errors and Solutions

### Error: "Cannot open export template"
**Solution**: Download the export templates in Godot:
1. Open Godot Editor
2. Go to Editor → Manage Export Templates
3. Download templates for your Godot version

### Error: "Build failed: code signing required"
**Solution** (iOS):
- Install Xcode
- Open in Xcode and sign there
- Or configure signing in export_presets.cfg

### Error: "APK not installed"
**Solution** (Android):
- Enable "Unknown Sources" on device
- Or sign the APK properly
- Check Android version compatibility

### Error: "Out of memory during export"
**Solution**:
- Close other applications
- Increase system memory
- Export in smaller chunks (use export filters)

---

## Advanced Topics

### Custom Export Scripts

You can automate exports using Godot's export API:

```gdscript
# Example: Export script
func export_project(platform: String) -> bool:
    var export_presets = get_export_presets()
    var preset = null
    
    for p in export_presets:
        if p.get_name() == platform:
            preset = p
            break
    
    if not preset:
        return false
    
    export_project(preset)
    return true
```

### CI/CD Integration

Set up automated builds using GitHub Actions or similar:

```yaml
# Example: GitHub Actions
- name: Build Android
  run: |
    godot --headless --export "Android" build/armored-archer.apk

- name: Upload build
  uses: actions/upload-artifact@v2
  with:
    name: android-build
    path: build/armored-archer.apk
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Godot Documentation](https://docs.godotengine.org)
2. Search [Godot Issues](https://github.com/godotengine/godot/issues)
3. Ask for help in [Godot Discord](https://discord.gg/godotengine)
4. Contact our support team: [Add support email]

---

## Quick Reference

### iOS Commands
```bash
# Build for device
godot --export "iOS" export/ios/armored-archer.ipa

# Open in Xcode
open export/ios/armored-archer.xcodeproj

# Install on device
ios-deploy --bundle export/ios/armored-archer.ipa
```

### Android Commands
```bash
# Build APK
godot --export "Android" export/android/armored-archer.apk

# Install on device
adb install export/android/armored-archer.apk

# View logs
adb logcat
```

---

**Happy exporting! 🚀**
