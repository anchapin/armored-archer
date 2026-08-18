# Armored Archer - Comprehensive RPC Map

**Document Version:** 1.1
**Last Updated:** 2026-08-18
**Purpose:** Identifies the client caller, server handler, storage ownership, and deployment path for every PRD-critical feature.

---

## Overview

This document provides a comprehensive mapping of all RPC endpoints in the Armored Archer game. It serves as the authoritative reference for backend development, ensuring clear ownership and deployment paths across all features.

**Architecture Principles:**
- **Server-Authoritative:** All game logic and calculations happen on the server
- **Client as Thin UI:** Client primarily displays state and sends user actions
- **Anti-Cheat First:** All gameplay RPCs include signature verification and timing attack detection
- **Audit Everything:** All state changes are logged for security and analytics

---

## Table of Contents

1. [System & Health](#system--health)
2. [PvE & Progression](#pve--progression)
3. [PvP & Matchmaking](#pvp--matchmaking)
4. [Inventory & Gear](#inventory--gear)
5. [Seasons & Leaderboards](#seasons--leaderboards)
6. [Monetization & Store](#monetization--store)
7. [Notifications](#notifications)
8. [Analytics, Surveys & Audit](#analytics-surveys--audit)
9. [Infrastructure & Observability](#infrastructure--observability)
9. [RPC Dependencies](#rpc-dependencies)

---

## System & Health

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Health Check | NetworkManager | `rpcHealthCheck()` in `player_rpc.ts` | None (stateless) | `/rpc/armored_archer/health_check` |
| Report Player | PlayerStatsManager | `rpcReportPlayer()` in `player_rpc.ts` | `player_reports` storage (custom collection) | `/rpc/armored_archer/report_player` |
| Get Player Reports | PlayerStatsManager | `rpcGetPlayerReports()` in `player_rpc.ts` | `player_reports` storage (custom collection) | `/rpc/armored_archer/get_player_reports` |

**Storage Schema:**
- `player_reports` collection: `{ reported_user_id, reason, match_id, additional_info, timestamp, reporter_id }`

---

## PvE & Progression

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Get Player Stats | PlayerStatsManager | `rpcGetPlayerStats()` in `rpg_system.ts` | `player_stats` storage (custom collection) | `/rpc/armored_archer/get_player_stats` |
| Gain XP | PlayerStatsManager | `rpcGainXP()` in `rpg_system.ts` — client amount hard-capped at the server's max stage-completion XP (`getMaxStageXPGain()`); `stage_complete` is the authoritative server-settled XP path (#1068) | `player_stats` storage (custom collection) | `/rpc/armored_archer/gain_xp` |
| Allocate Stats | PlayerStatsManager | `rpcAllocateStats()` in `rpg_system.ts` | `player_stats` storage (custom collection) | `/rpc/armored_archer/allocate_stats` |
| Respec Stats | PlayerStatsManager | `rpcRespecStats()` in `rpg_system.ts` | `player_stats` + `respec_data` storage (custom collections) | `/rpc/armored_archer/respec_stats` |
| Save Build | PlayerStatsManager | `rpcSaveBuild()` in `rpg_system.ts` | `player_builds` storage (custom collection) | `/rpc/armored_archer/save_build` |
| Load Build | PlayerStatsManager | `rpcLoadBuild()` in `rpg_system.ts` | `player_builds` storage (custom collection) | `/rpc/armored_archer/load_build` |
| Get Builds | PlayerStatsManager | `rpcGetBuilds()` in `rpg_system.ts` | `player_builds` storage (custom collection) | `/rpc/armored_archer/get_builds` |
| Generate Gear | GearManager | `rpcGenerateGear()` in `gear_system.ts` | `catalog` + `inventory` tables (PostgreSQL) | `/rpc/armored_archer/generate_gear` |
| Stage Complete | CampaignManager | `rpcStageComplete()` in `gear_system.ts` — sole stage-completion RPC since #1069 (consolidated `complete_stage` into it): stars clamped 0-3, score capped at `MAX_STAGE_SCORE`, difficulty server-verified via `resolveVerifiedDifficulty()` before drop/XP multipliers (#1068); claim-first atomic writes (`stage_completion_claims` marker precedes any loot/XP/stars grant so retries no-op); loot persisted via `gear_db` DB layer; XP computed server-side | `stage_completion` + `stage_completion_claims` storage (custom collections), `inventory_items`/`boss_defeats`/`unlocked_modifier_pools` tables (PostgreSQL) | `/rpc/armored_archer/stage_complete` |
| ~~Complete Stage~~ | — | **DECOMMISSIONED (#1069)**: `rpcCompleteStage()` in `stage_tracking.ts` removed — no production client caller (CampaignManager calls `stage_complete`). Stars/score best-of persistence migrated to `stage_complete` via `stage_progression.applyStageCompletion`; its orphaned `player_inventory` storage loot write was deleted (loot now persists through the `gear_db` layer). Tombstone left in `stage_tracking.ts` | — | ~~`/rpc/armored_archer/complete_stage`~~ |
| Get Completed Stages | CampaignManager | `rpcGetCompletedStages()` in `stage_tracking.ts` | `campaign_progress` storage (custom collection) | `/rpc/armored_archer/get_completed_stages` |
| Get Campaign Progress | CampaignManager | `rpcGetCampaignProgress()` in `stage_tracking.ts` | `campaign_progress` storage (custom collection) | `/rpc/armored_archer/get_campaign_progress` |

**Storage Schema:**
- `player_stats` collection: `{ user_id, level, xp, ability_points, stats: { attack, defense, dodge, crit_rate } }`
- `respec_data` collection: `{ last_respec_time, free_respecs_used, current_season_id }`
- `player_builds` collection: `{ build_slot, build_name, stats, level, timestamp }`
- `catalog` table (PostgreSQL): Master gear catalog with types, rarities, stats
- `inventory` table (PostgreSQL): Player gear ownership
- `campaign_progress` collection: `{ user_id, completed_stages: [], current_stage }`

---

## PvE & Combat

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Submit Combat Action | CombatManager | `rpcSubmitCombatAction()` in `combat_system.ts` | `pvp_match_states` storage (custom collection) | `/rpc/armored_archer/submit_combat_action` |
| Get Match State | CombatManager | `rpcGetMatchState()` in `combat_system.ts` | `pvp_match_states` storage (custom collection) | `/rpc/armored_archer/get_match_state` |
| Player Disconnect | CombatManager | `rpcPlayerDisconnect()` in `combat_system.ts` | `pvp_matches` storage (custom collection) | `/rpc/armored_archer/player_disconnect` |

**Storage Schema:**
- `pvp_match_states` collection: `{ match_id, turn, current_turn_user_id, creator_id, opponent_id, creator_health, opponent_health, creator_stats, opponent_stats, status, winner, log, last_turn_timestamp, turn_timeout_ms, consecutive_timeouts, forfeit_reason }`

---

## PvP & Matchmaking

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| List Matches | MatchmakerManager | `rpcListMatches()` in `matchmaker.ts` | `pvp_matches` + `player_stats` storage (custom collections) | `/rpc/armored_archer/list_matches` |
| Create Match | MatchmakerManager | `rpcCreateMatch()` in `matchmaker.ts` | `pvp_matches` + `player_stats` storage (custom collections) | `/rpc/armored_archer/create_match` |
| Accept Match | MatchmakerManager | `rpcAcceptMatch()` in `matchmaker.ts` | `pvp_matches` + `player_stats` storage (custom collections) | `/rpc/armored_archer/accept_match` |
| Get Player Rank | MatchmakerManager + SeasonManager | `rpcGetPlayerRank()` in `season_leaderboard.ts` (sole registration, issue #871) | `player_stats` storage + season leaderboard (Nakama) | `/rpc/armored_archer/get_player_rank` |
| Complete Match | MatchmakerManager | `rpcCompleteMatch()` in `matchmaker.ts` | `pvp_matches` + `leaderboard` (Nakama) | `/rpc/armored_archer/complete_match` |
| Join Matchmaking Pool | MatchmakingPoolManager | `rpcJoinPool()` in `matchmaking_pool.ts` | `matchmaking_pool` storage (custom collection) | `/rpc/armored_archer/join_matchmaking_pool` |
| Leave Matchmaking Pool | MatchmakingPoolManager | `rpcLeavePool()` in `matchmaking_pool.ts` | `matchmaking_pool` storage (custom collection) | `/rpc/armored_archer/leave_matchmaking_pool` |
| Get Queue Status | MatchmakingPoolManager | `rpcGetQueueStatus()` in `matchmaking_pool.ts` | `matchmaking_pool` storage (custom collection) | `/rpc/armored_archer/get_queue_status` |
| Sync Difficulty | DynamicDifficultyManager | `rpcSyncDifficulty()` in `dynamic_difficulty.ts` | `difficulty_state` storage (records client hint only; server-derived modifier preserved) | `/rpc/armored_archer/sync_difficulty` |
| Track Match Outcome | DynamicDifficultyManager | `rpcTrackMatchOutcome()` in `dynamic_difficulty.ts` | `difficulty_state` + `match_history` storage; PvE wins corroborated against `stage_completion` storage (server-authoritative streak re-derivation, #870) | `/rpc/armored_archer/track_match_outcome` |
| Get Player Performance | DynamicDifficultyManager | `rpcGetPlayerPerformance()` in `dynamic_difficulty.ts` | `difficulty_state` + `match_history` storage (streaks re-derived from ledger) | `/rpc/armored_archer/get_player_performance` |
| Get Match History | MatchmakerManager | `rpcGetMatchHistory()` in `matchmaker.ts` | `pvp_matches` + `player_stats` storage (custom collections) | `/rpc/armored_archer/get_match_history` |
| Get Match Details | MatchmakerManager (legacy/test) | `rpcGetMatchDetails()` in `matchmaker.ts` — no active production caller (only test fixtures and admin tooling invoke it; prefer `get_match_history`/`get_match_state`) | `pvp_matches` + `pvp_match_states` storage | `/rpc/armored_archer/get_match_details` |
| Log Match Data | MatchmakingAnalyticsManager (telemetry) | `rpcLogMatchData()` in `matchmaking_analytics.ts` | `matchmaking_match_data` storage (custom collection) | `/rpc/armored_archer/log_match_data` |
| Log Abandonment | MatchmakingAnalyticsManager (telemetry) | `rpcLogAbandonment()` in `matchmaking_analytics.ts` | `matchmaking_match_data` storage (custom collection) | `/rpc/armored_archer/log_abandonment` |
| Log Weapon Result | MatchmakingAnalyticsManager (telemetry) | `rpcLogWeaponResult()` in `matchmaking_analytics.ts` | `matchmaking_weapon_stats` storage (custom collection) | `/rpc/armored_archer/log_weapon_result` |
| Log Queue Time | MatchmakingAnalyticsManager (telemetry) | `rpcLogQueueTime()` in `matchmaking_analytics.ts` | `matchmaking_queue_times` storage (custom collection) | `/rpc/armored_archer/log_queue_time` |
| Get Match Quality Metrics | Admin Dashboard *(admin-only)* | `rpcGetMatchQualityMetrics()` in `matchmaking_analytics.ts` | `matchmaking_match_data` storage (custom collection) | `/rpc/armored_archer/get_match_quality_metrics` |
| Get Weapon Stats | Admin Dashboard *(admin-only)* | `rpcGetWeaponStats()` in `matchmaking_analytics.ts` | `matchmaking_weapon_stats` storage (custom collection) | `/rpc/armored_archer/get_weapon_stats` |
| Detect Balance Issues | Admin Dashboard *(admin-only)* | `rpcDetectBalanceIssues()` in `matchmaking_analytics.ts` | `matchmaking_balance_issues` storage (custom collection) | `/rpc/armored_archer/detect_balance_issues` |
| Export Analytics Report | Admin Dashboard *(admin-only)* | `rpcExportAnalyticsReport()` in `matchmaking_analytics.ts` | `matchmaking_balance_issues` + `matchmaking_match_data` storage (read) | `/rpc/armored_archer/export_analytics_report` |
| Log Hit Resolution | CombatManager (telemetry) | `rpcLogHitResolution()` in `fairness_telemetry.ts` | `fairness_hit_resolution` storage (custom collection) | `/rpc/armored_archer/log_hit_resolution` |
| Log Disconnect | CombatManager (telemetry) | `rpcLogDisconnect()` in `fairness_telemetry.ts` | `fairness_disconnects` storage (custom collection) | `/rpc/armored_archer/log_disconnect` |
| Log Timeout | CombatManager (telemetry) | `rpcLogTimeout()` in `fairness_telemetry.ts` | `fairness_timeouts` storage (custom collection) | `/rpc/armored_archer/log_timeout` |
| Log Ranking Delta | CombatManager (telemetry) | `rpcLogRankingDelta()` in `fairness_telemetry.ts` | `fairness_ranking_deltas` storage (custom collection) | `/rpc/armored_archer/log_ranking_delta` |
| Get Fairness Summary | Admin Dashboard *(admin-only)* | `rpcGetFairnessSummary()` in `fairness_telemetry.ts` | `fairness_*` storage (custom collections, read) | `/rpc/armored_archer/get_fairness_summary` |
| Log Encounter Pacing | PacingManager (telemetry) | `rpcLogEncounterPacing()` in `encounter_pacing.ts` | `pacing_state` storage (custom collection) | `/rpc/armored_archer/log_encounter_pacing` |
| Get Pacing Report | PacingManager | `rpcGetPacingReport()` in `encounter_pacing.ts` | `pacing_state` storage (custom collection, read) | `/rpc/armored_archer/get_pacing_report` |
| Record Drop | MatchmakerManager (telemetry) | `rpcRecordDrop()` in `balance_analytics.ts` | `player_stats` storage (read-only aggregation) | `/rpc/armored_archer/record_drop` |
| Record Stage Attempt | CampaignManager (telemetry) | `rpcRecordStageAttempt()` in `balance_analytics.ts` | `player_stats` storage (read-only aggregation) | `/rpc/armored_archer/record_stage_attempt` |
| Get Drop Statistics | Admin Dashboard *(admin-only)* | `rpcGetDropStatistics()` in `balance_analytics.ts` | `player_stats` storage (computed aggregation) | `/rpc/armored_archer/get_drop_statistics` |
| Get Stage Completion Statistics | Admin Dashboard *(admin-only)* | `rpcGetStageCompletionStatistics()` in `balance_analytics.ts` | `player_stats` + `stage_completion` storage (computed aggregation) | `/rpc/armored_archer/get_stage_completion_statistics` |
| Get Balance Insights | Admin Dashboard *(admin-only)* | `rpcGetBalanceInsights()` in `balance_analytics.ts` | `player_stats` + balance telemetry (computed) | `/rpc/armored_archer/get_balance_insights` |
| Run Balance Session | Admin Dashboard *(admin-only)* | `rpcRunBalanceSession()` in `balance_session.ts` | `player_stats` + balance telemetry (computed) | `/rpc/armored_archer/run_balance_session` |

**Storage Schema:**
- `pvp_matches` collection: `{ match_id, creator_id, opponent_id, creator_rank, opponent_rank, match_type, is_punch_up, status, created_at, updated_at, creator_turn_data, opponent_turn_data, winner, expires_at, last_turn_timestamp }`
- `matchmaking_pool` collection: `{ user_id, joined_at, match_type, min_rank, max_rank }`
- `player_performance` collection: `{ user_id, matches_played, win_rate, avg_accuracy, difficulty_rating }`

---

## Inventory & Gear

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Generate Gear | GearManager | `rpcGenerateGear()` in `gear_system.ts` | `catalog` + `inventory` tables (PostgreSQL) | `/rpc/armored_archer/generate_gear` |
| Equip Gear | GearManager | `rpcEquipGear()` in `gear_system.ts` | `loadout` table (PostgreSQL) | `/rpc/armored_archer/equip_gear` |
| Unequip Gear | GearManager | `rpcUnequipGear()` in `gear_system.ts` | `loadout` table (PostgreSQL) | `/rpc/armored_archer/unequip_gear` |
| Get Inventory | GearManager | `rpcGetInventory()` in `gear_system.ts` | `inventory` + `loadout` tables (PostgreSQL) | `/rpc/armored_archer/get_inventory` |
| Unlock Modifier Pool | GearManager | `rpcUnlockModifierPool()` in `gear_system.ts` | `unlocked_modifiers` storage (custom collection) | `/rpc/armored_archer/unlock_modifier_pool` |
| Get Unlocked Modifiers | GearManager | `rpcGetUnlockedModifiers()` in `gear_system.ts` | `unlocked_modifiers` storage (custom collection) | `/rpc/armored_archer/get_unlocked_modifiers` |

**Storage Schema:**
- `inventory` table (PostgreSQL): `{ inventory_id, user_id, gear_id, acquired_at }`
- `loadout` table (PostgreSQL): `{ loadout_id, user_id, helm_gear_id, armor_gear_id, bow_gear_id, arrow_gear_id, amulet_gear_id }`
- `unlocked_modifiers` collection: `{ user_id, modifier_pool_id, unlocked_at }`

---

## Seasons & Leaderboards

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Get Season Info | SeasonManager | `rpcGetSeasonInfo()` in `season_system.ts` | `seasons` storage (custom collection) + `leaderboard` (Nakama) | `/rpc/armored_archer/get_season_info` |
| Get Leaderboard | SeasonManager | `rpcGetLeaderboard()` in `season_system.ts` | `leaderboard` (Nakama built-in) | `/rpc/armored_archer/get_leaderboard` |
| Get Season Rewards | SeasonManager | `rpcGetSeasonRewards()` in `season_system.ts` | `leaderboard` (Nakama built-in) | `/rpc/armored_archer/get_season_rewards` |
| Claim Season Rewards | SeasonManager | `rpcClaimSeasonRewards()` in `season_system.ts` | `season_rewards_claimed` storage (custom collection) + wallet (Nakama) | `/rpc/armored_archer/claim_season_rewards` |
| End Season | SeasonManager | `rpcEndSeason()` in `season_system.ts` | `seasons` storage (custom collection) + `leaderboard` (Nakama) | `/rpc/armored_archer/end_season` |
| Get Season History | SeasonManager | `rpcGetSeasonHistory()` in `season_leaderboard.ts` | `seasons` storage (custom collection) + `leaderboard` (Nakama) | `/rpc/armored_archer/get_season_history` |
| Get Player Cosmetics | SeasonManager | `rpcGetPlayerCosmetics()` in `season_system.ts` — season titles/auras earned via leaderboard rank (separate from IAP cosmetic skins in `get_owned_cosmetics`/`equip_cosmetic`); client uses `season_cosmetics` field | `player_cosmetics` storage (custom collection) | `/rpc/armored_archer/get_player_cosmetics` |
| Get Prestige Progress | SeasonManager | `rpcGetPrestigeProgress()` in `season_system.ts` — multi-season prestige tier aggregation | `player_prestige` storage (custom collection) | `/rpc/armored_archer/get_prestige_progress` |
| Get Projected Next Season Elo | SeasonManager | `rpcGetProjectedNextSeasonElo()` in `season_system.ts` — server-declared projection (see `complete_match` settlement, ADR-0002) | `player_stats` storage + season leaderboard | `/rpc/armored_archer/get_projected_next_season_elo` |
| Get Season Telemetry | Admin Dashboard *(admin-only)* | `rpcGetSeasonTelemetry()` in `season_telemetry.ts` | `season_telemetry_season_summaries` storage (custom collection) | `/rpc/armored_archer/get_season_telemetry` |
| Get Rank Inflation | Admin Dashboard *(admin-only)* | `rpcGetRankInflation()` in `season_telemetry.ts` | `season_telemetry_rating_snapshots` storage (custom collection) | `/rpc/armored_archer/get_rank_inflation` |
| Get Reward Concentration | Admin Dashboard *(admin-only)* | `rpcGetRewardConcentration()` in `season_telemetry.ts` | `season_telemetry_reward_claims` storage (custom collection) | `/rpc/armored_archer/get_reward_concentration` |
| Get Progression Velocity | Admin Dashboard *(admin-only)* | `rpcGetProgressionVelocity()` in `season_telemetry.ts` | `season_telemetry_rank_changes` + `season_telemetry_season_summaries` storage | `/rpc/armored_archer/get_progression_velocity` |
| Capture Rating Snapshot | Admin Dashboard *(admin-only)* | `rpcCaptureRatingSnapshot()` in `season_telemetry.ts` | `season_telemetry_rating_snapshots` storage (custom collection) | `/rpc/armored_archer/capture_rating_snapshot` |

**Storage Schema:**
- `seasons` collection: `{ season_id, season_number, start_time, end_time, status, duration_weeks }`
- `season_rewards_claimed` collection: `{ season_id, user_id, claimed_at, rank, rewards }`
- `player_activity` collection: `{ user_id, last_match_time }`
- `leaderboard` (Nakama): Built-in leaderboard system with metadata: `{ wins, losses, win_rate, punch_up_wins }`

**Removed RPCs:**
- `armored_archer/update_rank` — **removed** (issue #1076). It applied Elo updates from client-declared `winner_id`/`loser_id`, bypassing ADR-0002 server-declared settlement. Seasonal Elo now mutates exclusively via `complete_match`'s `resolveServerTerminalState` path (see PvP section). Clients refresh Standing / Ladder Rating via `get_season_info` / `get_player_rank`.

---

## Monetization & Store

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Validate Purchase | StoreManager | `rpcValidatePurchase()` in `store.ts` | Wallet (Nakama built-in) + Redis cache | `/rpc/armored_archer/validate_purchase` |
| Get Currency | StoreManager | `rpcGetCurrency()` in `store.ts` | Wallet (Nakama built-in) + Redis cache | `/rpc/armored_archer/get_currency` |
| Spend Gems | StoreManager | `rpcSpendGems()` in `store.ts` | Wallet (Nakama built-in) + Redis cache | `/rpc/armored_archer/spend_gems` |
| Process Pending Purchases | StoreManager (RevenueCat webhook) | `rpcProcessPendingPurchases()` in `store.ts` | Wallet (Nakama built-in) + `purchases` storage (custom collection) | `/rpc/armored_archer/process_pending_purchases` |
| Check Refunds | StoreManager (admin) | `rpcCheckRefunds()` in `store.ts` | Wallet (Nakama built-in) + `refunds` storage (custom collection) | `/rpc/armored_archer/check_refunds` |
| Check Subscriptions | StoreManager (admin) | `rpcCheckSubscriptions()` in `store.ts` | Wallet (Nakama built-in) + `subscriptions` storage (custom collection) | `/rpc/armored_archer/check_subscriptions` |
| App Launch Check | StoreManager | `rpcAppLaunchCheck()` in `store.ts` | Wallet (Nakama built-in) + Redis cache | `/rpc/armored_archer/app_launch_check` |
| RevenueCat Webhook | External (RevenueCat) | `rpcRevenueCatWebhook()` in `store.ts` | Wallet (Nakama built-in) + `purchases` storage (custom collection) | `/rpc/armored_archer/revenuecat_webhook` |
| Purchase Cosmetic | GemManager | `rpcPurchaseCosmetic()` in `store.ts` — validates item exists in `COSMETIC_CATALOG`, rejects already-owned, debits gems via `player_currency` ledger (#860) | `player_currency` (single-ledger write) + `player_cosmetics_owned` storage (custom collections) | `/rpc/armored_archer/purchase_cosmetic` |
| Get Cosmetic Catalog | unknown (server-side catalog endpoint) | `rpcGetCosmeticCatalog()` in `store.ts` — returns the in-memory `COSMETIC_CATALOG`; no production client caller yet | None (stateless, in-memory catalog) | `/rpc/armored_archer/get_cosmetic_catalog` |
| Get Owned Cosmetics | GemManager | `rpcGetOwnedCosmetics()` in `store.ts` — cross-device sync (restores purchase history on new device) | `player_cosmetics_owned` storage (custom collection, read) | `/rpc/armored_archer/get_owned_cosmetics` |
| Get Equipped Cosmetics | GemManager | `rpcGetEquippedCosmetics()` in `store.ts` — returns current cosmetic loadout per slot | `player_cosmetics_equipped` storage (custom collection, read) | `/rpc/armored_archer/get_equipped_cosmetics` |
| Equip Cosmetic | GemManager | `rpcEquipCosmetic()` in `store.ts` — validates ownership + slot compatibility before writing | `player_cosmetics_equipped` storage (custom collection) | `/rpc/armored_archer/equip_cosmetic` |
| Unequip Cosmetic | GemManager | `rpcUnequipCosmetic()` in `store.ts` | `player_cosmetics_equipped` storage (custom collection) | `/rpc/armored_archer/unequip_cosmetic` |
| Save Cosmetic Loadout | GemManager | `rpcSaveCosmeticLoadout()` in `store.ts` — batch write of full loadout (cross-device restore path) | `player_cosmetics_equipped` storage (custom collection) | `/rpc/armored_archer/save_cosmetic_loadout` |
| Purchase Bundle | GemManager | `rpcPurchaseBundle()` in `store.ts` — validates all bundle items in `COSMETIC_CATALOG`, enforces one-time purchase via `player_bundles_owned`, debits gems via `player_currency` ledger | `player_currency` + `player_cosmetics_owned` + `player_bundles_owned` storage | `/rpc/armored_archer/purchase_bundle` |
| Get Bundle Catalog | GemManager | `rpcGetBundleCatalog()` in `store.ts` — returns `BUNDLE_DEFINITIONS` with per-player `is_owned` flag | `player_bundles_owned` storage (custom collection, read) | `/rpc/armored_archer/get_bundle_catalog` |
| Restore Purchases | StoreManager (constant defined; client integration pending) | `rpcRestorePurchases()` in `store.ts` — queries RevenueCat REST API for subscriber/non-subscription history, marks receipts, awards gems. Client constant `RPC_RESTORE_PURCHASES` is defined in `StoreManager.gd:19` but the `restore_purchases()` flow currently uses the local RevenueCat SDK and not yet the server RPC; flagged for follow-up. | `player_currency` + `purchase_receipts` storage (custom collections) | `/rpc/armored_archer/restore_purchases` |

**Storage Schema:**
- Wallet (Nakama): Built-in wallet system with currencies: `{ coins, gems }`
- `purchases` collection: `{ user_id, product_id, purchase_date, amount, platform, transaction_id }`
- `refunds` collection: `{ user_id, product_id, refund_date, amount, reason }`
- `subscriptions` collection: `{ user_id, product_id, expiry_date, status }`

**Deployment Notes:**
- RevenueCat webhook is external → requires public endpoint configuration
- Admin RPCs (`check_refunds`, `check_subscriptions`) should be protected via admin role checks
- Purchase validation includes PII handling restrictions per `privacy_compliance.ts`

---

## Notifications

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Register Device Token | NotificationManager | `registerRpcRegisterDeviceToken()` in `notifications_rpc.ts` | `device_tokens` table (PostgreSQL) + `notification_preferences` storage (custom collection) | `/rpc/armored_archer_register_device_token` |
| Remove Device Token | NotificationManager | `registerRpcRemoveDeviceToken()` in `notifications_rpc.ts` | `device_tokens` table (PostgreSQL) | `/rpc/armored_archer_remove_device_token` |
| Get Notification Preferences | NotificationManager | `registerRpcGetNotificationPreferences()` in `notifications_rpc.ts` | `notification_preferences` storage (custom collection) | `/rpc/armored_archer_get_notification_preferences` |
| Update Notification Preferences | NotificationManager | `registerRpcUpdateNotificationPreferences()` in `notifications_rpc.ts` | `notification_preferences` storage (custom collection) | `/rpc/armored_archer_update_notification_preferences` |
| Schedule Notification | NotificationManager | `registerRpcScheduleNotification()` in `notifications_rpc.ts` | `scheduled_notifications` storage (custom collection) | `/rpc/armored_archer_schedule_notification` |
| Cancel Scheduled Notification | NotificationManager | `registerRpcCancelNotification()` in `notifications_rpc.ts` | `scheduled_notifications` storage (custom collection) | `/rpc/armored_archer_cancel_notification` |
| Get Notification Status | NotificationManager | `registerRpcGetNotificationStatus()` in `notifications_rpc.ts` | `device_tokens` table (PostgreSQL) | `/rpc/armored_archer_get_notification_status` |

**Storage Schema:**
- `device_tokens` table (PostgreSQL): `{ user_id, device_token, platform, fcm_token, app_version, registered_at }`
- `notification_preferences` collection: `{ user_id, daily_rewards_enabled, events_enabled, pvp_challenges_enabled, promotions_enabled, notifications_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone }`
- `scheduled_notifications` collection: `{ user_id, notification_id, type, title, body, scheduled_for, data, status }`

**Deployment Notes:**
- Requires Firebase Cloud Messaging (FCM) configuration
- Device tokens support both iOS and Android platforms
- Quiet hours feature respects user timezone

---

## Analytics, Surveys & Audit

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Track Event | unknown (server-side ingest + planned `AnalyticsManager.track_event_to_backend`) | `rpcTrackEvent()` in `analytics.ts` — append-only event log; MonitoringManager buffers `client_error` events for retry, but no Godot caller invokes the server RPC yet. | Analytics collection (custom) | `/rpc/armored_archer/track_event` |
| Track Revenue | unknown (server-side ingest) | `rpcTrackRevenue()` in `analytics.ts` — IAP revenue event log paired with `track_event` | Analytics collection (custom) | `/rpc/armored_archer/track_revenue` |
| Get Analytics Summary | Admin Dashboard *(admin-only)* | `rpcGetAnalyticsSummary()` in `analytics.ts` — aggregated event + revenue counts | Analytics collection (custom, read) | `/rpc/armored_archer/get_analytics_summary` |
| Get Circuit Breaker States | Admin Dashboard *(admin-only)* | `rpcGetCircuitBreakerStates()` in `analytics.ts` — live state of every wrapped RPC's circuit breaker | None (in-process state) | `/rpc/armored_archer/get_circuit_breaker_states` |
| Submit Survey | SurveyManager | `rpcSubmitSurvey()` in `survey.ts` — post-match / post-purchase survey responses | `survey_responses` storage (custom collection) | `/rpc/armored_archer/submit_survey` |
| Get Survey Status | SurveyManager (constant exists; client invocation pending) | `rpcGetSurveyStatus()` in `survey.ts` — cooldown / eligibility check before prompting next survey | `survey_responses` storage (read) | `/rpc/armored_archer/get_survey_status` |
| Query Audit Logs | Admin Dashboard *(admin-only)* | `rpcQueryAuditLogs()` in `audit.ts` — paginated audit trail query (admin-gated, #1075) | `audit_logs` storage (custom collection) | `/rpc/armored_archer/query_audit_logs` |
| Get Funnel Conversion | Admin Dashboard *(admin-only)* | `rpcGetFunnelConversion()` in `funnel_analytics.ts` — stage-by-stage funnel conversion rate | `funnel_analytics` storage (custom collection) | `/rpc/armored_archer/get_funnel_conversion` |
| Get Player Funnel State | PlayerStatsManager (planned) | `rpcGetPlayerFunnelState()` in `funnel_analytics.ts` — returns where the player is in the onboarding funnel | `funnel_analytics` storage (custom collection, read) | `/rpc/armored_archer/get_player_funnel_state` |

**Storage Schema:**
- `analytics_events` collection: `{ event_id, user_id, event_name, properties, timestamp, session_id }`
- `analytics_revenue` collection: `{ event_id, user_id, product_id, amount, currency, platform, timestamp }`
- `survey_responses` collection: `{ user_id, survey_type, responses, submitted_at }`
- `funnel_analytics` collection: `{ user_id, stage, entered_at, exited_at, conversion_path }`

**Deployment Notes:**
- All `track_*` endpoints are append-only and intended to tolerate burst load; the server-side client should batch when possible.
- Survey cooldown is enforced server-side via `get_survey_status`; clients should not bypass it locally.
- `query_audit_logs` is the only audit-trail reader; admin-gated via the shared `withAdminGuard` wrapper (#1075).

---

## Infrastructure & Observability

| Feature | Client Caller | Server Handler | Storage Ownership | Deployment Path |
|----------|---------------|----------------|-------------------|------------------|
| Get Metrics | Admin Dashboard (admin-only) | `rpcGetMetrics()` in `metrics.ts` | Metrics store (Prometheus) | `/rpc/armored_archer/metrics` |
| N+1 Query Report | Admin Dashboard (admin-only) | `rpcGetNPlusOneReport()` in `metrics.ts` + `n_plus_one_detection.ts` | `query_performance` storage (custom collection) | `/rpc/armored_archer/n_plus_one_report` |
| Error Insights Dashboard | Admin Dashboard (admin-only) | `rpcGetErrorDashboard()` in `error_insight_pipeline.ts` | `error_insights` storage (custom collection) | `/rpc/armored_archer/error_insights_dashboard` |
| Error Insights Summary | Admin Dashboard (admin-only) | `rpcGetErrorSummary()` in `error_insight_pipeline.ts` | `error_insights` storage (custom collection) | `/rpc/armored_archer/error_insights_summary` |
| Error Insights Patterns | Admin Dashboard (admin-only) | `rpcGetErrorPatterns()` in `error_insight_pipeline.ts` | `error_insights` storage (custom collection) | `/rpc/armored_archer/error_insights_patterns` |
| Error Insights Stats | Admin Dashboard (admin-only) | `rpcGetErrorStats()` in `error_insight_pipeline.ts` | `error_insights` storage (custom collection) | `/rpc/armored_archer/error_insights_stats` |
| Error Insights Dismiss | Admin Dashboard (admin-only) | `rpcDismissInsight()` in `error_insight_pipeline.ts` | `error_insights` storage (custom collection) | `/rpc/armored_archer/error_insights_dismiss` |
| Deployment Record | CI/CD Pipeline (admin-only) | `rpcRecordDeployment()` in `deployment_observability.ts` | `deployment_history` storage (custom collection) | `/rpc/armored_archer/deployment_record` |
| Deployment Health | Admin Dashboard (admin-only) | `rpcDeploymentHealth()` in `deployment_observability.ts` | `deployment_history` storage (custom collection) | `/rpc/armored_archer/deployment_health` |
| Deployment History | Admin Dashboard (admin-only) | `rpcDeploymentHistory()` in `deployment_observability.ts` | `deployment_history` storage (custom collection) | `/rpc/armored_archer/deployment_history` |
| Deployment Metrics | Admin Dashboard (admin-only) | `rpcDeploymentMetrics()` in `deployment_observability.ts` | `deployment_history` storage (custom collection) | `/rpc/armored_archer/deployment_metrics` |
| Progressive Rollout - Create Flag | Admin Dashboard (admin-only) | `rpcCreateFeatureFlag()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_create_flag` |
| Progressive Rollout - Update Flag | Admin Dashboard (admin-only) | `rpcUpdateFeatureFlag()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_update_flag` |
| Progressive Rollout - List Flags | Admin Dashboard (admin-only) | `rpcListFeatureFlags()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_list_flags` |
| Progressive Rollout - Check | Client/Admin | `rpcCheckFeatureFlag()` in `progressive_rollout.ts` — **scoped to caller (issue #1156):** payload `user_id` must match `ctx.userId` or be omitted; mismatches return `FORBIDDEN` and are audit-logged as `cross_user_probe` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_check` |
| Progressive Rollout - Advance Phase | Admin Dashboard (admin-only) | `rpcAdvancePhase()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_advance` |
| Progressive Rollout - Rollback | Admin Dashboard (admin-only) | `rpcRollbackFeature()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_rollback` |
| Progressive Rollout - Health Check | Admin Dashboard (admin-only) | `rpcRolloutHealth()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_health` |
| Progressive Rollout - Metrics | Admin Dashboard (admin-only) | `rpcGetRolloutMetrics()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_metrics` |
| Progressive Rollout - Record Metrics | Client | `rpcRecordMetrics()` in `progressive_rollout.ts` | `feature_flags` storage (custom collection) | `/rpc/armored_archer/rollout_record_metrics` |
| Progressive Rollout - Prometheus Metrics | Admin Dashboard (admin-only) | `rpcPrometheusMetrics()` in `progressive_rollout.ts` | Metrics store (Prometheus) | `/rpc/armored_archer/rollout_metrics_prometheus` |

**Storage Schema:**
- `error_insights` collection: `{ insight_id, error_type, count, first_seen, last_seen, stack_trace, dismissed }`
- `deployment_history` collection: `{ deployment_id, timestamp, version, status, environment, metrics }`
- `feature_flags` collection: `{ flag_id, name, description, phase, enabled_percentage, targeting, created_at }`
- `query_performance` collection: `{ query_id, execution_time_ms, n_plus_one_detected, timestamp }`

**Admin Authorization (issue #1075):**
- Every RPC in this section marked *(admin-only)* — plus the season admin tools, `admin_query_matches`, and the QA replay endpoints — is wrapped server-side by the shared admin guard (`backend/src/modules/admin_auth.ts`).
- Authorized callers are configured via the `ADMIN_USER_IDS` environment variable (comma-separated Nakama user ids; see `backend/.env.example`). Unset/empty rejects every caller (fail-closed), and rejections are audit-logged as `admin_rpc_access_denied`.
- `rollout_check` and `rollout_record_metrics` remain player-callable by design (client feature-gating and rollout telemetry). `rollout_check` is **hard-scoped to the session user** (issue #1156): a payload `user_id` must equal `ctx.userId` or be omitted — cross-user probes are rejected with `FORBIDDEN` and audit-logged against the caller. Operators needing the full flag inventory (including canary cohorts) must use the admin-only `rollout_list_flags` RPC.

### Client-Side Synchronous Storage Cache (no RPC)

`NetworkManager.get_storage_sync()` (issue #1022) is a **client-only** synchronous key-value facade (`get`/`put`/`erase`/`has`) backed by a last-known-value cache persisted to `user://network_storage_cache.json`. It issues **no RPC** — Nakama storage I/O is asynchronous HTTP, so a synchronous server read is impossible, and no generic key-value storage RPC exists server-side.

| Aspect | Detail |
|--------|--------|
| Callers | PlayerRatingManager, MatchTransitionManager, SeasonManager, MatchResultsManager, `scenes/ui/pvp/match_results.gd` |
| Server handler | None (client-side only) |
| Storage ownership | Local file `user://network_storage_cache.json` per player device |
| Server truth | Unaffected — server-authoritative state flows exclusively through the domain RPCs above via `NetworkManager.send_rpc()` |

Reads of missing keys return `null`, which every caller already treats as "apply defaults" (e.g. `DEFAULT_RATING`, current-time last-active). The cache is a crash-safe fallback for these legacy local-storage paths, never an input to gameplay decisions.

---

## RPC Dependencies

### Critical Dependencies by Feature

| Feature | Depends On | Dependency Type |
|----------|-------------|------------------|
| **Complete Match** | Get Player Stats | Player stats must exist |
| **Complete Match** | Get Leaderboard Entry | Season leaderboards must exist |
| **Generate Gear** | Get Inventory | Must check existing inventory |
| **Generate Gear** | Stage Complete | Requires stage progression data |
| **Claim Season Rewards** | Get Season Info | Must verify season is active |
| **Claim Season Rewards** | Get Leaderboard Entry | Must verify player rank |
| **Allocate Stats** | Get Player Stats | Must verify ability points available |
| **Respec Stats** | Get Player Stats | Must verify total stat points |
| **Equip Gear** | Get Inventory | Must verify gear ownership |
| **Unequip Gear** | Get Inventory | Must verify current equipped gear |

### Cross-Feature Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          PLAYER STATS (Core)                                   │
│  ┌────────────────────────────────────────────────────────────────────────────┐       │
│  │  get_player_stats  ◄───┐                                          │       │
│  │  gain_xp                │                                          │       │
│  │  allocate_stats            │────────┐                              │       │
│  │  respec_stats             │        │   Shared via       │       │
│  │  save_build              │        │   storage:        │       │
│  │  load_build              │        │   player_stats    │       │
│  │  get_builds              │        │                  │       │
│  └────────────────────────────────────────────────────────────────────────────┘       │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐       │
│  │                       INVENTORY                                       │       │
│  │  get_inventory  ◄───┐                                          │       │
│  │  generate_gear          │                                          │       │
│  │  equip_gear             │────────┐                              │       │
│  │  unequip_gear           │        │   Shared via       │       │
│  │  unlock_modifier_pool    │        │   PostgreSQL:     │       │
│  │  get_unlocked_modifiers  │        │   inventory,      │       │
│  │                         │        │   loadout,         │       │
│  │                         │        │   catalog          │       │
│  └────────────────────────────────────────────────────────────────────────────┘       │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐       │
│  │                       PVP / MATCHMAKING                             │       │
│  │  list_matches        ◄───┐                                          │       │
│  │  create_match             │                                          │       │
│  │  accept_match             │────────┐                              │       │
│  │  get_player_rank         │        │   Shared via       │       │
│  │  complete_match          │        │   pvp_matches +   │       │
│  │  submit_combat_action    │        │   pvp_match_states│       │
│  │  get_match_state         │        │   storage          │       │
│  └────────────────────────────────────────────────────────────────────────────┘       │
│                         │                                                        │
│                         ▼                                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐       │
│  │                       SEASONS / LEADERBOARDS                       │       │
│  │  get_season_info        │                                          │       │
│  │  get_leaderboard       │────────┐   Shared via       │       │
│  │  get_season_rewards     │        │   Nakama           │       │
│  │  claim_season_rewards    │        │   leaderboard      │       │
│  │  end_season             │        │   + player_stats   │       │
│  └────────────────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Anti-Cheat Integration

All gameplay RPCs integrate with the anti-cheat system:
- `verifyRequestSignature()` - HMAC signature validation
- `detectTimingAttack()` - Request timing anomaly detection
- `validateCombatActionParameters()` - Action parameter validation
- `isPlayerFlagged()` - Player flag status check

**Protected RPCs:**
- `gain_xp`
- `allocate_stats`
- `create_match`
- `accept_match`
- `complete_match`
- `submit_combat_action`
- `update_rank` — **removed entirely** (issue #1076): the client-declared winner/loser form was an ADR-0002 bypass that no signature gate could salvage. Elo mutates only through `complete_match`'s server-declared settlement. HMAC signature verification itself is now **enabled by default** (`ENABLE_HMAC_VERIFICATION` defaults on; `HMAC_SECRET` required in env templates — see `backend/src/modules/anti_cheat.ts`).

---

## Deployment Architecture

### Environment-Specific Paths

| Environment | Base URL | Notes |
|-----------|----------|-------|
| Development | `http://localhost:7350` | Docker Compose local |
| Staging | `https://staging-api.armoredarcher.com` | Pre-production testing |
| Production | `https://api.armoredarcher.com` | Live player traffic |

### Deployment Requirements

**For each new RPC:**
1. Add RPC registration to `backend/src/index.ts` (main module loader)
2. Define a valibot schema in `backend/src/modules/validation.ts` (or a colocated module-level validation helper)
3. Add RPC handler function to appropriate module
4. Register RPC with `registerRpc()` or `registerRpcWithMetrics()`
5. Update this RPC_MAP.md
6. Add unit tests in `backend/src/modules/__tests__/{module}.test.ts`
7. Add integration tests in `backend/tests/integration/{module}.test.ts`

### Monitoring & Metrics

All RPCs are instrumented with:
- **Metrics:** Counters, gauges, and histograms via Prometheus
- **Tracing:** OpenTelemetry spans for request latency tracking
- **Logging:** Structured JSON logs with correlation IDs
- **Audit:** All state changes logged to audit collection

---

## Maintenance Procedures

### Adding a New RPC

1. **Define the interface** in the appropriate backend module
2. **Implement validation** using valibot schemas (canonical library — see `backend/src/modules/validation.ts`)
3. **Write the handler** with anti-cheat protection
4. **Register the RPC** in the module initializer
5. **Add storage logic** (PostgreSQL table or Nakama storage)
6. **Update this document** with the RPC mapping (client caller, server handler, storage ownership, deployment path)
7. **Write tests** (unit + integration)
8. **Deploy to staging** and validate

> **Maintenance note (issue #1072):** When adding or removing an RPC, update this file in the same PR. CI will fail with a registered-vs-documented diff in a follow-up issue.

### Deprecating an RPC

1. Mark as **deprecated** in this document
2. Add **deprecation notice** in RPC response
3. Implement **versioning** (v1 → v2 transition)
4. **Update client callers** to use new RPC
5. **Monitor usage** and deprecate when unused
6. **Remove after grace period** (minimum 2 versions)

### Storage Migration

For PostgreSQL table changes:
1. Create migration file in `backend/data/` (next sequential number)
2. Add UP/DOWN logic or `IF NOT EXISTS` / `DROP TABLE IF EXISTS`
3. Update `DATABASE_SCHEMA.md`
4. Add schema tests to `backend/src/modules/__tests__/schema.test.ts`
5. Run `make backend-migrate` locally before PR

---

## Appendix: RPC Index

| RPC Name | Module | File | Handler | Feature |
|----------|---------|------|---------|----------|
| `armored_archer/health_check` | player_rpc | `rpcHealthCheck()` | System |
| `armored_archer/get_player_stats` | rpg_system | `rpcGetPlayerStats()` | PvE |
| `armored_archer/gain_xp` | rpg_system | `rpcGainXP()` | PvE |
| `armored_archer/allocate_stats` | rpg_system | `rpcAllocateStats()` | PvE |
| `armored_archer/respec_stats` | rpg_system | `rpcRespecStats()` | PvE |
| `armored_archer/save_build` | rpg_system | `rpcSaveBuild()` | PvE |
| `armored_archer/load_build` | rpg_system | `rpcLoadBuild()` | PvE |
| `armored_archer/get_builds` | rpg_system | `rpcGetBuilds()` | PvE |
| `armored_archer/generate_gear` | gear_system | `rpcGenerateGear()` | Inventory |
| `armored_archer/equip_gear` | gear_system | `rpcEquipGear()` | Inventory |
| `armored_archer/unequip_gear` | gear_system | `rpcUnequipGear()` | Inventory |
| `armored_archer/get_inventory` | gear_system | `rpcGetInventory()` | Inventory |
| `armored_archer/unlock_modifier_pool` | gear_system | `rpcUnlockModifierPool()` | Inventory |
| `armored_archer/get_unlocked_modifiers` | gear_system | `rpcGetUnlockedModifiers()` | Inventory |
| `armored_archer/stage_complete` | gear_system | `rpcStageComplete()` | PvE |
| `armored_archer/list_matches` | matchmaker | `rpcListMatches()` | PvP |
| `armored_archer/create_match` | matchmaker | `rpcCreateMatch()` | PvP |
| `armored_archer/accept_match` | matchmaker | `rpcAcceptMatch()` | PvP |
| `armored_archer/get_player_rank` | season_leaderboard | `rpcGetPlayerRank()` | PvP |
| `armored_archer/complete_match` | matchmaker | `rpcCompleteMatch()` | PvP |
| `armored_archer/submit_combat_action` | combat_system | `rpcSubmitCombatAction()` | PvP |
| `armored_archer/get_match_state` | combat_system | `rpcGetMatchState()` | PvP |
| `armored_archer/player_disconnect` | combat_system | `rpcPlayerDisconnect()` | PvP |
| `armored_archer/join_matchmaking_pool` | matchmaking_pool | `rpcJoinPool()` | PvP |
| `armored_archer/leave_matchmaking_pool` | matchmaking_pool | `rpcLeavePool()` | PvP |
| `armored_archer/get_queue_status` | matchmaking_pool | `rpcGetQueueStatus()` | PvP |
| `armored_archer/get_season_info` | season_system | `rpcGetSeasonInfo()` | Seasons |
| `armored_archer/get_leaderboard` | season_system | `rpcGetLeaderboard()` | Seasons |
| `armored_archer/get_season_rewards` | season_system | `rpcGetSeasonRewards()` | Seasons |
| `armored_archer/claim_season_rewards` | season_system | `rpcClaimSeasonRewards()` | Seasons |
| `armored_archer/end_season` | season_system | `rpcEndSeason()` | Seasons |
| `armored_archer/validate_purchase` | store | `rpcValidatePurchase()` | Store |
| `armored_archer/get_currency` | store | `rpcGetCurrency()` | Store |
| `armored_archer/spend_gems` | store | `rpcSpendGems()` | Store |
| `armored_archer/process_pending_purchases` | store | `rpcProcessPendingPurchases()` | Store |
| `armored_archer/check_refunds` | store | `rpcCheckRefunds()` | Store |
| `armored_archer/check_subscriptions` | store | `rpcCheckSubscriptions()` | Store |
| `armored_archer/app_launch_check` | store | `rpcAppLaunchCheck()` | Store |
| `armored_archer/revenuecat_webhook` | store | `rpcRevenueCatWebhook()` | Store |
| `armored_archer/report_player` | player_rpc | `rpcReportPlayer()` | System |
| `armored_archer/get_player_reports` | player_rpc | `rpcGetPlayerReports()` | System |
| `armored_archer_register_device_token` | notifications_rpc | - | Notifications |
| `armored_archer_remove_device_token` | notifications_rpc | - | Notifications |
| `armored_archer_get_notification_preferences` | notifications_rpc | - | Notifications |
| `armored_archer_update_notification_preferences` | notifications_rpc | - | Notifications |
| `armored_archer_schedule_notification` | notifications_rpc | - | Notifications |
| `armored_archer_cancel_notification` | notifications_rpc | - | Notifications |
| `armored_archer_get_notification_status` | notifications_rpc | - | Notifications |
| `armored_archer/metrics` | metrics | `rpcGetMetrics()` | Infrastructure *(admin-only)* |
| `armored_archer/n_plus_one_report` | metrics + n_plus_one | - | Infrastructure *(admin-only)* |
| `armored_archer/error_insights_dashboard` | error_insight_pipeline | `rpcGetErrorDashboard()` | Infrastructure *(admin-only)* |
| `armored_archer/error_insights_summary` | error_insight_pipeline | `rpcGetErrorSummary()` | Infrastructure *(admin-only)* |
| `armored_archer/error_insights_patterns` | error_insight_pipeline | `rpcGetErrorPatterns()` | Infrastructure *(admin-only)* |
| `armored_archer/error_insights_stats` | error_insight_pipeline | `rpcGetErrorStats()` | Infrastructure *(admin-only)* |
| `armored_archer/error_insights_dismiss` | error_insight_pipeline | `rpcDismissInsight()` | Infrastructure *(admin-only)* |
| `armored_archer/deployment_record` | deployment_observability | `rpcRecordDeployment()` | Infrastructure *(admin-only)* |
| `armored_archer/deployment_health` | deployment_observability | `rpcDeploymentHealth()` | Infrastructure *(admin-only)* |
| `armored_archer/deployment_history` | deployment_observability | `rpcDeploymentHistory()` | Infrastructure *(admin-only)* |
| `armored_archer/deployment_metrics` | deployment_observability | `rpcDeploymentMetrics()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_create_flag` | progressive_rollout | `rpcCreateFeatureFlag()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_update_flag` | progressive_rollout | `rpcUpdateFeatureFlag()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_list_flags` | progressive_rollout | `rpcListFeatureFlags()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_check` | progressive_rollout | `rpcCheckFeatureFlag()` — scoped to `ctx.userId` (mismatches → `FORBIDDEN` + audit log, issue #1156) | Infrastructure (player-callable) |
| `armored_archer/rollout_advance` | progressive_rollout | `rpcAdvancePhase()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_rollback` | progressive_rollout | `rpcRollbackFeature()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_health` | progressive_rollout | `rpcRolloutHealth()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_metrics` | progressive_rollout | `rpcGetRolloutMetrics()` | Infrastructure *(admin-only)* |
| `armored_archer/rollout_record_metrics` | progressive_rollout | `rpcRecordMetrics()` | Infrastructure (player-callable) |
| `armored_archer/rollout_metrics_prometheus` | progressive_rollout | `rpcPrometheusMetrics()` | Infrastructure *(admin-only)* |
| `armored_archer/admin_get_season_state` | season_admin | `rpcAdminGetSeasonState()` | Seasons *(admin-only)* |
| `armored_archer/admin_get_player_season` | season_admin | `rpcAdminGetPlayerSeason()` | Seasons *(admin-only)* |
| `armored_archer/admin_validate_season` | season_admin | `rpcAdminValidateSeason()` | Seasons *(admin-only)* |
| `armored_archer/admin_trigger_season_event` | season_admin | `rpcAdminTriggerSeasonEvent()` | Seasons *(admin-only)* |
| `armored_archer/admin_query_matches` | matchmaker | `rpcAdminQueryMatches()` | PvP *(admin-only)* |
| `armored_archer/get_match_replay` | match_replay | `rpcGetMatchReplay()` | QA Replay *(admin-only)* |
| `armored_archer/list_match_replays` | match_replay | `rpcListMatchReplays()` | QA Replay *(admin-only)* |
| `armored_archer/flag_match_for_qa` | match_replay | `rpcFlagMatchForQa()` | QA Replay *(admin-only)* |
| `armored_archer/add_debug_notes` | match_replay | `rpcAddDebugNotes()` | QA Replay *(admin-only)* |
| `armored_archer/reconstruct_match_state` | match_replay | `rpcReconstructMatchState()` | QA Replay *(admin-only)* |
| `armored_archer/sync_difficulty` | dynamic_difficulty | `rpcSyncDifficulty()` | PvE |
| `armored_archer/track_match_outcome` | dynamic_difficulty | `rpcTrackMatchOutcome()` | PvE |
| `armored_archer/get_player_performance` | dynamic_difficulty | `rpcGetPlayerPerformance()` | PvE |
| `armored_archer/get_match_history` | matchmaker | `rpcGetMatchHistory()` | PvP |
| `armored_archer/get_match_details` | matchmaker | `rpcGetMatchDetails()` | PvP (legacy/test) |
| `armored_archer/log_match_data` | matchmaking_analytics | `rpcLogMatchData()` | Telemetry |
| `armored_archer/log_abandonment` | matchmaking_analytics | `rpcLogAbandonment()` | Telemetry |
| `armored_archer/log_weapon_result` | matchmaking_analytics | `rpcLogWeaponResult()` | Telemetry |
| `armored_archer/log_queue_time` | matchmaking_analytics | `rpcLogQueueTime()` | Telemetry |
| `armored_archer/get_match_quality_metrics` | matchmaking_analytics | `rpcGetMatchQualityMetrics()` | Analytics *(admin-only)* |
| `armored_archer/get_weapon_stats` | matchmaking_analytics | `rpcGetWeaponStats()` | Analytics *(admin-only)* |
| `armored_archer/detect_balance_issues` | matchmaking_analytics | `rpcDetectBalanceIssues()` | Analytics *(admin-only)* |
| `armored_archer/export_analytics_report` | matchmaking_analytics | `rpcExportAnalyticsReport()` | Analytics *(admin-only)* |
| `armored_archer/log_hit_resolution` | fairness_telemetry | `rpcLogHitResolution()` | Telemetry |
| `armored_archer/log_disconnect` | fairness_telemetry | `rpcLogDisconnect()` | Telemetry |
| `armored_archer/log_timeout` | fairness_telemetry | `rpcLogTimeout()` | Telemetry |
| `armored_archer/log_ranking_delta` | fairness_telemetry | `rpcLogRankingDelta()` | Telemetry |
| `armored_archer/get_fairness_summary` | fairness_telemetry | `rpcGetFairnessSummary()` | Analytics *(admin-only)* |
| `armored_archer/log_encounter_pacing` | encounter_pacing | `rpcLogEncounterPacing()` | Telemetry |
| `armored_archer/get_pacing_report` | encounter_pacing | `rpcGetPacingReport()` | Telemetry |
| `armored_archer/record_drop` | balance_analytics | `rpcRecordDrop()` | Telemetry |
| `armored_archer/record_stage_attempt` | balance_analytics | `rpcRecordStageAttempt()` | Telemetry |
| `armored_archer/get_drop_statistics` | balance_analytics | `rpcGetDropStatistics()` | Analytics *(admin-only)* |
| `armored_archer/get_stage_completion_statistics` | balance_analytics | `rpcGetStageCompletionStatistics()` | Analytics *(admin-only)* |
| `armored_archer/get_balance_insights` | balance_analytics | `rpcGetBalanceInsights()` | Analytics *(admin-only)* |
| `armored_archer/run_balance_session` | balance_session | `rpcRunBalanceSession()` | Analytics *(admin-only)* |
| `armored_archer/stage_complete` | gear_system (+ `stage_progression` persistence) | `rpcStageComplete()` | PvE |
| `armored_archer/get_completed_stages` | stage_tracking | `rpcGetCompletedStages()` | PvE |
| `armored_archer/get_campaign_progress` | stage_tracking | `rpcGetCampaignProgress()` | PvE |
| `armored_archer/get_season_history` | season_leaderboard | `rpcGetSeasonHistory()` | Seasons |
| `armored_archer/get_player_cosmetics` | season_system | `rpcGetPlayerCosmetics()` | Seasons |
| `armored_archer/get_prestige_progress` | season_system | `rpcGetPrestigeProgress()` | Seasons |
| `armored_archer/get_projected_next_season_elo` | season_system | `rpcGetProjectedNextSeasonElo()` | Seasons |
| `armored_archer/get_season_telemetry` | season_telemetry | `rpcGetSeasonTelemetry()` | Seasons *(admin-only)* |
| `armored_archer/get_rank_inflation` | season_telemetry | `rpcGetRankInflation()` | Seasons *(admin-only)* |
| `armored_archer/get_reward_concentration` | season_telemetry | `rpcGetRewardConcentration()` | Seasons *(admin-only)* |
| `armored_archer/get_progression_velocity` | season_telemetry | `rpcGetProgressionVelocity()` | Seasons *(admin-only)* |
| `armored_archer/capture_rating_snapshot` | season_telemetry | `rpcCaptureRatingSnapshot()` | Seasons *(admin-only)* |
| `armored_archer/purchase_cosmetic` | store | `rpcPurchaseCosmetic()` | Store (Cosmetics) |
| `armored_archer/get_cosmetic_catalog` | store | `rpcGetCosmeticCatalog()` | Store (Cosmetics, server-only) |
| `armored_archer/get_owned_cosmetics` | store | `rpcGetOwnedCosmetics()` | Store (Cosmetics) |
| `armored_archer/get_equipped_cosmetics` | store | `rpcGetEquippedCosmetics()` | Store (Cosmetics) |
| `armored_archer/equip_cosmetic` | store | `rpcEquipCosmetic()` | Store (Cosmetics) |
| `armored_archer/unequip_cosmetic` | store | `rpcUnequipCosmetic()` | Store (Cosmetics) |
| `armored_archer/save_cosmetic_loadout` | store | `rpcSaveCosmeticLoadout()` | Store (Cosmetics) |
| `armored_archer/purchase_bundle` | store | `rpcPurchaseBundle()` | Store (Bundles) |
| `armored_archer/get_bundle_catalog` | store | `rpcGetBundleCatalog()` | Store (Bundles) |
| `armored_archer/restore_purchases` | store | `rpcRestorePurchases()` | Store (client integration pending) |
| `armored_archer/track_event` | analytics | `rpcTrackEvent()` | Analytics |
| `armored_archer/track_revenue` | analytics | `rpcTrackRevenue()` | Analytics |
| `armored_archer/get_analytics_summary` | analytics | `rpcGetAnalyticsSummary()` | Analytics *(admin-only)* |
| `armored_archer/get_circuit_breaker_states` | analytics | `rpcGetCircuitBreakerStates()` | Analytics *(admin-only)* |
| `armored_archer/submit_survey` | survey | `rpcSubmitSurvey()` | Analytics |
| `armored_archer/get_survey_status` | survey | `rpcGetSurveyStatus()` | Analytics (client invocation pending) |
| `armored_archer/query_audit_logs` | audit | `rpcQueryAuditLogs()` | Analytics *(admin-only)* |
| `armored_archer/get_funnel_conversion` | funnel_analytics | `rpcGetFunnelConversion()` | Analytics *(admin-only)* |
| `armored_archer/get_player_funnel_state` | funnel_analytics | `rpcGetPlayerFunnelState()` | Analytics |

---

**Document Owners:**
- Technical Lead: [To be assigned]
- Backend Team Lead: [To be assigned]
- DevOps Team: [To be assigned]

**Change Log:**
| Version | Date | Changes | Author |
|---------|------|----------|--------|
| 1.0 | 2026-04-15 | Initial comprehensive RPC map creation | Claude (AI-assisted) |
| 1.1 | 2026-08-18 | Documented all 135 registered RPCs (was 86 of ~135); added Analytics & Telemetry section (events, revenue, surveys, audit, funnel); added cosmetics, bundles, restore, season cosmetics/prestige, telemetry, encounter pacing, matchmaking analytics, fairness, balance, match history/details, query_audit_logs sections/rows; corrected stale `Zod` instructions to `valibot` (canonical per AGENTS.md and `validation.ts`); added maintenance note for follow-up registered-vs-documented CI diff check (issue #1072) | Claude (AI-assisted) |
