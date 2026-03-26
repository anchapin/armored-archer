# Phase 17: Coverage Gap Closure - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete remaining gap closure to reach 60% overall Go coverage target. Phase 16 achieved 47.4% coverage with excellent progress on critical packages, but 12.6% gap remains. This phase focuses on MEDIUM priority packages (feedback, notifications, observability, utils cache) using standard unit test patterns with no external dependencies.

Scope: feedback package testing (0% → 80%+), notifications package testing (50.9% → 70%+), observability package testing (64.4% → 85%+), utils cache testing (26.8% → 70%+), overall 60% verification, Stage 3 CI/CD gate validation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — focused gap closure phase with clear path to 60% target. The scope, requirements, and success criteria are well-defined:

- **Coverage targets**: Overall 60% (from 47.4%), feedback 0% → 80%+, notifications 50.9% → 70%+, observability 64.4% → 85%+, utils cache 26.8% → 70%+
- **Recommended approach**: Option A from Phase 16-06 gap recommendations (focus on MEDIUM priority packages)
- **Test patterns**: Standard unit tests, no external dependencies, leverage existing fixtures and testhelpers
- **Estimated duration**: 2-3 days (medium effort)

Implementation approach follows established patterns from Phase 16:
- Unit tests using testify and factory fixtures
- gomock for interface mocking (MockNakamaLogger already available)
- Table-driven tests for edge cases
- Coverage verification after each package

### Contingency Plans (from Phase 16-06 recommendations)
- **If coverage reaches 58-59%**: Add edge case tests in critical packages (Option C)
- **If coverage reaches 55-57%**: Add partial RPC handler tests for critical endpoints (Option B subset)
- **If coverage reaches <55%**: Reconsider extending phase or adjusting targets (Option D or E)

</decisions>

<code_context>
## Existing Code Insights

### Phase 16 Results
- **Overall coverage**: 47.4% (up from 39.2%, +8.2% improvement)
- **Critical packages**: RPG 94.4%, Matchmaking 95.8%, Combat 90.2%, Store 91.0%, Season 90.1% (all exceed targets)
- **Gap closure progress**: Logger 0% → 100%, Cache provider 0% → 100%
- **Remaining gap**: 12.6% to 60% target

### Reusable Assets
- `backend/tests/testhelpers/fixtures_builder.go` — factory pattern for Player and Gear test data
- `backend/tests/testhelpers/mocks/nakama_logger_mock.go` — MockNakamaLogger for runtime.Logger interface
- Existing test infrastructure from Phase 16 — unit test patterns, coverage measurement, CI/CD gates

### Established Patterns
- Go testing via `go test` with coverage reports (`go test -coverprofile=coverage.out`)
- gomock for interface mocking (MockNakamaLogger for logger dependencies)
- Table-driven tests for multiple scenarios
- Factory fixtures for test data (NewPlayerBuilder, NewGearBuilder)

### Integration Points
- Coverage reports in `.gitignore` to prevent test artifacts in version control
- CI/CD workflows in `.github/workflows/` (coverage.yml, test.yml)
- Stage 3 gate (60% threshold) in `backend/tests/quality/coverage_gates.sh`
- Makefile targets for local test execution (`make backend-test`, `make backend-coverage`)

### Remaining Gap Packages (116 gaps total, all MEDIUM priority)
- **Feedback package**: 0% coverage, 36 gaps, 704 lines
- **Notifications package**: 50.9% coverage, 17 gaps, 997 lines
- **Observability package**: 64.4% coverage, 15 gaps, 642 lines
- **Utils cache**: 26.8% coverage, 10 gaps
- **RPC handlers**: 0% coverage, 35 gaps, 2616 lines (HIGH effort, fallback option)

</code_context>

<specifics>
## Specific Ideas

From Phase 16-06 gap recommendations (Option A - RECOMMENDED):

**Feedback Package Testing (0% → 80%+, ~2-3% impact)**:
- Impact: ~2-3% overall coverage
- Effort: MEDIUM
- Test approach: Standard unit tests, no external dependencies
- Priority: HIGH (business logic, user-facing feature)

**Notifications Package Testing (50.9% → 70%+, ~3-4% impact)**:
- Impact: ~3-4% overall coverage
- Effort: MEDIUM
- Test approach: Standard unit tests, may need mock notification channels
- Priority: HIGH (business logic, user-facing feature)

**Observability Package Testing (64.4% → 85%+, ~2-3% impact)**:
- Impact: ~2-3% overall coverage
- Effort: MEDIUM
- Test approach: Standard unit tests, metrics and tracing mock
- Priority: MEDIUM (infrastructure, operational)

**Utils Cache Testing (26.8% → 70%+, ~1-2% impact)**:
- Impact: ~1-2% overall coverage
- Effort: LOW-MEDIUM
- Test approach: Extend existing cache tests, edge cases
- Priority: LOW (utility, infrastructure)

**Verification and CI/CD Enforcement**:
- Overall coverage verification: Confirm 60% target achieved
- Stage 3 gate validation: Confirm gate passes with 60% coverage
- REQUIREMENTS.md update: Mark COV-01 and COV-08 as COMPLETE
</specifics>

<deferred>
## Deferred Ideas

None — scope is clear from Phase 16-06 gap recommendations. All tasks are focused on closing the 12.6% gap to reach 60% coverage target.

</deferred>
