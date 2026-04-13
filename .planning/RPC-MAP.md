# RPC Map: Armored Archer Backend

**Version:** 1.0
**Date:** 2026-04-13
**Backend:** TypeScript (Nakama.js)
**Deployment:** Docker Compose → Nakama Runtime → `modules/index.js`

---

## Overview

This document provides a complete mapping of all RPC endpoints in the Armored Archer backend. Each entry includes:

| Column | Description |
|--------|-------------|
| **RPC ID** | Full Nakama RPC identifier (`armored_archer/method_name`) |
| **Short Name** | Method name used in client code |
| **Client Caller** | Godot autoload that initiates the call |
| **Server Handler** | TypeScript module and function (`modules/*.ts`) |
| **Storage Owner** | Which system owns the data (player_stats, storage, leaderboard, etc.) |
| **Deployment** | Deployment path and status |
| **MVP Priority** | Required for MVP (P1) or Post-MVP (P2) |
| **Rate Limit** | Per-endpoint rate limit (if configured) |

---

## System & Health RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/health_check` | `health_check` | NetworkManager | `player_rpc.ts:rpcHealthCheck` | None (in-memory) | P1 | 1000/1m |

**Purpose:** Health check for load balancers and monitoring
**Notes:** Always returns success, monitored by Prometheus

---

## Player Progression RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/get_player_stats` | `get_player_stats` | PlayerStatsManager | `player_rpc.ts:rpcGetPlayerStats` | `player_stats` table | P1 | 100/1m |
| `armored_archer/gain_xp` | `gain_xp` | PlayerStatsManager | `rpg_system.ts:rpcGainXP` | `player_stats` table | P1 | 50/1m |
| `armored_archer/allocate_stats` | `allocate_stats` | PlayerStatsManager | `rpg_system.ts:rpcAllocateStats` | `player_stats` table | P1 | 50/1m |

**Purpose:** Player progression, level-up, and stat allocation
**Data Storage:** PostgreSQL `player_stats` table
**MVP Notes:** Core progression loop - required for PvE gameplay

---

## Matchmaking & PvP RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/list_matches` | `list_matches` | MatchmakerManager | `matchmaker.ts:rpcListMatches` | Nakama storage + Redis | P1 | 100/1m |
| `armored_archer/create_match` | `create_match` | MatchmakerManager | `matchmaker.ts:rpcCreateMatch` | Nakama storage + Redis | P1 | 50/1m |
| `armored_archer/accept_match` | `accept_match` | MatchmakerManager | `matchmaker.ts:rpcAcceptMatch` | Nakama storage + Redis | P1 | 50/1m |
| `armored_archer/get_player_rank` | `get_player_rank` | SeasonManager | `matchmaker.ts:rpcGetPlayerRank` | Nakama leaderboard | P1 | 100/1m |
| `armored_archer/complete_match` | `complete_match` | MatchmakingManager | `matchmaker.ts:rpcCompleteMatch` | Nakama storage + leaderboard | P1 | 50/1m |

**Purpose:** Asynchronous turn-based PvP matchmaking
**Data Storage:** Nakama storage (match state), Redis (matchmaking queue), Nakama leaderboards (ranks)
**MVP Notes:** Core PvP loop - async PvP is a core feature

---

## Combat RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/submit_combat_action` | `submit_combat_action` | CombatManager | `combat_system.ts:rpcSubmitCombatAction` | Nakama storage | P1 | 100/5s |
| `armored_archer/get_match_state` | `get_match_state` | CombatSyncManager | `combat_system.ts:rpcGetMatchState` | Nakama storage | P1 | 100/1m |
| `armored_archer/player_disconnect` | `player_disconnect` | NetworkManager | `combat_system.ts:rpcPlayerDisconnect` | Nakama storage | P1 | 100/1m |

**Purpose:** PvE auto-shooter and PvP combat actions
**Data Storage:** Nakama storage (match state, combat actions)
**MVP Notes:** Core combat system - required for both PvE and PvP

---

## Season & Leaderboard RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/get_season_info` | `get_season_info` | SeasonManager | `season_system.ts:rpcGetSeasonInfo` | Nakama storage | P1 | 100/1m |
| `armored_archer/get_leaderboard` | `get_leaderboard` | SeasonManager | `season_system.ts:rpcGetLeaderboard` | Nakama leaderboard | P1 | 100/1m |
| `armored_archer/update_rank` | `update_rank` | SeasonManager | `season_system.ts:rpcUpdateRank` | Nakama leaderboard | P1 | 50/1m |
| `armored_archer/get_season_rewards` | `get_season_rewards` | SeasonManager | `season_system.ts:rpcGetSeasonRewards` | Nakama storage | P1 | 100/1m |
| `armored_archer/claim_season_rewards` | `claim_season_rewards` | SeasonManager | `season_system.ts:rpcClaimSeasonRewards` | Nakama storage + player storage | P1 | 50/1m |
| `armored_archer/end_season` | `end_season` | Admin/Server | `season_system.ts:rpcEndSeason` | Nakama storage + leaderboard | P2 | 10/1m |

**Purpose:** Seasonal content, leaderboards, and rewards
**Data Storage:** Nakama storage (season config), Nakama leaderboards (ranks), Player storage (claimed rewards)
**MVP Notes:** Seasonal rank is a core MVP feature

---

## Gear & Inventory RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/generate_gear` | `generate_gear` | GearManager | `gear_system.ts:rpcGenerateGear` | `catalog` + `inventory` tables | P1 | 50/1m |
| `armored_archer/equip_gear` | `equip_gear` | InventoryManager | `gear_system.ts:rpcEquipGear` | `loadout` table | P1 | 50/1m |
| `armored_archer/unequip_gear` | `unequip_gear` | InventoryManager | `gear_system.ts:rpcUnequipGear` | `loadout` table | P1 | 50/1m |
| `armored_archer/get_inventory` | `get_inventory` | InventoryManager | `gear_system.ts:rpcGetInventory` | `inventory` + `loadout` tables | P1 | 100/1m |
| `armored_archer/unlock_modifier_pool` | `unlock_modifier_pool` | GearManager | `gear_system.ts:rpcUnlockModifierPool` | Player storage | P2 | 20/1m |
| `armored_archer/stage_complete` | `stage_complete` | GearManager | `gear_system.ts:rpcStageComplete` | Player storage + `catalog` | P1 | 20/1m |
| `armored_archer/get_unlocked_modifiers` | `get_unlocked_modifiers` | GearManager | `gear_system.ts:rpcGetUnlockedModifiers` | Player storage | P2 | 100/1m |

**Purpose:** Equipment system with loot drops and modifiers
**Data Storage:** PostgreSQL (`catalog`, `inventory`, `loadout` tables), Nakama storage (modifier pools)
**MVP Notes:** Gear system is a core progression element

---

## Store & Monetization RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/validate_purchase` | `validate_purchase` | StoreManager | `store.ts:rpcValidatePurchase` | RevenueCat (external) | P1 | 50/1m |
| `armored_archer/get_currency` | `get_currency` | StoreManager | `store.ts:rpcGetCurrency` | Nakama wallet/storage | P1 | 100/1m |
| `armored_archer/spend_gems` | `spend_gems` | StoreManager | `store.ts:rpcSpendGems` | Nakama wallet/storage | P1 | 50/1m |
| `armored_archer/process_pending_purchases` | `process_pending_purchases` | StoreManager | `store.ts:rpcProcessPendingPurchases` | RevenueCat (external) | P1 | 10/1m |
| `armored_archer/check_refunds` | `check_refunds` | Server/cron | `store.ts:rpcCheckRefunds` | RevenueCat (external) | P1 | 10/1m |
| `armored_archer/check_subscriptions` | `check_subscriptions` | Server/cron | `store.ts:rpcCheckSubscriptions` | RevenueCat (external) | P2 | 10/1m |
| `armored_archer/app_launch_check` | `app_launch_check` | StoreManager | `store.ts:rpcAppLaunchCheck` | RevenueCat (external) | P1 | 100/1m |
| `armored_archer/revenuecat_webhook` | `revenuecat_webhook` | RevenueCat (external) | `store.ts:rpcRevenueCatWebhook` | Nakama wallet/storage | P1 | No limit |

**Purpose:** In-app purchase validation and gem currency
**Data Storage:** Nakama wallet/storage, RevenueCat (external SaaS)
**MVP Notes:** Cosmetic-only monetization (P2 features are subscriptions - removed from MVP)

---

## Campaign RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/complete_stage` | `complete_stage` | CampaignManager | `stage_tracking.ts:rpcCompleteStage` | Nakama storage + Redis cache | P1 | 50/1m |
| `armored_archer/get_completed_stages` | `get_completed_stages` | CampaignManager | `stage_tracking.ts:rpcGetCompletedStages` | Nakama storage | P1 | 100/1m |
| `armored_archer/get_campaign_progress` | `get_campaign_progress` | CampaignManager | `stage_tracking.ts:rpcGetCampaignProgress` | Nakama storage | P1 | 100/1m |

**Purpose:** PvE campaign progression and stage tracking
**Data Storage:** Nakama storage (campaign state), Redis cache (progress)
**MVP Notes:** PvE campaign is a core gameplay loop

---

## Player Reporting RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/report_player` | `report_player` | UI/Feedback | `player_rpc.ts:rpcReportPlayer` | Nakama storage | P2 | 10/1m |
| `armored_archer/get_player_reports` | `get_player_reports` | UI/Admin | `player_rpc.ts:rpcGetPlayerReports` | Nakama storage | P2 | 50/1m |

**Purpose:** Player-to-player abuse reporting
**Data Storage:** Nakama storage (reports)
**MVP Notes:** Not required for launch - can be added post-MVP

---

## Notification RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/register_device_token` | `register_device_token` | Client | `notifications_rpc.ts:rpcRegisterDeviceToken` | Nakama storage | P2 | 20/1m |
| `armored_archer/remove_device_token` | `remove_device_token` | Client | `notifications_rpc.ts:rpcRemoveDeviceToken` | Nakama storage | P2 | 20/1m |
| `armored_archer/get_notification_preferences` | `get_notification_preferences` | Client | `notifications_rpc.ts:rpcGetNotificationPreferences` | Nakama storage | P2 | 100/1m |
| `armored_archer/update_notification_preferences` | `update_notification_preferences` | Client | `notifications_rpc.ts:rpcUpdateNotificationPreferences` | Nakama storage | P2 | 50/1m |
| `armored_archer/schedule_notification` | `schedule_notification` | Server/Manager | `notifications_rpc.ts:rpcScheduleNotification` | Nakama storage | P2 | 10/1m |
| `armored_archer/cancel_notification` | `cancel_notification` | Client | `notifications_rpc.ts:rpcCancelNotification` | Nakama storage | P2 | 20/1m |
| `armored_archer/get_notification_status` | `get_notification_status` | Client | `notifications_rpc.ts:rpcGetNotificationStatus` | Nakama storage | P2 | 100/1m |
| `start_notification_scheduler` | Internal | Server | `notifications_rpc.ts:startNotificationScheduler` | None (cron) | P2 | N/A |

**Purpose:** Push notification management
**Data Storage:** Nakama storage (device tokens, preferences, scheduled notifications)
**MVP Notes:** Push notifications not required for MVP launch

---

## Analytics RPCs

| RPC ID | Short Name | Client Caller | Server Handler | Storage Owner | Deployment | MVP | Rate Limit |
|---------|-------------|----------------|-----------------|----------------|--------------|------------|
| `armored_archer/track_event` | `track_event` | Various | `analytics.ts:rpcTrackEvent` | Analytics service (external) | P2 | No limit |
| `armored_archer/get_analytics_summary` | `get_analytics_summary` | Admin/Dashboard | `analytics.ts:rpcGetAnalyticsSummary` | Analytics service (external) | P2 | 50/1m |
| `armored_archer/track_revenue` | `track_revenue` | StoreManager | `analytics.ts:rpcTrackRevenue` | Analytics service (external) | P2 | 50/1m |

**Purpose:** Event tracking and analytics
**Data Storage:** External analytics service
**MVP Notes:** Analytics not required for MVP - can use basic logs initially

---

## Summary Statistics

| Category | Total RPCs | MVP Required (P1) | Post-MVP (P2) |
|----------|--------------|---------------------|------------------|
| System & Health | 1 | 1 | 0 |
| Player Progression | 3 | 3 | 0 |
| Matchmaking & PvP | 5 | 5 | 0 |
| Combat | 3 | 3 | 0 |
| Season & Leaderboard | 6 | 5 | 1 |
| Gear & Inventory | 7 | 5 | 2 |
| Store & Monetization | 8 | 5 | 3 |
| Campaign | 3 | 3 | 0 |
| Player Reporting | 2 | 0 | 2 |
| Notifications | 8 | 0 | 8 |
| Analytics | 3 | 0 | 3 |
| **TOTAL** | **49** | **30** | **19** |

**MVP RPC Count:** 30 endpoints (61% of total)
**Post-MVP RPC Count:** 19 endpoints (39% of total)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Godot Client                          │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ Player   │  Match   │ Combat   │  Store   │         │
│  │ Stats    │ making   │ Manager  │ Manager  │         │
│  └─────┬────┴─────┬────┴─────┬────┴─────┘         │
└────────┼────────────┼────────────┼─────────────────────────┘
         │            │            │
         │            │            │
         ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│              NetworkManager (Nakama Client)              │
└────────────────────────┬────────────────────────────────────┘
                     │ HTTPS (Nakama RPC)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              Docker Compose (Local/Dev)                 │
│  ┌──────────────────────────────────────────────┐          │
│  │    Nakama Server (heroiclabs/nakama)    │          │
│  │  ┌────────────────────────────────────┐   │          │
│  │  │  TypeScript Runtime (Node.js)     │   │          │
│  │  │  modules/index.js (InitModule)    │   │          │
│  │  └────────────────────────────────────┘   │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notes

1. **Rate Limits:** Configured in `backend/src/config.ts` and applied via `registerRpcWithRateLimit`
2. **Monitoring:** All RPCs emit metrics to Prometheus via `registerRpcWithMetrics`
3. **Tracing:** All RPCs participate in OpenTelemetry distributed tracing
4. **Error Tracking:** All RPC errors are sent to Sentry via structured logging
5. **Caching:** Frequently accessed data (player stats, leaderboards, season info) is cached in Redis

---

*Last Updated:* 2026-04-13
*Next Review:* After MVP launch (v1.0.0)
