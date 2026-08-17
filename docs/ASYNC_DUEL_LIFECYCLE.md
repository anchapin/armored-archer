# Async Duel Lifecycle

> **Shipped model — hybrid duels (ADR-0003, as cited in `backend/src/modules/combat_system.ts`):**
> **asynchronous matchmaking + live short-session turn-based duels.**
> An earlier revision of this document described correspondence-style duels (24-hour turns, 7-day matches). That model never shipped and is not described here except for one clearly-labeled [legacy note](#legacy-correspondence-engine-compatibility).

## Overview

Armored Archer PvP is a hybrid:

- **Matchmaking is asynchronous.** A player creates a match and does not need to be online while waiting. An open match waits in the pool for up to **24 hours**; a direct challenge to a specific opponent waits **5 minutes**.
- **The duel is live.** Once an opponent accepts, both players fight a short-session, turn-based duel with **5-minute turn timers**. Each turn is one discrete combat action (shoot: angle + power) — no realtime simulation or prediction.
- **The server is authoritative.** All combat math, health, timers, outcome declaration, and settlement run server-side (`backend/src/modules/combat_system.ts`, `backend/src/modules/matchmaker.ts`).
- **Settlement is server-declared.** The winner is derived exclusively from server terminal state; the client only *triggers* settlement (`rpcCompleteMatch`). Client-supplied outcome payloads are advisory and never honored (ADR-0002, as cited in `backend/src/modules/matchmaker.ts`).
- **Timeouts are mobile-hardened.** The 5-minute turn timer doubles as the reconnect grace window: **2 consecutive timeouts (~10 minutes) forfeit the match**. There is deliberately no separate, harsher inactivity forfeit — the 2-minute `MATCH_INACTIVE_TIMEOUT_MS` was removed as redundant in #868.

## Architecture

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Matchmaker (Nakama RPCs) | `backend/src/modules/matchmaker.ts` | Match creation, acceptance, server-declared settlement, Elo/XP/rewards |
| Combat system (Nakama RPCs) | `backend/src/modules/combat_system.ts` | Live duel turn engine: combat actions, health, turn timers, timeout/forfeit declaration |
| Storage — match record | Nakama collection `pvp_matches` | `PvPMatch`: status, ranks, winner/end_reason, `settled_at`, expiry |
| Storage — live duel state | Nakama collection `pvp_match_states` | `MatchState`: health, current turn, `turn_timeout_ms`, `consecutive_timeouts` |
| Client (Godot) | `autoloads/MatchmakingManager.gd`, `autoloads/CombatManager.gd`, `autoloads/CombatSyncManager.gd` | Matchmaking calls, combat actions, state polling/reconnect |

## Lifecycle Phases

```text
┌────────────────────────── ASYNC MATCHMAKING ──────────────────────────┐
│ create_match → status: pending                                        │
│   • open match (no target): 24-hour acceptance window                 │
│     (PENDING_MATCH_EXPIRY_MS, matchmaker.ts)                          │
│   • direct challenge (target_opponent_id): 5-minute window            │
│     (expires_at = Date.now() + 300000, matchmaker.ts)                 │
│                                                                      │
│ accept_match → status: active (creator takes the first turn)          │
└───────────────────────────────────┬───────────────────────────────────┘
                                    ▼
┌────────────────────────── LIVE DUEL (short session) ──────────────────┐
│ submit_combat_action — one discrete action per turn                   │
│   • 5-minute turn timer (TURN_TIMEOUT_MS, combat_system.ts)           │
│   • 1st timeout: turn passes to the opponent                          │
│   • 2nd consecutive timeout: auto-forfeit — opponent wins             │
│     (end_reason "timeout"); the ~10-minute reconnect grace           │
│     (MAX_CONSECUTIVE_TIMEOUTS, combat_system.ts)                      │
│   • health reaches zero: winner declared (end_reason "health_zero")   │
│ player_disconnect → forfeit, opponent wins (end_reason "disconnect")  │
│                                                                      │
│ THE SERVER DECLARES the terminal state:                               │
│   status = completed, winner + end_reason recorded,                   │
│   but NO settlement yet (match has no settled_at)                     │
└───────────────────────────────────┬───────────────────────────────────┘
                                    ▼
┌────────────────────────── SETTLEMENT (server-declared) ───────────────┐
│ complete_match — the client is only a TRIGGER:                        │
│   1. resolveServerTerminalState derives winner/draw from server       │
│      state only (client winner_id/loser_id is advisory, logged,       │
│      never honored)                                                   │
│   2. already settled → idempotent replay of the recorded outcome      │
│   3. draw → settleDrawMatch (completed + settled_at, no Elo/XP/       │
│      rewards)                                                         │
│   4. winner → Elo rank update, XP, rewards; settled_at written        │
│   No server terminal state → rejected (NO_SERVER_TERMINAL_STATE)      │
└───────────────────────────────────┬───────────────────────────────────┘
                                    ▼
                     completed (settled) — rewards applied

Cleanup guards (not gameplay): matches whose expires_at passes are
abandoned — pending matches at their acceptance deadline, active matches
after the 7-day inactivity guard (isMatchExpired, combat_system.ts).
```

## Match States

A match (`PvPMatch.status`) is in one of four states:

| State | Description | Entered via |
|-------|-------------|-------------|
| `pending` | Created, waiting for an opponent to accept | `create_match` |
| `active` | Live duel session in progress (5-minute turns) | `accept_match` |
| `completed` | Terminal — winner declared and/or settlement applied | server declaration (+ settlement) |
| `expired` | Abandoned (cleanup, not a gameplay outcome) | `expires_at` passed (`isMatchExpired`) |

The `active` phase has **no multi-day duration by design** — a duel is a live short session bounded by 5-minute turns. The 7-day `ACTIVE_MATCH_EXPIRY_MS` stamp written at acceptance is an abandonment guard for stuck matches, not a gameplay window.

## Timer & Timeout Reference

Every gameplay timer in the shipped hybrid model, with its code symbol:

| Timer | Value | Code symbol (file) |
|-------|-------|--------------------|
| Turn timeout | **5 minutes** | `TURN_TIMEOUT_MS = 5 * 60 * 1000` → `MatchState.turn_timeout_ms` (`combat_system.ts`, `getOrCreateMatchState`) |
| Reconnect grace / auto-forfeit | **2 consecutive timeouts (~10 minutes)** | `MAX_CONSECUTIVE_TIMEOUTS = 2` (`combat_system.ts`) |
| Open-match acceptance window | **24 hours** | `PENDING_MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000` (`matchmaker.ts`, `create_match` open-pool branch) |
| Direct-challenge acceptance window | **5 minutes** | `expires_at: Date.now() + 300000` (`matchmaker.ts`, `create_match` targeted branch) |
| Active-match abandonment guard | **7 days** (cleanup only) | `ACTIVE_MATCH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000` (`matchmaker.ts`, set in `rpcAcceptMatch`) |
| Expiry check | lazy | `isMatchExpired` (`combat_system.ts`) |
| Separate inactivity forfeit | **none** | the 2-minute `MATCH_INACTIVE_TIMEOUT_MS` was removed in #868; turn timers are the single timeout authority |

Turn-timing authority is the combat engine's `MatchState.turn_timeout_ms` (5 minutes), stored in `pvp_match_states`. The `turn_time_limit_ms` field on `PvPMatch` is preserved for storage-type migration only (see [legacy note](#legacy-correspondence-engine-removed-issue-903)) and is not the gameplay timer.

## RPC Endpoints (shipped lifecycle)

### 1. Create Match

**Endpoint**: `armored_archer/create_match` (matchmaker.ts)

**Purpose**: Opens the async matchmaking phase — creates a `pending` match.

**Request** (core fields):
```json
{
  "match_type": "ranked",
  "is_punch_up": false,
  "target_opponent_id": "user-uuid"
}
```
`target_opponent_id` is optional: without it the match is an open pool entry (24-hour window); with it, a direct challenge (5-minute window, punch-up rules may apply).

**Side effects**:
- Match stored in `pvp_matches` with `status: "pending"` and the branch-specific `expires_at`
- Anti-abuse: `recordMatchAction(userId, 'create', match_id)`; rate limit and cooldown checks
- Punch-up detection runs for targeted challenges (rank-difference thresholds in `matchmaker.ts` punch-up constants)

### 2. Accept Match

**Endpoint**: `armored_archer/accept_match` (`rpcAcceptMatch`, matchmaker.ts)

**Purpose**: Opponent joins the pending match — the live duel starts.

**Request**:
```json
{ "match_id": "match_1234567890_abc123" }
```

**Validation rules**:
- Match must exist and still be `pending`
- Player cannot accept their own match
- Player must have `player_stats` on record
- Concurrent active-match limit enforced

**Side effects**:
- `status` → `"active"`; `opponent_id`/`opponent_rank` recorded (`calculateRank`)
- `current_turn = 1`, creator takes the first turn
- `expires_at` re-stamped to now + `ACTIVE_MATCH_EXPIRY_MS` (7-day abandonment guard)
- Anti-abuse: `recordMatchAction(userId, 'accept', match_id)`; audit log entry

### 3. Submit Combat Action (live duel turn)

**Endpoint**: `armored_archer/submit_combat_action` (`rpcSubmitCombatAction`, combat_system.ts)

**Purpose**: Submits one discrete turn action and receives the server-computed result.

**Request** (core fields):
```json
{
  "match_id": "match_1234567890_abc123",
  "action_type": "shoot",
  "angle": 1.57,
  "power": 0.9
}
```

**Server-side flow**:
1. Validate match and participant (`getAndValidateMatch`)
2. Lazily check the turn timer (`isTurnTimedOut`) — see [Turn Timeout Handling](#turn-timeout-handling)
3. Reset `consecutive_timeouts = 0` on a successful action
4. Run anti-cheat validation (`validateAntiCheat`)
5. `processCombatAction` computes hit/damage server-side from stored stats
6. `saveMatchState` persists the duel state; both players notified (`notifyMatchStateUpdate`)
7. If health reaches zero: server declares the winner — `updateMatchStatus(..., 'health_zero')` + `persistMatchResult(..., 'health_zero')` — the match is terminal but **unsettled** (no `settled_at` yet)

**Response (timeout forfeited)**:
```json
{
  "error": "Match forfeited due to consecutive timeouts",
  "forfeit": true,
  "winner": "opponent-uuid"
}
```

### 4. Get Match State

**Endpoint**: `armored_archer/get_match_state` (`registerRpcGetMatchState`, combat_system.ts)

**Purpose**: Reads the live duel's server state (`pvp_match_states`) — health, current turn, whose turn it is, timer fields. Used for initial load, polling, and reconnect resync.

### 5. Player Disconnect (forfeit)

**Endpoint**: `armored_archer/player_disconnect` (`rpcPlayerDisconnect`, combat_system.ts)

**Purpose**: Reports a disconnect; the server forfeits the reporting player.

**Side effects**:
- Opponent declared winner: `updateMatchStatus(..., 'disconnect')` (or `'timeout'` when the reason is a timeout) + `persistMatchResult`
- Disconnect telemetry (`logDisconnect`) for fairness monitoring
- Players notified (`notifyOpponentOfForfeit`, `notifyMatchStateUpdate(..., 'match_completed')`)

### 6. Complete Match (settlement trigger)

**Endpoint**: `armored_archer/complete_match` (`rpcCompleteMatch`, matchmaker.ts)

**Purpose**: Triggers settlement of a terminal match. **The client is a trigger only — the winner is server-declared** (ADR-0002): `resolveServerTerminalState` is the sole source of winner truth, and the client-supplied `winner_id`/`loser_id` payload is advisory/logging only (`logAdvisoryPayloadMismatch`).

**Request**:
```json
{
  "match_id": "match_1234567890_abc123",
  "winner_id": "user-uuid",
  "loser_id": "opponent-uuid"
}
```
`winner_id`/`loser_id`/`is_punch_up` in the payload are advisory; settlement uses only server state (the server-recorded punch-up flag, not the client's).

**Behavior**:
- **No server terminal state** → rejected with `error_code: "NO_SERVER_TERMINAL_STATE"` (a live, unresolved match cannot be settled)
- **Already settled** (`settled_at` present) → idempotent replay:
  ```json
  {
    "success": true,
    "already_settled": true,
    "match_id": "match_1234567890_abc123",
    "winner": "user-uuid",
    "end_reason": "health_zero",
    "settled_at": 1234567900000
  }
  ```
- **Terminal draw** → `settleDrawMatch`: marks completed + `settled_at` + `end_reason: "draw"`; **no Elo/XP/rewards** are applied; response carries `is_draw: true`
- **Winner** → Elo rank update, XP, and rewards applied for both players; `settled_at` written as the double-settlement idempotency key

**Terminal-state resolution priority** (`resolveServerTerminalState`, matchmaker.ts):
1. `settled_at` on the match — settlement already ran (idempotent replay)
2. `winner` on the match — declared by a server resolution path (`updateMatchStatus` in combat_system.ts, or the turn engine)
3. Combat-system `MatchState` — declared winner (forfeit/timeout/disconnect) or health-zero (`resolveCombatStateTerminal`)
4. Turn-engine end conditions (`checkMatchEndConditions`) — health-zero, max-turns (winner by remaining health), or draw

Server-side end reasons (`end_reason`): `health_zero`, `forfeit`, `timeout`, `disconnect` (combat declaration, `combat_system.ts`) plus `draw` and max-turns mappings at settlement (`MatchEndReason`, `mapTurnEndReasonToMatchEndReason` in matchmaker.ts).

**Anti-abuse around settlement**: rate limit and cooldown checks, flagged-player checks for both participants, win-trading detection, audit logging (`logAudit`).

## Turn Timeout Handling

### Configuration

```typescript
// combat_system.ts
const TURN_TIMEOUT_MS = 5 * 60 * 1000;        // 5 minutes per turn
const MAX_CONSECUTIVE_TIMEOUTS = 2;           // auto-forfeit after 2 consecutive
```

The 5-minute turn timer is the **single timeout authority**: it doubles as the mobile reconnect grace, so a player who drops has roughly 10 minutes (two turn windows) to return before forfeiting. There is deliberately no separate, harsher inactivity forfeit — the 2-minute `MATCH_INACTIVE_TIMEOUT_MS` was removed as redundant dead code in #868.

### Timeout Flow

1. **First timeout**:
   - Detected lazily when a combat RPC arrives (`rpcSubmitCombatAction` calls `isTurnTimedOut` before processing)
   - `handleTurnTimeout` increments `MatchState.consecutive_timeouts`
   - The turn passes to the opponent; the match continues
   - Timeout telemetry logged (`logTimeout`, `timeout_type: 'turn_timeout'`); players notified

2. **Second consecutive timeout**:
   - `consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS` → auto-forfeit
   - The player who did **not** time out is declared the winner
   - `updateMatchStatus(..., 'timeout')` + `persistMatchResult(..., 'timeout')`; opponent notified (`notifyOpponentOfForfeit`)

3. **Reset**:
   - `consecutive_timeouts` resets to 0 whenever the player successfully submits a combat action

### Timeout Detection

Detection is lazy — no cron. `isTurnTimedOut` compares elapsed time since `last_turn_timestamp` against `MatchState.turn_timeout_ms` when the next combat action arrives:

```typescript
function isTurnTimedOut(matchState: MatchState): boolean {
  const timeSinceLastTurn = Date.now() - matchState.last_turn_timestamp;
  return timeSinceLastTurn > matchState.turn_timeout_ms;
}
```

## Match Data

Two storage records back the hybrid model.

**`PvPMatch`** (collection `pvp_matches`, matchmaker.ts) — the match record:

```typescript
interface PvPMatch {
  match_id: string;
  creator_id: string;
  opponent_id: string;
  creator_rank: number;
  opponent_rank: number;
  match_type: 'ranked' | 'casual';
  is_punch_up: boolean;
  status: 'pending' | 'active' | 'completed' | 'expired';
  winner?: string;             // server-declared winner
  end_reason?: MatchEndReason; // health_zero | forfeit | timeout | disconnect | draw | ...
  settled_at?: number;         // settlement idempotency key (written by complete_match)
  created_at: number;
  updated_at: number;
  expires_at: number;          // acceptance window (pending) / abandonment guard (active)
  last_turn_timestamp: number;
  // Legacy turn-engine fields (see legacy note): current_turn, current_player,
  // turn_time_limit_ms, creator_health, opponent_health, max_turns,
  // creator_consecutive_timeouts, opponent_consecutive_timeouts
}
```

**`MatchState`** (collection `pvp_match_states`, combat_system.ts) — the live duel state and the **turn-timing authority**:

```typescript
interface MatchState {
  match_id: string;
  turn: number;
  current_turn_user_id: string;
  creator_id: string;
  opponent_id: string;
  creator_health: number;      // level-scaled: 100 + level * 10 (getOrCreateMatchState)
  opponent_health: number;
  creator_stats: PlayerStats;  // stored server-side stats — never client input
  opponent_stats: PlayerStats;
  status: string;
  log: CombatLogEntry[];
  last_turn_timestamp: number;
  turn_timeout_ms: number;     // 5 minutes (TURN_TIMEOUT_MS)
  consecutive_timeouts: number;
  forfeit_reason?: string;
  winner?: string;
}
```

## Reconnect Flow

Because turn timers are the grace window, reconnect is simply "come back within roughly 10 minutes and take your turn."

**When to reconnect**: network loss/restoration, app backgrounded/foregrounded, crash restart while a match is active.

**Procedure** (client):
1. Ensure the network session is alive (`NetworkManager`)
2. Fetch server state via `get_match_state` (CombatManager/CombatSyncManager wrap this RPC)
3. Handle the response:
   - `active` → resync UI from server health/turn data; submit your turn if `current_turn_user_id` is you
   - `completed` → show results (settlement may still need a `complete_match` trigger)
   - expired/error → show the abandoned-match message, return to menu
4. Never trust local state — the server is the source of truth for health and turn order

**Edge cases**:

| Scenario | Handling |
|----------|----------|
| Match completed while offline | Results screen; winner already server-declared |
| Opponent acted while offline | Server state shows their result; take your turn |
| One turn window missed | Turn passed to you/opponent; counter at 1 — keep playing |
| Two consecutive windows missed | Auto-forfeit already declared; opponent won by `timeout` |

## Client Integration

The shipped client uses these autoloads (registered in `project.godot`):

| Phase | Autoload / scene | RPCs used |
|-------|------------------|-----------|
| Matchmaking | `autoloads/MatchmakingManager.gd` | `create_match`, `accept_match` |
| Live duel | `autoloads/CombatManager.gd` (`RPC_SUBMIT_COMBAT_ACTION`, `RPC_GET_MATCH_STATE`) | `submit_combat_action`, `get_match_state` |
| Live duel (sync) | `autoloads/CombatSyncManager.gd` | `submit_combat_action`, `get_match_state` |
| UI | `scenes/ui/matchmaking_menu.gd`, `scenes/ui/combat_menu.gd` | accept / action + state polling |

`autoloads/MatchmakerManager.gd` previously exposed the legacy correspondence duel methods (`submit_turn`, `get_async_match_state`, `forfeit_match`, `reconnect_to_match`) — these were removed in issue #903. Use `CombatManager` / `CombatSyncManager` for the live duel path.

## Notifications

Server → client notifications (combat_system.ts):

- **Turn taken / state update** — `notifyMatchStateUpdate(..., 'turn_taken' | 'health_update')`
- **Match completed** — `notifyMatchStateUpdate(..., 'match_completed')`
- **Forfeit/disconnect** — `notifyOpponentOfForfeit`

Timeouts and disconnects are additionally logged as fairness telemetry (`logTimeout`, `logDisconnect`).

## Testing

**Unit** (`backend/src/modules/**/__tests__/`): RPC validation, timeout accounting (`handleTurnTimeout`, `isTurnTimedOut`), terminal-state resolution (`resolveServerTerminalState`), draw settlement, settlement idempotency.

**Integration** (`backend/tests/integration/`): full lifecycle — create → accept → live turns → server declaration → settlement trigger → rewards.

**Manual flows**:
1. *Normal*: create → accept → alternate `submit_combat_action` turns → health-zero declaration → `complete_match` → verify rewards
2. *Timeout*: create → accept → one player waits past **5 minutes** (one window) → verify the turn passed; wait a second consecutive window → verify auto-forfeit with `end_reason: "timeout"`
3. *Reconnect*: accept → disconnect (network off) → reconnect within the grace period → `get_match_state` resyncs → play continues
4. *Draw*: reach max-turns end conditions with equal health → `complete_match` → verify `is_draw: true`, no Elo/XP applied

## Security Considerations

1. **Server-authoritative combat** — damage/hit computed from stored stats (`processCombatAction`), never client input
2. **Server-declared settlement** — client `winner_id`/`loser_id` advisory only; mismatches logged for telemetry (`logAdvisoryPayloadMismatch`), never honored
3. **Idempotent settlement** — `settled_at` guards against double reward application
4. **Anti-abuse** — rate limits, action cooldowns, concurrent-match limits, `recordMatchAction` tracking, win-trading detection, flagged-player checks
5. **Server-recorded punch-up** — reward multipliers key off the stored `is_punch_up` flag, not the client's claim
6. **Lazy timestamp validation** — late turn submissions are rejected against `turn_timeout_ms`

## Performance Considerations

1. **Lazy timeout detection** — timers checked on combat RPCs, no cron sweep
2. **Current-state storage** — one `MatchState` record per match plus a combat log, not full turn history
3. **Expiry as cleanup** — `expires_at` abandonment guards keep stale pending/active matches out of the pool (`isMatchExpired`)

## Legacy Correspondence Engine — Removed (issue #903)

The correspondence-style turn engine (24-hour turns, 7-day matches) and its RPCs were removed in issue #903:

- `armored_archer/submit_turn`, `armored_archer/get_async_match_state`, `armored_archer/forfeit_match` — RPCs removed from `backend/src/modules/matchmaker.ts` and `backend/src/index.ts`.
- Correspondence-era constants removed: `TURN_TIMEOUT_MS = 24 * 60 * 60 * 1000`, `MAX_CONSECUTIVE_TIMEOUTS = 2`, `DEFAULT_MAX_TURNS = 10`, `BASE_HEALTH = 100`, `ACTIVE_MATCH_EXPIRY_MS = 7 days`.
- `PvPMatch.turn_time_limit_ms`, `creator_health`, `opponent_health`, `max_turns`, `consecutive_timeouts` remain on the storage type for migration compatibility, but are no longer authoritative — the live duel engine in `combat_system.ts` (`MatchState`) owns the gameplay timer, HP, and timeout bookkeeping.
- The legacy correspondence client code in `autoloads/MatchmakerManager.gd` (`submit_turn`, `get_async_match_state`, `forfeit_match`, `reconnect_to_match`, timeout monitoring, async duel signals) was removed.

Historical references for completeness: see [MATCHMAKER.md](MATCHMAKER.md) and [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md).

## Related Documents

- [MATCHMAKER.md](MATCHMAKER.md) — matchmaking, ranks, Elo, punch-up rules
- [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md) — combat math and anti-cheat
- [CASUAL_VS_RANKED_REWARDS.md](CASUAL_VS_RANKED_REWARDS.md) — reward differences by match type
- [SEASONAL_LEADERBOARD.md](SEASONAL_LEADERBOARD.md) — seasonal rank settlement
