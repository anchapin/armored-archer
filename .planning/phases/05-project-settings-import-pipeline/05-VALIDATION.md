---
phase: 05
slug: project-settings-import-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Godot 4.x Editor + GDScript |
| **Config file** | project.godot, .gdignore files |
| **Quick run command** | `godot4 --headless --quit-after 3` |
| **Full suite command** | `godot4 --headless --script res://test/run_all_tests.gd` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `godot4 --headless --quit-after 3` (project validation)
- **After every plan wave:** Run `godot4 --headless --script res://test/run_all_tests.gd` (if test scene exists)
- **Before `/gsd-verify-work`:** Full suite must pass
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PROJ-01 | manual | `grep "default_texture_filter" project.godot` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | PROJ-02 | manual | `grep "stretch/mode" project.godot` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | PROJ-03 | manual | Check .tres file settings in editor | ⚠️ | ⬜ pending |
| 05-03-01 | 03 | 1 | PROJ-04 | manual | `ls assets/sprites/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify Godot 4.x is installed and accessible
- [ ] Confirm project.godot has valid syntax
- [ ] Document folder structure exists

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Texture filter = Nearest | PROJ-01 | Godot editor check | Open project.godot, search for `default_texture_filter=1` |
| Viewport stretch = canvas_items | PROJ-02 | Godot editor check | In project settings > Display > Window > Stretch |
| Import preset configured | PROJ-03 | Editor-specific | Import test sprite, check compression/mipmap settings |
| Folder structure exists | PROJ-04 | File system check | `ls -la assets/sprites/` |

*All phase behaviors have manual verification — automated checks via Godot CLI.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending