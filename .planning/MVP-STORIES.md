# MVP Stories: Armored Archer v1.0.0

**Status:** Frozen
**Date:** 2026-04-13
**Sprint:** Sprint 0 — Architecture Decision and Backlog Lock (GitHub #672)

---

## Story Hierarchy

```
MVP Launch
├── EPIC 1: Player Core
│   ├── Story 1.1: Authentication & Profile
│   ├── Story 1.2: Player Stats & Progression
│   └── Story 1.3: Inventory & Loadout
├── EPIC 2: PvE Campaign
│   ├── Story 2.1: Stage System
│   ├── Story 2.2: Combat System (PvE)
│   └── Story 2.3: Loot & Rewards
├── EPIC 3: Async PvP
│   ├── Story 3.1: Matchmaker
│   ├── Story 3.2: Combat System (PvP)
│   └── Story 3.3: Match Results
├── EPIC 4: Seasonal Leaderboards
│   ├── Story 4.1: Season System
│   ├── Story 4.2: Leaderboard
│   └── Story 4.3: Season Rewards
└── EPIC 5: Monetization
    ├── Story 5.1: IAP Integration
    ├── Story 5.2: Gem Currency
    └── Story 5.3: Cosmetic Store
```

---

## EPIC 1: Player Core

### Story 1.1: Authentication & Profile

**Title:** Players can sign up, log in, and manage their profile

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
- Anonymous authentication via device ID (Nakama built-in)
- Profile creation with username selection
- Profile display in UI
- Session management (auto-refresh tokens)

**Acceptance Criteria:**
- [ ] Player can launch game and be automatically authenticated (device ID)
- [ ] Player can set a unique username
- [ ] Player can view their profile (username, level, rank)
- [ ] Session tokens are stored and refreshed automatically
- [ ] Logout functionality works correctly
- [ ] Player data persists across app restarts

**Technical Requirements:**
- Use Nakama built-in authentication
- Store session token locally (encrypted)
- Auto-refresh tokens before expiry
- Validate username uniqueness server-side

**Dependencies:**
- None (can start immediately)

**API Calls:**
- `nk.authenticateDevice`
- `nk.getAccount`
- `nk.updateAccount`

---

### Story 1.2: Player Stats & Progression

**Title:** Players gain XP, level up, and allocate stats

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 5 days

**Description:**
- XP gain from completing stages and winning matches
- Level-up thresholds and ability point grants
- Stat allocation (attack, defense, speed)
- Stat bonuses reflected in combat

**Acceptance Criteria:**
- [ ] XP is awarded correctly for stage completion
- [ ] XP is awarded correctly for PvP wins
- [ ] Level-up triggers at correct XP thresholds
- [ ] Ability points are granted on level-up
- [ ] Stats can be allocated from ability points
- [ ] Stat changes are immediately reflected in gameplay
- [ ] Stats cannot be reallocated once spent (permanent choice)

**Technical Requirements:**
- Server-side XP calculation and validation
- PostgreSQL `player_stats` table with JSONB stats
- Caching layer for frequent stat queries
- Client-side stat manager with local cache

**Dependencies:**
- Story 1.1: Authentication & Profile
- Story 2.1: Stage System (for XP amounts)
- Story 3.3: Match Results (for PvP XP)

**API Calls:**
- `armored_archer/gain_xp`
- `armored_archer/allocate_stats`
- `armored_archer/get_player_stats`

---

### Story 1.3: Inventory & Loadout

**Title:** Players manage gear inventory and equip items

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 5 days

**Description:**
- Gear inventory display
- Equipment loadout management (5 slots)
- Equip/unequip gear
- Stat bonuses from equipped gear applied

**Acceptance Criteria:**
- [ ] Player can view inventory (all owned gear)
- [ ] Player can equip gear to appropriate slots
- [ ] Player can unequip gear from slots
- [ ] Only one item per slot can be equipped
- [ ] Stat bonuses from equipped gear are calculated correctly
- [ ] Gear cannot be equipped if player doesn't own it
- [ ] UI prevents equipping wrong gear types to wrong slots

**Technical Requirements:**
- PostgreSQL `catalog`, `inventory`, `loadout` tables
- Server-side validation of equip actions
- Client-side inventory manager with local cache

**Dependencies:**
- Story 1.2: Player Stats & Progression (for stat calculations)
- Story 2.3: Loot & Rewards (for gear acquisition)

**API Calls:**
- `armored_archer/get_inventory`
- `armored_archer/equip_gear`
- `armored_archer/unequip_gear`

---

## EPIC 2: PvE Campaign

### Story 2.1: Stage System

**Title:** Players progress through stages with increasing difficulty

**Owner:** Game Design Team
**Priority:** P0 (Blocker)
**Estimate:** 4 days

**Description:**
- Linear stage progression (Stage 1 → Stage 2 → ...)
- Stage configuration (enemy types, difficulty, rewards)
- Stage unlock conditions
- Stage selection UI

**Acceptance Criteria:**
- [ ] Stage 1 is available to new players
- [ ] Stages unlock sequentially (must complete previous)
- [ ] Stage difficulty increases appropriately
- [ ] Stage rewards are displayed before playing
- [ ] Stage selection UI shows locked/unlocked status
- [ ] Stage progress persists across sessions

**Technical Requirements:**
- Server-side stage configuration (Nakama storage)
- Stage unlock validation server-side
- Client-side stage selection UI
- Progress storage (Nakama storage)

**Dependencies:**
- Story 1.1: Authentication & Profile

**API Calls:**
- `armored_archer/get_campaign_progress`
- `armored_archer/get_completed_stages`

---

### Story 2.2: Combat System (PvE)

**Title:** Players engage in auto-shooter combat against AI enemies

**Owner:** Game Client Team
**Priority:** P0 (Blocker)
**Estimate:** 10 days

**Description:**
- Auto-shooting combat (player aims, auto-fires)
- Enemy AI behavior (move, attack, retreat)
- Damage calculation (base stats + gear bonuses)
- Hit detection and visual feedback
- Win/lose conditions

**Acceptance Criteria:**
- [ ] Player character aims and auto-shoots at enemies
- [ ] Enemies move and attack the player
- [ ] Damage is calculated correctly (including stat bonuses)
- [ ] Hit detection works reliably (visual + numerical feedback)
- [ ] Player wins when all enemies defeated
- [ ] Player loses when health reaches zero
- [ ] Combat feels responsive (minimal input lag)
- [ ] Combat maintains 60 FPS on minimum spec

**Technical Requirements:**
- Godot 4 Area2D collision detection
- State machine for enemy AI
- Client-side damage calculation (for feedback)
- Server-side validation (for rewards)

**Dependencies:**
- Story 1.2: Player Stats & Progression (for stat bonuses)
- Story 1.3: Inventory & Loadout (for gear bonuses)
- Story 2.1: Stage System (for enemy configuration)

**API Calls:**
- `armored_archer/submit_combat_action` (for logging)
- `armored_archer/get_match_state` (not used in PvE)

---

### Story 2.3: Loot & Rewards

**Title:** Players earn loot and rewards from stage completion

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 5 days

**Description:**
- Random gear drops from stage completion
- Gem rewards
- XP rewards
- Rarity system (common, rare, epic, legendary)

**Acceptance Criteria:**
- [ ] Stage completion triggers loot roll
- [ ] Loot rarity is based on stage difficulty
- [ ] Gear is added to player inventory
- [ ] Gems are awarded correctly
- [ ] XP is awarded correctly
- [ ] Loot results are displayed to player
- [ ] Duplicate gear is not granted

**Technical Requirements:**
- Server-side loot RNG
- PostgreSQL `catalog` with gear definitions
- Rarity weights per stage difficulty
- Inventory validation (no duplicates)

**Dependencies:**
- Story 1.3: Inventory & Loadout (for adding gear)
- Story 1.2: Player Stats & Progression (for awarding XP)
- Story 2.2: Combat System (PvE) (for win condition)

**API Calls:**
- `armored_archer/generate_gear`
- `armored_archer/complete_stage`
- `armored_archer/gain_xp`

---

## EPIC 3: Async PvP

### Story 3.1: Matchmaker

**Title:** Players create and find async PvP matches

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 6 days

**Description:**
- Match creation with difficulty selection
- Match listing for finding opponents
- Match acceptance
- Match queue management

**Acceptance Criteria:**
- [ ] Player can create a new match
- [ ] Player can view available matches
- [ ] Player can accept a match
- [ ] Match creator is notified when accepted
- [ ] Match is removed from listing after acceptance
- [ ] Match queue prevents duplicate listings

**Technical Requirements:**
- Nakama storage for match state
- Redis for match queue (performance)
- Server-side validation of match creation
- Client-side matchmaker UI

**Dependencies:**
- Story 1.1: Authentication & Profile

**API Calls:**
- `armored_archer/list_matches`
- `armored_archer/create_match`
- `armored_archer/accept_match`

---

### Story 3.2: Combat System (PvP)

**Title:** Players submit turn-based combat actions in async matches

**Owner:** Game Client Team
**Priority:** P0 (Blocker)
**Estimate:** 8 days

**Description:**
- Turn-based combat actions (shoot, dodge, special)
- Server-side action validation
- Action queue management
- Combat result display

**Acceptance Criteria:**
- [ ] Player can submit combat actions for current turn
- [ ] Server validates action legality (turn order, cooldowns)
- [ ] Player can view opponent's actions after turn flip
- [ ] Combat actions have visual feedback
- [ ] Match progresses through turns correctly
- [ ] Match ends when conditions met (HP, turn limit)

**Technical Requirements:**
- Server-side turn management
- Action validation (player can only act on their turn)
- Client-side combat UI
- Action queue display

**Dependencies:**
- Story 1.2: Player Stats & Progression (for damage calculation)
- Story 3.1: Matchmaker (for match state)

**API Calls:**
- `armored_archer/submit_combat_action`
- `armored_archer/get_match_state`

---

### Story 3.3: Match Results

**Title:** PvP matches conclude with rank updates

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 4 days

**Description:**
- Match result calculation (win/loss)
- Rank updates based on results
- Match completion
- Result persistence

**Acceptance Criteria:**
- [ ] Match ends when win/loss conditions met
- [ ] Winner receives rank increase
- [ ] Loser receives rank decrease
- [ ] Match is marked as complete
- [ ] Players are notified of match results
- [ ] Match results are viewable post-match

**Technical Requirements:**
- Server-side result calculation
- Nakama leaderboard for rank storage
- Match state transition to complete

**Dependencies:**
- Story 3.2: Combat System (PvP) (for combat completion)
- Story 4.2: Leaderboard (for rank updates)

**API Calls:**
- `armored_archer/complete_match`
- `armored_archer/update_rank`

---

## EPIC 4: Seasonal Leaderboards

### Story 4.1: Season System

**Title:** Game has seasonal cycles with resets

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
- Season configuration (duration, rewards)
- Season countdown display
- Season reset automation
- Season history

**Acceptance Criteria:**
- [ ] Current season info is displayed (name, duration, countdown)
- [ ] Season ends automatically on expiry
- [ ] Season resets leaderboards correctly
- [ ] Season history is accessible
- [ ] Admin can create new seasons manually

**Technical Requirements:**
- Server-side season configuration
- Cron job for season expiry
- Nakama storage for season data

**Dependencies:**
- None (can start immediately)

**API Calls:**
- `armored_archer/get_season_info`

---

### Story 4.2: Leaderboard

**Title:** Players compete on seasonal leaderboards

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 5 days

**Description:**
- Leaderboard display (top 100)
- Player rank display
- Real-time rank updates
- Leaderboard filtering (season, region)

**Acceptance Criteria:**
- [ ] Leaderboard displays top 100 players
- [ ] Player can see their own rank
- [ ] Leaderboard updates in real-time
- [ ] Leaderboard shows season identifier
- [ ] Player can view their position if not in top 100

**Technical Requirements:**
- Nakama leaderboards
- Redis cache for leaderboard queries
- Client-side leaderboard UI

**Dependencies:**
- Story 3.3: Match Results (for rank updates)
- Story 4.1: Season System (for season association)

**API Calls:**
- `armored_archer/get_leaderboard`
- `armored_archer/get_player_rank`

---

### Story 4.3: Season Rewards

**Title:** Players claim seasonal rewards based on rank

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 4 days

**Description:**
- Season reward tiers (based on rank)
- Reward claim UI
- One-time claim per season
- Reward delivery (gems, cosmetics)

**Acceptance Criteria:**
- [ ] Season rewards are displayed before season ends
- [ ] Player can claim rewards based on final rank
- [ ] Rewards are granted correctly (gems, cosmetics)
- [ ] Rewards can only be claimed once per season
- [ ] Claim status persists across sessions
- [ ] Rewards are removed after claim

**Technical Requirements:**
- Server-side reward calculation
- Reward storage (player claims)
- Server-side validation of claim eligibility

**Dependencies:**
- Story 4.1: Season System (for season expiry)
- Story 5.2: Gem Currency (for awarding gems)

**API Calls:**
- `armored_archer/get_season_rewards`
- `armored_archer/claim_season_rewards`

---

## EPIC 5: Monetization

### Story 5.1: IAP Integration

**Title:** Players can purchase in-app items

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 5 days

**Description:**
- RevenueCat SDK integration
- IAP catalog management
- Purchase validation
- Webhook processing

**Acceptance Criteria:**
- [ ] RevenueCat is initialized on app launch
- [ ] IAP catalog is displayed correctly
- [ ] Purchase flow works end-to-end
- [ ] Purchases are validated server-side
- [ ] Webhook processes purchases correctly
- [ ] Fraudulent purchases are rejected

**Technical Requirements:**
- RevenueCat SDK integration (client)
- RevenueCat webhook endpoint (server)
- Server-side purchase validation
- Database for purchase history

**Dependencies:**
- Story 1.1: Authentication & Profile
- RevenueCat account and configuration

**API Calls:**
- `armored_archer/validate_purchase`
- `armored_archer/app_launch_check`
- `armored_archer/revenuecat_webhook`

---

### Story 5.2: Gem Currency

**Title:** Players earn and spend premium currency

**Owner:** Backend Team
**Priority:** P0 (Blocker)
**Estimate:** 3 days

**Description:**
- Gem balance display
- Gem earning (IAP purchase)
- Gem spending (cosmetics, skips)
- Balance persistence

**Acceptance Criteria:**
- [ ] Player can view current gem balance
- [ ] Gem balance updates after IAP purchase
- [ ] Gem balance updates after spending
- [ ] Gem balance persists across sessions
- [ ] Negative gem balance is prevented

**Technical Requirements:**
- Nakama wallet/storage for gem balance
- Server-side balance validation
- Client-side balance display

**Dependencies:**
- Story 5.1: IAP Integration (for earning gems)
- Story 5.3: Cosmetic Store (for spending gems)

**API Calls:**
- `armored_archer/get_currency`
- `armored_archer/spend_gems`

---

### Story 5.3: Cosmetic Store

**Title:** Players purchase non-gameplay-affecting cosmetics

**Owner:** Game Design Team
**Priority:** P0 (Blocker)
**Estimate:** 4 days

**Description:**
- Cosmetic catalog (skins, icons, effects)
- Purchase with gems
- Ownership tracking
- Cosmetic preview

**Acceptance Criteria:**
- [ ] Cosmetic catalog is displayed with prices
- [ ] Player can preview cosmetics before purchase
- [ ] Player can purchase cosmetics with gems
- [ ] Purchased cosmetics are added to inventory
- [ ] Cosmetics cannot be purchased if player owns them
- [ ] Cosmetics do not affect gameplay (stats, damage, etc.)

**Technical Requirements:**
- Server-side cosmetic catalog
- Ownership validation
- Gem deduction on purchase
- Client-side store UI

**Dependencies:**
- Story 5.2: Gem Currency (for spending)

**API Calls:**
- `armored_archer/get_currency` (for balance)
- `armored_archer/spend_gems` (for purchase)

---

## Story Statistics

| Epic | Stories | Total Days | Critical Path |
|-------|----------|-------------|---------------|
| EPIC 1: Player Core | 3 | 13 days | 13 days |
| EPIC 2: PvE Campaign | 3 | 19 days | 19 days |
| EPIC 3: Async PvP | 3 | 18 days | 18 days |
| EPIC 4: Seasonal Leaderboards | 3 | 12 days | 12 days |
| EPIC 5: Monetization | 3 | 12 days | 12 days |
| **TOTAL** | **15** | **74 days** | **74 days (parallelizable)** |

**Critical Path:** EPIC 1 → EPIC 2 → EPIC 3 → EPIC 4 → EPIC 5
**Parallelizable:** EPIC 3 (PvP) and EPIC 5 (Monetization) can overlap with EPIC 2 (PvE)
**Estimated Timeline:** 8-10 weeks (with 1-2 developers)

---

## Acceptance Standards

All stories must meet these standards to be considered "Done":

1. **Functional:** All acceptance criteria pass
2. **Tested:** Unit tests and integration tests exist
3. **Documented:** Code is self-documenting with JSDoc
4. **Code Reviewed:** Changes approved by team
5. **Performance:** Meets MVP metrics (60 FPS, P95 < 200ms)
6. **Monitored:** Metrics and logging in place
7. **Error Handling:** Graceful error messages to user
8. **Edge Cases:** Handled (offline, network failure, etc.)

---

*Last Updated:* 2026-04-13
*Next Review:* Sprint planning (weekly)
