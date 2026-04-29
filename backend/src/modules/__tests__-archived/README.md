# Archived Tests

This directory contains test files for modules that have not yet been implemented.

## Archived Tests

| Test File                          | Missing Module            | Purpose                                                       |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `stat_allocation.spec.ts.bak`      | `stat_allocation.ts`      | Tests for respec costs, stat validation, and build management |
| `progression_tracking.spec.ts.bak` | `progression_tracking.ts` | Tests for quest progress, map markers, and level requirements |

## How to Re-enable

When the corresponding modules are implemented:

1. Move the test file from this directory back to `../__tests__/`
2. Rename from `.spec.ts.bak` to `.test.ts`
3. Ensure the module is implemented in `../<module_name>.ts`
4. Run the tests to verify implementation

## Why These Were Archived

These tests were causing CI failures because they import from modules that don't exist yet in the codebase. Rather than deleting the tests (which contain valuable specifications), they have been archived for future use when the features are implemented.

Archived: 2026-04-13
Reason: Module implementations pending - tests will be re-enabled when modules are added
