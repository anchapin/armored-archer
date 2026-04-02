---
phase: 05-campaign-persistence
plan: 02
subsystem: client
tags: [gdscript, campaign, sync, persistence, godot]

# Dependency graph
requires:
  - phase: 05-campaign-persistence
    plan: 01
    provides: get_campaign_progress RPC and fixed difficulty validation
provides:
  - Server-side campaign progress sync on connection
  - Dynamic difficulty tier sent to stage_complete RPC
  - Union merge of server and local campaign state
affects:
  - 05-03 (human verification depends on these changes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Connection sync pattern: connect connection_status_changed signal, call sync on is_online=true"
    - "Merge pattern: union of server arrays with local arrays, save after merge"

key-files:
  created: []
  modified:
    - autoloads/CampaignManager.gd - Added sync, connection handler, difficulty helper

key-decisions:
  - "Used union merge strategy — server state supplements local, never removes progress"
  - "Connected to connection_status_changed signal in _ready() following PlayerStatsManager/StoreManager pattern"
  - "Difficulty tiers map 1->easy, 2->medium, 3->hard with 'normal' fallback"

patterns-established:
  - "Autoload connection sync: connect signal in _ready(), sync on connect, merge with union"

requirements-completed: [PERSIST-03, PERSIST-04]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 05 Plan 02: Client Campaign Sync Summary

**CampaignManager syncs progress from server on connection and sends correct difficulty tier instead of hardcoded "normal"**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T04:08:00Z
- **Completed:** 2026-04-02T04:13:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `sync_campaign_progress()` that fetches from `armored_archer/get_campaign_progress` and merges server state (union strategy)
- Added `_on_connection_status_changed` handler that triggers sync when connection is established
- Connected `connection_status_changed` signal in `_ready()` following existing autoload pattern
- Fixed `_notify_server_stage_complete` to send actual difficulty tier via `_get_difficulty_string()` helper
- Added `_get_difficulty_string()` converting numeric tiers: 1->easy, 2->medium, 3->hard

## Task Commits

1. **Task 1: Add sync_campaign_progress()** - `d74f13d` (feat)
2. **Task 2: Fix difficulty value** - `d74f13d` (feat)

**Plan metadata:** included in task commit

## Files Created/Modified
- `autoloads/CampaignManager.gd` - Added `sync_campaign_progress()`, `_on_connection_status_changed()`, `_get_difficulty_string()`, connected signal in `_ready()`, fixed difficulty in `_notify_server_stage_complete()`

## Decisions Made
- Union merge strategy — server progress supplements local, never removes data. Player won't lose progress from either source.
- Connected signal in `_ready()` following the same pattern used by `PlayerStatsManager.gd` and `StoreManager.gd`
- `_get_difficulty_string()` returns "normal" as fallback for unknown tiers (backward compatible with backend)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## Next Phase Readiness
- All code changes complete for campaign persistence
- Plan 05-03 requires human verification: complete a PvE stage, close game, reopen, verify progress persists

---
*Phase: 05-campaign-persistence*
*Completed: 2026-04-02*
