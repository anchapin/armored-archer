# App Icons Specification

This document provides a comprehensive specification for all app icons required for iOS App Store and Google Play Store submission.

## Overview

This specification covers all required icon sizes for both iOS and Android platforms, with references to existing assets and guidelines for creating/procuring the necessary icons.

---

## iOS App Icons

### Required Sizes

| Size (px) | Scale | Usage | Source File |
|-----------|-------|-------|-------------|
| 1024 | 1x | App Store (App Store Connect) - **Required** | `assets/icons/icon_ios_1024.png` |
| 180 | @3x | iPhone App Icon | Generated from 1024 |
| 120 | @2x | iPhone App Icon | Generated from 1024 |
| 167 | @2x | iPad Pro App Icon (6th gen) | Generated from 1024 |
| 152 | @2x | iPad App Icon | Generated from 1024 |
| 76 | @1x | iPad App Icon | Generated from 1024 |
| 80 | @2x | Spotlight Search | Generated from 1024 |
| 58 | @2x | Settings | Generated from 1024 |
| 40 | @1x | Spotlight Search | Generated from 1024 |
| 29 | @1x | Settings | Generated from 1024 |

### iOS Icon Generation

iOS 11+ automatically generates all required sizes from a single 1024x1024 master icon. Apple recommends providing only the 1024x1024 icon in App Store Connect.

**Current Status:**
- ✅ 1024x1024 master icon: `assets/icons/icon_ios_1024.svg`
- ✅ Exported PNG: `assets/icons/icon_ios_1024.png`

---

## Android App Icons

### Required Sizes

| Size (px) | Density | Usage | Source File |
|-----------|---------|-------|-------------|
| 512 | - | Google Play Store - **Required** | `assets/icons/icon_android_512.png` |
| 1024 | - | Play Store high-res listing | `assets/icons/icon_android_1024.png` |
| 192 | xxxhdpi | Adaptive Icon foreground | Generated from 1024 |
| 144 | xxxhdpi | Legacy icon | Generated from 1024 |
| 96 | xxhdpi | Legacy icon | Generated from 1024 |
| 72 | xhdpi | Legacy icon | Generated from 1024 |
| 48 | mdpi | Legacy icon | Generated from 1024 |

### Android Adaptive Icons

Android 8.0+ (API 26+) uses adaptive icons consisting of:
- **Foreground**: 432x432 pixels (108x108 in a 108dp container)
- **Background**: Solid color or 432x432 pixels
- **Mask**: System-defined (typically circular or squircles)

**Current Status:**
- ✅ 512x512 icon: `assets/icons/icon_android_512.png`
- ✅ 1024x1024 icon: `assets/icons/icon_android_1024.png`

---

## App Store Assets

### iOS App Store

| Asset | Size | Path |
|-------|------|------|
| App Icon | 1024x1024 | `app_store_assets/ios/icon_1024x1024.png` |
| Feature Graphic | 1200x600 | `app_store_assets/ios/feature_graphic_1200x600.png` |

### Google Play Store

| Asset | Size | Path |
|-------|------|------|
| App Icon | 512x512 | `app_store_assets/android/icon_512x512.png` |
| App Icon | 1024x1024 | `app_store_assets/android/icon_1024x1024.png` |
| Feature Graphic | 1024x500 | `app_store_assets/android/feature_graphic_1024x500.png` |

---

## Icon Design Guidelines

### iOS Requirements
- Follow [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- No rounded corners (iOS applies masks automatically)
- No transparency (icons must be opaque)
- Maintain clear imagery even at small sizes

### Android Requirements
- Follow [Material Design Icon Guidelines](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- Use adaptive icons for Android 8.0+
- Provide foreground and background layers for adaptive icons
- Ensure icons work with Android's mask system

---

## Icon Assets Reference

### Source Files

```
assets/icons/
├── icon.svg                    # Master SVG icon (128x128)
├── icon_ios_1024.svg          # iOS master icon source
├── icon_ios_1024.png          # iOS master icon (1024x1024)
├── icon_ios_512.png           # iOS icon (512x512)
├── icon_ios_256.png           # iOS icon (256x256)
├── icon_ios_128.png           # iOS icon (128x128)
├── icon_android_512.png       # Android icon (512x512)
├── icon_android_1024.png      # Android icon (1024x1024)
└── icon_android.png           # Android legacy icon
```

### App Store Export Paths

```
app_store_assets/
├── ios/
│   └── icon_1024x1024.png     # Required for App Store Connect
└── android/
    ├── icon_512x512.png       # Required for Play Store
    └── icon_1024x1024.png     # Required for Play Store listing
```

---

## Generation Commands

### Using ImageMagick (if installed)

```bash
# iOS icon generation from master
convert assets/icons/icon_ios_1024.png -resize 180x180 assets/icons/icon_ios_180.png
convert assets/icons/icon_ios_1024.png -resize 120x120 assets/icons/icon_ios_120.png
convert assets/icons/icon_ios_1024.png -resize 167x167 assets/icons/icon_ios_167.png

# Android icon generation from master
convert assets/icons/icon_android_1024.png -resize 192x192 assets/icons/icon_android_192.png
convert assets/icons/icon_android_1024.png -resize 144x144 assets/icons/icon_android_144.png
convert assets/icons/icon_android_1024.png -resize 96x96 assets/icons/icon_android_96.png
convert assets/icons/icon_android_1024.png -resize 72x72 assets/icons/icon_android_72.png
convert assets/icons/icon_android_1024.png -resize 48x48 assets/icons/icon_android_48.png
```

### Using Godot Export

The project includes export presets in `export_presets.cfg` that can generate icons for both platforms.

---

## Checklist

### Before App Store Submission

- [ ] Replace placeholder icons with final artwork
- [ ] Verify iOS 1024x1024 icon meets Apple's guidelines
- [ ] Verify Android icons meet Play Store requirements
- [ ] Test icons on actual devices
- [ ] Ensure icons are not overly detailed at small sizes
- [ ] Verify adaptive icon works on Android 8.0+ devices
- [ ] Check for any transparency issues in PNG exports

---

## Notes

1. Current icons in `assets/icons/` are placeholder/generic icons
2. The 1024x1024 SVG in `assets/icons/icon_ios_1024.svg` can be used as a source for generating all sizes
3. For professional results, consider using icon generation tools or hiring a designer
4. Apple App Store Connect can generate device-specific icons from a 1024x1024 master
5. Android adaptive icons require a foreground/background split for best results
