# Live-Ops Calendar — Season 1 (First Post-Launch Season)

> Status: DRAFT — pending team sign-off (see [Team Alignment](#6-team-alignment)).
>
> Scope: This calendar plans live operations for the first PvP season after global launch.
> It uses **relative dates** (`T+N` days from launch, Week 1–6) because no absolute launch
> date is fixed yet. When a launch date is confirmed, replace `T+0` with it and every other
> date resolves automatically.

---

## 1. Season 1 Overview

| Field | Value |
|---|---|
| Season ID | `season_1` (per `season_system.ts` ID format) |
| Theme | **"First Blood"** — celebrate launch; showcase the core loop (PvE grind → build-crafting → ranked ladder) |
| Duration | **4 weeks** (matches the backend default `duration_weeks: 4` in `backend/src/modules/season_system.ts`; extendable to 5 via the cadence triggers in §5) |
| Start | `T+0` (launch day) — ranked ladder opens, all players seeded at Ladder Rating 1000 |
| End | `T+28` — final Ladder Ratings locked, rewards distributed, `season_2` starts automatically via `armored_archer/end_season` |
| Season rewards | Rank-tier Coins + Gems + exclusive non-stat cosmetics (title *"Season 1 Veteran"* + tier aura), distributed via `armored_archer/get_season_rewards` / `claim_season_rewards` |
| Monetization rule | **Cosmetics/skins only, via RevenueCat IAP.** Base gear and all stats remain gameplay-earned (transmog policy — see PRD §4C). Nothing in this calendar grants stat power for money. |

### Design goals for Season 1

1. **Prove the core loop retention story** — funnel players from PvE campaign into their first ranked duels.
2. **Establish the seasonal rhythm** — one full season cycle executed end-to-end (start → events → rollover) with no outages.
3. **Baseline telemetry** — capture season 1 metrics to calibrate future seasons (targets in §5).

---

## 2. Week-by-Week Calendar

Anchor: **Week 1 begins at `T+0` (launch day).** Each week runs Monday–Sunday once an
absolute launch date is set; until then, weeks are relative to launch.

| Window | Events & Activities | Featured Content | Store Rotation (IAP cosmetics only) | PvP / Ranked Schedule | Community Beats |
|---|---|---|---|---|---|
| **Pre-launch (T−7 → T−1)** | Season 1 config deployed & verified in prod; `season_1` staged; store items approved in App Store/Play consoles | — | Season 1 skin set submitted for store review | Ranked ladder configured, Ladder Rating seed = 1000 | Launch-week announcement (social, Discord); support playbook staffed (see `docs/BETA_SUPPORT_PLAYBOOK.md`) |
| **Week 1 (T+0 → T+6)** | Launch week double XP (PvE + PvP, server-side multiplier) | Campaign Ch. 1–2 featured; first boss modifier unlock highlighted ("Wind Boss → Piercing Arrow" per PRD §4B) | Season 1 skin set live: **Launch Ember** bundle (bow + arrow skins) | Ranked + casual duels open at launch — asynchronous matchmaking + live short-session duels (ADR-0003); punch-up toggle on | Daily dev diary posts; launch AMA; telemetry watch daily |
| **Week 2 (T+7 → T+13)** | **Bounty Duel Weekend** (T+11 → T+13): casual duels award +50% Coins (server config; casual stays Ladder Rating/Gem-free per `CASUAL_VS_RANKED_REWARDS.md`) | Campaign Ch. 3 featured; build-guide spotlight (community builds) | Rotation: **Frost Warden** armor + helm skins | Ranked ladder milestone push — mid-season Ladder Rating snapshot published | First community build-contest announcement; Discord ladder screenshot channel |
| **Week 3 (T+14 → T+20)** | **Punch-Up Week**: punch-up win Gem bonus highlighted (3–10 Gems per win, scaling with the Power Rating gap; ranked only); anti-abuse monitoring on punch-up queue | Campaign Ch. 4 featured; modifier drop-pool reminder for unlocked bosses | Rotation: **Legendary Hunt** aura + amulet skin bundle | Mid-season (T+14): leaderboard freeze check + top-100 published; matchmaking pool health review | Mid-season state-of-the-game post; telemetry review vs. §5 targets (go/no-go on cadence adjustments) |
| **Week 4 (T+21 → T+27)** | **Final Push Weekend** (T+25 → T+27): ranked XP +25% (config-driven); last-chance ladder climbing | All chapters featured (catch-up week); season rewards preview screen live in client | Last call: full Season 1 cosmetic set (all rotations return for the weekend) | Final ranked push; ladder closes end of `T+27` | "Final 48 hours" push notification via `notification_scheduler.ts`; content-creator ladder race |
| **Rollover (T+28)** | Season end: Ladder Ratings locked, rewards claimable, `season_2` auto-starts | Season 1 recap (most-used builds, top duel replays via match replay system) | Season 1 cosmetics move to legacy availability (decision in §5) | Off-season grace (~24h): casual duels only; `season_2` ladder opens at `T+29` | Season 1 awards ceremony post; Season 2 theme tease |

---

## 3. Event Types Mapped to Game Systems

Every event type in this calendar is implemented by toggling **existing, server-authoritative
systems** — no new gameplay code is required for Season 1.

| Event Type | Mechanic | Backing System (do not rebuild) | Reward Rule |
|---|---|---|---|
| Double XP weekend | Global XP multiplier | `matchmaker.ts` `calculateXPGain()` / `processMatchResult()` (server-side multiplier config) | Applies to both casual & ranked proportionally |
| Bounty Duel Weekend | Coin multiplier in casual | Same reward pipeline; casual stays at 50% structure per `CASUAL_VS_RANKED_REWARDS.md` | No Gems, no Ladder Rating change — casual remains practice-only |
| Punch-Up Week | Highlight + verify existing punch-up bonus (1.2–2.0× XP multiplier + 3–10 Gems on ranked wins, scaling with Power Rating gap) | Punch-up detection in matchmaker; `ANTI_ABUSE_GUIDE.md` monitoring | Gems remain ranked-punch-up-win-only |
| Final Push Weekend | Ranked XP bonus | Reward pipeline + `SeasonManager.gd` countdown UI | Season Standing still Ladder Rating-based only |
| Featured campaign chapters | Rotating spotlight + drop-rate focus on unlocked modifier pools | PvE stage completion & server-side loot rolls (`gear_system.ts`); campaign chapter prefix already in stage IDs | Base Gear only — never sold |
| Store rotation | Weekly cosmetic skin set swap | RevenueCat (receipt validation) + `armored_archer/validate_purchase` / `spend_gems`; Gem packs 100/$0.99, 550/$4.99, 1200/$9.99 | Cosmetics are visual-only transmog; zero stat impact |
| Season rewards | End-of-season distribution | `season_system.ts` RPCs; rewards = Rank-tier Coins + Gems + exclusive title/aura | One-time claim per season; cosmetics are non-stat |
| Community beats | Scheduled posts, contests, push notifications | `notification_scheduler.ts` / `notifications_rpc.ts` for client pings | Social/community only |

**Hard constraints carried into every event:**

- Server-authoritative: all multipliers and rewards are computed on Nakama; the client never decides rewards.
- No P2W: nothing purchasable affects combat stats (PRD §1).
- Casual mode never grants Gems or Ladder Rating/season movement.

---

## 4. Content Release Schedule

All items are server config, catalog, or store-metadata changes unless noted. Owners are
**roles** (fill names at kickoff). Dependencies reference other rows in this table.

| ID | Deliverable | System Touched | Owner (role) | Due | Depends on | Status |
|---|---|---|---|---|---|---|
| C1 | Season 1 config (`season_1`, 4-week duration, reward tiers) verified in staging | `season_system.ts` / DB | Backend Engineer | T−7 | — | ☐ |
| C2 | XP/Coin multiplier event flags + kill-switch (see §5) staged | `matchmaker.ts` config | Backend Engineer | T−7 | C1 | ☐ |
| C3 | Season 1 cosmetic set (3 rotations) authored & approved | Art + Game Director | Live-Ops/Art | T−10 | — | ☐ |
| C4 | RevenueCat products + App Store / Play console metadata approved | RevenueCat / store consoles | Release Manager | T−7 | C3 | ☐ |
| C5 | Season rewards preview UI (client) | `SeasonManager.gd` + UI | Client Engineer | T−14 | C1 | ☐ |
| C6 | Push notification campaign copy + schedule | `notification_scheduler.ts` | Community/Live-Ops | T−5 | — | ☐ |
| C7 | Telemetry dashboards configured (funnel, retention, match health) | `analytics.ts`, `funnel_analytics.ts`, `matchmaking_analytics.ts` | Data/Analytics | T−3 | — | ☐ |
| C8 | Mid-season review checkpoint (T+14) scheduled with decision template (§5) | Process | Live-Ops Lead | T+0 | C7 | ☐ |
| C9 | Rollover runbook rehearsal: `end_season` → `season_2` in staging | `season_system.ts` | Backend Engineer | T−3 | C1 | ☐ |
| C10 | Season 1 recap + Season 2 announcement assets | Docs/social | Community Manager | T+24 | — | ☐ |

---

## 5. Flexibility & Adaptability

### Event swap rules

1. **Drop-in/drop-out:** Every weekend event is a config toggle (C2). Any event can be
   replaced with a previously-run event from a canned list (Double XP ↔ Bounty Duel ↔
   Punch-Up highlight) with ≤48h notice and no client update.
2. **Substitution order:** If an event must be cancelled (bug, balance risk, incident),
   substitute in this priority order: (1) Double XP weekend, (2) casual Bounty Duel,
   (3) social/community beat only (no reward economy touched).
3. **Never mid-flight:** No reward-economy change deploys during an active weekend event;
   wait for the event window to close unless a security/anti-cheat incident forces it
   (then use the kill-switch, not a rebalance).
4. **Store rotations are independent:** A delayed skin rotation never blocks a gameplay
   event; rotate the previous set for an extra week instead.

### Cadence adjustment triggers (tied to telemetry)

Reviewed at the T+14 mid-season checkpoint (C8) against dashboards from C7. Thresholds are
Season 1 baselines — recalibrate for Season 2.

| Signal | Source | Threshold | Action |
|---|---|---|---|
| Ranked participation rate | `matchmaking_analytics.ts` / funnel | < 20% of DAU play ≥1 ranked duel in a week | Extend casual-side Bounty Duel events; investigate ranked friction (queue time, punch-up anxiety) |
| Season funnel conversion | `funnel_analytics.ts` | < 40% of new players reach first PvP duel by T+14 | Shift Week 3–4 featured content toward campaign catch-up + build guides |
| Match queue health | matchmaker pool metrics | Median ranked queue > 90s for 3 consecutive days | Widen matchmaking Power Rating band; consider cross-region pools |
| D1/D7 retention vs. launch | `analytics.ts` | D7 < 15% or week-over-week DAU decline > 20% | Live-ops pause on new event types; prioritize stability + core-loop fixes |
| Economy inflation | `balance_analytics.ts` | Coin/Gem faucet drift > +30% vs. model | Disable Gem-granting event amplifiers (keep punch-up baseline); rerun economy model |
| Crash/error rate | `health_monitor.ts` / alerting | Error budget burn > 2× for 24h | Kill-switch active multiplier events; freeze store rotation changes |
| Punch-up abuse signals | `anti_cheat.ts` + `ANTI_ABUSE_GUIDE.md` | Confirmed win-trading clusters | Restrict punch-up queue; escalate per anti-abuse runbook |

**Season length flexibility:** The 4-week default can extend to 5 weeks *only* via a
decision at the T+14 checkpoint (e.g., launch-stability incident consumed a week), recorded
in the decision log. Never shorten Season 1 — players grind toward locked rewards.

### Rollback & safety

- All event multipliers ship behind a server-side flag with a documented kill-switch (C2).
- Rollover is rehearsed in staging (C9); `end_season` is admin-gated and takes a backup
  snapshot of the `seasons` collection before running.

---

## 6. Team Alignment

RACI per deliverable area. **Sign-off fields are intentionally blank — humans fill these.**

| Area | Responsible | Accountable | Consulted | Informed | Sign-off (name / date) |
|---|---|---|---|---|---|
| Calendar & event schedule | Live-Ops Lead | Game Director | Community Mgr, Data/Analytics | Whole team | ____________ |
| Reward economy & multipliers | Backend Engineer | Game Director | Live-Ops Lead, Data/Analytics | Whole team | ____________ |
| Store rotations & pricing (cosmetics) | Release Manager | Game Director | Art, Live-Ops Lead | Whole team | ____________ |
| Season config & rollover (C1, C9) | Backend Engineer | Tech Lead | Live-Ops Lead | Whole team | ____________ |
| Telemetry targets & mid-season review | Data/Analytics | Live-Ops Lead | Game Director | Whole team | ____________ |
| Community beats & notifications | Community Manager | Live-Ops Lead | Game Director | Whole team | ____________ |
| Final calendar approval (this document) | Live-Ops Lead | Game Director | All leads | Whole team | ____________ |

**Alignment ritual:** 30-minute calendar kickoff at T−14; mid-season review at T+14 (C8);
retro at T+30 covering the whole first season. Decisions and threshold changes are logged
in this document's commit history (PRs against this file).

---

## Appendix: References

- PRD (core loop, transmog, economy): `docs/armored-archer_prd.md`
- Season system design: `docs/SEASONAL_LEADERBOARD.md`
- Casual vs ranked reward rules: `docs/CASUAL_VS_RANKED_REWARDS.md`
- PvP duel lifecycle: `docs/ASYNC_DUEL_LIFECYCLE.md`, `backend/src/modules/PUNCH_UP_MECHANICS_SUMMARY.md`
- IAP / store integration: `docs/REVENUECAT_SETUP.md`, `docs/STORE_README.md`
- Anti-abuse: `backend/src/modules/ANTI_ABUSE_GUIDE.md`
- Support staffing: `docs/BETA_SUPPORT_PLAYBOOK.md`
