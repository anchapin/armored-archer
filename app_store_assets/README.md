# App Store Assets

This directory contains all assets required for iOS App Store and Google Play Store submission.

## Directory Structure

```
app_store_assets/
├── ASSETS_REQUIREMENTS.md      # Detailed requirements for all assets
├── ICON_SPECIFICATION.md       # Complete icon size specifications
├── icon_config.json            # Machine-readable icon configuration
├── generate_icons.sh           # Icon generation script
├── localized_descriptions.md   # App store descriptions in multiple languages
├── ios/
│   ├── screenshots/
│   │   ├── iphone_6_7/        # 1290x2796 pixels (6.7" displays)
│   │   ├── iphone_5_5/        # 1242x2688 pixels (5.5" displays)
│   │   └── ipad/              # 2048x2732 pixels (iPad)
│   └── preview_video.mov     # Optional 15-30 second video
└── android/
    └── screenshots/
```

## Required Assets

### iOS App Store
- **App Icon**: 1024x1024 PNG (use `assets/icons/icon_ios_1024.svg`)
- **Screenshots**: 6-10 screenshots in various sizes
- **Feature Graphic**: 1200x600 PNG (optional, for desktop featuring)

### Google Play Store
- **App Icon**: 512x512 and 1024x1024 PNG
- **Feature Graphic**: 1024x500 PNG
- **Screenshots**: 2-8 screenshots

## Creating Screenshots

To capture screenshots for the app store:

1. **iOS**: Run the game on a simulator or device, use Cmd+S to capture
2. **Android**: Use Android Studio's screenshot tool or device buttons

### Recommended Screenshot Content
1. Main Menu/UI
2. Character Selection
3. Combat Gameplay
4. Gear Inventory
5. Shop Interface
6. PvP Leaderboard
7. Stage Selection
8. Character Customization
9. Tutorial/Onboarding

## Exporting Icons

The iOS icon template is available at `assets/icons/icon_ios_1024.svg`. Export to required sizes using:

```bash
# Using Inkscape (command line)
inkscape --export-width=1024 --export-height=1024 assets/icons/icon_ios_1024.svg --export-png=app_store_assets/ios/icon_1024x1024.png
```

## Notes

- All text in screenshots must be readable at thumbnail size
- Do not include device frames in screenshots
- Provide localized screenshots for each target market when possible
