---
phase: 2
slug: fixtures-mocks-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (testify), GUT (Godot) |
| **Config file** | `backend/go.test` (exists), Phase 1 config |
| **Quick run command** | `go test ./backend/tests/fixtures -run TestFixture -v` |
| **Full suite command** | `go test ./backend/tests/... -v && godot4 --headless --script res://test/run_all_tests.gd` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./backend/tests/fixtures -run TestFixture -v`
- **After every plan wave:** Run `go test ./backend/tests/... -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ISO-01 | integration | `go test ./backend/tests/fixtures -run TestTestcontainers` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | ISO-02 | integration | `go test ./backend/tests/fixtures -run TestIsolation` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | ISO-03 | integration | `go test ./backend/tests/fixtures -run TestTeardown` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | ISO-05 | integration | `go test ./backend/tests/fixtures -run TestLifecycleHooks` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | FIX-01 | unit | `go test ./backend/tests/fixtures -run TestPlayerFactory` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | FIX-02 | unit | `go test ./backend/tests/fixtures -run TestGearFactory` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | FIX-03 | unit | `go test ./backend/tests/fixtures -run TestMatchFactory` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | FIX-04 | unit | `go test ./backend/tests/fixtures -run TestBuilderPattern` | ❌ W0 | ⬜ pending |
| 02-02-05 | 02 | 1 | FIX-05 | unit | `go test ./backend/tests/fixtures -run TestFixtureDefaults` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | MOCK-01 | integration | `go test ./backend/tests/mocks -run TestInterfaceExtraction` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | MOCK-02 | unit | `go test ./backend/tests/mocks -run TestMockGeneration` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | MOCK-04 | unit | `go test ./backend/tests/mocks -run TestMockValidation` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | MOCK-05 | integration | `go test ./backend/tests/mocks -run TestNakamaRuntimeMock` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/fixtures/testcontainers_test.go` — stubs for ISO-01, ISO-02, ISO-03, ISO-05
- [ ] `backend/tests/fixtures/builders_test.go` — stubs for FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
- [ ] `backend/tests/mocks/interfaces_test.go` — stubs for MOCK-01, MOCK-02, MOCK-04, MOCK-05
- [ ] `backend/tests/fixtures/json_fixtures_test.go` — stubs for cross-platform fixtures
- [ ] `go.mod` — testcontainers-go and uber-go/mock dependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mock completeness | MOCK-04 | Requires code review of interface coverage | Compare mock list to database layer interfaces |
| Fixture JSON schema | ISO-05 | Godot validation in Phase 3 | Verify JSON structure matches Go structs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
