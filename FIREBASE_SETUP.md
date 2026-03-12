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

---

# Push Notifications Setup (Firebase Cloud Messaging)

This section explains how to configure Firebase Cloud Messaging (FCM) for push notifications in Armored Archer.

## Overview

Push notifications enable:
- **Daily Reward Reminders**: Notify players when their daily rewards are available
- **Event Notifications**: Alert players about new in-game events
- **PvP Challenges**: Notify when opponents are waiting for a match
- **Promotions**: Send special offers and promotions

## Prerequisites

- Firebase Cloud Messaging enabled in Firebase Console
- Firebase Admin SDK access (server-side)
- Firebase configuration from Step 1-3 above

## Step 1: Enable Cloud Messaging in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Grow** → **Cloud Messaging**
4. Click "Get Started" if not already enabled
5. Note your **Sender ID** (needed for Android)
6. Generate and download your **private key** (for server-side Admin SDK)

## Step 2: Configure Backend Environment Variables

Set the following environment variables for the Nakama backend:

```bash
# Enable Firebase Cloud Messaging
FIREBASE_ENABLED=true

# Firebase Project Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# Optional: Firebase Database URL
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

### Getting the Private Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely
4. Copy the `private_key` value (note: escape newlines as `\n`)

## Step 3: Configure Android for Push Notifications

### Add Dependencies

In your Android `build.gradle`:
```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### Update AndroidManifest.xml

```xml
<!-- Push notification permissions -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>

<!-- FCM service -->
<service
    android:name=".MyFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

### Create Messaging Service (Android)

```java
public class MyFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Send token to your server
        sendTokenToServer(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        // Handle incoming notification
    }
}
```

## Step 4: Configure iOS for Push Notifications

### Enable Push Notifications

1. In Xcode: Select your project → Signing & Capabilities
2. Add "Push Notifications" capability
3. Enable "Remote Notifications"

### Upload APNs Certificate

1. Go to Apple Developer Portal → Certificates
2. Create "Apple Push Notification service SSL (Sandbox & Production)"
3. Download and convert to .p12
4. Upload to Firebase Console → Project Settings → Cloud Messaging

## Step 5: Frontend Implementation (Godot)

### Register Device Token

When the game starts, register the FCM token with the backend:

```gdscript
# After Firebase initialization and getting the FCM token
var token = FirebaseMessaging.get_token()
if token:
    var result = await NakoRPC.call(
        "armored_archer_register_device_token",
        {
            "deviceToken": token,
            "platform": "android" if OS.get_name() == "Android" else "ios",
            "appVersion": GameVersion.get_version_string()
        }
    )
```

### Handle Notification Preferences

```gdscript
# Get notification preferences
var prefs = await NakoRPC.call(
    "armored_archer_get_notification_preferences",
    {}
)

# Update preferences
var result = await NakoRPC.call(
    "armored_archer_update_notification_preferences",
    {
        "dailyRewardsEnabled": true,
        "eventsEnabled": true,
        "pvpChallengesEnabled": false,
        "promotionsEnabled": true,
        "notificationsEnabled": true,
        "quietHoursEnabled": true,
        "quietHoursStart": "22:00:00",
        "quietHoursEnd": "08:00:00",
        "timezone": "America/New_York"
    }
)
```

### Notification Payloads

The backend sends notifications with these data fields:

- `type`: Notification type (daily_reward, event, pvp_challenge, promotion)
- `action`: Action to take when tapped (claim_rewards, view_event, join_arena)

```gdscript
# Handle notification tap
func _on_notification_clicked(data: Dictionary):
    match data.get("type"):
        "daily_reward":
            GameState.load_scene("res://scenes/DailyRewards.tscn")
        "event":
            GameState.load_event(data.get("eventId"))
        "pvp_challenge":
            GameState.load_scene("res://scenes/Arena.tscn")
```

## Step 6: Database Setup

Run the migration to create notification tables:

```bash
# Apply migration
psql -U nakama -d nakama -f backend/data/006_create_notifications.sql
```

This creates:
- `device_tokens` - Stores FCM tokens per user
- `notification_preferences` - User notification settings
- `scheduled_notifications` - Scheduled notifications queue
- `notification_history` - Delivery history for analytics

## Notification Types

### Daily Rewards
- Title: "🎁 Daily Rewards Await!"
- Body: "Your daily rewards are ready to claim. Come back and collect your gems!"
- Triggered: Configurable schedule (default: 9 AM local time)

### Events
- Title: "🎉 New Event Available!"
- Body: "A new event has started. Check it out and earn exclusive rewards!"
- Triggered: When new events are published

### PvP Challenges
- Title: "⚔️ PvP Challenge Ready!"
- Body: "{Opponent} is waiting for you in the arena!"
- Triggered: When matched with opponent

### Promotions
- Title: "🔥 Special Offer!"
- Body: "Limited time offer! Get bonus gems with your purchase."
- Triggered: During sales/promotions

## Testing

### Test Push Notifications

1. Use Firebase Console → Cloud Messaging → "Send your first message"
2. Or use the backend RPC to schedule a test notification

### Verify Delivery

Check the `notification_history` table:
```sql
SELECT * FROM notification_history 
WHERE user_id = 'target-user-id' 
ORDER BY delivered_at DESC 
LIMIT 10;
```

## Troubleshooting

### Notifications Not Received

1. Verify Firebase is enabled: `FIREBASE_ENABLED=true`
2. Check device token is registered
3. Verify user has not disabled notifications
4. Check quiet hours settings
5. Review notification_history for errors

### Firebase Admin SDK Errors

1. Verify private key format (newlines escaped as `\n`)
2. Check project ID matches Firebase Console
3. Ensure service account has "Firebase Admin SDK" role

### Token Registration Fails

1. Check database connectivity
2. Verify user_id is valid
3. Check for duplicate token conflicts
