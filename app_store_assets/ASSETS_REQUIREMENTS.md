# App Store Assets Required

This document lists all required assets for iOS App Store and Google Play Store submission.

## iOS App Store Assets

### App Icon
- **Required Size**: 1024x1024 pixels
- **Format**: PNG or JPEG
- **Location**: `assets/icons/icon_ios_1024.png`
- **Notes**: Must be high-resolution, will be used for all sizes

### Screenshots Requirements
- **Quantity Required**: 6-10 screenshots
- **Aspect Ratio**: 16:9 or 6:5 (can mix)
- **Format**: PNG or JPEG
- **Device Sizes**:
  - 6.7-inch Display (iPhone 14 Pro Max, etc.): 1290x2796 pixels
  - 6.5-inch Display (iPhone 11 Pro Max, etc.): 1242x2688 pixels
  - 5.5-inch Display (iPhone 8 Plus, etc.): 1242x2208 pixels
  - iPad Pro 12.9-inch (6th gen): 2048x2732 pixels
  - iPad Pro 12.9-inch (2nd gen): 2048x2732 pixels

### Required Screenshots (Recommended)
1. **Main Menu/UI** - Show the main game screen
2. **Character Selection** - Character/hero selection screen
3. **Combat Gameplay** - Action combat in progress
4. **Gear Inventory** - Equipment/inventory screen
5. **Shop Interface** - Store/purchase screen
6. **PvP Leaderboard** - Rankings and multiplayer
7. **Stage Selection** - Level/world selection
8. **Character Customization** - Transmog/customization options
9. **Tutorial/Onboarding** - First-time user experience
10. **Special Events** - Seasonal content (if applicable)

### Feature Graphic (Promotional)
- **Size**: 1200x600 pixels (for desktop featuring)
- **Format**: PNG or JPEG

### App Preview Video (Optional but Recommended)
- **Duration**: 15-30 seconds
- **Format**: H.264 codec, .mov or .mp4
- **Aspect Ratio**: 16:9 or 4:3
- **Content**: Gameplay footage, no text overlays

---

## Google Play Store Assets

### App Icon
- **Required Size**: 512x512 pixels (high-res)
- **Additional**: 1024x1024 (for Play Store listing)
- **Format**: PNG (32-bit recommended)
- **Shape**: Can be square or adaptive (will be masked on devices)

### Feature Graphic
- **Required Size**: 1024x500 pixels
- **Format**: PNG or JPEG
- **Usage**: Shown on Play Store listing page

### Screenshots Requirements
- **Quantity Required**: 2-8 screenshots
- **Format**: 24-bit PNG or JPEG
- **Minimum Size**: 320 pixels (shortest side)
- **Maximum Size**: 3840 pixels (longest side)
- **Aspect Ratio**: 2:1 recommended

### Required Screenshots (Recommended)
1. Phone screenshot - Main gameplay
2. Phone screenshot - Different feature
3. Tablet screenshot (optional)
4. Tablet screenshot (optional)

### Store Listing Graphics
- **TV Banner**: 1920x1080 pixels (optional)
- **Daydream VR**: 1800x1200 pixels (optional)

---

## Asset Checklist

### Create Before Submission

- [ ] iOS App Icon (1024x1024)
- [ ] iOS Screenshots (6-10, multiple device sizes)
- [ ] Android App Icon (512x512 and 1024x1024)
- [ ] Android Screenshots (2-8)
- [ ] Android Feature Graphic (1024x500)
- [ ] iOS Feature Graphic (1200x600)
- [ ] App Preview Video (optional)

### Export Paths

Store final assets in:
```
app_store_assets/
├── ios/
│   ├── icon_1024x1024.png
│   ├── screenshots/
│   │   ├── iphone_6_7/
│   │   ├── iphone_5_5/
│   │   └── ipad/
│   └── preview_video.mov
├── android/
│   ├── icon_512x512.png
│   ├── icon_1024x1024.png
│   ├── feature_graphic_1024x500.png
│   └── screenshots/
└── metadata/
    └── (localization files)
```

---

## Notes

1. **Test on Device**: Always view screenshots on actual devices before submission
2. **Text Size**: Ensure all text is readable at thumbnail size
3. **Orientation**: Provide screenshots in both portrait and landscape if your app supports both
4. **Localize**: Create localized screenshots for each target market
5. **No Device Frames**: Don't include device frames unless specifically required
6. **Screenshot Guidelines**: Review Apple's App Store Screenshot Guidelines and Google Play Screenshot Guidelines before creating assets

---

## Quick Generation Commands

If you have source images, you can use ImageMagick or similar tools:

```bash
# Resize icon for iOS
convert icon.png -resize 1024x1024 assets/icons/icon_ios_1024.png

# Resize icon for Android
convert icon.png -resize 512x512 assets/icons/icon_android_512.png

# Create feature graphic
convert screenshot.png -resize 1024x500 assets/feature_graphic.png
```
