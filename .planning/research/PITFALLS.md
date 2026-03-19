# Domain Pitfalls: Testing & QA Infrastructure

**Domain:** Testing & QA Infrastructure for Go Backend and Godot Game Client
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that cause rewrites, major issues, or failed testing initiatives.

### Pitfall 1: The Ice Cream Cone Anti-Pattern

**What goes wrong:** Team writes mostly E2E tests (slow, flaky) with few unit tests (fast, reliable). Test pyramid looks like an inverted cone.

**Why it happens:**
- E2E tests feel "more real" — they simulate actual user behavior
- Developers don't understand unit testing value
- Pressure to "test everything like a user would"
- Lack of training on writing good unit tests

**Consequences:**
- CI takes 30+ minutes instead of 5 minutes
- Flaky tests waste developer time debugging test infrastructure instead of code
- Tests break constantly due to UI changes, database migrations, network conditions
- Team loses confidence in tests, starts ignoring failures
- Development velocity drops dramatically

**Prevention:**
- Enforce test pyramid: 70% unit, 20% integration, 10% E2E (Google's ratio)
- Make E2E tests expensive to write (require approval)
- Track test execution time; fail CI if tests take too long
- Educate team on test pyramid principles (Martin Fowler's article)
- Use code review to catch anti-pattern early

**Detection:**
- Test suite takes > 10 minutes to run
- High flaky test rate (> 5% of tests fail intermittently)
- Tests mostly exercise UI or full request/response cycle
- Few tests for individual functions or classes

### Pitfall 2: Testing Private Implementation Details

**What goes wrong:** Tests rely on private functions, internal state, or specific implementation paths. Code refactoring breaks tests even when behavior is correct.

**Why it happens:**
- Desire to be "thorough" and test every function
- Misunderstanding of what tests should validate (behavior vs implementation)
- Easy to write tests for private functions (they have simple inputs/outputs)
- Lack of interfaces to mock dependencies

**Consequences:**
- Refactoring becomes nightmare — every change breaks dozens of tests
- Tests become maintenance burden instead of safety net
- Team stops refactoring, code quality degrades
- False confidence — tests pass but system doesn't work
- Tests couple to code structure, not observable behavior

**Prevention:**
- Test public interfaces and observable behavior only
- Use black-box testing for integration tests
- Design code with interfaces for easy mocking
- Refactor tests when refactoring code (tests are part of codebase)
- Code review rule: No tests for private functions

**Detection:**
- Tests import internal packages or access private fields
- Tests break when code is refactored without behavior changes
- Tests have deep knowledge of implementation details
- High test-to-code ratio (> 2:1) suggests over-testing

### Pitfall 3: Skipping Race Detector in Concurrent Code

**What goes wrong:** Go backend uses goroutines (Nakama is highly concurrent) but tests don't run with `-race` flag. Race conditions slip into production.

**Why it happens:**
- Race detector makes tests 5-10x slower
- Races are intermittent — hard to reproduce, easy to ignore
- Developers think "it works on my machine"
- Pressure to ship features quickly

**Consequences:**
- Production data corruption
- Intermittent server crashes (impossible to debug)
- Security vulnerabilities (race conditions in auth code)
- Player progress lost or duplicated
- Reputation damage, player churn

**Prevention:**
- **Always run `go test -race` in CI** for concurrent code
- Treat race detector warnings as critical bugs (fix immediately)
- Use `sync.Mutex`, `channels`, or `sync/atomic` for shared state
- Design code to avoid shared mutable state (prefer message passing)
- Run race detector on subset of tests in CI (fast feedback), full suite nightly

**Detection:**
- Intermittent test failures that pass on retry
- Data corruption in production that can't be reproduced locally
- Server crashes under load (race conditions more likely under concurrency)
- `go test -race` finds issues (detection tool exists — use it!)

### Pitfall 4: Brittle Godot Autoload Tests

**What goes wrong:** Tests depend on autoload singletons (NetworkManager, GameManager, etc.) but don't isolate them properly. Tests pollute each other's state.

**Why it happens:**
- Autoloads are global singletons — hard to reset between tests
- Godot doesn't provide clean autoload lifecycle management
- Tests assume clean state but don't enforce it
- Lack of understanding of autoload persistence

**Consequences:**
- Flaky tests that pass/fail depending on execution order
- Tests pass individually but fail in suite
- Impossible to debug — state depends on which tests ran before
- Developers lose confidence in test suite

**Prevention:**
- Create fresh autoload instances in `before_each()` or `setup()`
- Use GUT's `doubling` feature to mock autoloads
- Design autoloads with reset methods for testing
- Avoid testing autoloads directly — test their logic in isolation
- Use dependency injection instead of autoloads where possible

**Detection:**
- Tests pass when run individually but fail in suite
- Tests pass when run in one order but fail in another
- Tests depend on `before_all()` setup (suggests shared state)
- High test failure rate that goes away on retry

### Pitfall 5: Mock Drift from Real Implementation

**What goes wrong:** Mock objects return different data than real systems. Tests pass but production fails because mocks don't match reality.

**Why it happens:**
- Mocks are manually maintained
- Real system changes (API responses, database schema) but mocks aren't updated
- Developers simplify mocks ("this is good enough for testing")
- No contract tests between mocks and real systems

**Consequences:**
- Tests pass but integration fails in production
- False confidence in code quality
- Wasted time debugging "working" code
- Production outages from mock-reality mismatch

**Prevention:**
- Use contract tests to validate mocks match real systems
- Generate mocks from interfaces (uber/mock) instead of manual mocks
- Update mocks when real systems change (part of feature work)
- Periodically run tests against real systems (staging environment)
- Use Pact or similar tools for consumer-driven contracts

**Detection:**
- Tests pass but integration/staging tests fail
- Mock returns hardcoded data that doesn't match API responses
- Mock hasn't been updated in months while real system changed
- Tests use `any()` for all mock arguments (too permissive)

## Moderate Pitfalls

Mistakes that cause significant problems but are recoverable.

### Pitfall 6: Coverage as Sole Quality Metric

**What goes wrong:** Team chases 100% coverage, writes meaningless tests to increase numbers, misses actual bugs.

**Why it happens:**
- Coverage is easy to measure (single number)
- Management wants simple metrics
- Code coverage tools are ubiquitous
- Misunderstanding that coverage ≠ quality

**Consequences:**
- Tests without assertions (coverage increases, no value)
- Testing trivial code (getters, constants) instead of critical paths
- False sense of security (high coverage, low quality)
- Gameable metric — developers write bad tests to hit targets

**Prevention:**
- Use coverage as one metric among many (flaky tests, performance, mutation testing)
- Set reasonable targets (80% for critical paths, not 100%)
- Code review to catch assertion-free tests
- Combine coverage with mutation testing (measures test effectiveness)
- Focus on testing risky code, not easy code

**Detection:**
- Tests with no assertions (just calling functions)
- Coverage high but bug rate still high
- Tests for simple getters/setters but not for complex logic
- Developers complain about "coverage targets" instead of "quality"

### Pitfall 7: Slow Test Suite

**What goes wrong:** Test suite takes 20+ minutes to run. Developers stop running tests locally, rely on CI, slow feedback loop.

**Why it happens:**
- Too many integration/E2E tests (ice cream cone)
- Tests don't run in parallel
- Tests use real database/network instead of mocks
- No incentive to keep tests fast

**Consequences:**
- Developers commit untested code (don't wait for tests)
- PRs take hours to validate
- Context switching while waiting for tests
- Reduced development velocity
- Bugs caught late (expensive to fix)

**Prevention:**
- Keep unit tests fast (< 0.1s per test)
- Use mocks for slow dependencies (database, network)
- Run tests in parallel (`go test -parallel`, Jest parallel workers)
- Separate fast tests (run on PR) from slow tests (run nightly)
- Track test execution time, fail CI if exceeds threshold

**Detection:**
- Full test suite takes > 10 minutes
- Developers rarely run tests locally
- CI tests run sequentially instead of in parallel
- High proportion of integration/E2E tests vs unit tests

### Pitfall 8: Ignoring Flaky Tests

**What goes wrong:** Tests fail intermittently. Developers retry until they pass, ignore the underlying problem.

**Why it happens:**
- Flaky tests are hard to debug
- Pressure to ship features (retry until pass, move on)
- No systematic flaky test tracking
- Tests depend on external state (database, network, time)

**Consequences:**
- Team loses confidence in tests (always "red" due to flakes)
- Real test failures ignored (assumed to be flakes)
- Wasted developer time debugging test infrastructure
- CI runs waste resources (retrying tests)
- Bugs slip through because test failures are ignored

**Prevention:**
- Treat flaky tests as critical bugs (fix immediately or quarantine)
- Use flaky test detection (run tests multiple times, flag inconsistent results)
- Quarantine flaky tests (move to separate suite, don't block PRs)
- Root cause analysis: Why is this test flaky? (timing, state, dependencies)
- Design tests to be deterministic (no sleeps, no shared state, mocks for external deps)

**Detection:**
- Tests fail intermittently (pass on retry)
- Test failure rate > 2-3%
- Developers say "oh, that test is always flaky"
- CI runs show test retries or skipped tests

### Pitfall 9: Test Data Sprawl

**What goes wrong:** Test data duplicated across many test files. Inconsistent data makes tests hard to understand and maintain.

**Why it happens:**
- Copy-paste test setup between tests
- No centralized fixture management
- Tests inline complex data setup
- Lack of test data builders

**Consequences:**
- Hard to understand tests (what is this test data?)
- Inconsistent test data (same test uses different data in different files)
- Test maintenance nightmare (change data structure, update 50 files)
- Tests become brittle (depend on specific data values)

**Prevention:**
- Create fixture library (`tests/fixtures/`) with factory functions
- Use builder pattern for complex objects (`fixtures.NewPlayer().WithLevel(5).Build()`)
- Centralize test data constants
- Use table-driven tests to reduce duplication
- Code review to catch copy-pasted test setup

**Detection:**
- Same test data setup repeated across multiple test files
- Complex inline data structures in test functions
- Hard to understand what test data represents
- Changing data structure requires updates in many test files

### Pitfall 10: Load Testing in Production

**What goes wrong:** Team tests load by hitting production servers. Risks crashing real system, impacting real players.

**Why it happens:**
- Easiest way to test with realistic data
- Staging environment doesn't match production scale
- Pressure to validate before major launch
- "It's just a quick test" mentality

**Consequences:**
- Production outage during load test
- Real players impacted (slow, errors, disconnects)
- Reputation damage, player churn
- Hard to distinguish load test traffic from real traffic
- Potential data corruption (load test creates real players/matches)

**Prevention:**
- Always load test against staging/development environment
- Scale staging to match production (or use cloud burst for load tests)
- Use synthetic traffic that's clearly identifiable (test user IDs)
- Rate limit load tests to prevent accidental production impact
- Never automate load tests against production

**Detection:**
- Load test scripts point to production URLs
- Load tests run during business hours (risk to players)
- No staging environment that matches production scale
- Load tests create real data (not isolated)

## Minor Pitfalls

Annoyances that reduce test quality but don't cause major issues.

### Pitfall 11: Tests Without Descriptive Names

**What goes wrong:** Tests named `test1()`, `test_works()`, or `testFeature()`. Failure messages don't explain what broke.

**Prevention:** Use descriptive names like `testCombatCalculationWithZeroAttackReturnsZero()`. Test name should document what it tests.

### Pitfall 12: Asserting Multiple Things in One Test

**What goes wrong:** Test has 10 assertions. One fails, rest don't run. Hard to debug which assertion failed and why.

**Prevention:** One logical assertion per test. Use table-driven tests for multiple test cases.

### Pitfall 13: Not Cleaning Up Test Resources

**What goes wrong:** Tests create database records, files, network connections but don't clean up. Resource leaks, pollution across tests.

**Prevention:** Always cleanup in `defer` or `teardown()`. Use testcontainers for automatic cleanup.

### Pitfall 14: Hardcoding Test Values

**What goes wrong:** Tests use hardcoded values (dates, IDs, magic numbers). Brittle tests, hard to understand.

**Prevention:** Use constants, factory functions, or generate test data programmatically.

### Pitfall 15: Testing Third-Party Code

**What goes wrong:** Tests for library functions (PostgreSQL driver, Nakama SDK). Waste of time, should trust library authors.

**Prevention:** Test your code, not libraries. Assume libraries work (or file bug reports if they don't).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: Unit Tests** | Testing private methods | Code review rule: Test public interfaces only |
| **Phase 2: Integration Tests** | Shared database state | Use testcontainers for isolated database per test suite |
| **Phase 3: Load Tests** | Load testing production | Never automate load tests against production; use staging |
| **Phase 4: CI/CD Gates** | Coverage gaming | Combine coverage with mutation testing, code review |
| **Phase 5: Advanced Testing** | Property tests without invariants | Start with simple properties, don't over-complicate |

## Godot-Specific Pitfalls

| Pitfall | Why Happens | Prevention |
|---------|-------------|------------|
| **UI-dependent tests** | Godot is visual engine, easy to test UI | Test autoload logic, not UI. Keep UI tests manual. |
| **Scene tree assumptions** | Tests assume scene tree structure | Use `add_child()` in test, don't assume pre-existing tree. |
| **Signal timing issues** | Async signals fire later, test misses them | Use `await` on signals, or `wait_for_signal()` helper. |
| **Resource loading** | Tests fail because resources not loaded | Use `load()` in test, or mock resource loading. |
| **Headless differences** | Tests work in editor but fail headless | Always test headless in CI (`godot --headless`). |

## Go Backend-Specific Pitfalls

| Pitfall | Why Happens | Prevention |
|---------|-------------|------------|
| **Missing `-race` flag** | Race detector slows tests | Always run with `-race` in CI for concurrent code |
| **Table test complexity** | Tables grow too large, hard to read | Split large tables into multiple test functions |
| **Interface pollution** | Create interfaces just for mocking | Only mock external dependencies, not internal code |
| **Testable design ignored** | Code hard to test (tight coupling) | Design for testability: dependency injection, interfaces |
| **Context not propagated** | Tests don't validate context cancellation | Test context cancellation in goroutines |

## Nakama-Specific Pitfalls

| Pitfall | Why Happens | Prevention |
|---------|-------------|------------|
| **Nakama runtime mocking** | Hard to mock Nakama runtime interface | Use testify/mock, define interface for Nakama deps |
| **Storage assumption** | Tests assume storage works | Mock Nakama storage, test failure modes |
| **RPC handler testing** | Hard to test RPC handlers in isolation | Extract business logic from RPC handlers, test separately |
| **Match dependency** | Tests assume match exists | Create test matches in fixtures, don't rely on global state |
| **Authentication not tested** | Tests skip auth for simplicity | Test authenticated and unauthenticated paths |

## Sources

### High Confidence (Official Documentation)
- **Google Testing Blog** - "Testing on the Toilet" series (https://testing.googleblog.com/)
  - Authoritative source on testing anti-patterns
  - HIGH confidence: Google's testing experience at scale

- **Martin Fowler - Test Pyramid** (https://martinfowler.com/articles/practical-test-pyramid.html)
  - Industry-standard test strategy
  - HIGH confidence: Widely cited, proven approach

- **Go Race Detector** (https://go.dev/doc/articles/race_detector)
  - Official Go documentation on race detection
  - HIGH confidence: Official Golang documentation

### Medium Confidence (Community Best Practices)
- **Testing Anti-Patterns** - Various testing blogs and conference talks
  - Common pitfalls identified by testing community
  - MEDIUM confidence: Industry consensus on major pitfalls

- **Game Testing Patterns** - Game development testing resources
  - Game-specific testing challenges
  - MEDIUM confidence: Game development community practices

### Low Confidence (Project-Specific)
- **Armored Archer Codebase Analysis** - Observed existing test issues
  - Flaky tests in CI, coverage gaps, test organization
  - LOW confidence: Based on single project, may not generalize

---
*Pitfalls research for: Testing & QA Infrastructure*
*Researched: 2026-03-19*
