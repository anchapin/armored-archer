# Firebase Crashlytics & Analytics Setup Guide

This guide explains how to integrate Firebase Crashlytics and Analytics into the Armored Archer project for mobile platforms (iOS and Android).

## Overview

The Firebase integration provides:
- **Crashlytics**: Automatic crash reporting and crash analytics
- **Analytics**: Custom event tracking for gameplay metrics
- **User Properties**: Track user segments and cohorts

## Prerequisites

- Godot 4.6 or later
- Firebase account (free at https://console.firebase.google.com/)
- Android Studio (for Android builds)
- Xcode (for iOS builds)
- Google account for Firebase

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "Armored Archer")
4. Accept Firebase terms and conditions
5. Enable Google Analytics for this project (recommended)
6. Click "Create project"

## Step 2: Add Android App

1. In Firebase Console, click the Android icon
2. Enter your package name: `com.yourcompany.armoredarcher`
3. (Optional) Enter app nickname: "Armored Archer Android"
4. Register the app
5. Download `google-services.json`
6. Move `google-services.json` to: `res://firebase_config/google-services.json`
7. Replace the placeholder file with your downloaded config

## Step 3: Add iOS App

1. In Firebase Console, click the iOS icon
2. Enter your bundle ID: `com.yourcompany.ArmoredArcher`
3. (Optional) Enter app nickname: "Armored Archer iOS"
4. Register the app
5. Download `GoogleService-Info.plist`
6. Move `GoogleService-Info.plist` to: `res://firebase_config/GoogleService-Info.plist`
7. Replace the placeholder file with your downloaded config

## Step 4: Configure Android Build

### Update Android Manifest

1. Export your project to Android using Godot
2. Open the exported project in Android Studio
3. Add Google Services plugin to your `build.gradle` files

**Project-level `build.gradle`:**
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.1'
        classpath 'com.google.firebase:firebase-crashlytics-gradle:2.9.9'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

**App-level `build.gradle`:**
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'
    id 'com.google.firebase.crashlytics'
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-crashlytics'
}
```

### Add Permissions to AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Step 5: Configure iOS Build

### Install Firebase SDK via CocoaPods

1. Export your project to iOS using Godot
2. Open the exported project in Xcode
3. Navigate to project directory in Terminal
4. Create or edit `Podfile`:

```ruby
platform :ios, '12.0'

target 'ArmoredArcher' do
  use_frameworks!
  pod 'Firebase/Analytics'
  pod 'Firebase/Crashlytics'
end
```

5. Run: `pod install`
6. Open `ArmoredArcher.xcworkspace` (not .xcodeproj)

### Add GoogleService-Info.plist

1. Drag `GoogleService-Info.plist` into Xcode project
2. Ensure it's added to all targets
3. Verify it's in "Build Phases" → "Copy Bundle Resources"

### Update AppDelegate.swift

```swift
import UIKit
import Firebase

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        return true
    }
}
```

## Step 6: Using AnalyticsManager

The `AnalyticsManager` singleton provides convenient methods for tracking events:

### Basic Setup

```gdscript
# Initialize user ID when player logs in
AnalyticsManager.set_user_id("player_12345")

# Set user properties
AnalyticsManager.set_user_property("player_level", "10")
AnalyticsManager.set_user_property("premium_user", "true")
```

### Track Stage Completion

```gdscript
# When a player completes a stage
AnalyticsManager.log_stage_completed(
    "stage_1_1",           # stage_id
    "Forest Path",         # stage_name
    45.5,                  # time_taken_seconds
    3,                     # stars_earned
    "normal"               # difficulty
)
```

### Track PvP Matches

```gdscript
# When PvP match starts
AnalyticsManager.log_pvp_match_started(
    "match_abc123",
    "opponent_67890",
    SeasonManager.current_season_id
)

# When PvP match completes
AnalyticsManager.log_pvp_match_completed(
    "match_abc123",
    "win",                 # result: "win", "loss", "draw"
    "opponent_67890",
    SeasonManager.current_season_id,
    120.0,                # match_duration_seconds
    1500,                 # score
    800                   # opponent_score
)
```

### Track Purchases

```gdscript
# Track IAP purchases
AnalyticsManager.log_purchase(
    "gem_pack_100",
    "100 Gems",
    "currency",
    499,                   # $4.99
    "USD"
)

# Track gem purchases specifically
AnalyticsManager.log_gem_purchased(
    100,                   # gems_amount
    499,                   # $4.99
    "USD",
    "iap"
)

# Track cosmetic purchases
AnalyticsManager.log_cosmetic_purchased(
    "skin_001",
    "Dragon Archer",
    "skin",
    "legendary",
    999,                   # $9.99
    "USD"
)
```

### Track Gear Drops

```gdscript
# When player obtains gear
AnalyticsManager.log_gear_obtained(
    "weapon_001",
    "Fire Bow",
    "weapon",
    "epic",
    "stage_drop"           # source: "stage_drop", "pvp_reward", "purchase", etc.
)
```

### Custom Events

```gdscript
# Log any custom event
AnalyticsManager.log_custom_event("tutorial_completed", {
    "tutorial_id": "basics_001",
    "time_spent": 300.0
})
```

### Error Reporting

```gdscript
# Record custom errors that don't crash the app
AnalyticsManager.record_custom_error("Network timeout during match", get_stack())
```

### Crashlytics Control

```gdscript
# Enable/disable crashlytics (e.g., for privacy)
AnalyticsManager.set_crashlytics_collection_enabled(true)
AnalyticsManager.set_crashlytics_collection_enabled(false)
```

## Step 7: Test Crashlytics

To verify Crashlytics is working:

### Force a Test Crash

```gdscript
# Call this to trigger a test crash
AnalyticsManager.test_crash()
```

### Verify Crash in Firebase Console

1. Build and run the app on a physical device or emulator
2. Trigger the test crash
3. Close and reopen the app (crashes are sent on next launch)
4. Go to Firebase Console → Crashlytics
5. You should see the test crash within a few minutes

## Step 8: View Analytics

### Access Analytics Dashboard

1. Go to Firebase Console
2. Select your project
3. Click "Analytics" in the left sidebar
4. View events, user properties, and funnels

### Key Events to Track

The following events are automatically tracked by AnalyticsManager:

- `stage_completed` - When a player finishes a stage
- `stage_failed` - When a player fails a stage
- `pvp_match_started` - When a PvP match begins
- `pvp_match_completed` - When a PvP match ends
- `purchase` - General purchase event
- `gem_purchased` - Gem purchase specifically
- `cosmetic_purchased` - Cosmetic item purchase
- `gear_obtained` - When gear is obtained

#### Revenue & Monetization Events

- `revenue_tracked` - When revenue is recorded from a purchase
- `arpu_calculated` - ARPU calculation event
- `conversion_tracked` - Conversion tracking event
- `ltv_updated` - Lifetime value update
- `store_visit` - When player opens the store
- `offer_viewed` - When player views a special offer
- `offer_accepted` - When player accepts an offer
- `subscription_started` - When subscription begins
- `subscription_renewed` - When subscription renews
- `subscription_cancelled` - When subscription is cancelled

#### Crashlytics Events

- `crash_recorded` - When a crash is recorded
- `error_recorded` - When an error is recorded

## Step 9: Export Configuration

### Android Export Settings

In Godot's Export dialog:

1. Options → Android
2. Package Name: `com.yourcompany.armoredarcher`
3. Ensure `google-services.json` is in the export resources

### iOS Export Settings

In Godot's Export dialog:

1. Options → iOS
2. Bundle Identifier: `com.yourcompany.ArmoredArcher`
3. Ensure `GoogleService-Info.plist` is in the export resources

## Troubleshooting

### Analytics Not Working

- Verify Firebase config files are in correct location
- Check that internet permission is granted in AndroidManifest
- Ensure Firebase project ID matches in config files
- Test on physical device (emulator may have issues)

### Crashes Not Reported

- Crashlytics requires app restart after crash to send data
- Check that app has internet connection when restarting
- Verify Crashlytics dependencies are correctly installed
- Check Firebase Console for configuration errors

### Build Errors (Android)

- Ensure Gradle plugin versions are compatible
- Check that Google Services plugin is applied
- Verify `google-services.json` is in app module directory

### Build Errors (iOS)

- Make sure to use `.xcworkspace` not `.xcodeproj`
- Run `pod install` after any changes
- Verify `GoogleService-Info.plist` is in bundle resources
- Check that deployment target is at least iOS 12.0

## Best Practices

1. **Privacy**: Always get user consent before enabling analytics
2. **Testing**: Test on physical devices, not just emulators
3. **Event Names**: Use consistent, lowercase event names
4. **Parameters**: Include relevant context in event parameters
5. **User Properties**: Set user properties for segmentation
6. **Error Reporting**: Log meaningful errors for debugging

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Crashlytics Guide](https://firebase.google.com/docs/crashlytics)
- [Analytics Guide](https://firebase.google.com/docs/analytics)
- [Godot Firebase Plugin](https://github.com/GodotNuts/GodotFirebase)

## Notes

- Analytics only works on Android and iOS platforms
- Desktop platforms will log events to console but won't send to Firebase
- Consider using native Firebase plugins for more advanced features
- Review Firebase pricing for large-scale deployments

## Monetization & Revenue Analytics

The AnalyticsManager provides comprehensive revenue and monetization tracking:

### Revenue Tracking

```gdscript
# Get revenue summary
var revenue_summary = AnalyticsManager.get_revenue_summary()
print("Total Revenue: $", revenue_summary["total_revenue_dollars"])
print("Total Purchases: ", revenue_summary["total_purchases"])
print("ARPU: $", revenue_summary["arpu"])
print("LTV: $", revenue_summary["ltv"])
```

### Conversion Tracking

```gdscript
# Get conversion metrics
var conversion = AnalyticsManager.get_conversion_summary()
print("Conversion Rate: ", conversion["conversion_rate"], "%")
print("Store Conversion Rate: ", conversion["store_conversion_rate"], "%")
print("Paying Users: ", conversion["paying_users"])
print("Free Users: ", conversion["free_users"])
```

### User Registration

```gdscript
# Register new user (call when user creates account)
AnalyticsManager.register_user(false)  # false = free user

# When user makes first purchase
AnalyticsManager.register_user(true)  # true = paying user

# Increment session count each session
AnalyticsManager.increment_session_count()
```

### Offer Tracking

```gdscript
# Track when player views an offer
AnalyticsManager.log_offer_viewed("first_purchase_bonus", "first_purchase", 50)

# Track when player accepts an offer
AnalyticsManager.log_offer_accepted("first_purchase_bonus", "first_purchase", 999, 499)

# Track promo code usage
AnalyticsManager.log_promo_code_used("WELCOME20", 20, 200)
```

### Subscription Tracking

```gdscript
# Track subscription started
AnalyticsManager.log_subscription_started("premium_monthly", 999)

# Track subscription renewal
AnalyticsManager.log_subscription_renewed("premium_monthly", 999)

# Track subscription cancellation
AnalyticsManager.log_subscription_cancelled("premium_monthly", "too_expensive")
```

### Enhanced Crashlytics

```gdscript
# Log crash with context for better debugging
AnalyticsManager.log_crash_with_context(
    "null_pointer_exception",
    "res://scenes/player.gd:45",
    {"player_state": "combat", "current_weapon": "bow_001"}
)

# Log error with recent breadcrumbs
AnalyticsManager.log_error_with_breadcrumbs("Failed to load level", "error")
```

### User Properties for Segmentation

```gdscript
# Set user properties for analytics segmentation
AnalyticsManager.set_user_property("player_tier", "gold")
AnalyticsManager.set_user_property("games_played", "50")
AnalyticsManager.set_user_property("favorite_mode", "pvp")
```

### Key Metrics Explained

| Metric | Description | Calculation |
|--------|-------------|-------------|
| ARPU | Average Revenue Per User | Total Revenue / Total Users |
| ARPPU | Average Revenue Per Paying User | Total Revenue / Paying Users |
| LTV | Lifetime Value | Total Revenue / Paying Users |
| Conversion Rate | % of users who made a purchase | (Paying Users / Total Users) × 100 |
| Store Conversion | % of store visits that result in purchase | (Purchases / Store Visits) × 100 |
