# Campaign Persistence Validation Report

**Issue:** https://github.com/anchapin/armored-archer/issues/700
**Date:** 2026-04-16
**Status:** Complete Analysis

---

## Executive Summary

This report validates campaign persistence across app restarts and reconnects. The analysis covers:
- Local save/load mechanisms (CampaignManager.gd)
- Server synchronization (stage_tracking.ts)
- Potential issues and recommendations

---

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|---------|-------|
| Campaign progress saves correctly | ⚠️ PARTIAL | Saves locally, but async RPC has no error handling |
| Progress persists across app restarts | ✅ PASS | Local persistence to user:// works correctly |
| Progress persists across session reconnects | ⚠️ PARTIAL | Syncs on reconnect, but merge strategy has issues |
| No data loss during persistence | ⚠️ AT RISK | Missing `unlocked_chapters` tracking on server |
| Load times are reasonable | ✅ PASS | Simple JSON operations, no complex data structures |

---

## Implementation Analysis

### Client-side (CampaignManager.gd)

#### Local Persistence
```gdscript
func save_progress() -> void:
    """Saves campaign progress to user://campaign_progress.json."""
    var save_data = {
        "unlocked_chapters": unlocked_chapters,
        "unlocked_stages": unlocked_stages,
        "completed_stages": completed_stages,
        "unlocked_modifier_pools": unlocked_modifier_pools,
        "bosses_defeated": bosses_defeated
    }
```

**Status:** ✅ Working correctly
- Uses `user://` directory for cross-platform persistence
- Saves all 5 data arrays
- Uses standard JSON serialization

#### Load Behavior
```gdscript
func load_progress() -> void:
    """Loads campaign progress from user://campaign_progress.json."""
    # Loads and merges with server on connect
```

**Status:** ✅ Working correctly
- Gracefully handles missing files (returns empty arrays)
- Gracefully handles corrupted JSON (parse_result check)

#### Server Synchronization
```gdscript
func sync_campaign_progress() -> void:
    """Fetches campaign progress from server and merges with local state."""
    # Merges using union (takes max of both)
```

**Status:** ⚠️ Issues identified:
1. Union merge strategy - no conflict resolution
2. No timestamp/version checking for authoritative data
3. Missing `unlocked_chapters` from server response

#### Stage Completion
```gdscript
func _notify_server_stage_complete(stage_id: String, boss_id: String) -> void:
    # Send async RPC to server
    network_manager.send_rpc_async("armored_archer/stage_complete", JSON.stringify(payload), 10.0)
```

**Status:** ⚠️ No error handling:
- Async call with 10s timeout
- No callback for success/failure
- No retry logic
- Player won't know if server sync failed

### Server-side (stage_tracking.ts)

#### Stage Completion
```typescript
export function rpcCompleteStage(
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    payload: string
): string {
    // Validates, processes, stores in Nakama storage
}
```

**Status:** ✅ Server authoritative
- Validates authentication
- Validates payload with Zod
- Uses Nakama storage for persistence

#### Campaign Progress
```typescript
export function rpcGetCampaignProgress(
    ctx: Runtime.Context,
    logger: Runtime.Logger,
    nk: Runtime.Nakama,
    _payload: string
): string {
    // Returns: completed_stages, unlocked_stages, bosses_defeated
    // Missing: unlocked_chapters
}
```

**Status:** ⚠️ Missing data:
- Does NOT return `unlocked_chapters`
- Client-side `unlocked_chapters` will never sync from server

---

## Issues Found

### 1. Missing Server-side `unlocked_chapters` Tracking

**Severity:** HIGH
**Impact:** Players who lose local data or play on multiple devices won't have consistent chapter unlock states.

**Current Behavior:**
- Server tracks: `completed_stages`, `unlocked_stages`, `bosses_defeated`
- Client also tracks: `unlocked_chapters`
- Server doesn't know about chapter unlocks

**Example Scenario:**
1. Player unlocks chapter 2 on device A
2. Chapter unlock saved locally to device A
3. Player logs in on device B
4. Device B fetches campaign progress from server
5. Chapter 2 is NOT unlocked (server doesn't know about it)

**Recommendation:**
```typescript
// server should derive chapter unlocks from completions
// or track them explicitly
function deriveUnlockedChapters(completedStages: string[]): string[] {
    // Chapters unlock when their final stage is completed
    const chapterUnlocks = new Set<string>();
    const chapterFinalStages = {
        "chapter_1": "1_5",
        "chapter_2": "2_5",
        // ...
    };

    for (const stage of completedStages) {
        for (const [chapter, finalStage] of Object.entries(chapterFinalStages)) {
            if (stage === finalStage) {
                chapterUnlocks.add(chapter);
            }
        }
    }

    return Array.from(chapterUnlocks);
}
```

### 2. No Error Handling for Stage Completion RPC

**Severity:** MEDIUM
**Impact:** Players won't know if server sync failed, could lose progress.

**Current Code:**
```gdscript
network_manager.send_rpc_async("armored_archer/stage_complete", JSON.stringify(payload), 10.0)
# No callback, no error handling
```

**Recommendation:**
```gdscript
var rpc_result = await network_manager.send_rpc(
    "armored_archer/stage_complete",
    JSON.stringify(payload)
)

if rpc_result.has("error"):
    push_error("Failed to sync stage completion: " + str(rpc_result.error))
    # Consider retry or local flag for pending sync
```

### 3. Union Merge Strategy Can Cause State Drift

**Severity:** MEDIUM
**Impact:** If server is authoritative (e.g., after rollback), local changes may persist incorrectly.

**Current Behavior:**
```gdscript
# Merges using union (takes max of both)
for stage_id in server_completed:
    if not stage_id in completed_stages:
        completed_stages.append(stage_id)
```

**Issue:** If server removes a stage (e.g., due to rollback/bug fix), client won't remove it.

**Recommendation:**
- Add version/timestamp to save data
- Server should be authoritative for completions
- Only keep local state for offline play, then sync and use server state

### 4. No Retry Logic for Failed Syncs

**Severity:** LOW
**Impact:** Transient network errors could cause sync failures.

**Current:** Single sync attempt on connection change

**Recommendation:**
- Implement exponential backoff retry
- Queue failed syncs for later retry
- Show sync status to player

---

## Test Recommendations

### Required Tests

1. **Local Persistence Tests** ✅ (test/test_campaign_persistence.gd created)
   - Save/load with various data states
   - Handle missing/corrupted files
   - Verify data integrity after multiple saves

2. **Server Sync Tests**
   - Mock server responses and verify merge behavior
   - Test with server having more/less data than client
   - Test with conflicting data

3. **App Restart Simulation**
   - Complete stages, save, create new instance, load, verify
   - Test across all data types

4. **Session Reconnect Tests**
   - Complete stages offline, then reconnect, verify sync
   - Test with partial offline progress

5. **Edge Cases**
   - Empty arrays
   - Large data sets
   - Concurrent saves
   - Duplicate completions

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|-------|------------|---------|------------|
| Lost chapter unlocks on new device | HIGH | HIGH | Add server-side chapter tracking |
| Stage completion not synced | MEDIUM | MEDIUM | Add error handling and retry |
| State drift from union merge | LOW | MEDIUM | Add versioning, make server authoritative |
| Corrupted save file | LOW | MEDIUM | Add backup/restore mechanism |

---

## Recommendations Priority

### P0 (Critical)
1. Add server-side `unlocked_chapters` tracking
2. Add error handling to stage completion RPC

### P1 (High)
3. Add retry logic for failed syncs
4. Add versioning/timestamps to save data
5. Make server authoritative for completions

### P2 (Medium)
6. Add backup/restore for corrupted saves
7. Add sync status indicator to UI
8. Add manual "sync now" button

---

## Conclusion

The campaign persistence system has a solid foundation with local save/load working correctly. However, there are critical gaps in server synchronization:

1. **Missing `unlocked_chapters` on server** - This is the biggest issue that will cause data loss for players switching devices.

2. **No error handling for async RPC** - Players could lose progress without knowing it.

3. **Union merge strategy** - Can lead to state inconsistencies.

The system is functional for single-device play but needs improvements for cross-device reliability and data loss prevention.

---

## Acceptance Criteria Final Assessment

| Criterion | Pass/Fail | Reason |
|-----------|-----------|--------|
| Campaign progress saves correctly | ⚠️ PASS | Local save works, server sync needs error handling |
| Progress persists across app restarts | ✅ PASS | Local persistence works correctly |
| Progress persists across session reconnects | ⚠️ FAIL | `unlocked_chapters` not synced from server |
| No data loss during persistence | ⚠️ FAIL | Missing `unlocked_chapters` tracking causes potential loss |
| Load times are reasonable | ✅ PASS | Simple JSON operations, no complex data |

**Overall:** 2/5 criteria fully passing, 3/5 have issues that need addressing.

---

## Implementation Checklist for Fixes

- [ ] Add server-side chapter unlock derivation
- [ ] Update `rpcGetCampaignProgress` to return `unlocked_chapters`
- [ ] Add error handling to `_notify_server_stage_complete`
- [ ] Add retry logic for failed syncs
- [ ] Add version/timestamp to save data
- [ ] Add comprehensive tests for server sync scenarios
- [ ] Add backup/restore for corrupted saves
- [ ] Add sync status indicator to UI
