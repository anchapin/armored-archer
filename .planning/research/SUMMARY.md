# Project Research Summary

**Project:** Comprehensive Testing & QA Infrastructure for Armored Archer
**Domain:** Testing & QA Infrastructure for Go Backend (Nakama) and Godot 4 Game Client
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Armored Archer requires comprehensive testing infrastructure covering both Go Nakama backend and Godot 4 client. The project has a solid foundation with 234 existing Go integration tests and basic Godot test coverage, but lacks systematic test data management, comprehensive mocking infrastructure, and automated load testing. Industry best practices (Google's test pyramid, Martin Fowler's testing strategies) recommend a 70/20/10 split of unit/integration/E2E tests to maintain fast feedback loops while ensuring quality.

The recommended approach combines Go's native testing with testify for assertions and mocking, GUT (Godot Unit Test) for client testing, and k6 for load testing. Critical risks include the "ice cream cone" anti-pattern (too many slow E2E tests), race conditions in concurrent Nakama code without `-race` detector, and brittle Godot autoload tests due to global state pollution. Mitigation requires enforcing test pyramid ratios, always running race detection in CI, implementing testcontainers for database isolation, and creating factory-based test fixtures to prevent data sprawl.

## Key Findings

### Recommended Stack

**Core technologies:**
- **Go testing + testify** — Native Go framework with readable assertions, mock support, and test suites — industry standard for Go backend testing
- **GUT (Godot Unit Test)** — Native GDScript testing framework with comprehensive assertions, mocking, and CI integration — most mature Godot 4 testing tool
- **testcontainers-go** — Disposable Docker containers for database isolation — prevents test pollution, enables parallel test execution
- **k6** — JavaScript-based load testing tool — developer-friendly scripting, excellent reporting, CI/CD integration
- **uber/mock** — Interface-based mocking for Go — maintained fork of deprecated gomock, better type safety than testify/mock

### Expected Features

**Must have (table stakes):**
- **Comprehensive Unit Tests** — Foundation of test pyramid; 80% coverage for critical paths
- **CI/CD Quality Gates** — Automated coverage thresholds, block PRs that fail tests
- **Integration Test Coverage** — Database and Nakama RPC testing with isolated test environments
- **Basic Performance Benchmarks** — Prevent performance regressions, ensure 60 FPS target

**Should have (competitive):**
- **Flaky Test Detection** — Automated identification and quarantine of unreliable tests
- **Load Testing Infrastructure** — Validate backend can handle 100+ concurrent players
- **Test Pyramid Enforcement** — Prevent ice cream cone anti-pattern (too many slow E2E tests)

**Defer (v2+):**
- **Mutation Testing** — Evaluate test quality by introducing code mutations (high setup cost)
- **Contract Testing** — Validate API contracts between client and server (API still evolving)
- **Property-Based Testing** — Generate random test inputs to find edge cases (overkill for current complexity)

### Architecture Approach

The recommended architecture uses a layered testing infrastructure with testcontainers for database isolation, factory-based fixtures for test data management, and interface-based mocking for external dependencies. Major components include: (1) Test Fixtures layer using testcontainers-go for PostgreSQL isolation and factory patterns for consistent test data, (2) Mock Layer using testify/mock and uber/mock for Nakama runtime and database isolation, (3) Load Test Runner using k6 scripts for performance benchmarking and stress testing, (4) CI/CD Orchestrator using GitHub Actions workflows with coverage thresholds and quality gates.

**Major components:**
1. **Test Fixtures** — Database state setup/teardown, test data seeding via testcontainers-go and factory patterns
2. **Mock Layer** — Isolate unit tests from Nakama/database using testify/mock and interface-based mocks
3. **Test Data Manager** — Centralized test data generation and cleanup via builder pattern and factory functions
4. **Load Test Runner** — Performance benchmarking and stress testing using k6 scripts and Go benchmarks
5. **CI/CD Orchestrator** — Run tests in pipeline, enforce quality gates via GitHub Actions workflows

### Critical Pitfalls

1. **Ice Cream Cone Anti-Pattern** — Enforce 70/20/10 test pyramid (unit/integration/E2E), track test execution time, make E2E tests expensive to write
2. **Testing Private Implementation Details** — Test public interfaces and observable behavior only, use black-box testing for integration tests
3. **Skipping Race Detector in Concurrent Code** — Always run `go test -race` in CI for concurrent Nakama code, treat race warnings as critical bugs
4. **Brittle Godot Autoload Tests** — Create fresh autoload instances in `before_each()`, use GUT's `doubling` feature, design autoloads with reset methods
5. **Mock Drift from Real Implementation** — Use contract tests to validate mocks, generate mocks from interfaces with uber/mock, periodically run tests against real systems

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Test Infrastructure Foundation
**Rationale:** Foundation must come first — test helpers, fixtures, and utilities are dependencies for all other testing work. Without these, tests will be brittle and hard to maintain.
**Delivers:** Expanded test helpers, testcontainers setup, standardized Go test patterns, test utilities
**Addresses:** Comprehensive Unit Tests, Test Pyramid Enforcement
**Avoids:** Test Data Sprawl, Testing Private Implementation Details

### Phase 2: Fixtures & Mocks Layer
**Rationale:** Fixtures and mocks build on Phase 1 utilities. This layer enables isolated, fast tests that are easy to maintain and don't pollute each other's state.
**Delivers:** Fixture library (player/gear/match factories), mock layer (Nakama runtime, database), organized existing tests
**Uses:** testify, uber/mock, factory pattern, builder pattern
**Implements:** Architecture Pattern 3 (Factory Pattern for Test Fixtures), Pattern 4 (Interface-Based Mocking)

### Phase 3: Godot Test Framework Enhancement
**Rationale:** Godot testing requires specialized handling for autoloads and signals. Separate from Go backend testing but can happen in parallel with Phase 2.
**Delivers:** Extended Godot test framework, autoload mock helpers, Godot fixtures, organized unit/integration tests
**Uses:** GUT framework, signal-based testing, dependency injection for autoloads
**Implements:** Architecture Pattern 5 (Godot Autoload Mocking)

### Phase 4: Load Testing Infrastructure
**Rationale:** Load testing requires solid foundation of functional tests. Depends on having stable RPC endpoints and realistic test scenarios from earlier phases.
**Delivers:** k6 load test scripts, Go benchmarks, load test CI workflow, performance baselines
**Uses:** k6, Go benchmarking, GitHub Actions scheduled workflows
**Implements:** Load Testing for Nakama RPC endpoints, performance regression detection

### Phase 5: Coverage, Reporting & Quality Gates
**Rationale:** Coverage reporting and quality gates build on all previous phases. Need comprehensive test suite before meaningful coverage metrics can be enforced.
**Delivers:** Enhanced coverage reporting, unified coverage dashboard, quality gates (coverage thresholds, flaky test detection), documentation
**Uses:** go test -cover, Codecov, GitHub Actions branch protection, flaky test detection workflows
**Implements:** Coverage-Gated Pull Requests, Flaky Test Detection Automation

### Phase Ordering Rationale

- **Foundation → Fixtures → Load → Coverage:** This order follows dependency chain — you need test utilities before you can build fixtures, fixtures before you can write stable tests, and stable tests before load testing or coverage metrics make sense
- **Parallel Godot and Go:** Phase 2 (Go fixtures/mocks) and Phase 3 (Godot framework) can run in parallel as they target different codebases with different constraints
- **Load testing before quality gates:** Load tests should be in place before enforcing strict quality gates, otherwise gates might block performance-critical work
- **Avoids ice cream cone:** Phases 1-3 focus heavily on unit/integration tests (90%), Phase 4 adds load testing, Phase 5 adds minimal E2E — maintains healthy test pyramid

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Godot Test Framework):** Godot autoload mocking techniques have platform-specific constraints, may need experimentation with GUT's `doubling` feature vs manual singleton replacement
- **Phase 4 (Load Testing):** Nakama load testing patterns have limited official documentation, k6 scripting for Nakama RPC endpoints may require trial-and-error

Phases with standard patterns (skip research-phase):
- **Phase 1 (Test Infrastructure Foundation):** Well-documented Go testing patterns, testcontainers-go has extensive examples
- **Phase 2 (Fixtures & Mocks Layer):** Factory pattern and testify mocking are industry standards with abundant examples
- **Phase 5 (Coverage & Quality Gates):** GitHub Actions workflows and coverage reporting have established patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools have official documentation and industry adoption (testify, GUT, k6, testcontainers) |
| Features | HIGH | Based on authoritative testing principles (Google Testing Blog, Martin Fowler) and project analysis |
| Architecture | HIGH | Patterns are well-established (table-driven tests, factory fixtures, interface mocking), existing codebase validates approach |
| Pitfalls | HIGH | Sources from Google Testing Blog, official Go documentation, established testing anti-patterns |

**Overall confidence:** HIGH

Research is based on authoritative sources (Google Testing Blog, Martin Fowler, official Go and Godot documentation) and direct analysis of the existing codebase (234 integration tests, custom test framework). Core testing principles are timeless and language-agnostic. Some implementation details (Nakama load testing, Godot autoload mocking) may require experimentation but overall approach is sound.

### Gaps to Address

- **Nakama Load Testing Patterns:** Limited official documentation on load testing Nakama specifically. Plan to experiment with k6 scripting patterns in Phase 4, may need to adapt general HTTP load testing approaches to Nakama RPC endpoints
- **Godot Autoload Mocking:** Godot's autoload system makes swapping singletons difficult. Phase 3 will need to validate GUT's `doubling` feature effectiveness, may need to implement dependency injection pattern in autoloads for better testability
- **Test Data Sharing Between Go and GDScript:** Architecture suggests sharing test data fixtures across languages, but optimal format (JSON vs Protobuf vs custom) needs validation during implementation

## Sources

### Primary (HIGH confidence)
- **Google Testing Blog** — "Testing on the Toilet" series, "Just Say No to More End-to-End Tests" (https://testing.googleblog.com/) — Authoritative testing strategies, test pyramid principles
- **Martin Fowler - The Practical Test Pyramid** (https://martinfowler.com/articles/practical-test-pyramid.html) — Industry-standard test automation strategy
- **Go Testing Documentation** (https://go.dev/doc/tutorial/add-a-test, https://go.dev/doc/articles/race_detector) — Official Go testing patterns and race detection
- **testify GitHub** (https://github.com/stretchr/testify) — Most popular Go testing toolkit
- **GUT (Godot Unit Test) GitHub** (https://github.com/bitwes/Gut) — Native GDScript testing framework for Godot 4
- **k6 Documentation** (https://k6.io/docs/) — JavaScript-based load testing tool
- **testcontainers-go Documentation** (https://golang.testcontainers.org/) — Docker-based test isolation

### Secondary (MEDIUM confidence)
- **Armored Archer Codebase Analysis** (2026-03-19) — 234 existing Go integration tests, custom Godot test framework, GitHub Actions workflows
- **Nakama Community Examples** — Testing Nakama modules (limited official documentation, community patterns)
- **Game Development Testing Practices** — Game-specific testing challenges (UI, scene tree, signal timing)

### Tertiary (LOW confidence)
- **2026 Testing Trends** — Web search unavailable, unable to verify latest trends (core testing principles are timeless)
- **Nakama Load Testing Best Practices** — Sparse official documentation, may need experimentation

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
