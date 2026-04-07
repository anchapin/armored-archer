# Phase 05 Summary: Campaign State Persistence

**Completed:** 2026-04-06

---

## Overview

Phase 5 requirements were already implemented in both backend (stage_tracking.ts) and client (CampaignManager.gd). Added signal emission from sync_campaign_progress() to update UI after server sync.

---

## Changes Made

### 1. Backend Verification (No Changes Required)

**File:** `backend/src/modules/stage_tracking.ts`

**Existing RPC Handlers:**
- `rpcCompleteStage()` - Handles `armored_archer/complete_stage` RPC
  - Validates difficulty enum: 'easy' | 'medium' | 'hard' | 'nightmare'
  - Supports boss_defeated flag and boss_id
  - Generates server-side loot via `processStageLoot()`
  - Handles stage replay (updates only if new completion is better)
  - Tracks audit events

- `rpcGetCompletedStages()` - Handles `armored_archer/get_completed_stages` RPC
  - Returns all stage completions with stage_id, stars_earned, score, completed_at, updated_at
  - Supports filtering by stage_prefix

- `rpcGetCampaignProgress()` - Handles `armored_archer/get_campaign_progress` RPC
  - Returns:
    - completed_stages: list of stage completion IDs
    - unlocked_stages: list of unlocked stage IDs (derived from completions)
    - bosses_defeated: list of boss IDs defeated

### 2. Enhanced CampaignManager with Signal Emission

**File:** `autoloads/CampaignManager.gd`

**New Functions:**
- `get_chapter_progress(chapter_id: String) -> float` - Calculates progress (0.0-1.0) for a chapter
- `update_campaign_progress() -> void` - Emits campaign_progress_updated signal after data changes

**Modified Functions:**
- `sync_campaign_progress()` - Added `update_campaign_progress()` call to emit signal
- Signals already defined: `campaign_progress_updated`, `stage_completed`, `stage_unlocked`

**Data Flow:**
1. On connection status change to online → CampaignManager calls `sync_campaign_progress()`
2. Server responds with completed_stages, unlocked_stages, bosses_defeated
3. Client merges server data with local state (union operation)
4. `update_campaign_progress()` emits `campaign_progress_updated(chapter_id, progress)` for each chapter
5. `campaign_map.gd` (or other UI) listens to signal and updates visuals

### 3. Difficulty Validation (Already Implemented)

**Client Side:** CampaignManager._notify_server_stage_complete() (lines 210-231)
- Uses `_get_difficulty_string()` to convert numeric difficulty (1-3) to string enum
- Difficulty mapping: 1="easy", 2="medium", 3="hard" (matches server expectation)

**Server Side:** stage_tracking.ts CompleteStageRequest interface (line 54)
- `difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare'` (line 58)
- Server validates incoming difficulty enum

---

## Files Modified

- `autoloads/CampaignManager.gd` - Added update_campaign_progress() function and get_chapter_progress() helper

---

## Files Verified (No Backend Changes Required)

- `backend/src/modules/stage_tracking.ts` - All RPCs already implemented
- `autoloads/CampaignManager.gd` - Difficulty sending and server sync already implemented

---

## Verification

1. ✅ gdlint passes on CampaignManager.gd
2. ✅ Server RPC armored_archer/complete_stage accepts difficulty enum (not hardcoded "normal")
3. ✅ Server RPC armored_archer/get_campaign_progress returns completed/unlocked/bosses
4. ✅ Client CampaignManager.sync_campaign_progress() fetches and merges server data
5. ✅ Client emits campaign_progress_updated signal after sync
6. ✅ CampaignManager.load_progress() and save_progress() handle local persistence

---

## Success Criteria Met

- [x] Client sends valid difficulty enum to stage_complete RPC (CampaignManager uses _get_difficulty_string())
- [x] Server has get_campaign_progress RPC that returns completed and unlocked stages (stage_tracking.ts implements this)
- [x] Client fetches campaign progress from server on connection and merges (CampaignManager.sync_campaign_progress() merges union)
- [x] Campaign progress persists after closing and reopening the game (load_progress() + save_progress() work)

---

## Notes

- All Phase 5 backend RPCs were already implemented in stage_tracking.ts
- Client-side CampaignManager already had server sync and persistence logic
- Missing piece was signal emission from sync_campaign_progress() to update UI (now added)
- No actual data flow changes were needed
