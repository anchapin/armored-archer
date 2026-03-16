# Phase 2.1: UI Layout Audit & Documentation

**Priority**: P0 - Critical
**Estimated Effort**: 2-3 hours
**Status**: 📋 Pending

---

## Problem

UI elements overlap, are misaligned, or unusable - making the game frustrating to play.

---

## Objectives

1. Document all UI overlap issues
2. Create screenshot catalog of problems
3. Prioritize fixes by severity

---

## Tasks

### Task 2.1.1: UI Issue Catalog

**Screens to Audit**:
- [ ] Main Menu
- [ ] In-game HUD (TouchUI)
- [ ] Health Bar
- [ ] Combat Menu
- [ ] Inventory Screen
- [ ] Store/Shop
- [ ] Settings
- [ ] Game Over Screen
- [ ] Any modals/popups

**For Each Screen**:
1. Open screen in Godot
2. Take screenshot
3. Note all overlapping elements
4. Rate severity (Critical/Major/Minor)

---

### Task 2.1.2: Severity Classification

**Critical** (Blocks gameplay):
- Can't click buttons
- Can't read important text
- Controls don't work

**Major** (Frustrating):
- Text is cut off
- Elements are misaligned
- Hard to read

**Minor** (Cosmetic):
- Slight misalignment
- Inconsistent spacing
- Aesthetic issues

---

### Task 2.1.3: Create Issue Document

**Template**:

```markdown
## Screen: [Name]

### Issue 1: [Description]
- **Severity**: Critical/Major/Minor
- **Elements**: [Button A] overlaps [Text B]
- **Expected**: [Description of correct layout]
- **Screenshot**: [Attach]

### Issue 2: [Description]
...
```

---

### Task 2.1.4: Prioritize Fix List

Create ordered list:
1. Critical issues (fix immediately)
2. Major issues (fix in this phase)
3. Minor issues (fix if time permits)

---

## Success Criteria

- [ ] All UI screens documented
- [ ] All issues categorized by severity
- [ ] Fix priority list created
- [ ] Before screenshots saved

---

## Output Files

| File | Purpose |
|------|---------|
| `.planning/todos/ui-issues.md` | Issue catalog |
| `docs/ui-audit/` | Screenshot folder |
| `.planning/phases/02-mvp-gameplay/2.1-priority-list.md` | Fix order |

---

## Timebox

**Maximum Time**: 3 hours

Don't over-document - focus on critical issues first

---

## Next Phase

After audit is complete:
→ Move to **Phase 2.2: Modal Transparency Fixes**

---

**Status**: 📋 **READY TO START**
**Human Checkpoint**: Required before starting
