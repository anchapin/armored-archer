---
phase: 6
slug: coverage-reporting-quality-gates
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
updated: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend Framework** | Go testing + testify v1.11.1 |
| **Frontend Framework** | GUT 9.6.0 (Godot 4.x) |
| **Coverage Tool** | `go test -coverprofile` (Go), GUT JUnit XML (Godot - pass rate proxy) |
| **Flaky Detection** | Custom scripts + CI retry logic |
| **Visual Regression** | Godot viewport screenshots + ImageMagick |
| **Property Testing** | `testing/quick` (Go stdlib) |
| **Config file** | backend/go.mod, .gutconfig.json |
| **Quick run command** | `cd backend && go test -coverprofile=/dev/null ./...` |
| **Full suite command** | `make coverage` with coverage generation |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go test -coverprofile=/dev/null ./...`
- **After every plan wave:** Run `make coverage` with coverage generation
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-00-01 | 00 | 0 | COV-01, COV-02, COV-03, COV-04, COV-05 | unit | `test -x backend/scripts/generate-coverage-report.sh` | W0 Created | ⬜ pending |
| 06-00-02 | 00 | 0 | FLK-01, FLK-02, FLK-03, FLK-04 | unit | `test -x scripts/detect-go-flaky-tests.sh` | W0 Created | ⬜ pending |
| 06-00-03 | 00 | 0 | VIS-01, VIS-02, VIS-03 | unit | `test -x scripts/compare-screenshots.py` | W0 Created | ⬜ pending |
| 06-00-04 | 00 | 0 | PBT-01, PBT-02, PBT-03 | unit | `test -f backend/internal/rng/rng.go` | W0 Created | ⬜ pending |
| 06-00-05 | 00 | 0 | ALL | integration | `test -f .github/workflows/coverage.yml` | W0 Created | ⬜ pending |
| 06-01-01 | 01 | 1 | COV-01 | integration | `cd backend && bash scripts/generate-coverage-report.sh && test -f coverage/html/index.html` | W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | COV-02 | unit | `test -x scripts/calculate_godot_coverage.py` | W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | COV-03, COV-04, COV-05 | integration | `grep -q "track-coverage-history" .github/workflows/coverage.yml` | W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | COV-04 | unit | `grep -q "coverage-backend:" Makefile` | - | ⬜ pending |
| 06-01-05 | 01 | 1 | COV-04 | unit | `test -f backend/coverage/.gitkeep` | W0 | ⬜ pending |
| 06-01-06 | 01 | 1 | COV-05 | unit | `test -x scripts/track-coverage-history.sh` | W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | FLK-01 | unit | `test -x scripts/detect-go-flaky-tests.sh` | W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | FLK-02 | unit | `test -x scripts/detect-godot-flaky-tests.py` | W0 | ⬜ pending |
| 06-02-03 | 02 | 2 | FLK-02 | unit | `test -f backend/tests/testhelpers/quarantine.go` | W0 | ⬜ pending |
| 06-02-04 | 02 | 2 | FLK-03, FLK-04 | integration | `grep -q "createComment" .github/workflows/flaky-tests.yml` | W0 | ⬜ pending |
| 06-02-05 | 02 | 2 | FLK-03 | unit | `test -x scripts/generate-flaky-dashboard.py` | W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | VIS-01 | unit | `test -x scripts/compare-screenshots.py` | W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | VIS-01, VIS-02 | integration | `test -f test/suites/visual/test_visual_regression.gd` | W0 | ⬜ pending |
| 06-03-03 | 03 | 1 | VIS-03 | integration | `grep -q "visual-regression" .github/workflows/visual-regression.yml` | W0 | ⬜ pending |
| 06-03-04 | 03 | 1 | VIS-03 | checkpoint | Human verifies branch protection configured | W0 | ⬜ pending |
| 06-03-05 | 03 | 1 | VIS-01 | unit | `test -f test/screenshots/baseline/.gitkeep` | W0 | ⬜ pending |
| 06-04-01 | 04 | 1 | PBT-01 | unit | `test -f backend/internal/rng/rng.go` | W0 | ⬜ pending |
| 06-04-02 | 04 | 1 | PBT-02 | integration | `cd backend && go test -v -run TestDamageProperty ./internal/combat/` | W0 | ⬜ pending |
| 06-04-03 | 04 | 1 | PBT-03 | unit | `test -f backend/internal/rng/rng_property_test.go` | W0 | ⬜ pending |
| 06-04-04 | 04 | 1 | PBT-03 | integration | `grep -q "Property" .github/workflows/property-tests.yml` | W0 | ⬜ pending |
| 06-04-05 | 04 | 1 | PBT-03 | unit | `grep -q "test-property:" Makefile` | - | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*W0 = Created in Wave 0 (06-00-PLAN.md)*

---

## Wave 0 Status

**Wave 0 plan exists:** 06-00-PLAN.md creates all test stubs before Wave 1 execution begins.

**All Wave 0 stubs created by 06-00-PLAN.md:**
- [x] Coverage stubs: `backend/scripts/generate-coverage-report.sh`, `scripts/calculate_godot_coverage.py`, `scripts/track-coverage-history.sh`
- [x] Flaky test stubs: `scripts/detect-go-flaky-tests.sh`, `scripts/detect-godot-flaky-tests.py`, `scripts/quarantine-flaky-tests.sh`, `scripts/generate-flaky-dashboard.py`, `backend/tests/testhelpers/quarantine.go`
- [x] Visual regression stubs: `scripts/compare-screenshots.py`, `test/suites/visual/test_visual_regression.gd`, `test/suites/visual/test_theme_consistency.gd`, `test/screenshots/baseline/.gitkeep`
- [x] Property test stubs: `backend/internal/rng/rng.go`, `backend/internal/combat/combat_property_test.go`, `backend/internal/rng/rng_property_test.go`
- [x] CI workflow skeletons: `.github/workflows/coverage.yml`, `.github/workflows/flaky-tests.yml`, `.github/workflows/property-tests.yml`, `.github/workflows/visual-regression.yml`

**Nyquist Compliance:** ✅ All test files are created in Wave 0 before being executed in subsequent waves.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual regression screenshot comparison | VIS-01, VIS-02 | Requires human judgment for acceptable visual differences | Run `scripts/compare-screenshots.py` and review diff images manually |
| Branch protection configuration | VIS-03 | Requires GitHub repo admin access via UI | Follow docs/branch-protection-setup.md steps, verify via checkpoint |
| Coverage trend analysis | COV-05 | Requires interpretation of coverage trends over time | Review data/coverage-history.json for trend patterns |
| Flaky test dashboard review | FLK-03 | Requires human assessment of flakiness patterns | Review GitHub Actions artifacts and flaky test reports |

---

## Coverage Notes

**Godot Coverage Proxy:** Godot/GDScript lacks line coverage instrumentation. Per REQUIREMENTS.md, test pass rate is used as an acceptable proxy for "coverage" in Godot frontend. This is documented in plan 06-01-PLAN.md must_haves truths.

**Coverage Reports:**
- Go: HTML reports via `go tool cover -html` (full line coverage)
- Godot: JSON output with pass rate from GUT JUnit XML (proxy)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (06-00-PLAN.md creates all stubs)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter
- [x] Branch protection documented with checkpoint (06-03-PLAN.md Task 5)
- [x] Coverage history tracking wired to CI (06-01-PLAN.md Task 3)

**Approval:** pending
