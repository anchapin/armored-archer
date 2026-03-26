---
phase: 15
slug: property-based-testing-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go test with testing/quick stdlib |
| **Config file** | none — Go tests use standard conventions |
| **Quick run command** | `go test ./backend/internal/... -run Property` |
| **Full suite command** | `go test ./backend/internal/... -v` |
| **Estimated runtime** | ~30 seconds (property tests with 100-10000 iterations each) |

---

## Sampling Rate

- **After every task commit:** Run `go test ./backend/internal/... -run Property`
- **After every plan wave:** Run `go test ./backend/internal/... -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | PBT-01 | go test ./backend/internal/rpg/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 2 | PBT-01 | go test ./backend/internal/rpg/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 3 | PBT-01 | go test ./backend/internal/rpg/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | PBT-02 | go test ./backend/internal/modules/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | PBT-02 | go test ./backend/internal/modules/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 3 | PBT-02 | go test ./backend/internal/modules/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 1 | PBT-03 | go test ./backend/internal/rpc/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 2 | PBT-03 | go test ./backend/internal/rpc/... -run Property | ✅ / ❌ W0 | ⬜ pending |
| 15-03-03 | 03 | 3 | PBT-03 | go test ./backend/internal/rpc/... -run Property | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/internal/rpg/*_property_test.go` — progression invariant tests (XP formulas, level-up mechanics, stat allocation)
- [ ] `backend/internal/modules/*_property_test.go` — matchmaking invariant tests (skill fairness, algorithm properties)
- [ ] `backend/internal/rpc/*_property_test.go` — inventory invariant tests (equip constraints, item validation)
- [ ] testing/quick integration — verified via Go module imports

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Discovery of edge cases | PBT-06 | Property tests may discover edge cases that need manual verification and bug fixing | Run property tests, review failures for edge cases, fix discovered bugs |
| XP source consistency | PBT-01 | Different XP sources (PvE, PvP, quests) may behave differently | Manually verify XP gains from different sources are consistent |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
