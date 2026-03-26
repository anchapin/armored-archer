# Context: Phase 01 - Design System Foundation

## Phase Overview

This is the foundational phase for the v2.2.0 UI/UX Polish milestone. It establishes the design tokens, base components, theme system, and accessibility infrastructure that all subsequent UI work will build upon.

## Project Context

### From PROJECT.md
- **Vision**: Create visually appealing, intuitive, easy-to-use game interface
- **Current State**: 20+ UI screens, 35+ GDScript files, Godot 4.x
- **Target**: Unified design system, 60fps UI, WCAG-like accessibility, mobile support

### From ROADMAP.md
- **Phase 1**: Design System Foundation
- **Goal**: Establish visual consistency across all screens

## Locked Decisions

1. **Godot 4.x** - UI system uses Godot's Control nodes
2. **Design Tokens First** - No UI work until tokens are defined
3. **Component-Based** - All UI extends base components
4. **Runtime Theming** - Light/dark themes with user preference
5. **WCAG AA** - Accessibility baseline for contrast ratios

## Technical Constraints

### Godot 4.x UI System
- Use Control nodes (not Node2D) for UI
- Theme overrides via Control's `theme` property
- StyleBox resources for button/panel styling
- Font sizes defined in Theme (not hardcoded)

### File Locations
- Design tokens: `autoloads/design_tokens.gd`
- Theme manager: `autoloads/ThemeManager.gd`
- Base components: `scenes/ui/components/`
- Accessibility: `autoloads/AccessibilityManager.gd`

### No Backend Changes
- This is purely client-side UI work
- No database or API changes needed

## Codebase Analysis

### Existing UI Files
- 20+ scenes in `scenes/ui/`
- 35+ scripts in `scenes/ui/` and `autoloads/`
- Key screens: main_menu, combat_menu, loadout, gear_inventory, store_menu, matchmaking_menu, leaderboard_menu, campaign_map

### Current Issues to Address
1. Hardcoded colors throughout
2. No consistent typography
3. No theming support
4. Unknown accessibility compliance
5. Inconsistent spacing and sizing

### Dependencies
- None for Phase 1 (foundation)

## Scope Clarification

### In Phase 1
- Design tokens definition
- Base component creation
- Theme manager
- Accessibility foundation
- Main menu migration (pilot)

### Out of Scope
- Other screen migrations (Phase 2+)
- New UI features
- Animation polish
- Mobile responsiveness (Phase 3+)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Design tokens don't match existing UI | Pilot with main_menu to catch issues |
| Godot theming complexity | Use StyleBox resources properly |
| Scope creep | Strict checklist, defer non-essentials |
