# Test Infrastructure Improvement Plan

## Current State Assessment

### What's Working Well
- **GUT Framework**: Well-integrated Godot testing with proper test runner
- **Test Suites Organization**: Clear directory structure (player, combat, gear, network, etc.)
- **E2E Framework**: Custom E2ETestFramework exists with UserJourneyE2ETests
- **CI Integration**: Comprehensive GitHub Actions workflow with:
  - Godot tests
  - Backend tests with coverage
  - Test pyramid validation
  - Coverage gates (80% target)
  - Flaky test detection
- **Test Pyramid Script**: Validates 70/20/10 distribution
- **Mocking Infrastructure**: Custom MockNetwork classes for testing RPCs
- **Performance Tests**: Dedicated suite for 60fps, low-end device benchmarks

### Issues Identified

#### 1. Backend Test Infrastructure Missing
- **Problem**: `backend/tests/` directory doesn't exist; backend tests aren't actually running
- **Impact**: Critical systems (combat_system.ts, rpg_system.ts, matchmaker.ts) not tested
- **Evidence**: `test.yml` references `backend/tests/` but directory doesn't exist

#### 2. Integration Test Suite Empty
- **Problem**: `test/suites/integration/` only has `.gitkeep` and README
- **Impact**: No integration tests between components
- **Current Coverage**: 0 tests (vs. 10-30% target)

#### 3. Flaky Test System Over-Complex
- **Problem**: Multiple overlapping flaky test detection scripts
  - `detect-godot-flaky-tests.py`
  - `detect_godot_flaky_tests.py`
  - `detect-go-flaky-tests.sh`
  - `quarantine-flaky-tests.sh`
  - `mark-flaky-tests.sh`
- **Impact**: Confusing, hard to maintain
- **Data Files**: Multiple overlapping history files in `data/`

#### 4. Test Coverage Gaps
- Many autoloads lack test files (e.g., AccessibilityManager, AudioManager, AnimationUtils)
- Coverage gate uses proxy metrics (function count ratio) instead of real instrumentation

#### 5. Property-Based Testing Missing
- No fuzz/property-based testing for:
  - Combat damage calculations
  - State machine transitions
  - Network serialization

---

## Improvement Plan

### Phase 1: Backend Test Infrastructure (Priority: Critical)

**CRITICAL FINDING:** The backend test infrastructure doesn't exist in this repository. Unlike what the planning documents describe:

- No `backend/src/` directory exists
- No `backend/tests/` directory exists  
- No `go.mod` file exists
- No TypeScript source files to test
- Package.json has Jest configured but no test files

The references to Go tests in planning docs appear to be aspirational or from a different project state.

**Proposed Approach - Option A (Recommended):** Create TypeScript test infrastructure
```
backend/
├── src/
│   └── modules/           # Create TypeScript source files first
│       ├── combat_system.ts
│       ├── rpg_system.ts
│       └── matchmaker.ts
├── tests/
│   ├── unit/
│   └── integration/
└── jest.config.js
```

**Proposed Approach - Option B:** If Go backend exists elsewhere, document where it lives

**Actions:**
1. Confirm if TypeScript backend source should exist in this repo
2. OR confirm if Go backend lives in separate repository
3. Set up proper test infrastructure once source is available

### Phase 2: Fill Integration Test Suite (Priority: High)

Add real integration tests to `test/suites/integration/`:
- Cross-manager communication tests
- Network + Combat integration
- PlayerStats + Gear + Combat flow
- Save/Load persistence integration

### Phase 3: Simplify Flaky Test Detection (Priority: Medium)

**Consolidate** the 5+ flaky test scripts into a single tool:
- Remove duplicate Python scripts
- Use a single shell script with clear flags
- Simplify data file structure to one `data/flaky-tests.json`

**Add to CI**: Run flaky detection only on nightly/weekly schedule, not every PR

### Phase 4: Add Property-Based Testing (Priority: Medium)

Add to Godot test suite:
- Fuzz testing for damage calculation edge cases
- State machine stress tests
- Network payload fuzzing

### Phase 5: Missing Test Coverage (Priority: Low)

Add test files for uncovered autoloads:
- AccessibilityManager
- AudioManager
- AnimationUtils
- ArcherDesignTokens (if testable)
- EncounterData

---

## Implementation Roadmap

| Phase | Task | Effort | Impact |
|-------|------|--------|--------|
| 1 | Backend Jest setup | Medium | Critical |
| 1 | Backend unit tests | Medium | Critical |
| 2 | Integration tests | Medium | High |
| 3 | Simplify flaky system | Low | Medium |
| 4 | Property-based tests | Low | Medium |
| 5 | Missing autoload tests | Low | Low |

---

## Status: PHASE 1 COMPLETED ✅

### Completed in this phase:
1. Created `backend/src/` TypeScript modules:
   - `src/modules/combat_system.ts` - Combat mechanics
   - `src/modules/rpg_system.ts` - Player progression  
   - `src/modules/matchmaker.ts` - Matchmaking

2. Created `backend/tests/` with 39 unit tests (all passing)

3. Jest config with 80% coverage threshold

4. Results: 90.54% statement coverage, 94.44% function coverage

---

## Success Metrics

- Backend test coverage > 70%
- Integration tests > 10% of total
- Test pyramid validates without violations
- Flaky test detection runs without manual intervention
- Property-based tests catch 3+ edge cases in combat math
