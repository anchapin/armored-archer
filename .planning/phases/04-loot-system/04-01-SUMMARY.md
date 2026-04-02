---
phase: 04-loot-system
plan: 01
subsystem: backend
tags: [gear, loot, alignment, backend]
dependency_graph:
  requires: []
  provides: [gear-5-type-4-rarity]
  affects: [gear_system.ts, validation.ts, gear_system.test.ts, progression_validation.test.ts]
tech_stack:
  added: []
  patterns: [5-slot gear system, 4-tier rarity, server-authoritative loot]
key_files:
  created: []
  modified:
    - backend/src/modules/gear_system.ts
    - backend/src/modules/validation.ts
    - backend/src/modules/__tests__/gear_system.test.ts
    - backend/src/modules/__tests__/progression_validation.test.ts
decisions: []
metrics:
  duration: ~20 minutes
  completed: 2026-04-02T02:50:00Z
---

# Phase 04 Plan 01: Backend Gear System Alignment Summary

**One-liner:** Aligned backend gear types (3→5) and rarity tiers (3→4) to match client's helm/armor/bow/arrow/amulet schema with epic rarity support.

## Changes

### Task 1: Update GEAR_TYPES, RARITIES, BASE_STATS, GEAR_NAMES
- `gear_system.ts`: GEAR_TYPES changed from `['weapon', 'armor', 'accessory']` to `['helm', 'armor', 'bow', 'arrow', 'amulet']`
- `gear_system.ts`: RARITIES added epic tier (stat_multiplier: 1.8, drop_chance: 0.10, color: #9B30FF), rebalanced common from 70% to 60%
- `gear_system.ts`: BASE_STATS updated for 5 types (helm/armor: defense+health, bow/arrow: attack+crit, amulet: dodge+crit)
- `gear_system.ts`: GEAR_NAMES updated with archery-themed names per slot
- `gear_system.ts`: rollRarity() updated to handle epic tier in drop calculation
- `gear_system.ts`: generateModifiers() updated — epic rarity grants 2 modifiers like legendary

### Task 2: Update modifier pools and tests
- `validation.ts`: equip/unequip slot enums updated to helm/armor/bow/arrow/amulet
- `gear_system.test.ts`: All 70 tests migrated from weapon/armor/accessory to bow/armor/amulet
- `progression_validation.test.ts`: equipped_gear keys migrated to new slot names

## Verification
- `npm run typecheck` passes with 0 errors
- `npm test -- --testPathPatterns="gear"` — 70/70 tests pass
- `npm test -- --testPathPatterns="progression_validation"` — 17/17 tests pass

## Deviations from Plan
None — plan executed exactly as written.

## Self-Check: PASSED
- [x] backend/src/modules/gear_system.ts compiles
- [x] GEAR_TYPES = ['helm', 'armor', 'bow', 'arrow', 'amulet']
- [x] RARITIES includes epic tier with 10% drop rate
- [x] Gear names are archery-themed per slot type
- [x] Equip/unequip RPCs accept the 5 new slot type strings
- [x] All 87 tests pass
