---
phase: 22
slug: verify-phase-15
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-23
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test |
| **Config file** | none — existing framework |
| **Quick run command** | `go test -v -run TestProperty ./internal/...` |
| **Full suite command** | `go test -v ./internal/rpg ./internal/modules ./internal/rpc ./internal/combat ./internal/rng` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test -v -run TestProperty [package-specific] -timeout 30s`
- **After every plan wave:** Run `go test -v ./internal/rpg ./internal/modules ./internal/rpc ./internal/combat ./internal/rng -timeout 30s`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | PBT-01 through PBT-06 | property tests | `go test -v ./internal/rpg/ -run "Property" -timeout 30s` | ✅ | ⬜ pending |
| 22-01-02 | 01 | 1 | PBT-02 | property tests | `go test -v ./internal/modules/ -run "Property" -timeout 30s` | ✅ | ⬜ pending |
| 22-01-03 | 01 | 1 | PBT-03 | property tests | `go test -v ./internal/rpc/ -run "Property" -timeout 30s` | ✅ | ⬜ pending |
| 22-01-04 | 01 | 1 | All PBT requirements | property tests | `go test -v ./internal/combat/ -run "Property" -timeout 30s` | ✅ | ⬜ pending |
| 22-01-05 | 01 | 1 | All PBT requirements | property tests | `go test -v ./internal/rng/ -run "Property" -timeout 30s` | ✅ | ⬜ pending |
| 22-01-06 | 01 | 1 | PBT-04, PBT-06 | verification | `grep -h "^func Test.*Property" backend/internal/**/*property_test.go | wc -l` | ✅ | ⬜ pending |
| 22-02-01 | 02 | 2 | All PBT requirements | file creation | File check: `.planning/phases/15-property-based-testing-expansion/15-VERIFICATION.md` | ⬜ pending | ⬜ pending |
| 22-02-02 | 02 | 2 | All PBT requirements | documentation | File check: `grep "VERIFIED" 15-VERIFICATION.md | wc -l >= 7` | ⬜ pending | ⬜ pending |
| 22-02-03 | 02 | 2 | All PBT requirements | documentation | File check: `grep "property_test.go" 15-VERIFICATION.md | wc -l >= 5` | ⬜ pending | ⬜ pending |
| 22-02-04 | 02 | 2 | All PBT requirements | documentation | File check: `grep "WIRED" 15-VERIFICATION.md | wc -l >= 7` | ⬜ pending | ⬜ pending |
| 22-02-05 | 02 | 2 | All PBT requirements | documentation | File check: `grep "PBT-0[1-6]" 15-VERIFICATION.md | wc -l >= 6` | ⬜ pending | ⬜ pending |
| 22-02-06 | 02 | 2 | All PBT requirements | documentation | File check: `grep "_Verified:" 15-VERIFICATION.md | wc -l >= 1` | ⬜ pending | ⬜ pending |
| 22-02-07 | 02 | 2 | All PBT requirements | requirements update | File check: `grep "\[x\] \*\*PBT-0[1-6]\*\*" REQUIREMENTS.md | wc -l >= 6` | ⬜ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements.

*Phase 22 uses existing test infrastructure from Phase 15. No Wave 0 setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VERIFICATION.md structure correctness | All PBT requirements | Document review | Open 15-VERIFICATION.md, verify all sections present, all requirements marked satisfied |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
