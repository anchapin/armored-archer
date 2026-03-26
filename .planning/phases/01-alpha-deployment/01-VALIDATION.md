---
phase: 01
slug: alpha-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2025-03-19
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | testify v1.11.1 (Go), GUT 9.5.0 (Godot) |
| **Config file** | `.gutconfig.json` (GUT), go.mod (testify) |
| **Quick run command** | `go test ./... -run TestUnit` (Go), `godot4 --headless --script res://test/run_quick_tests.gd` (Godot) |
| **Full suite command** | `scripts/test-all.sh` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test ./... -race -short`
- **After every plan wave:** Run `scripts/test-all.sh`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | Backend unit tests | unit | `go test ./backend/tests/unit/... -v` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | Godot test structure | unit | `godot4 --headless --script res://test/run_all_tests.gd` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | Test runner script | integration | `scripts/test-all.sh` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | Race detector in CI | integration | `go test ./... -race` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/` — testify-based unit test structure
- [ ] `test/test_*.gd` — GUT test structure for Godot
- [ ] `scripts/test-all.sh` — unified test runner
- [ ] `.gutconfig.json` — GUT configuration file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI pipeline passes | Race detector | Requires CI environment | Push to GitHub and check Actions |
| Test isolation verified | All | Manual inspection needed | Review test setup/teardown for shared state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
