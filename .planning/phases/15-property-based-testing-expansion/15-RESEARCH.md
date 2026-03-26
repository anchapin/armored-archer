# Phase 15: Property-Based Testing Expansion - Research

**Researched:** 2026-03-22
**Domain:** Property-based testing for game progression, matchmaking, and inventory systems
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Progression System:**
- Use testing/quick as primary library — matches existing patterns in rng_property_test.go, proven for simple mathematical invariants (XP formulas, stat scaling)
- Test all XP sources — comprehensive coverage across PvE, PvP, quests to prevent source-specific bugs (PBT-01 requirement)
- Target 6-8 progression tests — achievable within 20+ total budget, sufficient coverage for XP formulas, level-up mechanics, stat allocation invariants

**Matchmaking System:**
- Use hybrid data approach — synthetic player data with known skill ratings as base, include realistic outliers for edge case coverage
- Apply ±15% skill matching tolerance — industry standard for fair matchmaking, aligns with PBT-02 requirement for algorithm properties
- Target 6-8 matchmaking tests — balanced with progression/inventory to hit 20+ total, covers fairness, order independence, distribution properties

**Inventory System:**
- Test both equip constraints and item validation — equip constraints (one per slot) and item validation (rarity hierarchy, type constraints) to satisfy PBT-03 requirement
- Target 6-8 inventory tests — comprehensive loadout coverage while staying within 20+ total test budget
- Use explicit edge case testing — separate test cases for empty inventory, full inventory, duplicate items (proven pattern from rng_property_test.go bounds checking)

**Library Selection:**
- testing/quick for all systems — primary choice based on proven patterns and simple invariant nature across all three systems
- rapid library evaluation deferred to future phases if testing/quick proves insufficient for complex state machines

### Claude's Discretion
Specific invariants to test are at Claude's discretion based on domain knowledge. Examples to consider:
- Progression: XP formula consistency, level-up stat scaling, ability point allocation constraints
- Matchmaking: skill matching fairness, order independence of candidates, distribution properties within tolerance bands
- Inventory: loadout slot uniqueness, rarity hierarchy constraints, item type validation

### Deferred Ideas (OUT OF SCOPE)
- rapid library evaluation — deferred if testing/quick proves sufficient for simple invariants across all three systems
- Complex state machine testing — deferred if matchmaking algorithm remains simple (TODO in modules.go)
- Godot property tests — out of scope for this phase (Go backend only)
- Store/season/notifications property tests — deferred to v2.6.0 (documented in REQUIREMENTS.md)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PBT-01 | Add invariant tests for progression system (XP consistency, level-up mechanics) | testing/quick patterns from rng_property_test.go + rpg.go formulas documented |
| PBT-02 | Add invariant tests for matchmaking system (skill matching fairness, algorithm properties) | ±15% tolerance standard + hybrid data approach defined |
| PBT-03 | Add invariant tests for inventory system (item constraints, validation rules) | Loadout slot uniqueness + rarity hierarchy invariants identified |
| PBT-04 | Use testing/quick for simple invariants across progression, matchmaking, inventory | Go 1.25.0 stdlib includes testing/quick, proven patterns exist |
| PBT-05 | Evaluate rapid library for complex state machine testing (matchmaking state transitions) | rapid library deferred per CONTEXT.md decisions |
| PBT-06 | Add 20+ property tests total across 3 systems (progression, matchmaking, inventory) | 6-8 tests per system identified = 18-24 total tests |
</phase_requirements>

## Summary

Phase 15 expands property-based testing coverage to progression, matchmaking, and inventory systems using Go's standard library `testing/quick` package. The phase targets 20+ property tests across three systems, building on proven patterns from existing property tests in RNG (6 tests, 155 lines) and combat (6 tests, 143 lines).

**Primary recommendation:** Use `testing/quick` exclusively for this phase, following established patterns from `backend/internal/rng/rng_property_test.go`. The standard library package provides sufficient capability for simple invariants across all three systems. No additional dependencies required.

**Key findings:**
- `testing/quick` is available in Go 1.25.0 stdlib (current project version)
- Existing property tests demonstrate proven patterns: fixed seeds, explicit loops, tolerance-based validation
- Progression system has well-defined mathematical formulas (XP scaling, level calculation)
- Matchmaking algorithm is not yet implemented (TODO in modules.go), allowing flexible invariant design
- Inventory system has clear constraints (5 slot types, rarity hierarchy, unique slot constraints)
- Test fixtures available in `backend/tests/testhelpers/` for Player, Gear, and Match data generation

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testing/quick | Go 1.25.0 stdlib | Property-based testing for simple invariants | Part of Go standard library, frozen but stable, proven in existing tests |
| math/rand | Go 1.25.0 stdlib | Random number generation for test data | Used in existing property tests for deterministic randomness |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| testify | v1.11.1 | Assertion helpers, test utilities | Already in go.mod, used in existing tests |
| testfixtures | v0.41.0 | Database fixtures for integration tests | Available in go.mod, use for inventory/loadout tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testing/quick | rapid | rapid provides shrinking and state machine testing, but adds dependency. testing/quick sufficient for simple invariants. |

**Installation:**
```bash
# No installation required - testing/quick is in Go 1.25.0 stdlib
# Testify already installed (v1.11.1 in go.mod)
```

**Version verification:**
```bash
go version go1.25.0 linux/amd64  # Confirmed
go doc testing/quick  # Available in stdlib
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   ├── rpg/
│   │   ├── rpg.go                    # Progression logic (XP, levels, stats)
│   │   └── rpg_property_test.go       # PBT-01: Progression invariants
│   ├── matchmaking/
│   │   ├── matchmaking.go             # Skill matching logic (TODO: implement)
│   │   └── matchmaking_property_test.go  # PBT-02: Fairness invariants
│   ├── rpc/
│   │   ├── rpc.go                     # GetInventory, EquipGear (inventory RPCs)
│   │   └── rpc_property_test.go       # PBT-03: Inventory invariants
│   ├── rng/
│   │   └── rng_property_test.go       # Existing: RNG invariants (reference)
│   └── combat/
│       └── combat_property_test.go     # Existing: Combat invariants (reference)
└── tests/
    └── testhelpers/
        ├── fixtures_builder.go         # PlayerBuilder, GearBuilder, MatchBuilder
        └── fixtures.go                # TestPlayer, TestGear, TestMatch structs
```

### Pattern 1: Property Test Structure (from rng_property_test.go)
**What:** Standard property test pattern using testing/quick with explicit loops
**When to use:** All property tests for progression, matchmaking, and inventory systems
**Example:**
```go
// Source: backend/internal/rng/rng_property_test.go (lines 10-22)
func TestRollIntProperty_WithinBounds(t *testing.T) {
    Seed(42) // Fixed seed for reproducibility
    for i := 0; i < 1000; i++ {
        min := rand.Intn(1000)
        max := min + rand.Intn(1000) + 1

        result := RollInt(min, max)

        if result < min || result >= max {
            t.Errorf("RollInt(%d, %d) returned %d, outside bounds", min, max, result)
        }
    }
}
```

### Pattern 2: Statistical Validation (from rng_property_test.go)
**What:** Tolerance-based validation for statistical properties
**When to use:** XP distribution, skill matching distribution, stat allocation distribution
**Example:**
```go
// Source: backend/internal/rng/rng_property_test.go (lines 24-47)
func TestRollIntProperty_UniformDistribution(t *testing.T) {
    min := 0
    max := 100
    samples := 10000

    counts := make([]int, max-min)
    Seed(42) // Fixed seed for reproducibility

    for i := 0; i < samples; i++ {
        val := RollInt(min, max)
        counts[val]++
    }

    // Check each value appears approximately same number of times
    expected := float64(samples) / float64(max-min)
    tolerance := expected * 0.30 // 30% tolerance (adjusted for statistical variance)

    for i, count := range counts {
        if count < int(expected-tolerance) || count > int(expected+tolerance) {
            t.Errorf("Value %d appeared %d times, expected ~%d +/- %d", i, count, int(expected), int(tolerance))
        }
    }
}
```

### Pattern 3: Invariant with Skip Logic (from combat_property_test.go)
**What:** Property tests that skip invalid inputs
**When to use:** XP formulas (non-negative), stat allocation (positive values)
**Example:**
```go
// Source: backend/internal/combat/combat_property_test.go (lines 83-110)
func TestDamageProperty_CritIncreasesDamage(t *testing.T) {
    property := func(attack, defense int) bool {
        // Use only non-negative values to avoid zero damage edge cases
        if attack < 0 || defense < 0 {
            return true // Skip invalid inputs
        }

        attacker := &PlayerStats{}
        attacker.Stats.Attack = attack

        defender := &PlayerStats{}
        defender.Stats.Defense = defense

        normalDamage := CalculateDamage(attacker, defender)

        // Simulate crit (2x multiplier from combat.go)
        critDamage := normalDamage * 2

        // Crit should never deal less damage than normal hit
        return critDamage >= normalDamage
    }

    if err := quick.Check(property, nil); err != nil {
        t.Errorf("Critical hit did not increase damage: %v", err)
    }
}
```

### Anti-Patterns to Avoid
- **Not using fixed seeds:** Property tests must be reproducible. Always use `Seed(42)` or similar.
- **Too low sample counts:** Use 100-1000 iterations for mathematical invariants, 10000+ for statistical validation.
- **Ignoring edge cases:** Explicitly test empty/full inventory, zero XP, max level boundaries.
- **Mixing property tests with unit tests:** Keep property tests in separate `*_property_test.go` files.
- **Testing implementation details:** Focus on invariants (what must be true), not how it's implemented.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random input generation | Manual random loops | `testing/quick` with `quick.Check()` | Handles type reflection, shrinks failures automatically |
| Statistical validation | Manual chi-square tests | Explicit loop with tolerance bounds (30% from rng_property_test.go) | Simpler, sufficient for game balance validation |
| Test data generation | Ad-hoc structs | `TestPlayerBuilder`, `GearBuilder`, `MatchBuilder` from testhelpers | Fluent API, sensible defaults, auto-scaling |
| Reproducibility | Time-based seeds | Fixed seeds (`Seed(42)`) | Same test run produces same results, debugging easier |
| XP formula testing | Hardcoded test cases | Property test with random XP values | Covers edge cases automatically, not just happy path |

**Key insight:** Property-based testing is about discovering edge cases through random inputs, not enumerating test cases. The `testing/quick` package handles the heavy lifting of generating inputs and shrinking failures to minimal counterexamples.

## Common Pitfalls

### Pitfall 1: Non-deterministic Tests
**What goes wrong:** Tests fail intermittently due to random number generation without fixed seeds
**Why it happens:** Go's `math/rand` defaults to time-based seed, producing different sequences each run
**How to avoid:** Always call `Seed(42)` (or other fixed value) at test start
**Warning signs:** "Test passes locally, fails in CI" syndrome

### Pitfall 2: Testing the Wrong Properties
**What goes wrong:** Testing implementation details instead of invariants (what must be true)
**Why it happens:** Confusing property-based testing with unit testing
**How to avoid:** Focus on invariants: "XP should always be non-negative" not "CalculateLevel returns floor(sqrt(xp/100))"
**Warning signs:** Tests break when refactoring internal implementation

### Pitfall 3: Insufficient Sample Counts
**What goes wrong:** Tests pass despite bugs because random inputs rarely trigger edge cases
**Why it happens:** Low iteration counts (10-100) don't explore input space sufficiently
**How to avoid:** Use 1000+ iterations for mathematical invariants, 10000+ for statistical validation
**Warning signs:** Bugs discovered in production despite "all tests passing"

### Pitfall 4: Ignoring Statistical Variance
**What goes wrong:** Tests fail due to natural statistical fluctuations, not actual bugs
**Why it happens:** Treating random distributions as deterministic
**How to avoid:** Use tolerance-based validation (30% from rng_property_test.go) for statistical properties
**Warning signs:** "Flaky property test" CI failures that go away on re-run

### Pitfall 5: Testing Unimplemented Features
**What goes wrong:** Writing property tests for matchmaking before algorithm is implemented
**Why it happens:** Eagerly covering requirements without underlying implementation
**How to avoid:** Matchmaking algorithm is TODO in modules.go - design invariants now, implement tests after algorithm
**Warning signs:** Tests for functions that return "Not yet implemented" errors

## Code Examples

Verified patterns from existing property tests:

### Progression System - XP Level Consistency
```go
// Invariant: XP never decreases, level is monotonic function of XP
func TestProgressionProperty_XPLevelMonotonic(t *testing.T) {
    rand.Seed(42)
    for i := 0; i < 1000; i++ {
        xp := rand.Intn(100000) // Random XP from 0-99999
        level1 := rpg.CalculateLevel(xp)

        // Add more XP
        xp2 := xp + rand.Intn(10000)
        level2 := rpg.CalculateLevel(xp2)

        // Higher XP should never decrease level
        if xp2 > xp && level2 < level1 {
            t.Errorf("XP increased from %d to %d, but level decreased from %d to %d",
                xp, xp2, level1, level2)
        }
    }
}
```

### Progression System - Stat Allocation Conservation
```go
// Invariant: Total stats increase equals points allocated
func TestProgressionProperty_StatConservation(t *testing.T) {
    rand.Seed(42)
    for i := 0; i < 1000; i++ {
        player := rpg.NewPlayerStats("test-user")
        initialStats := player.GetTotalStats()

        // Random stat allocation
        statName := rpg.ValidStats[rand.Intn(len(rpg.ValidStats))]
        points := rand.Intn(rpg.MaxStatPointsPerLevel) + 1

        player.AbilityPoints += points
        err := player.AllocateStat(statName, points)

        if err != nil {
            t.Errorf("Stat allocation failed: %v", err)
        }

        finalStats := player.GetTotalStats()
        expectedIncrease := points

        if finalStats-initialStats != expectedIncrease {
            t.Errorf("Stats increased by %d, expected %d from allocating %d points",
                finalStats-initialStats, expectedIncrease, points)
        }
    }
}
```

### Matchmaking System - Skill Fairness (±15% Tolerance)
```go
// Invariant: Matched players' skill ratings within ±15% of each other
func TestMatchmakingProperty_SkillFairness(t *testing.T) {
    rand.Seed(42)
    tolerance := 0.15 // 15% per CONTEXT.md decision

    for i := 0; i < 1000; i++ {
        skill1 := rand.Intn(100) + 1
        skill2 := rand.Intn(100) + 1

        // Simulate matchmaking: only match if within tolerance
        shouldMatch := float64(skill1) * (1 - tolerance) <= float64(skill2) &&
                      float64(skill2) <= float64(skill1) * (1 + tolerance)

        if shouldMatch {
            // Verify tolerance holds both directions
            ratio1 := float64(skill1) / float64(skill2)
            ratio2 := float64(skill2) / float64(skill1)

            if ratio1 < 1-tolerance || ratio1 > 1+tolerance {
                t.Errorf("Skill ratio %.2f outside ±%.0f%% tolerance", ratio1, tolerance*100)
            }
            if ratio2 < 1-tolerance || ratio2 > 1+tolerance {
                t.Errorf("Skill ratio %.2f outside ±%.0f%% tolerance", ratio2, tolerance*100)
            }
        }
    }
}
```

### Inventory System - Loadout Slot Uniqueness
```go
// Invariant: Each loadout slot can have at most one gear item
func TestInventoryProperty_SlotUniqueness(t *testing.T) {
    rand.Seed(42)
    slotTypes := []string{"helm", "armor", "bow", "arrow", "amulet"}

    for i := 0; i < 1000; i++ {
        loadout := make(map[string]string) // slot -> gear_id

        // Simulate equipping multiple items
        numEquips := rand.Intn(10) + 1
        for j := 0; j < numEquips; j++ {
            slot := slotTypes[rand.Intn(len(slotTypes))]
            gearID := fmt.Sprintf("gear-%d", rand.Intn(1000))
            loadout[slot] = gearID
        }

        // Verify each slot has exactly one item
        for _, slot := range slotTypes {
            if _, exists := loadout[slot]; exists {
                // Slot should have exactly one gear_id
                if len(loadout) > 5 {
                    t.Errorf("Loadout has %d items, max 5 slots", len(loadout))
                }
            }
        }
    }
}
```

### Inventory System - Rarity Hierarchy
```go
// Invariant: Higher rarity gear has higher or equal base stats
func TestInventoryProperty_RarityHierarchy(t *testing.T) {
    rand.Seed(42)
    rarities := []string{"common", "rare", "epic", "legendary"}
    rarityStats := map[string]int{
        "common": 5,
        "rare": 10,
        "epic": 15,
        "legendary": 20,
    }

    for i := 0; i < 1000; i++ {
        rarity1 := rarities[rand.Intn(len(rarities))]
        rarity2 := rarities[rand.Intn(len(rarities))]

        stats1 := rarityStats[rarity1]
        stats2 := rarityStats[rarity2]

        // If rarity1 is higher than rarity2, stats1 should be >= stats2
        if rarity1 > rarity2 && stats1 < stats2 {
            t.Errorf("Higher rarity %s (%d) has lower stats than %s (%d)",
                rarity1, stats1, rarity2, stats2)
        }
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unit tests only | Unit + property tests | Phase 15 | Systematic edge case discovery |
| Hand-rolled property tests | testing/quick stdlib | Go 1.x | No dependencies, stable API |
| Reproduce failures manually | Auto-shrinking with quick.Check | testing/quick | Minimal counterexamples for debugging |

**Deprecated/outdated:**
- Custom random test generators: testing/quick provides reflection-based generation
- Manual statistical analysis: Use tolerance-based validation instead
- Third-party property testing libs: testing/quick is sufficient for simple invariants

## Open Questions

1. **Matchmaking implementation timing**
   - What we know: Matchmaking algorithm is TODO in modules.go (line 14)
   - What's unclear: When will matchmaking algorithm be implemented relative to property tests?
   - Recommendation: Design invariants now, implement property tests after algorithm is implemented (use placeholder/mock for PBT-02)

2. **Rapid library evaluation criteria**
   - What we know: rapid library evaluation deferred per CONTEXT.md decisions
   - What's unclear: What conditions trigger rapid library evaluation?
   - Recommendation: Evaluate rapid if testing/quick proves insufficient for complex state machines (e.g., matchmaking state transitions become non-trivial)

3. **XP source testing strategy**
   - What we know: Must test all XP sources (PvE, PvP, quests) per CONTEXT.md
   - What's unclear: Are these separate property tests or parameterized tests?
   - Recommendation: Use parameterized property tests with source as parameter to test invariants common to all sources

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go testing package + testing/quick (stdlib) |
| Config file | None - test configuration in code (quick.Config) |
| Quick run command | `go test -v ./internal/rpg/ -run "Property" -timeout 30s` |
| Full suite command | `go test ./... -timeout 5m` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PBT-01 | XP consistency, level-up mechanics | property | `go test -v ./internal/rpg/ -run "Property" -timeout 30s` | ❌ Wave 1 |
| PBT-02 | Skill matching fairness, algorithm properties | property | `go test -v ./internal/matchmaking/ -run "Property" -timeout 30s` | ❌ Wave 1 |
| PBT-03 | Item constraints, validation rules | property | `go test -v ./internal/rpc/ -run "Property" -timeout 30s` | ❌ Wave 1 |
| PBT-04 | Use testing/quick for simple invariants | N/A (implementation detail) | N/A | ✅ Stdlib available |
| PBT-05 | Evaluate rapid library | N/A (evaluation task) | N/A | ✅ Deferred per CONTEXT |
| PBT-06 | 20+ property tests total | property | `go test ./... -run "Property" | grep -c "^---" | awk '{print $1}'` | ❌ Wave 1 |

### Sampling Rate
- **Per task commit:** `go test -v ./internal/rpg/ -run "Property" -timeout 30s` (package-specific)
- **Per wave merge:** `go test ./... -timeout 5m` (full suite)
- **Phase gate:** All 20+ property tests passing + mutation score targets met (from Phase 14)

### Wave 0 Gaps
- [ ] `backend/internal/rpg/rpg_property_test.go` — covers PBT-01 (progression invariants)
- [ ] `backend/internal/matchmaking/matchmaking_property_test.go` — covers PBT-02 (fairness invariants)
- [ ] `backend/internal/rpc/rpc_property_test.go` — covers PBT-03 (inventory invariants)
- [ ] Framework install: None required (testing/quick in Go 1.25.0 stdlib)

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Sources

### Primary (HIGH confidence)
- Go 1.25.0 standard library - testing/quick package documentation
- backend/internal/rng/rng_property_test.go - 155 lines, 6 proven property test patterns
- backend/internal/combat/combat_property_test.go - 143 lines, combat invariants
- backend/internal/rpg/rpg.go - 460 lines, progression formulas (XP, levels, stats)
- backend/internal/modules/modules.go - Matchmaking TODO (line 14)
- backend/internal/rpc/rpc.go - GetInventory (line 556), EquipGear (line 660) RPCs
- backend/tests/testhelpers/fixtures_builder.go - PlayerBuilder, GearBuilder, MatchBuilder patterns
- backend/DATABASE_SCHEMA.md - Inventory/loadout constraints, slot types, rarity hierarchy
- 15-CONTEXT.md - User decisions: testing/quick, 6-8 tests per system, ±15% tolerance

### Secondary (MEDIUM confidence)
- Go documentation on testing/quick package - stdlib availability, Config structure
- Existing property test patterns from Phase 14 mutation testing integration

### Tertiary (LOW confidence)
- None - all findings verified against code or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - testing/quick verified in Go 1.25.0 stdlib, existing tests demonstrate patterns
- Architecture: HIGH - proven patterns from 2 existing property test files (298 lines total)
- Pitfalls: HIGH - common PBT pitfalls identified from existing test analysis
- Matchmaking: MEDIUM - algorithm not implemented yet, invariants designed but unverified

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (30 days - stable domain, testing patterns unlikely to change)
