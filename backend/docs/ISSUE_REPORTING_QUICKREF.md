# Issue Reporting Pipeline - Quick Reference

**Version**: 1.0.0
**Created**: 2026-03-16
**Status**: ✅ Active

---

## 🚀 Quick Start

### For Alpha Users

**Report a bug in 3 steps:**

1. **Open the bug report form**
   - In-game: Settings → Report Bug
   - Web: https://github.com/{owner}/armored-archer/issues/new/choose

2. **Fill out the form**
   - Device and version are auto-detected
   - Describe the bug clearly
   - Add reproduction steps

3. **Submit**
   - You'll receive an issue number
   - Track progress on GitHub
   - Get notified when fixed

---

## 📁 Files Created

| File | Purpose | Location |
|------|---------|----------|
| **GitHub Issue Template** | Standardized bug report form | `.github/ISSUE_TEMPLATE/alpha-bug-report.md` |
| **In-Game Bug Form** | HTML form for bug submission | `backend/templates/bug-report-form.html` |
| **Auto-Triage Script** | Automatic issue categorization | `backend/scripts/auto-triage-issues.py` |
| **Triage Procedures** | Developer triage guidelines | `backend/docs/ISSUE_TRIAGE.md` |
| **GitHub Workflow** | Automated triage & Slack alerts | `.github/workflows/issue-triage.yml` |

---

## 🏷️ Bug Categories

| Category | Label | Keywords | Examples |
|----------|-------|----------|----------|
| Crash | `bug:crash` | crash, freeze, hang | Game closes unexpectedly |
| Blocker | `bug:blocker` | stuck, blocked, can't continue | Can't complete level |
| Combat | `bug:combat` | damage, hit, enemy | Arrow doesn't damage enemy |
| Performance | `bug:performance` | lag, fps, slow | Game runs slowly |
| UI/UX | `bug:ui` | button, menu, text | Button doesn't work |
| Audio | `bug:audio` | sound, music, silent | No sound effects |
| Network | `bug:network` | disconnect, timeout | Multiplayer disconnects |
| Visual | `bug:visual` | sprite, glitch, rendering | Wrong sprite displayed |

---

## ⚠️ Severity Levels

| Severity | Response Time | Slack Alert | Examples |
|----------|---------------|-------------|----------|
| **Critical** | < 1 hour | `#alpha-bugs-critical` 🚨 | Crash, data loss, blocker |
| **High** | < 4 hours | `#alpha-bugs-all` ⚠️ | Combat broken, frequent disconnect |
| **Medium** | < 24 hours | Weekly report | UI bug, visual glitch |
| **Low** | < 1 week | Weekly report | Typo, cosmetic issue |

---

## 🔧 Auto-Triage Script Usage

```bash
# Run on a specific issue
python3 backend/scripts/auto-triage-issues.py --issue-number 123

# Test with sample data
python3 backend/scripts/auto-triage-issues.py \
  --title "Game crashes on level 3" \
  --body "Every time I shoot an arrow, the game crashes..."

# Dry run (no changes made)
python3 backend/scripts/auto-triage-issues.py --dry-run --issue-number 123

# Verbose output
python3 backend/scripts/auto-triage-issues.py --verbose --issue-number 123
```

### Environment Variables

```bash
# Required for GitHub API access
export GITHUB_TOKEN=your_github_token

# Required for Slack notifications
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## 📊 GitHub Issue Views

### Critical Bugs
```
is:open label:alpha label:severity:critical
```

### Needs Triage
```
is:open label:alpha label:bug no:assignee
```

### My Assigned Issues
```
is:open assignee:@me
```

### Resolved This Week
```
label:status:resolved updated:>=2026-03-16
```

---

## 🔔 Slack Notifications

### Critical Bug Alert Format

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

[View Issue] [Assign to Me]
```

### Daily Digest (9 AM UTC)

```
📊 Daily Bug Report - Mar 16

New Issues: 5
Resolved: 2
Open Total: 12

New Issues:
- #123 [critical] Game crashes on level 3
- #124 [high] Cannot damage enemies
...

Resolved:
- #120 Fixed arrow collision detection
- #121 Fixed menu navigation
```

---

## 🧪 Testing the Pipeline

### Test Issue Creation

```bash
# Using GitHub CLI
gh issue create \
  --title "[ALPHA BUG] Test bug report" \
  --body "This is a test bug report to verify the pipeline." \
  --label "alpha" \
  --label "bug"
```

### Test Auto-Triage

```bash
# Test with crash keywords
python3 backend/scripts/auto-triage-issues.py \
  --title "Game crashes when shooting arrow" \
  --body "The game freezes and crashes to home screen every time I shoot an arrow in level 3. Device: iPhone 14 Pro, iOS 17.2, Version: v2.0.5" \
  --verbose

# Expected output:
# Category: Crash (high confidence)
# Severity: Critical
# Labels: alpha, bug:crash, severity:critical
```

### Test Slack Integration

```bash
# Test Slack webhook
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H "Content-Type: application/json" \
  -d '{"text":"Test alert from issue triage pipeline"}'
```

---

## 📈 Metrics to Track

### Daily
- New issues count
- Resolved issues count
- Average time to triage
- Critical bugs count

### Weekly
- Bug report rate (reports per active user)
- Resolution rate (% fixed within SLA)
- Top bug categories
- Duplicate rate

### Monthly
- Total bugs reported
- Average resolution time
- User satisfaction (survey)
- Recurring issues

---

## 🚨 Escalation Path

```
Developer → Lead Engineer → CTO → All Hands
```

**When to escalate:**
1. Critical bug affecting > 50% of users
2. Security vulnerability
3. Data loss confirmed
4. Bug unresolved after SLA time

---

## 🔗 Related Documents

- [Full Design Document](../../../.planning/phases/03-user-onboarding/03-03-issue-reporting.md)
- [Triage Procedures](../../backend/docs/ISSUE_TRIAGE.md)
- [Alpha User Guide](../../backend/docs/ALPHA_USER_GUIDE.md)
- [Feedback System](../../../.planning/phases/03-user-onboarding/03-02-feedback-system.md)

---

## 📞 Support

- **On-Call Developer**: Check `#engineering` Slack
- **Lead Engineer**: @lead-engineer
- **Alpha Support**: alpha-support@armoredarcher.com
- **Discord**: https://discord.gg/armoredarcher

---

**Last Updated**: 2026-03-16
**Maintained By**: Development Team
