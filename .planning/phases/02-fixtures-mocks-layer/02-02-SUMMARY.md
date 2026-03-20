---
phase: 02-fixtures-mocks-layer
plan: 02
title: Builder Pattern Fixtures
subsystem: Test Infrastructure
tags: [testing, fixtures, builder-pattern, json, go]
author: Claude Sonnet
date: 2026-03-20
completion_date: 2026-03-20
---

# Phase 02 Plan 02: Builder Pattern Fixtures Summary

## Objective

Enhance existing test fixtures with builder pattern for flexible test data creation, and add JSON serialization for cross-platform fixture sharing between Go backend and Godot frontend tests.

## One-Liner

Implemented fluent builder pattern API (PlayerBuilder, GearBuilder, MatchBuilder) with method chaining, stat auto-scaling, and JSON serialization for cross-platform fixture sharing.

## Tech Stack

- **Language**: Go 1.21+
- **Testing**: Go testing + testify
- **Serialization**: encoding/json
- **Pattern**: Builder pattern with fluent API

## Key Files

### Created
- `backend/tests/testhelpers/fixtures_builder.go` (292 lines) - Builder pattern implementation
- `backend/tests/testhelpers/fixtures_json_test.go` (199 lines) - JSON serialization tests
- `backend/tests/testhelpers/fixtures_builder_test.go` (565 lines) - Builder pattern tests
- `backend/tests/fixtures/players.json` (7 player fixtures)
- `backend/tests/fixtures/gear.json` (18 gear fixtures)
- `backend/tests/fixtures/matches.json` (12 match fixtures)

### Modified
- `backend/tests/testhelpers/fixtures.go` - Added JSON serialization methods (toJSON, fromJSON, MarshalJSON, UnmarshalJSON)

## Decisions Made

### 1. Builder API Design
**Decision**: Use method chaining for fluent API with `*Builder` return types
**Rationale**: Enables readable, expressive test data creation with sensible defaults
**Impact**: Developers can write `NewPlayerBuilder().WithLevel(10).WithStats(25,20,15,8).Build()`

### 2. Stat Auto-Scaling Formula
**Decision**: Implement automatic stat scaling based on level and rarity
**Rationale**: Reduces boilerplate in tests while ensuring realistic stat distributions
**Formulas**:
- Player level scaling: Attack/Defense = 10 + level, Dodge = 10 + (level/2), CritRate = 5 + (level/5)
- Gear rarity scaling: common=5, rare=10, epic=15, legendary=20

### 3. JSON Field Naming
**Decision**: Use Go struct field names (PascalCase) instead of JSON tags
**Rationale**: Maintains compatibility between Go and potential Godot deserialization
**Impact**: JSON fields use UserID, Level, Attack, etc. (not user_id, level, attack)

### 4. Time Serialization
**Decision**: Use RFC3339 format for time.Time fields in JSON
**Rationale**: Standard format that's widely supported across languages
**Implementation**: Custom MarshalJSON/UnmarshalJSON methods handle conversion

## Deviations from Plan

**None - plan executed exactly as written.**

## Implementation Details

### Task 1: Builder Pattern Implementation
Created three builder types with fluent API:

**PlayerBuilder Methods**:
- `NewPlayerBuilder()` - Creates builder with defaults
- `WithLevel(level int)` - Sets level and auto-scales stats
- `WithStats(attack, defense, dodge, critRate int)` - Sets custom stats
- `WithGear(gear ...TestGear)` - Adds gear items
- `WithID(userID string)` - Sets custom user ID
- `WithXP(xp int)` - Sets player XP
- `Build() *TestPlayer` - Returns constructed player

**GearBuilder Methods**:
- `NewGearBuilder()` - Creates builder with defaults
- `WithType(gearType string)` - Sets gear type
- `WithRarity(rarity string)` - Sets rarity and scales stats
- `WithStats(attack, defense, dodge, critRate int)` - Sets custom stats
- `WithID(id string)` - Sets custom gear ID
- `WithDisplayName(name string)` - Sets display name
- `Build() *TestGear` - Returns constructed gear

**MatchBuilder Methods**:
- `NewMatchBuilder()` - Creates builder with defaults
- `WithPlayers(creatorID, opponentID string)` - Sets player IDs
- `WithStatus(status string)` - Sets match status
- `WithHealth(creatorHealth, opponentHealth int)` - Sets health values
- `WithTurn(turn int)` - Sets current turn
- `WithID(matchID string)` - Sets custom match ID
- `Build() *TestMatch` - Returns constructed match

### Task 2: JSON Serialization
Added serialization methods to all fixture types:

**Methods Added**:
- `toJSON() string` - Serializes fixture to JSON string
- `fromJSON(jsonStr string) error` - Deserializes JSON into fixture
- `MarshalJSON() []byte` - Implements json.Marshaler interface
- `UnmarshalJSON([]byte) error` - Implements json.Unmarshaler interface

**Time Handling**: Custom marshal/unmarshal methods handle time.Time fields using RFC3339 format

### Task 3: JSON Fixture Files
Created three fixture files with diverse test scenarios:

**players.json** (7 players):
- Level 1 player (default stats)
- Level 10 player (scaled stats)
- Level 50 player (high-level)
- Level 100 player (max level)
- Player with legendary gear
- Player with custom stats
- Player with full loadout (5 gear items)

**gear.json** (18 items):
- Common items (bow, helm, armor, arrow, amulet)
- Rare items (all types)
- Epic items (bow with high attack, balanced helm)
- Legendary items (bow, armor)
- Attack-focused, defense-focused, balanced distributions

**matches.json** (12 matches):
- Active matches (full health, low health, various turns)
- Completed matches (winner/loser, close match, double KO)
- Forfeited matches (creator forfeit, opponent forfeit)

### Task 4: Builder Pattern Tests
Created comprehensive test suite with 23 test cases:

**PlayerBuilder Tests** (8 tests):
- TestPlayerBuilderDefaults
- TestPlayerBuilderWithLevel (5 subtests: levels 1, 10, 25, 50, 100)
- TestPlayerBuilderWithStats
- TestPlayerBuilderWithGear
- TestPlayerBuilderWithID
- TestPlayerBuilderWithXP
- TestPlayerBuilderChaining

**GearBuilder Tests** (9 tests):
- TestGearBuilderDefaults
- TestGearBuilderWithType (5 subtests: bow, helm, armor, arrow, amulet)
- TestGearBuilderWithRarity (4 subtests: common, rare, epic, legendary)
- TestGearBuilderTypeAndRarityCombo (6 subtests)
- TestGearBuilderStats
- TestGearBuilderWithID
- TestGearBuilderWithDisplayName
- TestGearBuilderChaining

**MatchBuilder Tests** (6 tests):
- TestMatchBuilderDefaults
- TestMatchBuilderWithPlayers
- TestMatchBuilderWithStatus (3 subtests: active, completed, forfeited)
- TestMatchBuilderWithHealth
- TestMatchBuilderWithTurn
- TestMatchBuilderWithID
- TestMatchBuilderChaining

**Integration Tests**:
- TestBuilderIntegration - Complete game scenario with players, gear, and match

## Performance Metrics

- **Total Tests**: 35 (23 builder tests + 6 JSON tests + 6 existing fixture tests)
- **Test Pass Rate**: 100%
- **Lines of Code**: 1,056 lines (292 builder + 199 JSON tests + 565 builder tests)
- **Fixture Files**: 37 fixtures across 3 JSON files
- **Execution Time**: ~15 minutes

## Cross-Platform Compatibility

JSON fixtures use Go struct field names (PascalCase) for compatibility:
- Go: `player.UserID` ↔ JSON: `"UserID": "player123"`
- Go: `gear.Type` ↔ JSON: `"Type": "bow"`
- Go: `match.Status` ↔ JSON: `"Status": "active"`

This structure can be loaded by both Go tests (via `fromJSON()`) and future Godot tests (via JSON.parse).

## API Documentation

### PlayerBuilder Usage Example

```go
// Create a level 50 player with legendary gear
player := testhelpers.NewPlayerBuilder().
    WithLevel(50).
    WithGear(
        *testhelpers.NewGearBuilder().
            WithType("bow").
            WithRarity("legendary").
            Build(),
    ).
    WithID("player123").
    Build()

// Result: Level=50, Attack=60, Defense=60, Dodge=35, CritRate=15, 1 legendary bow
```

### GearBuilder Usage Example

```go
// Create an epic bow with custom stats
gear := testhelpers.NewGearBuilder().
    WithType("bow").
    WithRarity("epic").
    WithStats(25, 5, 3, 10).
    WithDisplayName("Phoenix Bow").
    Build()

// Result: Type=bow, Rarity=epic, Attack=25, Defense=5, Dodge=3, CritRate=10
```

### MatchBuilder Usage Example

```go
// Create an active match at turn 5
match := testhelpers.NewMatchBuilder().
    WithPlayers("player1", "player2").
    WithStatus("active").
    WithHealth(90, 85).
    WithTurn(5).
    Build()

// Result: Status=active, CreatorHealth=90, OpponentHealth=85, Turn=5
```

## Success Criteria Verification

✅ **Developers can write fluent builder API calls**
```go
NewPlayerBuilder().WithLevel(10).WithStats(25, 20, 15, 8).Build()
```

✅ **Builder pattern supports method chaining**
All builder methods return `*Builder` for chaining

✅ **JSON fixtures can be loaded in both Go and Godot tests**
JSON structure uses Go field names, compatible with both platforms

✅ **Fixture defaults are sensible and cover common scenarios**
7 players, 18 gear items, 12 matches covering diverse test cases

✅ **All builder methods have tests validating behavior**
23 builder tests + 6 JSON tests = 29 tests, all passing

✅ **JSON round-trip serialization preserves all fixture data**
Custom MarshalJSON/UnmarshalJSON methods handle time.Time fields correctly

## Commits

1. **f076ff9e** - `feat(02-02): create builder pattern for fixtures`
2. **741bb54f** - `feat(02-02): add JSON serialization to fixtures`
3. **bf6bab46** - `feat(02-02): create JSON fixture files for cross-platform sharing`
4. **413f1cc9** - `test(02-02): create builder pattern tests`

## Next Steps

1. Use builder patterns in integration tests to reduce boilerplate
2. Extend JSON fixtures to include more edge cases (boundary conditions, invalid data)
3. Add fixture loader utility for reading JSON files into test structures
4. Consider adding Godot test examples that load these JSON fixtures

## Lessons Learned

1. **Builder pattern complexity**: WithType() doesn't auto-scale stats - only WithRarity() does. This is by design but could be confusing. Added TestGearBuilderTypeAndRarityCombo to document expected behavior.

2. **Integer division**: Stat scaling uses integer division (e.g., 15/2 = 7, not 7.5). Test expectations must account for this.

3. **JSON field naming**: Using Go struct field names instead of snake_case requires custom MarshalJSON/UnmarshalJSON for time fields, but maintains better cross-platform compatibility.

## Self-Check: PASSED

✅ All files created exist
✅ All commits exist
✅ All tests pass (35/35)
✅ JSON fixtures valid (37 fixtures total)
✅ Builder API functional with method chaining
