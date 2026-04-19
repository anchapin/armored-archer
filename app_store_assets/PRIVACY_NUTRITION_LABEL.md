# Apple Privacy Nutrition Label

Reference for filling out the App Privacy section in App Store Connect.

## Data Collected

### 1. Email Address
- **Type**: Personal info → Email
- **Purpose**: App functionality (account creation and authentication)
- **Linked to identity**: Yes
- **Used for tracking**: No

### 2. Player ID
- **Type**: Personal info → User ID
- **Purpose**: App functionality (account management, game saves)
- **Linked to identity**: Yes
- **Used for tracking**: No

### 3. Crash Data
- **Type**: App info and performance → Crash data
- **Purpose**: Analytics (bug fixing via Firebase Crashlytics)
- **Linked to identity**: No
- **Used for tracking**: No

### 4. Performance Data
- **Type**: App info and performance → Other performance data (frame rates, load times)
- **Purpose**: Analytics (performance optimization)
- **Linked to identity**: No
- **Used for tracking**: No

### 5. Purchase History
- **Type**: Purchase history
- **Purpose**: App functionality (in-app purchase management)
- **Linked to identity**: Yes
- **Used for tracking**: No

### 6. Gameplay Statistics
- **Type**: App activity → Other action in the app (match history, gear inventory, level progress)
- **Purpose**: App functionality (game state management)
- **Linked to identity**: Yes
- **Used for tracking**: No

## Data Used to Track

**None.** Armored Archer does not use advertising identifiers, does not include ad SDKs, and does not track user activity across apps or websites.

## Data Linked to Identity

| Data Type | Purpose |
|-----------|---------|
| Email | Account creation, authentication, support |
| Player ID | Game state, matchmaking, leaderboards |
| Purchase history | IAP management, refund handling |
| Gameplay stats | Game progression, multiplayer matching |

## Data Not Linked to Identity

| Data Type | Purpose |
|-----------|---------|
| Crash data | Bug fixing |
| Performance data | App optimization |

## App Privacy Declaration Summary

Enter the following in App Store Connect > App Privacy:

1. **"Does your app collect data?"** → Yes
2. **Select all data types collected**: Email, User ID, Purchase History, Crash Data, Other Performance Data, Other Usage Data
3. **For each data type, specify**:
   - Whether it is linked to identity (see tables above)
   - Whether it is used for tracking (all: No)
   - Purpose: App Functionality for most; Analytics for crash/performance data

## Privacy Policy URL

Enter: `https://anchapin.github.io/armored-archer/docs/privacy-policy.html`
