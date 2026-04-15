# MVP Scope: Armored Archer v1.0.0

**Status:** Frozen
**Date:** 2026-04-15
**Sprint:** Sprint 0 — Architecture Decision and Backlog Lock (GitHub #672)
**Issue:** #675 - Freeze MVP scope around core features

---

## Definition of Done

There is **one backend of record**, **one deployment path**, and **one approved MVP backlog**.

---

## MVP Core Value Proposition

**Players can enjoy a polished, responsive archery game with reliable PvE progression, async PvP combat, seasonal leaderboards, and cosmetic customization.**

### What MVP Includes (The Core Loop)

1. **PvE Progression:** Auto-shooter combat with stage-based campaign
2. **Async PvP:** Turn-based asynchronous matches against other players
3. **Seasonal Rank:** Leaderboards with seasonal reset and rewards
4. **Cosmetic Monetization:** Non-pay-to-win cosmetic items only

### What MVP Excludes (Out of Scope)

| Feature | Reason | When to Add |
|---------|---------|--------------|
| Subscriptions | Adds complexity, not needed for MVP | Post-MVP (v1.1.0) |
| Push notifications | Not core to gameplay, can be added later | Post-MVP (v1.1.0) |
| Guilds/clans | Major feature, adds significant complexity | Post-MVP (v1.2.0) |
| Real-time PvP | Async PvP is core feature; real-time adds technical complexity | Post-MVP (v1.2.0) |
| Trading | Not core to core loop, adds anti-cheat complexity | Post-MVP (v1.2.0) |
| Player reporting | Important but not blocking for launch | Post-MVP (v1.1.0) |
| Analytics dashboard | Basic logging sufficient for MVP | Post-MVP (v1.1.0) |

---

## MVP Feature Breakdown

### 1. PvE Progression System

**Description:** Auto-shooter combat where the player controls aim positioning while the character auto-shoots. Players progress through stages, earn loot, and level up.

**Core Mechanics:**
- Stage-based campaign (linear progression)
- Auto-shooting combat (player aims, auto-fires)
- Stage rewards (XP, gear drops, gems)
- Level-up system with stat allocation
- Enemy scaling across stages

**Required RPCs:** `gain_xp`, `allocate_stats`, `get_player_stats`, `complete_stage`, `get_campaign_progress`, `get_completed_stages`

**Acceptance Criteria:**
- [ ] Player can complete stage 1 with tutorial
- [ ] XP is awarded on stage completion
- [ ] Level-up grants ability points
- [ ] Stats can be allocated immediately after earning points
- [ ] Stage progression is persistent (survives app restart)
- [ ] Enemies scale appropriately (not too hard/easy)

**Dependencies:**
- Combat system (client-side auto-aim)
- Stage configuration (backend)
- Player stats storage
- Loot drop system

---

### 2. Async PvP System

**Description:** Asynchronous turn-based matches where players take turns submitting combat actions. Results are calculated server-side and persisted.

**Core Mechanics:**
- Match creation with difficulty selection
- Match acceptance by opponent
- Turn-based combat actions (shoot, dodge, special)
- Server-side combat calculation
- Match result storage and retrieval

**Required RPCs:** `list_matches`, `create_match`, `accept_match`, `get_player_rank`, `complete_match`, `submit_combat_action`, `get_match_state`

**Acceptance Criteria:**
- [ ] Player can create a match
- [ ] Other players can see and accept the match
- [ ] Combat actions are submitted and validated server-side
- [ ] Match state is retrievable at any time
- [ ] Match results are correctly calculated and stored
- [ ] Player rank updates after match completion

**Dependencies:**
- Matchmaker system
- Combat calculation (server-side)
- Match state storage
- Leaderboard system

---

### 3. Seasonal Leaderboard System

**Description:** Ranked gameplay with seasonal resets. Players compete for season rewards and recognition.

**Core Mechanics:**
- Season duration (e.g., 30 days)
- Season-specific leaderboards
- Rank calculation based on match results
- Season rewards based on rank
- Season reset and rollover

**Required RPCs:** `get_season_info`, `get_leaderboard`, `update_rank`, `get_season_rewards`, `claim_season_rewards`

**Acceptance Criteria:**
- [ ] Player can view current season info
- [ ] Leaderboard displays top 100 players
- [ ] Player can see their own rank
- [ ] Rank updates correctly after match completion
- [ ] Season rewards are claimable
- [ ] Season resets correctly on expiry

**Dependencies:**
- Leaderboard system (Nakama leaderboards)
- Season configuration
- Reward system

---

### 4. Cosmetic-Only Monetization

**Description:** Non-pay-to-win monetization. Players purchase gems and spend them on cosmetic items (skins, visual effects, icons).

**Core Mechanics:**
- Gem purchase via IAP
- Gem currency storage
- Cosmetic item catalog
- Non-tradable, non-granting-power cosmetics

**Required RPCs:** `validate_purchase`, `get_currency`, `spend_gems`, `app_launch_check`, `revenuecat_webhook`

**Acceptance Criteria:**
- [ ] Player can purchase gems (via RevenueCat)
- [ ] Gem balance is displayed correctly
- [ ] Gems can be spent on cosmetics
- [ ] Purchase validation prevents fraud
- [ ] Webhook correctly processes purchases
- [ ] All cosmetics are non-gameplay-affecting

**Dependencies:**
- RevenueCat integration
- Gem currency system
- Cosmetic catalog

---

## Technical Requirements for MVP

### Backend (TypeScript/Nakama.js)

- [ ] All 30 MVP RPCs implemented and tested
- [ ] PostgreSQL schema complete (`player_stats`, `catalog`, `inventory`, `loadout`)
- [ ] Nakama storage for match states and campaign progress
- [ ] Redis caching for performance
- [ ] Rate limiting on all endpoints
- [ ] Error tracking (Sentry)
- [ ] Metrics (Prometheus)
- [ ] Logging (structured)

### Client (Godot 4)

- [ ] Network manager for RPC calls
- [ ] Player stats manager with local caching
- [ ] Matchmaker UI
- [ ] Combat system with auto-aim
- [ ] Campaign progression UI
- [ ] Season leaderboard UI
- [ ] Store/IAP UI
- [ ] 60 FPS target on minimum spec devices
- [ ] Offline queue for retries

### Deployment

- [ ] Docker Compose configuration
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Staging environment
- [ ] Production deployment ready
- [ ] Rollback procedure documented

---

## MVP Metrics for Success

| Metric | Target | Measurement |
|---------|---------|-------------|
| Backend RPC latency | P95 < 200ms | Prometheus metrics |
| Client frame rate | 60 FPS minimum | Godot profiler |
| Matchmaker time-to-match | < 30s | Match creation metrics |
| Season participation | 30% of DAU | Analytics |
| IAP conversion rate | 2% of MAU | RevenueCat |
| Crash rate | < 0.5% | Sentry |

---

## MVP Rollout Plan

### Phase 1: Alpha (Internal) - 2 weeks
- Internal playtesting
- Bug fixes
- Performance tuning

### Phase 2: Closed Beta - 4 weeks
- 100 selected testers
- Feedback collection
- Bug fixes and polish

### Phase 3: Soft Launch - 2 weeks
- Limited geographic launch
- Scale testing
- Monitoring and iteration

### Phase 4: Global Launch
- Full public release
- Marketing launch
- Live operations

---

## Backlog Items (Post-MVP)

| Priority | Feature | Estimate | Target Version |
|----------|----------|-----------|----------------|
| P0 | Bug fixes and hotfixes | Ongoing | v1.0.x |
| P1 | Player reporting system | 2 weeks | v1.1.0 |
| P1 | Analytics dashboard | 1 week | v1.1.0 |
| P2 | Push notifications | 2 weeks | v1.1.0 |
| P2 | Subscription IAP | 1 week | v1.1.0 |
| P3 | Guilds/clans | 4 weeks | v1.2.0 |
| P3 | Real-time PvP | 4 weeks | v1.2.0 |
| P3 | Trading system | 2 weeks | v1.2.0 |

---

## Constraints

### Technical
- **Backend:** TypeScript with Nakama.js (per ADR-001)
- **Database:** PostgreSQL 14
- **Cache:** Redis 7
- **Monitoring:** Prometheus + Grafana
- **Error Tracking:** Sentry

### Business
- **MVP Timeline:** 10 weeks to launch
- **Team Size:** 1-2 developers
- **Budget:** Bootstrapped (minimal infrastructure costs)
- **Platform:** Mobile (iOS + Android)

### Quality
- **Test Coverage:** >80% for critical paths
- **CI/CD:** All PRs must pass tests
- **Code Review:** All changes require approval

---

## Sign-off

**Product Owner:** @anchapin  Date: 2026-04-15

**Tech Lead:** @anchapin  Date: 2026-04-15

**Stakeholders:** N/A (single developer project)  Date: 2026-04-15

---

*Last Updated:* 2026-04-15
*Next Review:* Sprint 1 planning
*Related Issues:* #672 (Sprint 0), #675 (Freeze MVP scope), #676 (Vertical slice stories)
