# Product Analytics Dashboard

This document describes the analytics instrumentation for Armored Archer and provides guidance for setting up dashboards to monitor product metrics.

## Overview

The analytics system tracks user behavior across the game client and backend server. It supports multiple analytics providers (Mixpanel, Amplitude, Segment) and can forward events to external services for visualization.

## Key Events and Metrics

### Session Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `session_start` | User launches the game | platform, version, device_id |
| `session_end` | User exits the game | duration_seconds, session_id |
| `first_session` | New user first launch | platform, version |
| `daily_login` | Returning user daily login | consecutive_days, platform |

### Tutorial Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `tutorial_started` | User begins tutorial | step, platform |
| `tutorial_step` | User progresses in tutorial | step_number, step_name |
| `tutorial_completed` | User finishes tutorial | duration_seconds |
| `tutorial_failed` | User fails/exits tutorial | step, reason |

### PVE (Campaign) Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `pve_stage_started` | User starts a campaign stage | stage_id, difficulty, wave |
| `pve_stage_completed` | User completes a stage | stage_id, duration, stars, difficulty |
| `pve_stage_failed` | User fails a stage | stage_id, reason, duration |
| `pve_boss_defeated` | User defeats a boss | boss_id, stage_id, time_elapsed |

### PVP Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `pvp_match_started` | User starts a PVP match | match_type, rank |
| `pvp_match_completed` | User finishes a PVP match | match_id, result, duration, rank_change |
| `pvp_match_abandoned` | User leaves a PVP match | match_id, reason |
| `pvp_disconnect` | User disconnects from PVP | match_id, connection_type |

### Store & Revenue Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `store_opened` | User opens the store | source (main_menu, in_game) |
| `purchase_initiated` | User starts a purchase | product_id, price, currency |
| `purchase_completed` | Purchase succeeds | product_id, amount, currency, transaction_id |
| `purchase_failed` | Purchase fails | product_id, error_code, reason |
| `gem_purchased` | Gems acquired | gem_amount, usd_amount, product_id |
| `subscription_started` | User starts subscription | subscription_tier, duration |

### Progression Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `gear_obtained` | User gains new gear | gear_id, rarity, source |
| `gear_equipped` | User equips gear | gear_id, slot, previous_gear_id |
| `transmog_applied` | User applies skin | skin_id, slot |
| `level_up` | User levels up | new_level, previous_level, source |
| `ability_unlocked` | New ability unlocked | ability_id, unlock_type |

### Network Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `network_error` | Network connection fails | error_type, endpoint, status_code |
| `rpc_error` | RPC call fails | rpc_name, error_code |
| `rpc_latency` | RPC call latency | rpc_name, latency_ms |

### Funnel Analysis Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `app_opened` | User launches the app | platform, app_version, engine_version |
| `main_menu_viewed` | User sees main menu | platform |
| `campaign_started` | User starts campaign stage | chapter, stage, platform |
| `campaign_completed` | User completes campaign chapter | chapter, stages_completed, platform |
| `store_viewed` | User opens store | store_location, platform |
| `pvp_lobby_entered` | User enters PvP lobby | season_id, platform |
| `inventory_viewed` | User opens inventory | platform |
| `settings_opened` | User opens settings | platform |
| `tutorial_skipped` | User skips tutorial | step_id, platform |

### Custom Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `xp_gained` | Player gains XP | amount, total_xp, level, source |
| `game_started` | Game session starts | stage, stage_id, timestamp |
| `game_won` | Player wins game | stage, stage_id, duration_seconds |
| `game_lost` | Player loses game | stage, stage_id, duration_seconds, reason |

## Dashboard Setup

### Mixpanel Dashboard

1. **Create a Mixpanel project** at https://mixpanel.com
2. **Add API key** to backend environment: `MIXPANEL_API_KEY`
3. **Enable forwarding**: Set `MIXPANEL_ENABLED=true`

#### Recommended Mixpanel Reports:

**User Engagement**
- DAU/MAU Chart
- Session Duration Distribution
- Retention by Cohort

**Revenue**
- Total Revenue Over Time
- ARPPU (Average Revenue Per Paying User)
- Purchase Conversion Funnel

**Game Progression**
- Stage Completion Rate
- Average Stage Duration
- Tutorial Completion Rate

**PVP Metrics**
- Match Start Rate
- Win/Loss Ratio
- Average Match Duration

### Amplitude Dashboard

1. **Create an Amplitude project** at https://amplitude.com
2. **Add API key** to backend environment: `AMPLITUDE_API_KEY`
3. **Enable forwarding**: Set `AMPLITUDE_ENABLED=true`

#### Recommended Amplitude Charts:

**Funnels**
- Store Visit → Purchase
- Tutorial Start → Completion
- Match Start → Match End

**Segmentation**
- By platform (iOS/Android)
- By user cohort
- By acquisition source

### Custom Dashboard

For self-hosted analytics, configure a custom endpoint:

```
ANALYTICS_CUSTOM_ENDPOINT=https://your-analytics-server.com/track
ANALYTICS_CUSTOM_API_KEY=your_api_key
```

## Implementation

### Backend Configuration

The backend module `analytics.ts` provides:

- `track_event` RPC - Track any analytics event
- `track_revenue` RPC - Track purchase/revenue events
- `get_analytics_summary` RPC - Query analytics data

### Godot Client Integration

The Godot client includes `AnalyticsManager` (in `addons/analytics_manager/analytics_manager.gd`) which provides:

- Firebase Analytics integration for mobile
- Local analytics fallback for desktop/web
- Backend RPC forwarding for event aggregation
- Session and performance monitoring

### Environment Variables

```bash
# Enable analytics
ANALYTICS_ENABLED=true

# Mixpanel
MIXPANEL_ENABLED=true
MIXPANEL_API_KEY=your_key

# Amplitude
AMPLITUDE_ENABLED=true
AMPLITUDE_API_KEY=your_key

# Segment
SEGMENT_ENABLED=true
SEGMENT_WRITE_KEY=your_key

# Custom endpoint
ANALYTICS_CUSTOM_ENDPOINT=https://your-server.com/track
```

## Monitoring Key Metrics

### Daily Health Metrics

1. **Active Users**
   - DAU (Daily Active Users)
   - MAU (Monthly Active Users)
   - Stickiness (DAU/MAU ratio)

2. **Session Quality**
   - Average session duration
   - Sessions per user per day
   - Crash-free sessions

3. **Revenue**
   - Daily revenue
   - Conversion rate
   - ARPPU

### Product Metrics

1. **Tutorial**
   - Start rate
   - Completion rate
   - Drop-off points

2. **Engagement**
   - Stage progression rate
   - PVP match frequency
   - Feature adoption

3. **Retention**
   - Day 1/7/30 retention
   - Churn prediction
   - Lifetime value

## Security & Privacy

- **User data** is anonymized where possible
- **PII** is not sent to analytics services without consent
- **GDPR/CCPA** compliance: Users can opt-out via game settings
- **Data retention**: Configure retention period in analytics provider settings

## Troubleshooting

### Events Not Appearing

1. Check that `ANALYTICS_ENABLED=true` in environment
2. Verify API keys are correctly configured
3. Check backend logs for forwarding errors
4. Ensure network connectivity from server

### Dashboard Not Updating

1. Check event timestamp is correct
2. Verify data pipeline status in analytics provider
3. Check for timezone settings in dashboard

### Performance Issues

1. Analytics events are queued and sent asynchronously
2. In high-traffic scenarios, consider batching events
3. Monitor server resource usage for external API calls

## Firebase Analytics Setup

### Configuration

Firebase Analytics is automatically configured when running on mobile platforms (iOS/Android). The following configuration files are required:

- **Android**: `res://firebase_config/google-services.json`
- **iOS**: `res://firebase_config/GoogleService-Info.plist`

### Firebase Console Dashboard

View your analytics data in the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Analytics** > **Dashboard**

### Key Firebase Analytics Reports

#### User Acquisition
- New vs Returning Users
- Traffic Sources
- User Properties (platform, version, country)

#### Engagement
- Daily/Weekly Active Users
- Session Duration
- Screens Views

#### Monetization (Conversion Tracking)
- In-App Purchase Revenue
- Conversion Rate
- ARPPU

#### Events
- Event Count
- Key Events (automatically tracked)
- Custom Events

### Recommended Funnels (Firebase)

1. **App Open → Main Menu → Store → Purchase**
   - Track store conversion rate

2. **App Open → Tutorial Start → Tutorial Complete**
   - Track tutorial completion

3. **Campaign Start → Campaign Stage Complete**
   - Track stage progression

4. **PvP Lobby → Match Start → Match Complete**
   - Track PvP engagement

### Debugging Firebase Events

Use Firebase DebugView to test events during development:

```bash
# Android
adb shell setprop debug.firebase.analytics.app com.armoredarcher.game

# iOS (via Xcode)
- Enable "Debug" scheme
- Set launch argument: -FIRDebugEnabled
```

### Converting Firebase Events to Custom Dashboard

Firebase events are also forwarded to the backend for cross-platform analytics. Configure backend integration in:

```
# Backend environment
ANALYTICS_ENABLED=true
FIREBASE_ENABLED=true
```
