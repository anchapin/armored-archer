# Phase 15: Property-Based Testing Expansion - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add property-based tests to progression, matchmaking, and inventory systems to systematically discover edge cases. Use testing/quick for simple invariants and evaluate rapid for complex state machines. Target 20+ property tests total across three systems.

Scope: progression system (XP formulas, level-up mechanics), matchmaking system (skill matching fairness, algorithm properties), inventory system (item constraints, validation rules). Document and fix discovered edge cases.

</domain>

<decisions>
## Implementation Decisions

### Progression System
- Use testing/quick as primary library — matches existing patterns in rng_property_test.go, proven for simple mathematical invariants (XP formulas, stat scaling)
- Test all XP sources — comprehensive coverage across PvE, PvP, quests to prevent source-specific bugs (PBT-01 requirement)
- Target 6-8 progression tests — achievable within 20+ total budget, sufficient coverage for XP formulas, level-up mechanics, stat allocation invariants

### Matchmaking System
- Use hybrid data approach — synthetic player data with known skill ratings as base, include realistic outliers for edge case coverage
- Apply ±15% skill matching tolerance — industry standard for fair matchmaking, aligns with PBT-02 requirement for algorithm properties
- Target 6-8 matchmaking tests — balanced with progression/inventory to hit 20+ total, covers fairness, order independence, distribution properties

### Inventory System
- Test both equip constraints and item validation — equip constraints (one per slot) and item validation (rarity hierarchy, type constraints) to satisfy PBT-03 requirement
- Target 6-8 inventory tests — comprehensive loadout coverage while staying within 20+ total test budget
- Use explicit edge case testing — separate test cases for empty inventory, full inventory, duplicate items (proven pattern from rng_property_test.go bounds checking)

### Library Selection
- testing/quick for all systems — primary choice based on proven patterns and simple invariant nature across all three systems
- rapid library evaluation deferred to future phases if testing/quick proves insufficient for complex state machines

### Claude's Discretion
Specific invariants to test are at Claude's discretion based on domain knowledge. Examples to consider:
- Progression: XP formula consistency, level-up stat scaling, ability point allocation constraints
- Matchmaking: skill matching fairness, order independence of candidates, distribution properties within tolerance bands
- Inventory: loadout slot uniqueness, rarity hierarchy constraints, item type validation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- testing/quick library — already available via Go modules, matches existing property testing patterns
- rng_property_test.go in backend/internal/rng/ — proven pattern for property tests (156 lines, 6 tests)
  - TestRollIntProperty_WithinBounds — bounds checking for RNG output
  - TestRollIntProperty_UniformDistribution — statistical validation
  - TestRollChoiceProperty_FromSlice — slice element validation
  - TestShuffleProperty_Permutation — permutation invariants
  - TestSeedProperty_DifferentSequences — seed reproducibility
  - TestSeedProperty_SameSequence — deterministic behavior
- TestPlayer fixtures in backend/tests/testhelpers/fixtures_builder.go — PlayerBuilder with WithLevel(), WithStats(), WithGear() methods for test data generation

### Established Patterns
- Property tests use explicit loops with sample counts (100-10000 iterations)
- Fixed seed for reproducibility (Seed(42) pattern)
- Tolerance-based validation for statistical properties (30% tolerance in uniform distribution test)
- Assertion-based failure reporting (t.Errorf with context)

### Integration Points
- Progression system in backend/internal/rpg/rpg.go — PlayerStats struct, XP scaling formulas, level-up logic
- Matchmaking in backend/internal/modules/modules.go — PVPAsyncMatchmaker function, TODO for implementation
- Inventory via RPCs in backend/internal/rpc/rpc.go — GetInventory, EquipGear functions
- Test helpers in backend/tests/testhelpers/ — factory fixtures for Player and Gear data

</code_context>

<specifics>
## Specific Ideas

From user decisions during smart discuss:

**Progression System:**
- testing/quick library (primary choice)
- Test all XP sources: PvE, PvP, quests
- 6-8 property tests covering XP formulas, level-up mechanics, stat allocation invariants
- Pattern from rng_property_test.go: explicit loops, fixed seeds, tolerance validation

**Matchmaking System:**
- Hybrid data approach: synthetic base with realistic outliers
- ±15% skill matching tolerance (industry standard)
- 6-8 property tests for fairness, order independence, distribution properties

**Inventory System:**
- Both equip constraints and item validation tests
- 6-8 property tests for loadout constraints, rarity hierarchy, slot validation
- Explicit edge cases: empty inventory, full inventory, duplicate items (pattern from TestRollIntProperty_WithinBounds)

</specifics>

<deferred>
## Deferred Ideas

- rapid library evaluation — deferred if testing/quick proves sufficient for simple invariants across all three systems
- Complex state machine testing — deferred if matchmaking algorithm remains simple (TODO in modules.go)
- Godot property tests — out of scope for this phase (Go backend only)
- Store/season/notifications property tests — deferred to v2.6.0 (documented in REQUIREMENTS.md)

</deferred>
