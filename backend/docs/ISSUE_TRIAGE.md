# Issue Triage Procedures

**Version**: 1.0.0
**Created**: 2026-03-16
**Status**: ✅ Active
**Owner**: Development Team
**Applies To**: Alpha Bug Reports (v2.1.0+)

---

## 📋 Overview

This document defines the procedures for triaging bug reports submitted during the alpha testing phase of Armored Archer. Effective triage ensures that bugs are properly categorized, prioritized, and assigned for resolution.

### Purpose

- Provide consistent handling of all alpha bug reports
- Ensure critical bugs receive immediate attention
- Reduce time from report to resolution
- Maintain clear communication with alpha testers

### Scope

This procedure applies to:
- All GitHub issues labeled with `alpha` and `bug`
- Bug reports submitted via in-game form
- Bug reports submitted via GitHub issue templates

---

## 🏗️ Triage Workflow

### High-Level Process

```
┌─────────────────┐
│ Issue Created   │
│ (GitHub/In-Game)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auto-Triage     │
│ (Automated)     │
│ - Categorize    │
│ - Severity      │
│ - Duplicate     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Slack Alert     │
│ (If Critical)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Human Triage    │
│ (Developer)     │
│ - Verify        │
│ - Reproduce     │
│ - Assign        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Fix In Progress │
└─────────────────┘
```

### Timeline

| Stage | Target Time | Responsible |
|-------|-------------|-------------|
| Auto-Triage | < 1 minute | System |
| Slack Alert (Critical) | < 1 minute | System |
| Initial Human Review | < 4 hours | On-call Developer |
| Reproduction Attempt | < 24 hours | Assigned Developer |
| Fix Started | < 48 hours | Assigned Developer |
| Fix Deployed | < 72 hours | DevOps |

---

## 🏷️ Severity Classification

### Critical (severity:critical)

**Response Time**: < 1 hour
**Slack Channel**: `#alpha-bugs-critical`

**Criteria**:
- Game crash or freeze
- Progression blocker (player cannot continue)
- Save data corruption or loss
- Server outage affecting all users
- Security vulnerability

**Examples**:
- "Game crashes immediately on startup"
- "Softlock in level 3 - cannot proceed"
- "All player data reset after update"

**Actions**:
1. ⚠️ **IMMEDIATE** Slack alert to `#alpha-bugs-critical`
2. Page on-call developer
3. Create incident if affecting > 50% of users
4. Consider hotfix deployment

---

### High (severity:high)

**Response Time**: < 4 hours
**Slack Channel**: `#alpha-bugs-all` (daily digest)

**Criteria**:
- Major feature broken (combat, multiplayer, progression)
- Frequent disconnections
- Performance severely impacted
- Affects 10-50% of users

**Examples**:
- "Cannot damage enemies in combat"
- "Multiplayer disconnects every 5 minutes"
- "FPS drops to 10 in boss fights"

**Actions**:
1. Log to Slack `#alpha-bugs-all`
2. Assign to relevant developer within 4 hours
3. Include in daily bug report
4. Target fix in next deployment

---

### Medium (severity:medium)

**Response Time**: < 24 hours
**Slack Channel**: None (included in weekly report)

**Criteria**:
- Minor feature broken but workaround exists
- UI elements not functioning correctly
- Visual glitches that don't affect gameplay
- Affects < 10% of users

**Examples**:
- "Button overlap in settings menu"
- "Wrong icon shown for Epic Bow"
- "Audio cuts out briefly during transitions"

**Actions**:
1. Categorize and label
2. Assign to appropriate developer
3. Include in weekly bug report
4. Fix in regular sprint cycle

---

### Low (severity:low)

**Response Time**: < 1 week
**Slack Channel**: None

**Criteria**:
- Cosmetic issues
- Typos in text
- Minor visual glitches
- Nice-to-have improvements

**Examples**:
- "Typo in level 2 intro text"
- "Slight color mismatch on button"
- "Particle effect slightly off-center"

**Actions**:
1. Categorize and label
2. Add to backlog
3. Fix when time permits
4. Batch similar issues

---

## 📁 Category Assignment

### Bug Categories

| Category | Label | Description | Example Keywords |
|----------|-------|-------------|------------------|
| **Crash** | `bug:crash` | Game crashes, freezes, or becomes unresponsive | crash, freeze, hang, black screen |
| **Progression Blocker** | `bug:blocker` | Player cannot continue or complete content | stuck, blocked, can't continue, softlock |
| **Combat** | `bug:combat` | Issues with combat mechanics | damage, hit, enemy, attack, weapon |
| **Performance** | `bug:performance` | FPS, lag, optimization issues | lag, fps, slow, stutter, frame drop |
| **UI/UX** | `bug:ui` | User interface problems | button, menu, text, overlay, broken UI |
| **Audio** | `bug:audio` | Sound and music issues | sound, music, volume, silent, audio |
| **Network** | `bug:network` | Online and connectivity issues | disconnect, timeout, connection, server |
| **Visual** | `bug:visual` | Graphical glitches and rendering issues | sprite, animation, glitch, rendering |

### Auto-Triage Keywords

The auto-triage system uses these keywords for initial categorization:

**Crash**:
- Primary: crash, freeze, hang, frozen, black screen, white screen
- Secondary: restart, quit, close, force close

**Blocker**:
- Primary: can't continue, cant continue, stuck, blocked, softlock, soft lock
- Secondary: impossible, progression, game over, unbeatable

**Combat**:
- Primary: damage, hit, enemy, attack, weapon, health, hp, dead, death
- Secondary: arrow, bow, sword, shield, combat, fight

**Performance**:
- Primary: lag, fps, slow, stutter, frame drop, framerate, performance
- Secondary: optimization, optimise, memory, ram, cpu

**UI**:
- Primary: button, menu, text, overlay, broken ui, interface, hud
- Secondary: click, tap, touch, display, screen

**Audio**:
- Primary: sound, music, volume, silent, audio, speaker, headphone
- Secondary: noise, crackle, distortion, mute

**Network**:
- Primary: disconnect, timeout, connection, server, online, multiplayer
- Secondary: latency, ping, network, wifi, internet

**Visual**:
- Primary: sprite, animation, glitch, rendering, graphic, texture
- Secondary: visual, model, mesh, polygon, artifact

---

## 🔄 Duplicate Handling

### Detection

The auto-triage system checks for potential duplicates by:
1. Comparing issue titles (70%+ similarity)
2. Matching device + version + error pattern
3. Same category + similar keywords

### Procedure

When a potential duplicate is detected:

1. **Auto-triage adds**:
   - Label: `potential-duplicate`
   - Comment: "This appears similar to #ISSUE_NUMBER"

2. **Developer review**:
   - Compare both issues
   - If confirmed duplicate:
     - Comment: "Duplicate of #ISSUE_NUMBER - closing"
     - Close issue
     - Add label: `duplicate`
   - If not duplicate:
     - Remove `potential-duplicate` label
     - Comment: "Reviewed - this is a distinct issue"

### Linking Related Issues

For issues that are related but not duplicates:

1. Add comment: "Related to #ISSUE_NUMBER"
2. Use GitHub's "Linked issues" feature in sidebar
3. Consider creating a tracking issue for multiple related bugs

---

## 👥 Developer Assignment

### Assignment Rules

| Category | Primary Assignee | Backup |
|----------|------------------|--------|
| Crash | Lead Engineer | Senior Developer |
| Blocker | Game Lead | Lead Engineer |
| Combat | Gameplay Developer | Game Lead |
| Performance | Engine Developer | Lead Engineer |
| UI/UX | UI Developer | Frontend Developer |
| Audio | Audio Engineer | General Developer |
| Network | Backend Developer | DevOps |
| Visual | Graphics Developer | UI Developer |

### On-Call Rotation

- Weekly rotation among senior developers
- On-call developer responsible for initial triage
- Schedule published in `#engineering` Slack channel
- Escalation path: On-call → Lead Engineer → CTO

---

## 📝 Missing Information Handling

### Required Information

All bug reports should include:
- Device information (device model, OS version)
- Game version
- Bug description
- Reproduction steps
- Expected behavior
- Frequency (Always/Sometimes/Rarely)

### Auto-Generated Comments

When information is missing, auto-triage adds:

```
## 📋 Missing Information

Thanks for reporting this issue! To help us investigate, please provide:

- [ ] Device information
- [ ] Game version
- [ ] Reproduction steps
- [ ] Expected behavior

Once you've added this information, we can start investigating. Thanks! 🙏
```

### Follow-Up Procedure

1. Auto-comment added immediately
2. Developer waits up to 48 hours for response
3. If no response after 48 hours:
   - Add label: `waiting-for-response`
   - Wait additional 7 days
4. If still no response after 7 days:
   - Close issue with comment
   - User can reopen when ready

---

## 🔔 Slack Notifications

### Alert Configuration

| Severity | Channel | Trigger | Format |
|----------|---------|---------|--------|
| Critical | `#alpha-bugs-critical` | Immediate | Full alert with actions |
| High | `#alpha-bugs-all` | Daily digest | Summary list |
| Medium | `#alpha-status` | Weekly report | Statistics |
| Low | `#alpha-status` | Weekly report | Statistics |

### Alert Message Format

**Critical Bug Alert**:
```
🚨 CRITICAL BUG REPORTED 🚨

Issue: #123 Game crashes on level 3
Reporter: @alpha_user_001
Severity: Critical
Category: Crash
Device: iPhone 14 Pro, iOS 17.2
Version: v2.0.5

Description:
Game freezes for 2 seconds then crashes when shooting arrow

Reproduction:
1. Start campaign level 3
2. Aim at enemy
3. Release arrow
4. Game freezes then crashes

[View Issue] [Assign to Me]
```

**Daily Digest** (sent at 9 AM UTC):
```
📊 Daily Bug Report (Last 24 Hours)

New Issues: 5
- #123 [Critical] Game crashes on level 3
- #124 [High] Cannot damage enemies
- #125 [Medium] UI overlap in settings
- #126 [Low] Typo in level 2
- #127 [Medium] Audio cuts out briefly

Resolved: 2
- #120 Fixed arrow collision detection
- #121 Fixed menu navigation

In Progress: 3
```

---

## 📊 Dashboard & Tracking

### GitHub Issue Views

Use these saved filters for tracking:

**Critical Bugs**:
```
is:open label:alpha label:severity:critical
```
URL: `https://github.com/{owner}/armored-archer/issues?q=is:open+label:alpha+label:severity:critical`

**Needs Triage**:
```
is:open label:alpha label:bug no:assignee
```
URL: `https://github.com/{owner}/armored-archer/issues?q=is:open+label:alpha+label:bug+no:assignee`

**My Assigned Issues**:
```
is:open assignee:@me
```
URL: `https://github.com/{owner}/armored-archer/issues?q=is:open+assignee:@me`

**Resolved This Week**:
```
label:status:resolved updated:>=YYYY-MM-DD
```

### Project Board

Alpha bugs are tracked on the GitHub Project Board:
- **To Triage**: New issues awaiting categorization
- **To Reproduce**: Issues needing reproduction
- **In Progress**: Being fixed
- **In Review**: Fix deployed, awaiting verification
- **Resolved**: Confirmed fixed

---

## 📈 Metrics & Reporting

### Daily Metrics

Track these metrics daily:
- New issues count
- Resolved issues count
- Average time to triage
- Average time to resolution
- Critical bugs count

### Weekly Report

Generated every Monday at 9 AM UTC:

```
## Weekly Bug Report (Week of YYYY-MM-DD)

### Summary
- New Issues: 23
- Resolved: 18
- In Progress: 5
- Critical: 0

### By Category
- Crash: 3
- Combat: 8
- Performance: 5
- UI: 4
- Other: 3

### By Severity
- Critical: 0
- High: 5
- Medium: 12
- Low: 6

### Top Issues (by votes/engagement)
1. #123 Arrow collision detection (24 votes)
2. #124 Multiplayer disconnects (18 votes)
3. #125 FPS drops in boss fights (15 votes)

### Trends
- Bug report rate: ↑ 15% from last week
- Resolution time: ↓ 2 hours faster
- Top category: Combat bugs
```

### Monthly Summary

At end of each month:
- Total bugs reported
- Resolution rate
- Average resolution time
- Top bug categories
- Recurring issues
- Recommendations for prevention

---

## 🚨 Escalation Procedures

### When to Escalate

Escalate to Lead Engineer or CTO when:
1. Critical bug affecting > 50% of users
2. Security vulnerability discovered
3. Data loss or corruption confirmed
4. Bug remains unresolved after 72 hours (critical) or 1 week (high)
5. Multiple related critical bugs (potential systemic issue)

### Escalation Path

```
Developer → Lead Engineer → CTO → All Hands
```

1. **Developer**: Initial investigation and fix attempt
2. **Lead Engineer**: Review, additional resources, priority adjustment
3. **CTO**: Strategic decision, potential delay of other work
4. **All Hands**: Emergency team mobilization

### Escalation Communication

**Slack Message** (to `#engineering-leadership`):
```
🚨 ESCALATION: Issue #123

Severity: Critical
Impact: 80% of users cannot complete level 3
Time Open: 48 hours
Blocker: Need additional engineering resources

Requesting: Senior developer to assist with investigation

[View Issue]
```

---

## 🧪 Reproduction Guidelines

### Steps for Developers

When attempting to reproduce a bug:

1. **Read the report carefully**
   - Note exact device, OS, and game version
   - Follow reproduction steps exactly as written
   - Note any additional context

2. **Set up matching environment**
   - Use same device/emulator if possible
   - Install exact game version
   - Match settings (graphics quality, etc.)

3. **Attempt reproduction**
   - Follow steps 3-5 times
   - Note any variations in behavior
   - Record screen if intermittent

4. **Document findings**
   - Comment on issue with results
   - Add "Reproduced" or "Cannot Reproduce" label
   - Note any additional findings

### Cannot Reproduce

If unable to reproduce after 3+ attempts:

1. Comment with details:
   ```
   ## Reproduction Attempt
   
   Tried on: iPhone 14, iOS 17.2, v2.0.5
   Attempts: 5
   Result: Unable to reproduce
   
   @Reporter Can you confirm:
   - Your exact game version?
   - Any mods or custom settings?
   - Does this happen on other devices?
   ```

2. Add label: `cannot-reproduce`
3. Wait 7 days for user response
4. If no response, close with comment

---

## ✅ Resolution & Closure

### Fix Verification

Before closing an issue:

1. **Fix deployed** to alpha environment
2. **Tested by developer** who implemented fix
3. **Verified by reporter** (when possible)
4. **No regressions** in related functionality

### Closing Comment Template

```
## ✅ Fixed

This issue has been resolved in version {version}.

**Fix**: {brief description of fix}
**Deployed**: {date}
**Verified by**: @{developer}

@Reporter Please test and confirm the fix works for you. 
If you're still experiencing issues, please comment below.

---
If no response within 7 days, this issue will be closed.
```

### Closure

After verification:
1. Add label: `status:resolved`
2. Close issue
3. Update project board
4. Notify reporter (if not already notified)

---

## 📚 Reference

### Related Documents

- [Phase 3.3 Design](../../../.planning/phases/03-user-onboarding/03-03-issue-reporting.md)
- [GitHub Issue Template](../../../.github/ISSUE_TEMPLATE/alpha-bug-report.md)
- [Auto-Triage Script](../../scripts/auto-triage-issues.py)
- [Alpha User Guide](ALPHA_USER_GUIDE.md)

### Tools & Scripts

| Tool | Location | Purpose |
|------|----------|---------|
| Auto-Triage | `scripts/auto-triage-issues.py` | Automatic categorization |
| Slack Alerts | GitHub Actions | Real-time notifications |
| Issue Dashboard | GitHub Issues | Tracking and filtering |

### Contact

- **On-Call Developer**: Check `#engineering` Slack channel
- **Lead Engineer**: @lead-engineer
- **Alpha Support**: alpha-support@armoredarcher.com

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-16
**Maintained By**: Development Team
**Review Schedule**: Monthly during alpha phase
