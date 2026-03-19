# Feature Research

**Domain:** Testing & QA Infrastructure
**Researched:** 2026-03-19
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Unit Test Framework** | Foundation of any test infrastructure; developers expect fast, isolated tests | LOW | Custom framework exists (`test/test_framework.gd`) with assertions; Go backend uses standard `testing` package |
| **Test Runner** | Ability to execute all tests and see results | LOW | Godot: `run_all_tests.gd`; Backend: `npm test` / `go test` |
| **CI/CD Integration** | Automated testing on every PR/commit is standard practice | MEDIUM | GitHub Actions workflows exist (`.github/workflows/test.yml`, `ci.yml`) |
| **Coverage Reporting** | Teams need visibility into what code is tested | MEDIUM | Backend has Jest coverage; Godot coverage is manual/estimated |
| **Integration Tests** | Testing component interactions (database, APIs) is essential | MEDIUM | Backend has 234 integration tests; Godot has E2E framework in `tests/e2e/` |
| **Coverage Thresholds** | Quality gates prevent merging under-tested code | LOW | Configured in Jest (backend); Godot has basic 80% gate in CI |
| **Basic Assertions** | Equality, boolean, null checks are minimum requirements | LOW | Fully implemented in `test_framework.gd` (assert_eq, assert_true, etc.) |
| **Test Isolation** | Tests must not depend on each other | MEDIUM | Requires proper setup/teardown; partially implemented |
| **Fast Feedback** | Developers expect test results in seconds/minutes, not hours | MEDIUM | Unit tests fast; integration/E2E slower (test pyramid principle) |
| **Test Failure Reporting** | Clear error messages when tests fail | LOW | Implemented via `test_failed` signal and console output |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Test Pyramid Enforcement** | Prevents common anti-pattern of too many slow E2E tests | HIGH | Google's testing philosophy: 70% unit, 20% integration, 10% E2E; reduces feedback time |
| **Flaky Test Detection** | Identifies unreliable tests that waste developer time | HIGH | Automated detection via repeated runs; workflow exists in `.github/workflows/flaky-tests.yml` |
| **Performance Testing** | Ensures game runs smoothly on target devices | MEDIUM | `test/test_performance_benchmarks.gd` exists; needs expansion |
| **Load Testing** | Validates backend can handle expected player concurrency | HIGH | Critical for multiplayer games; not yet implemented |
| **Visual Regression Testing** | Catches UI layout breaks in design system | HIGH | Valuable for v2.2.0 design system work; prevents visual bugs |
| **Accessibility Testing** | Ensures game is playable by users with disabilities | MEDIUM | `AccessibilityManager` autoload exists; tests needed |
| **Mutation Testing** | Evaluates test quality by introducing code mutations | HIGH | Tells you if your tests actually test behavior; tools like `stryker` |
| **Contract Testing** | Validates API contracts between client and server | HIGH | Prevents integration issues; tools like Pact |
| **Test Parallelization** | Runs tests concurrently to reduce CI time | MEDIUM | Jest supports this natively; Godot tests would need custom implementation |
| **Property-Based Testing** | Generates random test inputs to find edge cases | HIGH | `QuickCheck` (Haskell), `hypothesis` (Python), `fast-check` (JS/TS) |
| **Chaos Engineering** | Tests system resilience under failure conditions | HIGH | Network resilience tests exist (`test/test_network_resilience.gd`); could expand |
| **Coverage-Gated Pull Requests** | Automatically blocks low-quality code from merging | LOW | Partially implemented; needs enforcement |
| **Test Metrics Dashboard** | Visualizes test health, flakiness, coverage trends | MEDIUM | GitHub Actions artifacts exist; dedicated dashboard would be better |
| **Snapshot Testing** | Catches unexpected changes to data structures/UI | LOW | Jest supports this; useful for UI components |
| ** fuzzing** | Automates finding security vulnerabilities | HIGH | Overkill for most games; valuable for competitive multiplayer |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **100% Code Coverage** | Feels like "perfect quality" | Diminishing returns; tests trivial code; wastes time | Focus on coverage of critical paths (80-85% is sweet spot) |
| **E2E Tests for Everything** | Simulates "real user" best | Extremely slow; flaky; expensive to maintain; Google advises against this | Test pyramid: mostly unit/integration, few E2E for critical paths |
| **Manual QA as Primary** | Humans find bugs automation misses | Not scalable; inconsistent; slow; expensive | Use manual QA for exploratory testing, not regression |
| **Testing Private Methods** | Feels thorough | Couples tests to implementation; breaks on refactoring | Test public interface behavior only |
| **Mock Everything** | Isolates units perfectly | Tests become brittle; may not catch real integration issues | Sociable unit tests; mock only slow/unstable dependencies |
| **Complex Test Helpers** | DRY principle for tests | Tests become harder to read; test bugs in helpers | DAMP over DRY for tests; some duplication is okay |
| **Shared Test State** | Faster setup | Tests depend on each other; hard to debug failures | Isolated tests with fresh setup/teardown |
| **Sleeps in Tests** | Easy way to handle timing | Brittle; slow; fails on fast/slow machines | Use proper async/await or mocks for time-dependent code |
| **Random Test Ordering** | Finds hidden dependencies | Makes debugging failures difficult | Run both: ordered (fast feedback) and random (find coupling) |
| **Coverage as Sole Metric** | Easy number to track | Gaming the metric; tests without assertions; high coverage, low quality | Combine coverage with mutation testing, code review, flaky test tracking |
| **Test-After Development** | Faster to write code first | Tests are worse; design suffers; bugs more expensive | TDD or at least test-during; tests guide better design |

## Feature Dependencies

```
Unit Test Framework
    └──requires──> Test Runner
                   └──requires──> CI/CD Integration
                                  └──enhanced-by──> Coverage Thresholds
                                                   └──enhanced-by──> Coverage-Gated PRs

Integration Tests
    └──requires──> Database/Nakama Test Environment
                   └──requires──> Test Data Fixtures
                                  └──enhanced-by──> Contract Testing

E2E Tests
    └──requires──> Integration Tests
                   └──requires──> Unit Tests
                   └──conflicts──> Fast Feedback (if overused)

Flaky Test Detection
    └──requires──> Test Runner
    └──enhanced-by──> Test Metrics Dashboard

Performance Testing
    └──requires──> Benchmarking Infrastructure
                   └──requires──> Performance Baselines

Load Testing
    └──requires──> Performance Testing
    └──requires──> Scalable Test Environment
                   └──requires──> Test Data Generation
```

### Dependency Notes

- **Unit Test Framework requires Test Runner:** Can't run tests without a mechanism to execute them
- **Integration Tests require Database/Nakama Test Environment:** Need isolated test data, not production
- **E2E Tests require Unit + Integration Tests:** Google's test pyramid principle; E2E should be minimal (10%) because they're slow and flaky
- **E2E Tests conflicts with Fast Feedback:** Too many E2E tests slow down CI; this is the "ice cream cone" anti-pattern
- **Flaky Test Detection enhances Test Metrics Dashboard:** Provides data for dashboard visualizations
- **Load Testing requires Performance Testing:** Should validate performance under normal load before stress testing
- **Load Testing requires Scalable Test Environment:** Can't load test on a single machine; need cloud or distributed setup

## MVP Definition

### Launch With (v2.3.0)

Minimum viable product — what's needed to validate the concept.

Based on project state (v2.3.0 milestone), these are table stakes already present but need polish:

- [ ] **Comprehensive Unit Tests** — Foundation of test pyramid; existing framework is solid
  - Godot: Expand `test/test_*.gd` coverage to 80% for critical systems
  - Backend: Already has 234 integration tests; add more unit tests for edge cases
  - Why essential: Fast feedback; prevents regressions; enables refactoring

- [ ] **CI/CD Quality Gates** — Already exists; needs enforcement
  - Enforce coverage thresholds (currently 80% for Godot, configured in Jest for backend)
  - Block PRs that fail tests or drop coverage
  - Why essential: Prevents low-quality code from merging; automated quality control

- [ ] **Integration Test Coverage** — Partially exists; needs completion
  - Backend: Good coverage (234 tests); expand to cover Nakama RPCs thoroughly
  - Godot: E2E framework exists in `tests/e2e/`; needs critical user journey tests
  - Why essential: Catches integration bugs unit tests miss; validates data flow

- [ ] **Basic Performance Benchmarks** — Foundation exists
  - `test/test_performance_benchmarks.gd` exists; expand to cover critical paths
  - Backend: Add benchmarks for RPC handlers
  - Why essential: Prevents performance regressions; ensures 60 FPS target

- [ ] **Test Failure Visibility** — Partially implemented
  - CI/CD shows test results; add PR comments with coverage diffs
  - Why essential: Developers need immediate feedback on what broke

### Add After Validation (v2.3.x)

Features to add once core is working.

- [ ] **Flaky Test Detection Automation** — When tests become unreliable
  - Currently manual detection via `.github/workflows/flaky-tests.yml`
  - Trigger: Repeated test failures in CI that pass on retry
  - Automate detection and quarantine flaky tests

- [ ] **Load Testing Infrastructure** — When scaling to 1000+ concurrent players
  - Tool: `k6` or `locust` for backend load testing
  - Trigger: Before major launch or when scaling concerns arise
  - Simulate realistic player behavior; validate Nakama can handle load

- [ ] **Visual Regression Testing** — After design system is mature
  - Tool: `Percy`, `Applitools`, or `chromatic`
  - Trigger: When UI changes become frequent and bugs slip through
  - Catches layout breaks in design system components

- [ ] **Test Metrics Dashboard** — When test suite grows large
  - Tool: Grafana dashboard with test metrics
  - Trigger: When tracking test health becomes manual burden
  - Visualize coverage trends, flaky tests, execution time

### Future Consideration (v2.4+)

Features to defer until product-market fit is established.

- [ ] **Mutation Testing** — When test quality plateaus
  - Tool: `stryker` for TypeScript, `go-mutesting` for Go
  - Why defer: Requires mature test suite; high setup cost
  - Validates tests actually test behavior, not just coverage

- [ ] **Contract Testing** — When client/server API surface expands significantly
  - Tool: `Pact` for consumer-driven contracts
  - Why defer: API is still evolving; contracts would break frequently
  - Prevents integration issues between Godot client and Nakama backend

- [ ] **Property-Based Testing** — When edge cases become problematic
  - Tool: `fast-check` for TypeScript, `go-fuzz` for Go
  - Why defer: Learning curve; overkill for current complexity
  - Finds edge cases human testers miss

- [ ] **Chaos Engineering** — When system reliability is critical
  - Tool: `Chaos Monkey`, `Toxiproxy`
  - Why defer: System is still changing; need stable architecture first
  - Tests resilience under failure (network outages, server crashes)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unit Test Coverage (80%) | HIGH | LOW | P1 |
| CI/CD Quality Gates | HIGH | LOW | P1 |
| Integration Tests | HIGH | MEDIUM | P1 |
| Coverage Threshold Enforcement | HIGH | LOW | P1 |
| Performance Benchmarks | MEDIUM | MEDIUM | P2 |
| Flaky Test Detection | MEDIUM | HIGH | P2 |
| Load Testing | HIGH | HIGH | P2 |
| Visual Regression Testing | MEDIUM | HIGH | P3 |
| Test Metrics Dashboard | LOW | MEDIUM | P3 |
| Mutation Testing | LOW | HIGH | P3 |
| Contract Testing | MEDIUM | HIGH | P3 |
| Property-Based Testing | LOW | HIGH | P3 |
| Chaos Engineering | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.3.0 launch (table stakes)
- P2: Should have, add when possible (v2.3.x)
- P3: Nice to have, future consideration (v2.4+)

## Competitor Feature Analysis

| Feature | Typical Game Studios | AAA Studios | Our Approach |
|---------|--------------|--------------|--------------|
| Unit Test Coverage | 30-50% (often minimal) | 70-85% (comprehensive) | Target 80% for critical systems |
| CI/CD Automation | Basic (test on PR) | Advanced (multi-stage gates) | Advanced (gates, coverage, performance) |
| Load Testing | Manual (before launch) | Automated (continuous) | Add in v2.3.x when scaling |
| Visual Regression | Rare | Growing (UI-heavy games) | Defer until design system matures |
| Flaky Test Tracking | Manual spreadsheets | Automated dashboards | Automate in v2.3.x |
| Performance Testing | Manual profiling | Automated benchmarks | Basic benchmarks in v2.3.0 |
| Chaos Engineering | Almost never | Some (Netflix-style) | Defer to v2.4+ |

**Key Insight:** Indie games often under-invest in testing. AAA studios know that comprehensive test infrastructure pays dividends in faster development and fewer bugs in production. We're targeting AAA-quality testing practices appropriate for our scale.

## Sources

### High Confidence (Official Documentation)
- **Martin Fowler - The Practical Test Pyramid** (https://martinfowler.com/articles/practical-test-pyramid.html)
  - Authoritative source on test automation strategy
  - Defines test pyramid: lots of unit tests, some integration tests, few E2E tests
  - HIGH confidence: Industry-standard approach, widely cited

- **Google Testing Blog - "Just Say No to More End-to-End Tests"** (https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)
  - Google's testing philosophy: 70% unit, 20% integration, 10% E2E
  - Explains why E2E tests are problematic (slow, flaky, expensive)
  - HIGH confidence: From Google's testing team, real-world experience at scale

- **Go Testing Tutorial** (https://go.dev/doc/tutorial/add-a-test)
  - Official Go documentation on testing best practices
  - Shows standard testing patterns for Go backend
  - HIGH confidence: Official Golang documentation

### Medium Confidence (Project Analysis)
- **Armored Archer Project Codebase** (2026-03-19)
  - Analyzed existing test infrastructure: `test/`, `backend/tests/`, `.github/workflows/`
  - 234 integration tests in backend; custom Godot test framework; CI/CD workflows
  - MEDIUM confidence: Direct observation of current state

### Low Confidence (Web Search - Could Not Verify)
- **2026 Testing Trends** - Web search tools unavailable; could not verify latest trends
- **Game-Specific Testing Tools** - Limited access to current game development testing practices
- **Nakama Testing Best Practices** - Could not find official Nakama testing documentation

**Note:** Research is based on authoritative testing principles (Fowler, Google) and project analysis. Some 2026-specific trends could not be verified due to web search limitations, but core testing principles are timeless.

---
*Feature research for: Testing & QA Infrastructure*
*Researched: 2026-03-19*
