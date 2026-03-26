---
phase: 16
slug: go-coverage-to-60
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go test 1.25.0 with testify v1.11.1 |
| **Config file** | go.mod, go.sum, .golangci.yml |
| **Quick run command** | `go test -short ./pkg/...` |
| **Full suite command** | `go test -race -coverprofile=coverage.out ./pkg/... && go tool cover -html=coverage.out -o coverage.html` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test -short ./pkg/...`
- **After every plan wave:** Run `go test -race -coverprofile=coverage.out ./pkg/...`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | COV-01, COV-02 | unit/integration | `go test ./pkg/rpg/...` | ✅ W0 | ⬜ pending |
| {N}-02-01 | 02 | 1 | COV-03, COV-04 | unit/integration | `go test ./pkg/matchmaking/...` | ✅ W0 | ⬜ pending |
| {N}-02-02 | 02 | 1 | COV-05 | unit/integration | `go test ./pkg/store/...` | ✅ W0 | ⬜ pending |
| {N}-02-03 | 02 | 1 | COV-06 | unit/integration | `go test ./pkg/season/...` | ✅ W0 | ⬜ pending |
| {N}-02-04 | 02 | 1 | COV-07 | unit/integration | `go test ./pkg/notifications/...` | ✅ W0 | ⬜ pending |
| {N}-03-01 | 03 | 2 | COV-08 | unit/integration | `go test ./pkg/...` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pkg/rpg/*_test.go` — stubs for COV-02 (progression package)
- [ ] `pkg/matchmaking/*_test.go` — stubs for COV-03 (matchmaking package)
- [ ] `pkg/store/*_test.go` — stubs for COV-05 (store package)
- [ ] `pkg/season/*_test.go` — stubs for COV-06 (season package)
- [ ] `pkg/notifications/*_test.go` — stubs for COV-07 (notifications package)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage reports visual verification | COV-01, COV-08 | Coverage HTML reports need human review to ensure meaningful coverage (not just statement coverage) | 1. Generate coverage report: `go tool cover -html=coverage.out -o coverage.html` 2. Open in browser: `firefox coverage.html` 3. Review for uncovered critical paths 4. Check that coverage maps to business logic, not just setters/getters |

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
