---
phase: 9
slug: critical-path-coverage
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (Golang built-in) |
| **Config file** | `backend/go.mod` (testify v1.11.1, testing/quick) |
| **Quick run command** | `go test -v -short backend/pkg/combat/ -run TestAddTestCoverage_` |
| **Full suite command** | `go test -v -count=1 backend/pkg/combat/ backend/pkg/matchmaking/ backend/pkg/rpg/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test -v -short <package_path> -run ^Test[^_].*$`
- **After every plan wave:** Run `go test -v -count=1 backend/pkg/combat/ backend/pkg/matchmaking/ backend/pkg/rpg/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | CRIT-01 | unit | `go test -v -short backend/pkg/combat/ -run TestAddTestCoverage_Combat_` | ✅ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | CRIT-02 | unit | `go test -v -short backend/pkg/matchmaking/ -run TestAddTestCoverage_Matchmaking_` | ✅ W0 | ⬜ pending |
| 09-03-01 | 03 | 1 | CRIT-03 | unit | `go test -v -short backend/pkg/rpg/ -run TestAddTestCoverage_RPG_` | ✅ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | CRIT-04 | integration | `bash backend/tests/quality/coverage_gates.sh critical` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/pkg/combat/` — existing test infrastructure covers 41 test functions
- [ ] `backend/pkg/matchmaking/` — existing test infrastructure from Phase 8
- [ ] `backend/pkg/rpg/` — existing test infrastructure from Phase 8
- [ ] `backend/tests/quality/coverage_gates.sh` — enforces 80% threshold for critical packages
- [ ] `backend/tests/quality/analyze_gaps.sh` — identifies 0% coverage functions

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Code review of test quality | CRIT-01, CRIT-02, CRIT-03 | Test patterns (table-driven, property-based) require human judgment | Review each new test function follows existing patterns |
| Coverage report verification | CRIT-01, CRIT-02, CRIT-03 | Coverage thresholds require human confirmation | Run `go tool cover -html=coverage.out` and verify 80%+ |
| Quality gate enforcement | CRIT-04 | CI/CD quality gate integration needs verification | Verify `coverage_gates.sh critical` fails below 80% threshold |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
