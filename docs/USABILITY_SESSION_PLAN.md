# Usability Session Plan: First 15 Minutes & First Purchase

**Sprint:** Sprint 7 - Mobile Beta Readiness
**Priority:** Stretch
**Issue:** #733

---

## 1. Objectives

Validate the first-time user experience (FTUE) for new players:
- Can users reach gameplay within 60 seconds?
- Do users understand controls before entering combat?
- Is the purchase flow discoverable, trustworthy, and friction-free?
- Where do users hesitate, get confused, or abandon?

## 2. Participant Profile

| Criteria | Requirement |
|----------|-------------|
| Count | 5-8 participants |
| Experience | Mix: 2 mobile gamers, 2 non-gamers, 2-4 archery/game fans |
| Device | iOS (3-4) and Android (3-4) |
| Prior exposure | None to the game (first-time only) |
| Session length | 30 minutes |

## 3. Session Format

### Setup (5 min)
- Install test build on participant's device
- Start screen recording
- Brief: "We're testing a new mobile game. Think out loud as you play. There are no wrong answers."

### Phase 1: First 15 Minutes (15 min)
- Hand device to participant
- Say: "Open the app and do whatever feels natural"
- Observer remains silent, takes notes
- At minute 15, pause for questions

### Phase 2: First Purchase (5 min)
- Say: "Now imagine you've been playing for a week and want to customize your character. Show me how you'd buy something."
- Observer notes trust signals, hesitation points, confusion

### Wrap-Up (5 min)
- Post-session questionnaire (see Section 6)

## 4. Observer Script & Metrics

### Phase 1: First 15 Minutes — Key Observations

| Timestamp | What to Watch | Success Metric | Red Flag |
|-----------|---------------|----------------|----------|
| 0:00-0:15 | Privacy consent flow | Completes in <10s without confusion | Asks "what does this mean?" |
| 0:15-0:30 | Beta welcome screen | Dismisses quickly | Reads carefully / seems concerned |
| 0:30-1:00 | Main menu orientation | Taps Play within 30s | Explores all buttons first |
| 1:00-2:00 | Campaign map comprehension | Selects first stage without help | Doesn't know which to tap |
| 2:00-3:30 | Tutorial: movement | Completes in <30s | Tries wrong controls first |
| 3:30-4:30 | Tutorial: aiming | Completes in <20s | Confused about auto-aim |
| 4:30-5:30 | Tutorial: shooting | Completes in <20s | Doesn't find shoot button |
| 5:30-7:00 | Tutorial: health awareness | Reads/nods and continues | Ignores or skips |
| 7:00-10:00 | First combat engagement | Defeats first wave | Dies repeatedly |
| 10:00-15:00 | Second/third stage attempt | Navigates back naturally | Gets lost in menus |

### Phase 2: First Purchase — Key Observations

| What to Watch | Success Metric | Red Flag |
|---------------|----------------|----------|
| Discovers store/gem purchase | Finds it within 30s | Doesn't know where to look |
| Understands gem value | Can explain what gems buy | "What are gems for?" |
| Purchase button clarity | Knows the price before tapping | Surprised by price |
| Trust signals | Feels confident proceeding | Hesitates at payment |
| Confirmation step | Expects confirmation | Surprised when purchase fires immediately |
| Success feedback | Knows purchase worked | "Did it go through?" |
| Error handling | Understands error message | "What does this mean?" |

### Quantitative Metrics to Record

- **Time to first tap** (seconds from app launch to first meaningful interaction)
- **Time to gameplay** (seconds from app launch to first combat)
- **Tutorial completion rate** (percentage of steps completed)
- **Tutorial skip rate** (at which step, if any)
- **Time to store discovery** (seconds from main menu to store)
- **Purchase intent clarity** (1-5 Likert scale, post-session)
- **SUS score** (System Usability Scale, post-session)

## 5. In-Game Feedback Collection

The game includes a built-in usability feedback system (see `scripts/usability_feedback_collector.gd`) that can be activated for beta testing sessions. It captures:

- Timestamped events (scene changes, button presses, tutorial steps)
- Time-to-milestone measurements
- Hesitation detection (pauses >3 seconds)
- Error frequency
- Session replay markers

Activate by setting `usability_testing_mode = true` in `user://usability_config.json` before the session.

## 6. Post-Session Questionnaire

### Task Completion (ask after each phase)

1. "How easy or difficult was it to [start playing / find the store]?" (1-7 scale)
2. "What was the most confusing moment?"
3. "Was there anything that almost stopped you from continuing?"

### Overall (ask at end)

4. "What is this game about? What's the goal?" (tests comprehension)
5. "How would you rate the overall experience?" (1-7 scale)
6. "Would you play this again? Why or why not?"
7. "What would you change about the first 15 minutes?"
8. "How did you feel about the purchase process?"
9. "Was anything missing that you expected to see?"
10. SUS Questionnaire (10 standard questions)

## 7. Known Issues to Watch For

Based on heuristic evaluation of the current codebase:

### Critical (will likely cause user confusion)
1. **No purchase confirmation dialog** - Tapping a gem pack immediately initiates purchase
2. **Tutorial references keyboard only** - Says "WASD / Arrow keys" but this is a mobile game
3. **Gem value is opaque** - Store shows prices but not what gems buy
4. **No purchase success feedback** - Success only prints to console, no visual celebration

### Moderate (may cause hesitation)
5. **Campaign map is information-dense** - Difficulty numbers, boss tags, quest markers, level requirements all visible at once for new players
6. **No gear/loadout tutorial** - Loadout button is visible but unexplained
7. **Settings button does nothing** - Prints "not implemented" to console
8. **Tutorial can only be skipped after step 1** - No global skip on first step

### Low (nice-to-fix)
9. **No welcome splash** - Goes straight from consent to main menu
10. **Store error dialog is unstyled** - Uses default AcceptDialog, no design tokens
11. **No first-purchase incentive banner** - Only a hidden 25-gem achievement

## 8. Success Criteria

| Metric | Target | Acceptable | Fail |
|--------|--------|------------|------|
| Time to gameplay | <60s | <90s | >120s |
| Tutorial completion | >80% | >60% | <50% |
| Store discoverability | <30s | <60s | >90s |
| Purchase flow comprehension | 5+ on 7-pt | 4+ | <4 |
| SUS Score | >80 | >68 | <52 |
| Critical issues found | 0 | 1-2 | 3+ |

## 9. Session Schedule Template

| Session # | Date | Participant | Device | Observer | Notes |
|-----------|------|-------------|--------|----------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |

## 10. Analysis & Reporting

After all sessions complete:

1. Compile quantitative metrics into a summary table
2. Map qualitative observations to the known issues list
3. Identify any NEW issues not in the heuristic evaluation
4. Rank issues by: frequency (how many users hit it) x severity (how badly it blocked them)
5. Create fix recommendations with priority levels
6. Present findings in `docs/USABILITY_FINDINGS.md`
