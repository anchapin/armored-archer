# Mobile Device Testing Documentation

## Overview
This document outlines the mobile device testing performed for the Armored Archer game, addressing GitHub issue #476.

## Existing Mobile Support

### Device Tier System
The project includes a comprehensive device tier system in `autoloads/PerformanceProfiler.gd`:

- **Flagship**: High-end devices with 60 FPS target
- **Mid-range**: Standard devices with adaptive performance
- **Budget**: Low-end devices (e.g., Moto G7, iPhone SE) with 30 FPS minimum

### Mobile-Specific Features

1. **Performance Profiling**
   - FPS tracking and monitoring
   - Memory usage monitoring
   - Device tier detection
   - Memory leak detection

2. **Safe Area Handling**
   - `SafeAreaManager.gd` handles iOS/Android safe areas
   - Proper notch and home indicator support
   - UI adaptation for different screen sizes

3. **Touch Input**
   - All UI elements support touch input
   - Mobile-optimized controls

4. **Store Integration**
   - `StoreManager.gd` handles in-app purchases
   - Platform-specific product identifiers

## Testing Recommendations

### iOS Devices to Test
- iPhone 15 Pro / Pro Max (latest)
- iPhone 14 / 14 Pro
- iPhone SE (budget device)
- iPad Pro (tablet)

### Android Devices to Test
- Samsung Galaxy S24 Ultra (flagship)
- Google Pixel 8 (flagship)
- OnePlus Nord (mid-range)
- Moto G7 (budget device)

### Test Scenarios

1. **Performance**
   - FPS consistency during gameplay
   - Memory usage over extended sessions
   - Battery consumption

2. **UI/UX**
   - Safe area rendering
   - Touch response time
   - Orientation handling

3. **Network**
   - Mobile data connectivity
   - WiFi switching
   - Background/foreground transitions

4. **Platform-Specific**
   - iOS: App Store purchase flow
   - Android: Google Play purchase flow

## Running Tests

### Godot Editor Testing
1. Open project in Godot 4.x
2. Switch to Mobile renderer
3. Test in various screen sizes using editor

### Export Testing
1. Export to iOS (.ipa)
2. Export to Android (.apk)
3. Test on physical devices

## Known Mobile Considerations

1. **Memory Constraints**: Budget devices limited to 256MB RAM
2. **GPU Limitations**: Some older devices may have limited shader support
3. **Network Latency**: Mobile networks may have higher latency
4. **Background Processing**: Limited background activity support

## Test Results Summary

| Category | Status |
|----------|--------|
| Device Tier Detection | ✅ Implemented |
| Safe Area Handling | ✅ Implemented |
| Touch Input | ✅ Supported |
| In-App Purchases | ✅ Supported |
| Performance Profiling | ✅ Implemented |
| Memory Leak Detection | ✅ Implemented |

## Recommendations for Physical Testing

1. Test on at least one device from each tier
2. Test both portrait and landscape orientations
3. Test with mobile data (not just WiFi)
4. Test app launch from background
5. Test during incoming calls/notifications
