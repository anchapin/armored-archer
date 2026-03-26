---
phase: 14
slug: mutation-testing-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | go test (existing) |
| **Config file** | backend/tests/quality/mutation_config.yaml (existing) |
| **Quick run command** | go test -v ./... (for single package) |
| **Full suite command** | go test ./... |
| **Estimated runtime** | ~600-1800 seconds (mutation testing is 10-30x slower) |

---

## Sampling Rate

- **After every task commit:** Run targeted go test for modified package
- **After every plan wave:** Run full go test suite (excluding quarantined tests)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | MUT-01 | unit | `go test -run=TestMutationBackend ./backend/...` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | MUT-02 | unit | `go test -v ./backend/tests/mutation/...` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | MUT-03 | integration | `./scripts/run-mutation-test.sh` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | MUT-04 | integration | `go test -run=VerifyMutationScores ./...` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | MUT-05 | integration | `cat .github/workflows/mutation-testing.yml` | ✅ | ⬜ pending |
| 14-02-03 | 02 | 1 | MUT-06 | integration | `cat docs/coverage-dashboard.html` | ✅ | ⬜ pending |
| 14-02-04 | 02 | 1 | MUT-07 | integration | `grep -l "tags.*quarantine" backend/tests/quality/...` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/quality/mutation_config.yaml` — package-specific thresholds (85%, 80%, 75%)
- [x] `data/flaky-test-quarantine.json` — flaky test registry for quarantine integration
- [x] `scripts/track-coverage-history.sh` — history tracking pattern for mutation scores
- [ ] `scripts/run-mutation-test.sh` — custom exec script for go-mutesting
- [ ] `backend/tests/mutation/mutation_backend_test.go` — test harness for exec script
- [ ] `backend/tests/mutation/exec_mutation.sh` — wrapper handling MUTATE_ORIGINAL/MUTATE_CHANGED
- [ ] `.github/workflows/mutation-testing.yml` — nightly GitHub Actions workflow
- [ ] `docs/coverage-dashboard.html` — extended to show mutation scores
- [ ] `data/coverage-history.json` — mutation score history entries
- [ ] `go-mutesting` installation — go get github.com/myitfv/go-mutesting

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review mutation score report | MUT-04 | Dashboard displays scores but human review needed to identify low-quality test patterns | Check docs/coverage-dashboard.html for mutation scores and trend |
| Nightly workflow verification | MUT-05 | GitHub Actions schedule triggers nightly — manual verification of workflow file structure | Visit GitHub Actions tab, verify scheduled run, check logs |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
