# Vertical Slice Stories: Sprint 1 - Foundation

**Status:** Ready for Sprint 1 Planning
**Date:** 2026-04-15
**Sprint:** Sprint 1 — Vertical Slice Foundation (GitHub #679)
**Issue:** #676 - Break vertical slice into owned stories

---

## Vertical Slice Goal

A tester can complete one PvE run, receive loot, and equip it without admin intervention.

**Definition of Done:** End-to-end flow from account creation → PvE stage completion → loot drop → equipment equip.

---

## Story Breakdown

### Story VS-1: Account Bootstrap & Session Management

**Title:** New players can authenticate and initialize their account

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 2 days

**Description:**
Implement the foundation of player identity using Nakama's device-based authentication. This is the entry point for all gameplay.

**Acceptance Criteria:**
- [ ] New players are automatically authenticated via device ID on first launch
- [ ] Player account is created with default stats (level 1, 0 XP, base stats)
- [ ] Session token is stored locally and auto-refreshed before expiry
- [ ] Account persists across app restarts
- [ ] Logout functionality works and clears local session
- [ ] Player can set a unique username (validated server-side)

**Technical Tasks:**
1. Implement `NetworkManager.authenticate_device()` RPC
2. Create `PlayerStatsManager` autoload with default initialization
3. Add session persistence using OS secure storage
4. Implement token refresh logic in NetworkManager
5. Create profile setup UI for username selection

**Dependencies:**
- None (can start immediately)

**Blocked By:** None

**Blocks:** VS-2, VS-3, VS-4, VS-5

---

### Story VS-2: PvE Stage Configuration & Load

**Title:** One PvE stage and boss encounter is configured and loadable

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
Create the data model and configuration for a single playable stage with a boss encounter. This establishes the PvE content structure.

**Acceptance Criteria:**
- [ ] Stage 1 configuration exists in Nakama storage (enemies, waves, boss)
- [ ] Stage is unlocked for new players
- [ ] Client can fetch stage data via RPC
- [ ] Stage loads successfully in-game scene
- [ ] Boss entity spawns with correct stats and AI
- [ ] Stage completion condition exists (defeat boss)

**Technical Tasks:**
1. Define stage schema (enemy waves, boss stats, rewards)
2. Implement `get_stage_config` RPC
3. Create Stage 1 configuration (1 wave + 1 boss)
4. Implement stage unlock validation in backend
5. Create stage scene structure in Godot
6. Load enemies and boss from configuration

**Dependencies:**
- VS-1 (requires authenticated player)

**Blocked By:** VS-1

**Blocks:** VS-3, VS-4

---

### Story VS-3: Combat System - PvE Flow

**Title:** Players can engage in auto-shooter combat against enemies

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 4 days

**Description:**
Implement the core PvE combat loop with auto-shooting mechanics. Player aims, character auto-fires, enemies respond.

**Acceptance Criteria:**
- [ ] Player character auto-aims at nearest enemy
- [ ] Auto-fire mechanism works with player controlling aim
- [ ] Projectiles deal damage to enemies
- [ ] Enemy AI moves toward player and attacks
- [ ] Hit detection provides visual feedback (damage numbers)
- [ ] Player health decreases when hit
- [ ] Boss has distinct attack pattern (projectile or melee)
- [ ] Win condition triggers when boss HP reaches 0
- [ ] Lose condition triggers when player HP reaches 0

**Technical Tasks:**
1. Implement `AutoAimManager` for nearest-target selection
2. Create auto-fire mechanism with cooldown
3. Implement Area2D collision for hit detection
3. Add floating damage number UI
4. Create basic enemy AI state machine (chase → attack → retreat)
5. Implement boss special attack pattern
6. Add win/lose state management

**Dependencies:**
- VS-1 (requires player stats)
- VS-2 (requires stage/enemy configuration)

**Blocked By:** VS-1, VS-2

**Blocks:** VS-4

---

### Story VS-4: Server-Side Loot Generation & Persistence

**Title:** Stage completion triggers loot generation and persistence

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
Implement the reward pipeline where server generates gear drops, persists to inventory, and notifies client.

**Acceptance Criteria:**
- [ ] Client sends `complete_stage` RPC with stage ID
- [ ] Server validates stage was actually completed
- [ ] Server rolls for gear drop based on stage configuration
- [ ] Gear is generated with random stats based on rarity
- [ ] Gear is persisted to player's inventory
- [ ] Client receives gear details in RPC response
- [ ] Loot results are displayed to player (gear name, rarity, stats)

**Technical Tasks:**
1. Implement `complete_stage` RPC with validation
2. Create loot RNG system with rarity weights
3. Implement gear stat generation formulas
4. Add inventory persistence in PostgreSQL
5. Create loot display UI component
6. Implement duplicate prevention (can't own same gear twice)

**Dependencies:**
- VS-3 (requires stage completion event)

**Blocked By:** VS-3

**Blocks:** VS-5

---

### Story VS-5: Inventory Display & Loadout Management

**Title:** Players can view inventory and equip gear

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
Create the inventory and loadout UI so players can manage their equipment and see stat bonuses.

**Acceptance Criteria:**
- [ ] Player can view all owned gear in inventory UI
- [ ] Gear is displayed with name, rarity, and stats
- [ ] Player can equip gear to appropriate slots (5 slots)
- [ ] Player can unequip gear from slots
- [ ] Only one item per slot allowed
- [ ] Stat bonuses from equipped gear are calculated
- [ ] Total stats (base + gear) are displayed
- [ ] Loadout changes persist to server

**Technical Tasks:**
1. Implement `get_inventory` RPC
2. Implement `equip_gear` RPC with validation
3. Implement `unequip_gear` RPC
4. Create inventory UI scene with grid/list view
5. Create loadout UI scene with 5 equipment slots
6. Implement stat bonus calculation in PlayerStatsManager
7. Add drag-and-drop equip/unequip functionality
8. Persist loadout changes to Nakama storage

**Dependencies:**
- VS-4 (requires gear in inventory)
- VS-1 (requires player stats)

**Blocked By:** VS-1, VS-4

**Blocks:** None (end of flow)

---

### Story VS-6: Stat Allocation System

**Title:** Players can allocate ability points to stats

**Owner:** @anchapin
**Priority:** P1 (Stretch)
**Estimate:** 2 days

**Description:**
Allow players to spend ability points earned from leveling up to boost their base stats.

**Acceptance Criteria:**
- [ ] Level-up grants ability points
- [ ] Player can view available ability points
- [ ] Player can allocate points to Attack, Defense, or Speed
- [ ] Allocated stats are immediately reflected in combat
- [ ] Stat allocation persists to server
- [ ] Points cannot be reallocated once spent

**Technical Tasks:**
1. Implement `allocate_stats` RPC
2. Add ability point tracking to PlayerStatsManager
3. Create stat allocation UI
4. Implement stat bonus application in combat calculations
5. Validate server-side that player owns points to spend

**Dependencies:**
- VS-1 (requires player stats)
- VS-3 (requires combat to use stats)

**Blocked By:** VS-1, VS-3

**Blocks:** None

---

### Story VS-7: End-to-End Smoke Test

**Title:** Automated validation of vertical slice flow

**Owner:** @anchapin
**Priority:** P0 (Blocker)
**Estimate:** 2 days

**Description:**
Create a script or manual checklist to validate the complete vertical slice works end-to-end.

**Acceptance Criteria:**
- [ ] Automated test script can run locally
- [ ] Script tests: auth → load stage → complete stage → receive loot → equip gear
- [ ] All validation points pass
- [ ] Test results are logged/recorded
- [ ] Manual checklist exists for human testing
- [ ] Checklist covers all vertical slice stories
- [ ] Test can be run before code commits

**Technical Tasks:**
1. Create smoke test script (Godot headless or backend test)
2. Implement test steps matching user flow
3. Add validation assertions at each step
4. Create markdown manual checklist
5. Integrate smoke test into CI/CD pipeline

**Dependencies:**
- VS-1 through VS-5 (all core stories must be complete)

**Blocked By:** VS-1, VS-2, VS-3, VS-4, VS-5

**Blocks:** None

---

## Story Statistics

| Story ID | Owner | Priority | Estimate | Dependencies | Blocks |
|----------|-------|----------|-----------|--------------|--------|
| VS-1 | @anchapin | P0 | 2 days | None | VS-2, VS-3, VS-4, VS-5 |
| VS-2 | @anchapin | P0 | 3 days | VS-1 | VS-3, VS-4 |
| VS-3 | @anchapin | P0 | 4 days | VS-1, VS-2 | VS-4 |
| VS-4 | @anchapin | P0 | 3 days | VS-3 | VS-5 |
| VS-5 | @anchapin | P0 | 3 days | VS-1, VS-4 | None |
| VS-6 | @anchapin | P1 | 2 days | VS-1, VS-3 | None |
| VS-7 | @anchapin | P0 | 2 days | VS-1, VS-2, VS-3, VS-4, VS-5 | None |
| **P0 Total** | - | - | **17 days** | - | - |
| **P1 Total** | - | - | **2 days** | - | - |
| **TOTAL** | - | - | **19 days** | - | - |

---

## Critical Path

The critical path for Sprint 1 is:

```
VS-1 (2d) → VS-2 (3d) → VS-3 (4d) → VS-4 (3d) → VS-5 (3d) → VS-7 (2d)
```

Total critical path: **17 days** (P0 stories)

**Note:** VS-6 (Stat Allocation) is a stretch item and can be worked in parallel or deferred to Sprint 2 if needed.

---

## Sprint Timeline (2 Weeks = 10 Working Days)

**Reality Check:** The vertical slice requires 17 days of P0 work on the critical path. This exceeds the 2-week sprint budget.

### Options for Sprint 1:

**Option A: Reduce Scope** (Recommended for 2-week sprint)
- Cut VS-6 (Stat Allocation) - move to Sprint 2
- Simplify VS-2 to 1 stage without boss (just enemies) - move boss to Sprint 2
- Combine VS-4 and VS-5 testing

**Adjusted Estimate:** ~12 days (still tight but achievable with crunch or sprint extension)

**Option B: Extend Sprint**
- Extend Sprint 1 to 3 weeks to accommodate full scope

**Option C: Parallel Development**
- Add a second developer to work on non-critical-path items in parallel

### Recommendation

**Proceed with Option A (Reduced Scope) for Sprint 1:**

1. **MVP for Sprint 1:**
   - Account bootstrap (VS-1)
   - Single PvE stage with enemies only (no boss) (VS-2 simplified)
   - Combat flow (VS-3)
   - Loot generation (VS-4)
   - Inventory display + basic equip (VS-5 simplified - no full loadout UI, just equip from loot)

2. **Move to Sprint 2:**
   - Boss encounter (VS-2 full)
   - Full loadout UI (VS-5 full)
   - Stat allocation (VS-6)
   - Enhanced smoke test coverage

---

## Dependencies Graph

```
     VS-1 (Auth)
      /    |    \
     /     |     \
  VS-2   VS-3   VS-5
   |      |      |
   +---> VS-4 <---+
          |
       VS-7 (Test)

VS-6 (Stat Allocation) - Parallel with VS-3/VS-4
```

---

## RPCs Required

| RPC | Story | Status |
|-----|-------|--------|
| `authenticate_device` | VS-1 | To Implement |
| `update_account` | VS-1 | To Implement |
| `get_stage_config` | VS-2 | To Implement |
| `complete_stage` | VS-4 | To Implement |
| `get_inventory` | VS-5 | To Implement |
| `equip_gear` | VS-5 | To Implement |
| `unequip_gear` | VS-5 | To Implement |
| `allocate_stats` | VS-6 | To Implement |
| `get_player_stats` | VS-1, VS-6 | To Implement |

---

## Acceptance Standards

All stories must meet these standards to be considered "Done":

1. **Functional:** All acceptance criteria pass
2. **Tested:** Unit tests exist for server logic
3. **Documented:** Code is self-documenting with JSDoc/GDScript comments
4. **Error Handling:** Graceful error messages to user
5. **Performance:** Combat maintains 60 FPS on minimum spec
6. **Code Review:** Changes approved by owner

---

## Sign-off

**Product Owner:** ____________________  Date: _______

**Tech Lead:** ____________________  Date: _______

---

*Created:* 2026-04-15
*Next Review:* Sprint 1 planning (immediate)
