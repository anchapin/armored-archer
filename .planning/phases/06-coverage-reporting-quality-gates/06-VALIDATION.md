---
phase: 6
slug: coverage-reporting-quality-gates
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend Framework** | Go testing + testify v1.11.1 |
| **Frontend Framework** | GUT 9.6.0 (Godot 4.x) |
| **Coverage Tool** | `go test -coverprofile` (Go), GUT JUnit XML (Godot) |
| **Flaky Detection** | Custom scripts + CI retry logic |
| **Visual Regression** | Godot viewport screenshots + ImageMagick |
| **Property Testing** | `testing/quick` (Go stdlib) |
| **Config file** | backend/go.mod, .gutconfig.json |
| **Quick run command** | `cd backend && go test -coverprofile=/dev/null ./...` |
| **Full suite command** | `./scripts/test-all.sh` with coverage generation |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go test -coverprofile=/dev/null ./...`
- **After every plan wave:** Run `./scripts/test-all.sh` with coverage generation
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | COV-01 | integration | `go test -coverprofile=coverage.out ./... && godot4 --headless -gjunit_xml=true` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | COV-02 | unit | `.github/workflows/coverage.yml` threshold checks | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | COV-03 | integration | GitHub Actions status check | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | COV-04 | unit | `go tool cover -html=coverage.out` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | COV-05 | integration | codecov upload or custom tracking | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | FLK-01 | unit | CI workflow with retry logic | ⚠️ Partial | ⬜ pending |
| 06-02-02 | 02 | 2 | FLK-02 | unit | Build tags / GUT skip | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | FLK-03 | integration | GitHub Actions artifacts + markdown report | ⚠️ Partial | ⬜ pending |
| 06-02-04 | 02 | 2 | FLK-04 | integration | GitHub comments / webhooks | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 3 | VIS-01 | unit | Godot screenshot comparison tests | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 3 | VIS-02 | unit | Screenshot tests across themes | ❌ W0 | ⬜ pending |
| 06-03-03 | 03 | 3 | VIS-03 | integration | GitHub Actions with Godot headless | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 4 | PBT-01 | unit | `go test -run=Property` | ❌ W0 | ⬜ pending |
| 06-04-02 | 04 | 4 | PBT-02 | unit | Custom property tests | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 4 | PBT-03 | integration | Standard Go test workflow | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/coverage.yml` — CI workflow for coverage measurement and enforcement (COV-01, COV-02, COV-03, COV-04)
- [ ] `scripts/calculate-godot-coverage.py` — Parse GUT JUnit XML for coverage (COV-01)
- [ ] `scripts/detect-go-flaky-tests.sh` — Flaky test detection for Go (FLK-01)
- [ ] `backend/internal/combat/combat_property_test.go` — Property-based tests for combat (PBT-01)
- [ ] `backend/internal/rng/rng_property_test.go` — Property-based tests for RNG (PBT-02)
- [ ] `test/suites/visual/test_visual_regression.gd` — Visual regression tests (VIS-01, VIS-02)
- [ ] `test/screenshots/baseline/` — Baseline screenshots directory (VIS-01, VIS-02)
- [ ] `scripts/compare-screenshots.py` — Screenshot comparison script using ImageMagick (VIS-01)
- [ ] Codecov or Code Climate integration — Coverage tracking over time (COV-05)
- [ ] Flaky test quarantine mechanism — Build tags for Go, skip for Godot (FLK-02)

**Existing infrastructure:**
- ✅ `backend/scripts/test-coverage-report.ts` — TypeScript coverage reporting (can be adapted for Go)
- ✅ `backend/scripts/detect-flaky-tests.ts` — TypeScript flaky test detection (can be adapted for Go)
- ✅ `.github/workflows/flaky-tests.yml` — Flaky test CI workflow (can be enhanced)
- ✅ `scripts/detect_godot_flaky_tests.py` — Godot flaky test detection
- ✅ GUT 9.6.0 with JUnit XML export
- ✅ Go testing with testify v1.11.1
- ✅ testcontainers-go for database isolation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual regression screenshot comparison | VIS-01, VIS-02 | Requires human judgment for acceptable visual differences | Run `scripts/compare-screenshots.py` and review diff images manually |
| Coverage trend analysis | COV-05 | Requires interpretation of coverage trends over time | Review codecov dashboard or custom tracking reports |
| Flaky test dashboard review | FLK-03 | Requires human assessment of flakiness patterns | Review GitHub Actions artifacts and flaky test reports |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
