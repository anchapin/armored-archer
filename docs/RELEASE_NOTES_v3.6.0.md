# Armored Archer — Release Notes v3.6.0

**Version**: v3.6.0
**Release Date**: April 2026
**Sprint**: Sprint 8 — Soft Launch Tuning and Release Candidate
**Status**: Release Candidate

---

## Highlights

Armored Archer v3.6.0 is the **soft launch release candidate**, bringing gameplay balance tuning, analytics funnel tracking, and the full set of mobile beta readiness features from Sprint 7.

---

## What's New

### Gameplay Balance (Sprint 8)
- **Stage pacing tuning** — Adjusted enemy spawn timing and wave composition for smoother difficulty curves
- **Drop rate rebalancing** — Gear drop rates tuned for better progression feel across all rarity tiers
- **Punch-up risk/reward** — PvP punch-up mechanics refined for clearer risk/reward trade-offs
- **Season reward adjustments** — Seasonal ladder rewards retuned for better distribution across rank tiers

### Analytics & Monitoring (Sprint 8)
- **Funnel drop-off analytics** — Full install-to-PvE-to-PvP-to-purchase conversion tracking with drop-off identification
- **Trust system fixes** — Resolved all P0/P1 trust-system blockers from audit

### Mobile Beta Readiness (Sprint 7)
- **Touch controls polish** — Dual joystick improvements, aim smoothing, safe area handling, haptic feedback
- **Monitoring consolidation** — Unified crash/error monitoring, analytics, and health checks
- **Regression test suite** — Comprehensive regression tests across all major game systems
- **App store readiness** — Complete app store assets, metadata, and submission documentation
- **Usability improvements** — UX fixes from usability session findings, feedback collector integration
- **Support playbook** — FAQ and support documentation for beta users

### Store & Monetization (Sprint 6)
- **RevenueCat integration** — Production-ready IAP with sandbox validation, restore, and retry flows
- **Cosmetic-only gems** — Gems can only purchase cosmetics with zero combat impact (server-enforced)
- **Cross-device cosmetic sync** — Cosmetic ownership syncs across devices via transmog system
- **Audit logging** — Comprehensive audit trail for purchases and entitlements
- **Launch cosmetics** — Founder's bundle packaging for early adopters
- **Store resilience** — Graceful fallback messaging for provider outages

### Seasons & Progression (Sprint 5)
- **End-of-season soft reset** — Rank decay with cosmetic prestige rewards
- **Season telemetry** — Rank inflation, reward concentration, and progression velocity tracking
- **Season admin tools** — State validation and management for operators
- **Leaderboard UX** — Clearer ladder display with reward previews and seasonal messaging

### Economy & Balance (Sprint 5)
- **XP curve consolidation** — Unified XP curves with season economy hardening
- **Balancing simulator** — Session simulator with simulated player cohorts for tuning validation

### Client Features
- **Accessibility** — Text scaling, screen reader support via AccessibilityManager
- **Theme system** — Light/dark mode with design token support
- **Tutorial system** — TutorialManager with onboarding guidance
- **Object pooling** — Performance optimization for mobile devices
- **Device tier system** — Automatic performance scaling based on device capability

---

## Bug Fixes

- Resolved all CI pipeline failures (lint, complexity, coverage)
- Fixed P0/P1 trust-system blockers
- Fixed bugs in store/gem/transmog systems from Sprint 6
- Fixed flaky parallel CI failures from Docker conflicts
- Fixed RPG system validation schemas
- Fixed coverage workflow to TypeScript with act skip guards

---

## Technical Improvements

- **CI/CD**: 22+ GitHub Actions workflows covering CI, testing, security scanning, deployment, and rollback
- **Testing**: 80+ GDScript test files, 232+ TypeScript test files, 73.5% backend coverage
- **Security**: Server-authoritative design, DAST scanning, input validation, anti-cheat
- **Monitoring**: Prometheus + Grafana + Loki stack with alerting
- **Progressive deployment**: Canary rollout pipeline with automated rollback
- **Documentation**: Comprehensive runbooks, deployment guides, and support playbooks

---

## Known Issues

_(To be populated during RC verification)_

---

## Minimum Requirements

- **iOS**: iOS 15.0 or later
- **Android**: Android 8.0 (API 26) or later
- **Network**: Persistent internet connection required (server-authoritative game)

---

## Store Information

- **Age Rating**: 12+ (iOS) / Teen (Android)
- **Monetization**: In-app purchases (cosmetic-only gems, no pay-to-win)
- **Privacy**: No tracking, no ads SDK — see privacy policy for details

---

## For Testers

- Use the in-app feedback system to report bugs
- Refer to `docs/BETA_SUPPORT_PLAYBOOK.md` for common questions
- Crash reports are automatically sent via Firebase Crashlytics
