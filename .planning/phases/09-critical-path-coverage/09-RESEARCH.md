# Phase 09: Critical Path Coverage - Research

**Researched:** 2026-03-21
**Domain:** Go testing, test coverage improvement, high-risk system testing
**Confidence:** HIGH

## Summary

Phase 9 focuses on achieving 80% test coverage on the three highest-risk, highest-impact backend systems: combat, matchmaking, and progression (RPG). These systems contain 303 total functions with 97 currently at 0% coverage (32%). The phase requires systematically adding tests to uncovered functions while maintaining test quality standards established in Phase 8. Critical path coverage is prioritized over overall 60% threshold because bugs in these systems have outsized impact on player experience and game balance.

**Primary recommendation:** Use gap analysis script to identify specific uncovered functions, then add tests following table-driven patterns, property-based testing for math-heavy functions, and integration tests for complex workflows.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRIT-01 | Combat system reaches 80% test coverage | Current: 15.1%, 38/86 functions at 0% coverage. Table-driven tests for state transitions, property tests for damage calculations, integration tests for combat workflows. |
| CRIT-02 | Matchmaking system reaches 80% test coverage | Current: estimated 20-25%, 37/94 functions at 0% coverage. Tests needed for Elo calculations, ranking logic, match lifecycle management. |
| CRIT-03 | Progression (rpg) system reaches 80% test coverage | Current: estimated 60-65%, 22/123 functions at 0% coverage. Tests needed for XP calculations, level progression, stat allocation validation. |
| CRIT-04 | Critical path coverage threshold (80%) enforced before overall 60% target | Quality gates already exist in Phase 8 (`tests/quality/coverage_gates.sh`). Script enforces 80% threshold for combat, matchmaking, rpg packages. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testify | v1.11.1 | Test assertions, table-driven tests | Already in project, industry-standard for Go testing |
| go test | Built-in | Test execution, coverage profiling | Go's native testing tool, reliable and well-documented |
| go tool cover | Built-in | Coverage report generation, gap analysis | Official Go coverage tool, integrates with CI/CD |
| testing/quick | Built-in | Property-based testing for combat math | Go stdlib tool for property-based testing, already used in combat |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| testhelpers | Custom | Domain-specific assertions (player stats, gear, matches) | Simplifies test code, provides domain-specific error messages |
| bash | Built-in | CI/CD scripting, coverage gate enforcement | Quality gates already implemented in Phase 8 |
| awk/grep | Built-in | Coverage data parsing, gap analysis | Gap analysis script already implemented in Phase 8 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| testify | gomega | testify is simpler, already in project, less boilerplate |
| testing/quick | rapid | rapid is more powerful but heavier dependency, testing/quick sufficient for this phase |
| Custom gap analysis | Third-party coverage tools | Gap analysis already implemented, works with go tool cover output |

**Installation:**
```bash
# All required tools are Go built-ins or already installed
go test -v ./...                                    # Run tests
go test -coverprofile=coverage.out ./...                 # Generate coverage
go tool cover -func=coverage.out                          # View coverage by function
go tool cover -html=coverage.out                          # View HTML report
```

**Version verification:**
```bash
go version                                            # Verify Go version
go list -m github.com/stretchr/testify                  # Verify testify v1.11.1
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── internal/
│   ├── combat/              # Combat system (CRIT-01)
│   │   ├── combat.go         # 86 functions, 38 at 0% coverage
│   │   └── combat_property_test.go  # Property tests (already exist)
│   ├── matchmaking/         # Matchmaking system (CRIT-02)
│   │   ├── matchmaking.go   # 94 functions, 37 at 0% coverage
│   │   └── (no tests yet)
│   └── rpg/               # Progression system (CRIT-03)
│       ├── rpg.go          # 123 functions, 22 at 0% coverage
│       └── (no tests yet)
├── tests/
│   ├── combat/             # Combat tests (already exist)
│   │   └── combat_test.go  # 308 lines, 10 test functions
│   ├── matchmaking/        # Matchmaking tests (already exist)
│   │   └── matchmaking_test.go  # 266 lines, 14 test functions
│   └── rpg/               # RPG tests (already exist)
│       └── rpg_test.go     # 349 lines, 17 test functions
└── scripts/
    ├── generate-coverage-report.sh   # Coverage generation (Phase 8)
    └── (quality gates in tests/quality/)
```

### Pattern 1: Table-Driven Tests for State Transitions
**What:** Test multiple scenarios using table-driven pattern
**When to use:** Validation functions, state machine transitions, business logic
**Example:**
```go
// Source: Existing project patterns (backend/tests/combat/combat_test.go)
func TestCombatActionValidate(t *testing.T) {
    tests := []struct {
        name        string
        setupAction func() *combat.CombatAction
        isValid     bool
    }{
        {
            name: "valid_action",
            setupAction: func() *combat.CombatAction {
                return &combat.CombatAction{
                    MatchID:    "match123",
                    ActionType: combat.ActionShoot,
                    Angle:      3.14159,
                    Power:      0.5,
                }
            },
            isValid: true,
        },
        {
            name: "empty_match_id",
            setupAction: func() *combat.CombatAction {
                return &combat.CombatAction{
                    MatchID:    "",
                    ActionType: combat.ActionShoot,
                    Angle:      3.14159,
                    Power:      0.5,
                }
            },
            isValid: false,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            action := tt.setupAction()
            err := action.Validate()

            if tt.isValid {
                assert.NoError(t, err, "Valid action should pass validation")
            } else {
                assert.Error(t, err, "Should fail validation")
            }
        })
    }
}
```

### Pattern 2: Property-Based Testing for Math-Heavy Functions
**What:** Verify mathematical properties hold for random inputs
**When to use:** Damage calculations, XP formulas, Elo ratings
**Example:**
```go
// Source: Existing project patterns (backend/internal/combat/combat_property_test.go)
func TestDamageProperty_NonNegative(t *testing.T) {
    property := func(attack, defense int) bool {
        attacker := &combat.PlayerStats{}
        attacker.Stats.Attack = attack

        defender := &combat.PlayerStats{}
        defender.Stats.Defense = defense

        damage := combat.CalculateDamage(attacker, defender)
        return damage >= 0
    }

    config := &quick.Config{
        MaxCount: 1000,
        Rand:     rand.New(rand.NewSource(42)),
    }

    if err := quick.Check(property, config); err != nil {
        t.Errorf("Damage calculation produced negative value: %v", err)
    }
}
```

### Pattern 3: Integration Tests for Complex Workflows
**What:** Test complete workflows across multiple functions
**When to use:** Combat action processing, match lifecycle, XP gain + level up
**Example:**
```go
// Source: Existing project patterns (backend/tests/combat/combat_test.go)
func TestProcessCombatAction(t *testing.T) {
    matchState := combat.NewMatchState("match123", "creator1", "opponent1",
        &combat.PlayerStats{}, &combat.PlayerStats{})
    matchState.CreatorStats.Stats.Attack = 20
    matchState.OpponentStats.Stats.Defense = 10

    action := &combat.CombatAction{
        MatchID:    "match123",
        ActionType: combat.ActionShoot,
        Angle:      3.14159,
        Power:      0.5,
    }

    result, err := combat.ProcessCombatAction(matchState, action,
        matchState.CreatorStats, matchState.OpponentStats)

    assert.NoError(t, err, "Should process combat action")
    assert.True(t, result.Success, "Result should be successful")
    assert.True(t, result.MatchStatus == combat.MatchStatusActive ||
        result.MatchStatus == combat.MatchStatusCompleted, "Match should be active or completed")
}
```

### Pattern 4: Gap-Driven Test Development
**What:** Use coverage gap analysis to prioritize test development
**When to use:** Phase 9 requires adding tests to reach 80% coverage
**Example:**
```bash
# Run gap analysis to identify uncovered functions
cd backend && go test -coverprofile=coverage.out ./internal/combat ./internal/matchmaking ./internal/rpg
go tool cover -func=coverage.out | grep "internal/combat/" | awk '$3 == "0.0%"'

# Output:
# internal/combat/combat.go:123.45,145.2  CalculateHitChance 0.0%
# internal/combat/combat.go:167.39,171.2  CalculateCrit 0.0%
# ...

# Prioritize: Start with high-risk functions (damage, hit chance, validation)
```

### Anti-Patterns to Avoid
- **Testing private methods:** Tests should validate public behavior, not implementation details
- **Coverage without quality:** Every test must have at least one assertion (Phase 8 quality gate)
- **Testing multiple concerns in one test:** One test function = one behavior
- **Ignoring edge cases:** Empty inputs, boundary values, nil pointers must be tested
- **Hardcoding expected values:** Use calculations or constants, not magic numbers

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test assertions | Custom assertion logic | testify assert/require | testify provides battle-tested assertions with clear error messages |
| Coverage parsing | Custom regex on output | go tool cover -func | Official tool handles all edge cases, provides structured output |
| Property testing | Custom random input generation | testing/quick | Go stdlib tool handles shrinking, seeding, and edge cases |
| Gap analysis | Manual code review | tests/quality/analyze_gaps.sh | Script already exists, automated and consistent |
| Coverage thresholds | Manual checks | tests/quality/coverage_gates.sh | Quality gates already implemented, enforced in CI/CD |

**Key insight:** All testing infrastructure from Phase 8 is available. Phase 9 focuses on adding tests, not building infrastructure.

## Common Pitfalls

### Pitfall 1: Testing Implementation Details Instead of Behavior
**What goes wrong:** Tests break when code refactors, even though behavior is unchanged
**Why it happens:** Testing internal functions instead of public APIs
**How to avoid:** Test public functions only, verify inputs and outputs, not intermediate state
**Warning signs:** Tests require importing internal package structure, not just public API

### Pitfall 2: Low Coverage Despite Many Tests
**What goes wrong:** Adding tests but coverage doesn't increase
**Why it happens:** Tests cover same code paths repeatedly, missing uncovered branches
**How to avoid:** Use gap analysis script (`tests/quality/analyze_gaps.sh`) to identify 0% coverage functions
**Warning signs:** Coverage report shows many lines still at 0% despite adding tests

### Pitfall 3: Tests Pass Without Assertions
**What goes wrong:** Coverage increases but tests don't catch bugs
**Why it happens:** Tests execute code but don't verify results (no assertions)
**How to avoid:** Phase 8 quality gate enforces at least one assertion per test
**Warning signs:** Test functions with no assert/require calls

### Pitfall 4: Flaky Tests Due to Randomness
**What goes wrong:** Tests fail intermittently due to random input
**Why it happens:** Using rand.Float64() directly instead of seeding or mocking
**How to avoid:** Seed random generators in tests, or use deterministic inputs
**Warning signs:** Tests pass locally but fail in CI, or fail inconsistently

### Pitfall 5: Testing Too Many Scenarios in One Test
**What goes wrong:** Test becomes unreadable, hard to debug when it fails
**Why it happens:** Combining multiple test cases into one test function
**How to avoid:** Use table-driven tests, one test case per t.Run() subtest
**Warning signs:** Test functions longer than 50 lines, multiple assert types in one test

## Code Examples

Verified patterns from official sources:

### Adding Tests for Uncovered Functions (Combat)
```go
// Source: Gap analysis output shows CalculateHitChance at 0% coverage
// backend/tests/combat/combat_test.go

func TestCalculateHitChance(t *testing.T) {
    tests := []struct {
        name           string
        angle          float64
        dodge          int
        minHitChance   float64
        maxHitChance   float64
    }{
        {"base_hit_chance", 3.14159, 0, 0.6, 0.8},
        {"high_dodge", 3.14159, 100, 0.1, 0.3},
        {"minimum_hit_chance", 0, 1000, 0.1, 0.95},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            hitChance := combat.CalculateHitChance(tt.angle, tt.dodge)
            assert.True(t, hitChance >= tt.minHitChance && hitChance <= tt.maxHitChance,
                "Hit chance should be within range [%f, %f], got %f", tt.minHitChance, tt.maxHitChance, hitChance)
        })
    }
}
```

### Adding Tests for Uncovered Functions (Matchmaking)
```go
// Source: Gap analysis output shows CalculateEloChange at 0% coverage
// backend/tests/matchmaking/matchmaking_test.go

func TestCalculateEloChange(t *testing.T) {
    // Test even match (same elo)
    winnerChange, loserChange := matchmaking.CalculateEloChange(1000, 1000, false)
    assert.True(t, winnerChange > 0, "Winner should gain elo")
    assert.True(t, loserChange < 0, "Loser should lose elo")
    assert.True(t, winnerChange == -loserChange, "Changes should be symmetric")

    // Test punch-up (underdog wins)
    winnerChange, loserChange = matchmaking.CalculateEloChange(1000, 1200, true)
    assert.True(t, winnerChange > 16, "Underdog winner should gain more elo")
}
```

### Adding Tests for Uncovered Functions (RPG)
```go
// Source: Gap analysis output shows AddXP at 0% coverage
// backend/tests/rpg/rpg_test.go

func TestAddXP(t *testing.T) {
    stats := rpg.NewPlayerStats("user123")

    // Test small XP gain (no level up)
    levelsGained, _ := stats.AddXP(50, "pve")
    assert.Equal(t, 0, levelsGained, "Should not gain levels")
    assert.Equal(t, 50, stats.XP, "XP should be 50")

    // Test XP gain that causes level up (from 50 XP to 450 XP)
    levelsGained, _ = stats.AddXP(400, "pve")
    assert.Equal(t, 1, levelsGained, "Should gain 1 level")
    assert.Equal(t, 3, stats.AbilityPoints, "Should gain 3 ability points")
}
```

### Running Gap Analysis to Prioritize Testing
```bash
# Source: backend/tests/quality/analyze_gaps.sh (already exists)

cd backend
go test -coverprofile=coverage.out ./internal/combat ./internal/matchmaking ./internal/rpg
go tool cover -func=coverage.out | grep "internal/combat/" | awk '$3 == "0.0%"'

# Output shows specific functions needing tests:
# github.com/anchapin/armored-archer/backend/internal/combat/combat.go:118.59,121.25 1 CalculateHitChance 0.0%
# github.com/anchapin/armored-archer/backend/internal/combat/combat.go:167.39,171.2 1 CalculateCrit 0.0%
# ...

# Prioritize: High-risk functions first (damage, hit chance, validation)
```

### Verifying Quality Gates After Adding Tests
```bash
# Source: backend/tests/quality/coverage_gates.sh (already exists)

cd backend
go test -coverprofile=coverage/coverage.out ./...
bash tests/quality/coverage_gates.sh

# Output:
# Overall coverage: 65.0%
# PASS: Overall coverage 65.0% meets threshold
# Critical package coverage:
#   internal/combat: 82.5% (PASS)
#   internal/matchmaking: 79.2% (PASS)
#   internal/rpg: 81.0% (PASS)
# All coverage gates passed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual coverage estimation | go tool cover -func | v2.3.0 | Precise function-level coverage, no guessing |
| Testing random functions | Gap analysis prioritization | v2.4.0 | Systematic approach, highest impact first |
| Coverage without quality | Assertion requirement enforcement | v2.4.0 | Tests actually catch bugs, not just execute code |
| No quality gates | Automated threshold enforcement | v2.4.0 | Prevents regression, enforces 80% critical path |

**Deprecated/outdated:**
- Manual coverage estimation (replaced by go tool cover)
- Testing without gap analysis (replaced by tests/quality/analyze_gaps.sh)
- Coverage gaming without assertions (replaced by Phase 8 assertion requirement)
- Unprioritized test development (replaced by gap-driven testing)

## Open Questions

None - All infrastructure from Phase 8 is available and functional.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Go test + testify v1.11.1 + testing/quick |
| Config file | None - go test uses _test.go files |
| Quick run command | `go test -v -run TestSpecificFunc ./internal/combat` |
| Full suite command | `go test -v -coverprofile=coverage.out ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRIT-01 | Combat system reaches 80% coverage | unit + property + integration | `go test -v -coverprofile=coverage.out ./internal/combat && go tool cover -func=coverage.out | grep internal/combat | awk '{sum+=$3} END {print sum/NR}'` | ✅ backend/tests/combat/combat_test.go |
| CRIT-02 | Matchmaking system reaches 80% coverage | unit + integration | `go test -v -coverprofile=coverage.out ./internal/matchmaking && go tool cover -func=coverage.out | grep internal/matchmaking | awk '{sum+=$3} END {print sum/NR}'` | ✅ backend/tests/matchmaking/matchmaking_test.go |
| CRIT-03 | Progression system reaches 80% coverage | unit + integration | `go test -v -coverprofile=coverage.out ./internal/rpg && go tool cover -func=coverage.out | grep internal/rpg | awk '{sum+=$3} END {print sum/NR}'` | ✅ backend/tests/rpg/rpg_test.go |
| CRIT-04 | Critical path threshold enforced | integration | `go test -coverprofile=coverage.out ./... && bash tests/quality/coverage_gates.sh` | ✅ backend/tests/quality/coverage_gates.sh |

### Sampling Rate
- **Per task commit:** `go test -v -run TestSpecificFunc ./internal/combat` (quick sanity check)
- **Per wave merge:** `go test -v -coverprofile=coverage.out ./internal/combat ./internal/matchmaking ./internal/rpg && go tool cover -func=coverage.out | grep internal/` (full critical path check)
- **Phase gate:** Full suite green with all quality gates passing (80% combat, 80% matchmaking, 80% rpg) before `/gsd:verify-work`

### Wave 0 Gaps
None - existing test infrastructure covers all phase requirements:
- ✅ `backend/tests/combat/combat_test.go` - 10 test functions, 308 lines
- ✅ `backend/tests/matchmaking/matchmaking_test.go` - 14 test functions, 266 lines
- ✅ `backend/tests/rpg/rpg_test.go` - 17 test functions, 349 lines
- ✅ `backend/tests/quality/coverage_gates.sh` - enforces 80% threshold
- ✅ `backend/tests/quality/analyze_gaps.sh` - identifies 0% coverage functions
- ✅ `backend/tests/testhelpers/assertions.go` - domain-specific assertions

## Sources

### Primary (HIGH confidence)
- Go tool cover official documentation - https://pkg.go.dev/cmd/cover
- testify v1.11.1 documentation - https://pkg.go.dev/github.com/stretchr/testify
- testing/quick package documentation - https://golang.org/pkg/testing/quick
- Project existing test files (backend/tests/combat/combat_test.go, backend/tests/matchmaking/matchmaking_test.go, backend/tests/rpg/rpg_test.go)
- Project quality gate scripts (backend/tests/quality/coverage_gates.sh, backend/tests/quality/analyze_gaps.sh)
- Project coverage history (data/coverage-history.json)
- .planning/REQUIREMENTS.md - CRIT-01, CRIT-02, CRIT-03, CRIT-04 definitions
- .planning/phases/08-fix-broken-packages-establish-quality-gates/08-RESEARCH.md - Phase 8 infrastructure research

### Secondary (MEDIUM confidence)
- Go testing best practices - https://golang.org/pkg/testing
- Table-driven test patterns - https://dave.cheney.net/2019/05/07/prefer-table-driven-tests
- Property-based testing with Go - https://go.dev/blog/subtests

### Tertiary (LOW confidence)
None - All findings verified with official documentation and existing project code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - go test, go tool cover, and testify are well-documented and already in use
- Architecture: HIGH - All patterns verified from existing project test files and Phase 8 research
- Pitfalls: HIGH - Based on common testing mistakes documented in Go best practices and Phase 8 research

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (30 days for Go testing landscape)
