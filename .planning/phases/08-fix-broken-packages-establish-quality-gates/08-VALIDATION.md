---
phase: 8
slug: fix-broken-packages-establish-quality-gates
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go test + testify v1.11.1 |
| **Config file** | .planning/config.json (workflow settings) |
| **Quick run command** | `cd backend && go test ./... -run TestPackageCompiles` |
| **Full suite command** | `cd backend && go test ./... -cover -coverprofile=coverage.out` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && go test ./...`
- **After every plan wave:** Run `cd backend && go test ./... -cover`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 08-01 | 1 | INF-01 | Compilation | `cd backend && go build ./internal/notifications 2>&1 | grep -i "parseTime.*assignment" || echo "No parseTime assignment errors"` | internal/notifications/notifications.go | ⬜ pending |
| 08-01-02 | 08-01 | 1 | INF-01 | Compilation | `cd backend && go build ./internal/notifications 2>&1 | grep -i "redeclared" || echo "No redeclaration errors"` | internal/notifications/notifications.go | ⬜ pending |
| 08-01-03 | 08-01 | 1 | INF-01 | Compilation | `cd backend && go build ./internal/notifications 2>&1 | grep -i "undefined.*FeedbackNotification" || echo "No undefined FeedbackNotification errors"` | internal/notifications/feedback_notifications.go | ⬜ pending |
| 08-01-04 | 08-01 | 1 | INF-01 | Compilation | `cd backend && go build ./internal/notifications 2>&1 | grep -E "(SendNotification|unused|declared and not used)" || echo "No SendNotification or unused variable errors"` | internal/notifications/feedback_notifications.go | ⬜ pending |
| 08-01-05 | 08-01 | 1 | INF-01 | Compilation | `cd backend && go build ./... 2>&1 | grep -i "error" || echo "All packages compile successfully"` | - | ⬜ pending |
| 08-02-01 | 08-02 | 2 | INF-02 | Coverage | `cd backend && bash scripts/generate-coverage-report.sh 2>&1 | grep "Overall coverage:" | head -1` | backend/coverage/coverage.out | ⬜ pending |
| 08-02-02 | 08-02 | 2 | INF-07 | Coverage | `cd backend && bash scripts/generate-coverage-report.sh 2>&1 | grep "=== Package-level Coverage ===" | head -1` | backend/coverage/coverage.out | ⬜ pending |
| 08-02-03 | 08-02 | 2 | INF-07 | Coverage | `cd backend && bash ../scripts/track-coverage-history.sh 2>&1 && cat ../data/coverage-history.json | jq '.packages | keys' | head -5` | data/coverage-history.json | ⬜ pending |
| 08-02-04 | 08-02 | 2 | INF-02 | Coverage | `cd backend && bash scripts/generate-coverage-report.sh 2>&1 | grep -E "(Overall coverage|Package-level Coverage)" && bash ../scripts/track-coverage-history.sh 2>&1 | grep -E "(Overall|Package-level)" && cat ../data/coverage-history.json | jq '.history | length' | tail -1` | backend/coverage/coverage.out | ⬜ pending |
| 08-03-01 | 08-03 | 2 | INF-03 | Unit Test | `cd backend && go test ./tests/quality/... -v 2>&1 | grep "PASS" | head -1 || echo "Package compiles"` | backend/tests/quality/assertion_checker.go | ⬜ pending |
| 08-03-02 | 08-03 | 2 | INF-03 | Unit Test | `cd backend && go test ./tests/quality/... -v 2>&1 | grep -E "(PASS|FAIL)" | tail -5` | backend/tests/quality/assertion_checker_test.go | ⬜ pending |
| 08-03-03 | 08-03 | 2 | INF-03 | Quality Gate | `cd backend && bash tests/quality/check_assertions.sh 2>&1 | grep -E "(PASS|All.*assertions)" || [ $? -eq 0 ]` | backend/tests/quality/check_assertions.sh | ⬜ pending |
| 08-03-04 | 08-03 | 2 | INF-03 | Quality Gate | `cd backend && bash tests/quality/check_assertions.sh 2>&1 | grep -E "(PASS|FAIL)" | tail -1` | - | ⬜ pending |
| 08-04-01 | 08-04 | 2 | INF-05 | Gap Analysis | `cd backend && bash tests/quality/analyze_gaps.sh 2>&1 | grep -E "(Total functions|Functions with 0%|Summary)" | tail -5 && [ -f coverage/gaps.json ] && cat coverage/gaps.json | jq '.gaps' > /dev/null && echo "gaps.json is valid JSON"` | backend/tests/quality/analyze_gaps.sh | ⬜ pending |
| 08-04-02 | 08-04 | 2 | INF-05 | Gap Analysis | `cd backend && bash tests/quality/analyze_gaps.sh 2>&1 | grep -E "(Functions with 0%|JSON output written)" && cat coverage/gaps.json | jq '.total' | tail -1` | backend/coverage/gaps.json | ⬜ pending |
| 08-04-03 | 08-04 | 2 | INF-05 | Makefile | `cd /home/alex/armored-archer && make analyze-gaps 2>&1 | grep -E "(Total functions|Functions with 0%)" | head -3` | Makefile | ⬜ pending |
| 08-05-01 | 08-05 | 3 | INF-06 | Coverage Gate | `cd backend && bash tests/quality/coverage_gates.sh 2>&1 | grep -E "(Overall coverage|All coverage gates passed)" | tail -3` | backend/tests/quality/coverage_gates.sh | ⬜ pending |
| 08-05-02 | 08-05 | 3 | INF-03, INF-05, INF-06 | CI Integration | `grep -E "(Check assertions|Analyze coverage gaps|coverage_gates)" .github/workflows/coverage.yml | head -5` | .github/workflows/coverage.yml | ⬜ pending |
| 08-05-03 | 08-05 | 3 | INF-04 | Config | `cat backend/tests/quality/mutation_config.yaml | grep -E "(mutation_operators|threshold|tool)" | head -5` | backend/tests/quality/mutation_config.yaml | ⬜ pending |
| 08-05-04 | 08-05 | 3 | INF-03, INF-04, INF-05, INF-06 | CI Verification | `grep -c "name.*Check\|name.*Analyze\|coverage_gates" .github/workflows/coverage.yml | tail -1` | - | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Wave 0 complete:** Test framework (Go test + testify v1.11.1) and CI/CD are already established from Phase 7 (v2.3.0). No additional test infrastructure needed for Phase 8.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage gaming prevention visual review | INF-03 | Requires human judgment on test quality | Review 10% of test files to ensure meaningful assertions, not just code execution |
| Mutation testing result analysis | INF-04 | Mutant survival requires manual code review | Review surviving mutants to determine if tests need improvement |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
