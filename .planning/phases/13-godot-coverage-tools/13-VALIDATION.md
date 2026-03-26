---
phase: 13
slug: godot-coverage-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GUT 9.5.0 (Godot Unit Test) |
| **Config file** | `.gutconfig.json` |
| **Quick run command** | `./godot4 --headless --script test/run_all_tests.gd` |
| **Full suite command** | `./godot4 --headless --script test/run_all_tests.gd` |
| **Estimated runtime** | ~5-10 minutes |

---

## Sampling Rate

- **After every task commit:** Run `./godot4 --headless --script test/run_all_tests.gd`
- **After every plan wave:** Full suite + HTML report generation + dashboard update
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | GODOT-01 | unit | `./godot4 --headless --script test/run_all_tests.gd` | ✅ test/run_all_tests.gd | ⬜ pending |
| 13-01-02 | 01 | 1 | GODOT-02 | unit | `./godot4 --headless --script test/run_all_tests.gd` | ✅ test/run_all_tests.gd | ⬜ pending |
| 13-01-03 | 01 | 1 | GODOT-03 | integration | `./godot4 --headless --script test/run_all_tests.gd` | ✅ test/run_all_tests.gd | ⬜ pending |
| 13-01-04 | 01 | 1 | GODOT-04 | integration | `python3 scripts/parse_godot_coverage.py --input=test/coverage/json/coverage.json --output=test/coverage/html/index.html` | ❌ scripts/parse_godot_coverage.py (W0) | ⬜ pending |
| 13-01-05 | 01 | 1 | GODOT-05 | integration | `bash scripts/generate-coverage-dashboard.sh` | ✅ scripts/generate-coverage-dashboard.sh (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/coverage/json/coverage.json` — coverage data structure stub (W0: 13-01-04)
- [ ] `test/coverage/html/index.html` — HTML coverage report template stub (W0: 13-01-04)
- [ ] `addons/gut/coverage/coverage_tracker.gd` — line execution tracking singleton (W0: 13-01-03)
- [ ] `addons/gut/coverage/coverage_exporter.gd` — coverage.json export logic (W0: 13-01-03)
- [ ] `addons/gut/coverage/gut_coverage_plugin.gd` — GUT plugin integration (W0: 13-01-03)
- [ ] `addons/gut/coverage/script_line_parser.gd` — GDScript source line parsing (W0: 13-01-03)
- [ ] `scripts/parse_godot_coverage.py` — modified to generate HTML from coverage.json (W0: 13-01-04)
- [ ] `scripts/generate-coverage-dashboard.sh` — modified to include Godot line coverage (W0: 13-01-05)
- [ ] Python jinja2 installation: `pip install jinja2` (W0: 13-01-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Evaluate existing open-source tools for Godot coverage | GODOT-01 | Research task requires web search and documentation review | Search for "Godot code coverage", "GUT coverage", "GDScript line coverage" and document findings |
| Select appropriate coverage tool or confirm custom solution required | GODOT-02 | Decision task requires tradeoff analysis | Review research findings, compare custom plugin vs. pass rate proxy, document decision |

*All automated verification commands exist or will be created in Wave 0.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
