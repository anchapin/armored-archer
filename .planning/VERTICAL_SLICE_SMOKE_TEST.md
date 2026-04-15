# Vertical Slice Smoke Test Checklist

**Issue:** #679 - Sprint 1 — Vertical Slice Foundation
**Purpose:** Validates the complete end-to-end vertical slice flow from account creation → PvE stage completion → loot drop → equipment equip.
**Definition of Done:** A tester can complete one PvE run, receive loot, and equip it without admin intervention.

---

## Automated Smoke Test

### Backend RPC Validation

The backend smoke test validates all RPCs required for the vertical slice:

```bash
# Run backend smoke tests
cd backend
npm run test:integration -- --testPathPattern="smoke"
```

**Test Coverage:**
- ✅ `armored_archer/get_player_stats` - Player account initialization
- ✅ `armored_archer/gain_xp` - XP gain and level-up
- ✅ `armored_archer/allocate_stats` - Stat allocation
- ✅ `armored_archer/generate_gear` - Loot generation
- ✅ `armored_archer/equip_gear` - Gear equipping
- ✅ `armored_archer/unequip_gear` - Gear unequipping
- ✅ `armored_archer/get_inventory` - Inventory retrieval
- ✅ `armored_archer/stage_complete` - Stage completion tracking

**File:** `backend/tests/integration/vertical_slice_smoke.test.ts`

### Godot E2E Test Scene

Run the Godot end-to-end test:

```bash
# Run in headless mode (recommended for CI)
godot --headless --script res://test/e2e_vertical_slice.gd

# Or open in editor for interactive testing
# Open res://test/e2e_vertical_slice_test.tscn in Godot Editor
```

**Test Flow:**
1. ✅ Authenticate with device ID
2. ✅ Load initial player stats (level 1, base stats)
3. ✅ Load stage 1 configuration
4. ✅ Simulate PvE combat against enemy
5. ✅ Call stage_complete RPC
6. ✅ Verify loot received in response
7. ✅ Call get_inventory RPC
8. ✅ Verify gear in inventory
9. ✅ Call equip_gear RPC
10. ✅ Verify gear equipped in loadout

**File:** `test/e2e_vertical_slice.gd`

---

## Manual Testing Checklist

### Prerequisites

Before testing, verify:
- [ ] Nakama server is running (`make backend-start`)
- [ ] Server is accessible at http://localhost:7350
- [ ] Database migrations have been run (`make backend-migrate`)
- [ ] Godot project is opened in Godot 4.6.1 Editor
- [ ] No previous session data exists (clear `user://session_data.json` for fresh test)

### Step 1: Account Bootstrap & Session Management (VS-1)

**Objective:** New players can authenticate and initialize their account

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Device authentication | 1. Launch game (press F5)<br>2. Observe NetworkManager logs | Session created with device ID, no authentication errors | ☐ |
| Session persistence | 1. Close and relaunch game<br>2. Observe NetworkManager logs | Session restored from local storage, no re-auth required | ☐ |
| Initial stats | 1. Press F1 to open debug<br>2. Check PlayerStatsManager | Player has level 1, 0 XP, base stats (ATK=10, DEF=10, etc.) | ☐ |
| Logout functionality | 1. Click logout (if available)<br>2. Check session file | Session cleared from storage | ☐ |

**RPCs Validated:**
- [ ] `Nakama.authenticate_device()` - Device-based auth works
- [ ] Session token stored locally
- [ ] Refresh token available
- [ ] Auto-refresh before expiry

---

### Step 2: PvE Stage Configuration (VS-2)

**Objective:** One PvE stage and boss encounter is configured and loadable

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Stage data loading | 1. Navigate to Campaign Map<br>2. Check console for stage loading | Stage 1 unlocked, data loaded from `res://data/campaigns.json` | ☐ |
| Stage selection | 1. Click Stage 1 on campaign map | Stage loads in game scene | ☐ |
| Enemy configuration | 1. Start Stage 1<br>2. Check enemy spawner | Enemy spawns with correct stats (health, attack, defense) | ☐ |
| Boss encounter | 1. Navigate to a boss stage (e.g., Stage 1_5)<br>2. Observe boss spawn | Boss entity spawns with boss-specific stats and AI | ☐ |

**RPCs Validated:**
- [ ] Stage data loads correctly from `campaigns.json`
- [ ] Enemy data applied to spawned entities
- [ ] Stage completion condition exists (defeat all enemies/boss)

---

### Step 3: Combat System - PvE Flow (VS-3)

**Objective:** Players can engage in auto-shooter combat against enemies

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Auto-aim | 1. Start Stage 1<br>2. Enemy spawns<br>3. Observe aim indicator | Auto-aim indicator shows nearest enemy | ☐ |
| Auto-fire | 1. Move joystick/character<br>2. Auto-aim locks target<br>3. Observe projectile firing | Character auto-fires at locked target | ☐ |
| Hit detection | 1. Arrow hits enemy<br>2. Check for damage numbers | Damage numbers appear, enemy health decreases | ☐ |
| Enemy AI | 1. Observe enemy behavior | Enemy moves toward player, attacks when in range | ☐ |
| Player damage | 1. Enemy attacks player<br>2. Check player health bar | Player health decreases, damage numbers appear | ☐ |
| Win condition | 1. Defeat all enemies<br>2. Check game state | "Victory!" message, stage completion triggered | ☐ |
| Lose condition | 1. Let enemy defeat player<br>2. Check game state | "Defeat" message, return to menu | ☐ |
| Boss attack pattern | 1. Fight a boss<br>2. Observe boss attacks | Boss uses special attack pattern (projectile/melee) | ☐ |

**RPCs Validated:**
- [ ] `AutoAimManager` selects nearest target
- [ ] `ShootingManager` auto-fires with cooldown
- [ ] Area2D collision for hit detection works
- [ ] Enemy AI state machine (chase → attack → retreat)
- [ ] Win/lose state management

---

### Step 4: Server-Side Loot Generation (VS-4)

**Objective:** Stage completion triggers loot generation and persistence

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Stage completion RPC | 1. Defeat Stage 1<br>2. Check NetworkManager logs | `armored_archer/stage_complete` RPC called | ☐ |
| Loot generation | 1. Check RPC response | Response contains gear item with name, rarity, stats | ☐ |
| Inventory persistence | 1. Check backend database | Gear persisted to `inventory` table for player | ☐ |
| Loot display | 1. After stage complete<br>2. Observe UI | Loot screen shows gear name, rarity color, stats | ☐ |

**RPCs Validated:**
- [ ] `armored_archer/stage_complete` - Validates stage completion
- [ ] Loot RNG with rarity weights (common 60%, rare 25%, epic 10%, legendary 5%)
- [ ] Gear stat generation with base × rarity multiplier
- [ ] Inventory persistence in PostgreSQL
- [ ] Duplicate prevention (can't own same gear twice)

**Expected Loot Response:**
```json
{
  "success": true,
  "xp_gained": 100,
  "level_up": false,
  "gear_dropped": {
    "id": "gear_abc123",
    "name": "Rustic Bow",
    "rarity": "common",
    "type": "bow",
    "stats": [
      { "name": "attack", "base_value": 10, "value": 10 }
    ],
    "level": 1
  }
}
```

---

### Step 5: Inventory Display & Loadout Management (VS-5)

**Objective:** Players can view inventory and equip gear

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Get inventory RPC | 1. Navigate to Loadout screen<br>2. Check NetworkManager logs | `armored_archer/get_inventory` RPC called | ☐ |
| Inventory display | 1. Open Loadout screen | Shows all owned gear with name, rarity, stats | ☐ |
| Equip gear | 1. Click on gear item<br>2. Click equip button | `armored_archer/equip_gear` RPC called | ☐ |
| Equipped slot update | 1. Check loadout UI after equip | Gear appears in correct equipment slot | ☐ |
| Unequip gear | 1. Click equipped gear<br>2. Click unequip button | `armored_archer/unequip_gear` RPC called | ☐ |
| Slot cleared after unequip | 1. Check loadout UI after unequip | Slot is empty, gear back in inventory | ☐ |
| Stat bonus calculation | 1. Equip gear with +ATK<br>2. Check PlayerStatsManager | Total stats reflect base + gear bonus | ☐ |
| Loadout persistence | 1. Equip gear, restart game<br>2. Check loadout screen | Gear remains equipped across restarts | ☐ |

**RPCs Validated:**
- [ ] `armored_archer/get_inventory` - Returns owned gear + equipped loadout
- [ ] `armored_archer/equip_gear` - Validates slot, updates loadout
- [ ] `armored_archer/unequip_gear` - Clears slot, validates ownership
- [ ] `PlayerStatsManager` - Calculates stat bonuses from gear

**Expected Loadout Response:**
```json
{
  "success": true,
  "inventory": [
    { "id": "gear_abc123", "name": "Rustic Bow", "rarity": "common", ... }
  ],
  "loadout": {
    "helm": "gear_xyz789",
    "armor": null,
    "bow": "gear_abc123",
    "arrow": null,
    "amulet": null
  }
}
```

---

### Step 6: Stat Allocation System (VS-6) - Stretch

**Objective:** Players can allocate ability points to stats

| Test | Steps | Expected Result | Pass/Fail |
|-------|--------|-----------------|-------------|
| Level-up grants AP | 1. Gain enough XP to level up<br>2. Check UI | Ability points available display shows +1 or more | ☐ |
| Allocate stat | 1. Click +ATK button<br>2. Check stats | ATK increases by 1, AP decreases by 1 | ☐ |
| Server validation | 1. Check NetworkManager logs | `armored_archer/allocate_stats` RPC called | ☐ |
| Immediate effect | 1. Allocate stat<br>2. Check combat | New stat value applied to damage calculations | ☐ |
| Persistence | 1. Allocate stats, restart<br>2. Check stats | Allocated stats persist across restarts | ☐ |

**RPCs Validated:**
- [ ] `armored_archer/allocate_stats` - Validates player owns points
- [ ] XP system grants AP on level-up
- [ ] Stat bonus applied to combat calculations

---

## Full End-to-End Test Scenario

### Complete User Flow

**Scenario:** A new player installs the game and completes their first PvE run with gear acquisition.

| Step | Action | Expected Observation | Pass/Fail |
|-------|----------|---------------------|-------------|
| 1 | Fresh install, launch game | Device ID generated, session created automatically | ☐ |
| 2 | Navigate from main menu to campaign | Campaign map loads, Stage 1 unlocked | ☐ |
| 3 | Start Stage 1 | Stage loads, enemy spawns with health bar visible | ☐ |
| 4 | Defeat all enemies (auto-shooter) | Arrows auto-fire, enemies die with damage numbers | ☐ |
| 5 | Stage completion | "Victory!" message, loot reward screen appears | ☐ |
| 6 | Claim loot | Gear added to inventory, name shown (e.g., "Rustic Bow") | ☐ |
| 7 | Navigate to Loadout screen | Inventory shows newly acquired gear | ☐ |
| 8 | Equip new gear | Gear moves to bow slot, stats display updated | ☐ |
| 9 | Return to Stage 2 | New stage unlocked (Stage 1_2) | ☐ |
| 10 | Restart app | Loadout persists, player stats preserved | ☐ |

**Success Criteria:** All 10 steps complete without errors or manual intervention.

---

## Common Issues & Troubleshooting

### Authentication Failures

| Symptom | Cause | Fix |
|----------|--------|-----|
| "No internet connection" error | Nakama not running | `make backend-start` |
| "Authentication failed (401)" | Wrong server key | Check `.env` has `NAKAMA_SERVER_KEY=defaultkey` |

### Stage Loading Failures

| Symptom | Cause | Fix |
|----------|--------|-----|
| Stage data empty | `campaigns.json` missing | Verify `res://data/campaigns.json` exists |
| Enemies don't spawn | Scene tree issue | Check enemy spawner is child of stage scene |

### Combat Issues

| Symptom | Cause | Fix |
|----------|--------|-----|
| Arrows don't fire | ShootingManager not initialized | Verify ShootingManager autoload exists |
| Damage not dealt | Collision layer issue | Check enemy Area2D collision layer mask |

### Loot Not Received

| Symptom | Cause | Fix |
|----------|--------|-----|
| No gear in RPC response | RNG rolled "no drop" | Try multiple stage completions (60% drop chance) |
| Gear not in inventory | DB write failed | Check PostgreSQL logs, verify `inventory` table |

---

## Sign-off

**Tester:** ______________________

**Date:** ______________________

**Automated Tests:** ☐ Pass / ☐ Fail

**Manual E2E Test:** ☐ Pass / ☐ Fail

**Comments:** ______________________

---

*Last Updated: 2026-04-15*
*Related: #679 (Sprint 1 Vertical Slice Foundation), VERTICAL_SLICE_STORIES.md*
