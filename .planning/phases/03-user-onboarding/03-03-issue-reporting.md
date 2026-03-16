# Phase 3.3 - Issue Reporting Pipeline

**Version**: 1.0.0
**Created**: 2026-03-16
**Status**: 📋 In Progress
**Owner**: Development Team
**Phase**: v2.1.0 - Alpha Launch & Stabilization
**Parent**: Phase 3 - Alpha User Onboarding

---

## 📋 Overview

This document defines the design and implementation of the Issue Reporting Pipeline for Armored Archer alpha users. The pipeline enables seamless bug reporting from users directly to GitHub issues, with automated triage, categorization, and notification systems.

### Purpose

The Issue Reporting Pipeline bridges the gap between user-reported bugs and developer action items by:
1. Making bug reporting simple and accessible for alpha users
2. Automatically categorizing and prioritizing reports
3. Creating structured GitHub issues with all necessary context
4. Notifying the team of critical bugs via Slack
5. Providing visibility into issue status through a tracking dashboard

### Scope

**In Scope**:
- GitHub issue templates for bug reports
- In-game bug report submission form (HTML)
- Auto-triage system for categorization
- GitHub webhook integration for new issues
- Slack notifications for critical bugs
- Issue tracking dashboard
- Triage procedures documentation

**Out of Scope** (Future Phases):
- Direct Godot integration (Phase 4+)
- Mobile app bug reporting widget
- Automated bug reproduction
- AI-powered duplicate detection
- Integration with Jira or other issue trackers

---

## 🎯 Objectives

### Primary Goals

1. **Simple Reporting**: Users can submit bug reports in under 3 minutes
2. **Auto-Categorization**: 80%+ of issues automatically categorized correctly
3. **Rapid Response**: Critical bugs trigger Slack alerts within 1 minute
4. **Complete Context**: All bug reports include device, version, and logs
5. **Transparent Tracking**: Users can view issue status on GitHub

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bug Report Submission Rate | > 30% of alpha users | GitHub analytics |
| Auto-Triage Accuracy | > 80% | Manual review |
| Critical Bug Alert Time | < 1 minute | Slack timestamp |
| Time to Triage (avg) | < 4 hours | GitHub issue metrics |
| Duplicate Issue Rate | < 15% | GitHub issue links |
| User Satisfaction | > 4/5 | Post-submission survey |

---

## 🏗️ System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Reporting Layer                       │
│  ┌───────────────────┐         ┌───────────────────┐           │
│  │  In-Game Form     │         │  GitHub Web UI    │           │
│  │  (HTML/JS)        │         │  (Issue Template) │           │
│  └─────────┬─────────┘         └─────────┬─────────┘           │
│            │                              │                      │
└────────────┼──────────────────────────────┼──────────────────────┘
             │                              │
             │ POST to Backend              │ GitHub Issue Created
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Processing & Triage Layer                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Auto-Triage Script (Python)                      │   │
│  │  - Keyword analysis                                      │   │
│  │  - Pattern matching                                      │   │
│  │  - Severity detection                                    │   │
│  │  - Duplicate detection                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         GitHub Webhook Handler                           │   │
│  │  - Listen for new issues                                 │   │
│  │  - Parse issue content                                   │   │
│  │  - Trigger auto-triage                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
             │
             │ GitHub API + Slack API
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Notification & Tracking Layer                │
│  ┌───────────────────┐         ┌───────────────────┐           │
│  │  Slack Alerts     │         │  Issue Dashboard  │           │
│  │  (Critical bugs)  │         │  (Web UI)         │           │
│  └───────────────────┘         └───────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Issue Templates** | GitHub Markdown | Native GitHub integration |
| **In-Game Form** | HTML/CSS/JS | Simple, no build step, WebView compatible |
| **Auto-Triage** | Python 3.x | Rich NLP libraries, easy scripting |
| **Webhook Handler** | GitHub Actions | Native GitHub integration, reliable |
| **Notifications** | Slack Incoming Webhook | Team communication standard |
| **Dashboard** | GitHub Issues + Labels | No additional infrastructure |

---

## 📊 Issue Categorization System

### Auto-Triage Categories

| Category | Label | Keywords | Priority |
|----------|-------|----------|----------|
| **Crash** | `bug:crash` | crash, freeze, hang, black screen, white screen | Critical |
| **Progression Blocker** | `bug:blocker` | can't continue, stuck, blocked, softlock | Critical |
| **Combat** | `bug:combat` | damage, hit, arrow, enemy, attack, weapon | High |
| **Performance** | `bug:performance` | lag, fps, slow, stutter, frame drop | High |
| **UI/UX** | `bug:ui` | button, menu, text, overlay, broken UI | Medium |
| **Audio** | `bug:audio` | sound, music, volume, silent, audio | Low |
| **Network** | `bug:network` | disconnect, timeout, connection, server | High |
| **Visual** | `bug:visual` | sprite, animation, glitch, rendering | Medium |

### Severity Detection

**Critical** (Slack Alert):
- Keywords: crash, freeze, data loss, progression blocker, softlock
- Impact: Game unplayable, user cannot continue

**High** (Slack Summary):
- Keywords: combat broken, can't damage, disconnect, multiplayer
- Impact: Major feature broken, affects core gameplay

**Medium** (Daily Report):
- Keywords: UI broken, visual glitch, minor bug
- Impact: Annoyance but game playable

**Low** (Weekly Report):
- Keywords: typo, cosmetic, minor visual
- Impact: Minimal impact on gameplay

### Duplicate Detection

The auto-triage system checks for potential duplicates by:
1. Comparing issue titles (Levenshtein distance < 3)
2. Matching device + version + error pattern
3. Same category + similar keywords in description

When a potential duplicate is found:
- Comment added: "This appears similar to #ISSUE_NUMBER"
- Label added: `potential-duplicate`
- Developer manually confirms and closes if duplicate

---

## 🔌 API Design

### In-Game Bug Report Submission

**Endpoint**: `POST /api/bug-report`

**Request**:
```json
{
  "title": "Game crashes when shooting arrow",
  "description": "Every time I shoot an arrow, the game freezes for 2 seconds then crashes",
  "category": "crash",
  "device_info": "iPhone 14 Pro, iOS 17.2",
  "game_version": "v2.0.5",
  "reproduction_steps": [
    "Start campaign level 3",
    "Aim at enemy",
    "Release arrow",
    "Game freezes then crashes"
  ],
  "expected_behavior": "Arrow should shoot and hit enemy",
  "actual_behavior": "Game freezes and crashes to home screen",
  "frequency": "Always",
  "logs": "base64_encoded_log_snippet",
  "screenshot": "base64_encoded_screenshot"
}
```

**Response**:
```json
{
  "success": true,
  "github_issue_url": "https://github.com/.../issues/123",
  "issue_number": 123,
  "message": "Bug report submitted successfully. Thank you!"
}
```

### GitHub Webhook Payload

**Event**: `issues.opened`

**Payload** (relevant fields):
```json
{
  "action": "opened",
  "issue": {
    "number": 123,
    "title": "[ALPHA BUG] Game crashes when shooting arrow",
    "labels": ["alpha", "bug"],
    "body": "...",
    "user": {
      "login": "alpha_user_001"
    }
  },
  "repository": {
    "name": "armored-archer",
    "full_name": "team/armored-archer"
  }
}
```

---

## 🎨 User Interface Design

### In-Game Bug Report Form

**Location**: Settings → Report Bug or pause menu

**Flow**:
1. User clicks "Report Bug" button
2. Form modal opens (WebView or native UI)
3. User enters bug title (auto-suggest from keywords)
4. User describes the bug (with template guidance)
5. Auto-detected info displayed (device, version, logs)
6. User adds reproduction steps (numbered list)
7. Optional: Attach screenshot/screen recording
8. User submits
9. Success confirmation with issue number
10. Option to view issue on GitHub

**Design Principles**:
- Pre-fill all detectable information (device, version, logs)
- Guide users with structured form fields
- Provide examples for each field
- Validate before submission
- Show progress indicator during submission
- Provide confirmation with tracking info

**Reference**: `backend/templates/bug-report-form.html`

### Issue Tracking Dashboard

**Location**: GitHub Issues page with custom views

**Views**:
1. **Critical Bugs**: `label:severity:critical+is:open`
2. **Alpha Bugs**: `label:alpha+is:open`
3. **Needs Triage**: `no:assignee+label:bug`
4. **In Progress**: `assignee:@me+is:open`
5. **Resolved This Week**: `label:status:resolved+updated:>=2026-03-16`

**Dashboard Features**:
- Filter by severity, category, assignee
- Sort by created date, priority, votes
- Export to CSV
- Subscribe to notifications
- RSS feed for new issues

**Reference**: `backend/templates/issue-dashboard.html`

---

## 🔔 Notification System

### Slack Integration

**Channels**:
- `#alpha-bugs-critical`: Critical severity bugs (immediate alert)
- `#alpha-bugs-all`: All alpha bug reports (digest)
- `#alpha-status`: Daily/weekly summary

### Alert Triggers

| Trigger | Channel | Message Format | Frequency |
|---------|---------|----------------|-----------|
| Critical bug created | `#alpha-bugs-critical` | 🚨 CRITICAL BUG: [Title] #[Number] | Immediate |
| High severity bug | `#alpha-bugs-all` | ⚠️ High Priority: [Title] #[Number] | Immediate |
| Daily summary | `#alpha-status` | 📊 Daily Bug Report: X new, Y resolved | 9 AM UTC |
| Weekly summary | `#alpha-status` | 📈 Weekly Bug Report: Trends, top issues | Monday 9 AM UTC |

### Slack Message Template

**Critical Bug Alert**:
```
🚨 *CRITICAL BUG REPORTED* 🚨

*Issue*: #[123] Game crashes on level 3
*Reporter*: @alpha_user_001
*Severity*: Critical
*Category*: Crash
*Device*: iPhone 14 Pro, iOS 17.2
*Version*: v2.0.5

*Description*:
Game freezes for 2 seconds then crashes when shooting arrow

*Reproduction*:
1. Start campaign level 3
2. Aim at enemy
3. Release arrow
4. Game freezes then crashes

<View Issue|https://github.com/.../issues/123>
<Assign to Me|https://github.com/.../issues/123/assign>
```

### Webhook Configuration

**GitHub → Slack**:
1. GitHub webhook triggers on `issues.opened`
2. GitHub Action processes issue
3. Action determines severity from labels
4. Action sends formatted message to Slack webhook URL

**Setup**:
```yaml
# .github/workflows/slack-notifications.yml
on:
  issues:
    types: [opened]
```

---

## 🔐 Security & Permissions

### Authentication

**In-Game Form**:
- Requires alpha user authentication token
- Token validated against alpha access list
- Rate limited to 5 reports per user per day

**GitHub Issues**:
- Public repository (issues visible to all)
- Alpha users can create issues
- Developers have write access for triage

### Authorization

| Action | Alpha User | Developer | Admin |
|--------|------------|-----------|-------|
| Submit bug report | ✅ | ✅ | ✅ |
| View all issues | ✅ | ✅ | ✅ |
| Comment on issues | ✅ | ✅ | ✅ |
| Add labels | ❌ | ✅ | ✅ |
| Assign issues | ❌ | ✅ | ✅ |
| Close issues | ❌ | ✅ | ✅ |
| Delete issues | ❌ | ❌ | ✅ |

### Data Protection

- User emails not exposed in public issues
- Logs sanitized before submission (no PII)
- Screenshots reviewed before public posting (optional moderation)
- Rate limiting prevents spam
- GitHub spam filtering enabled

---

## 📋 GitHub Issue Templates

### Template Structure

**File**: `.github/ISSUE_TEMPLATE/alpha-bug-report.md`

**Frontmatter**:
```yaml
name: 🐛 Alpha Bug Report
description: Report a bug encountered during alpha testing
title: '[ALPHA BUG] '
labels: [alpha, bug, needs-triage]
assignees: ''
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug!
        Please fill out all fields to help us reproduce and fix the issue.
  - type: input
    id: device
    attributes:
      label: Device Information
      description: What device and OS are you using?
      placeholder: e.g., iPhone 14 Pro, iOS 17.2
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Game Version
      description: What version of the game are you running?
      placeholder: e.g., v2.0.5
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: Describe what went wrong
      placeholder: The game...
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Reproduction Steps
      description: List the steps to reproduce this bug
      placeholder: |
        1. Go to...
        2. Click on...
        3. See error...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should have happened?
    validations:
      required: true
  - type: dropdown
    id: frequency
    attributes:
      label: Frequency
      description: How often does this bug occur?
      options:
        - Always
        - Sometimes
        - Rarely
        - Only once
    validations:
      required: true
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How severe is this bug?
      options:
        - Critical (Game crash, progression blocker)
        - High (Major feature broken)
        - Medium (Minor bug, game still playable)
        - Low (Cosmetic issue)
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs & Screenshots
      description: Paste any error messages or attach screenshots
      render: shell
    validations:
      required: false
```

---

## 🧪 Testing Strategy

### Auto-Triage Testing

**Test Cases**:
1. Crash keywords → Critical severity + crash category
2. Combat keywords + high severity → High priority
3. UI keywords → Medium severity + UI category
4. Duplicate title → Potential duplicate label
5. Missing required fields → Comment requesting info

**Test Setup**:
```bash
# Run auto-triage tests
cd backend
python3 scripts/test_auto_triage.py
```

### Webhook Testing

**Test Scenarios**:
1. New issue created → Slack alert sent
2. Critical label added → Immediate Slack notification
3. Issue assigned → Comment added
4. Issue closed → Summary updated

**Local Testing**:
```bash
# Use GitHub CLI to create test issue
gh issue create --title "[TEST] Bug report" --body "Test"
```

### End-to-End Testing

**User Flow**:
1. Open in-game bug form
2. Fill out all fields
3. Submit
4. Verify GitHub issue created
5. Verify Slack notification sent
6. Verify labels applied correctly

---

## 🚀 Deployment Plan

### Phase 1: GitHub Templates

```bash
# Create issue templates
cp .github/ISSUE_TEMPLATE/alpha-bug-report.md
```

**Verification**:
- Navigate to GitHub Issues → New Issue
- Verify alpha bug report template appears
- Test template with sample data

### Phase 2: Auto-Triage Script

```bash
# Deploy auto-triage script
cp backend/scripts/auto-triage-issues.py
chmod +x backend/scripts/auto-triage-issues.py

# Test locally
python3 backend/scripts/auto-triage-issues.py --test
```

**Verification**:
- Run script against test issues
- Verify labels applied correctly
- Verify comments added for missing info

### Phase 3: Webhook Integration

```bash
# Deploy GitHub Action
cp .github/workflows/issue-triage.yml

# Configure Slack webhook URL in GitHub Secrets
# SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

**Verification**:
- Create test issue
- Verify Slack notification received
- Verify issue labels applied

### Phase 4: In-Game Form

```bash
# Deploy HTML form
cp backend/templates/bug-report-form.html

# Integrate into Godot project (Phase 4)
# For now, accessible via WebView
```

**Verification**:
- Open form in browser
- Submit test bug report
- Verify GitHub issue created

### Phase 5: Dashboard

```bash
# Create saved GitHub issue views
# Document in ISSUE_TRIAGE.md
```

**Verification**:
- Access dashboard URLs
- Verify filters work correctly
- Verify issue counts accurate

### Rollback Plan

If issues detected:
1. Disable GitHub webhook
2. Pause auto-triage script
3. Remove in-game form link
4. Notify alpha users of temporary unavailability

---

## 📊 Success Criteria

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-Triage Accuracy | > 80% | Manual review of 100 issues |
| Webhook Reliability | > 99% | GitHub Action success rate |
| Slack Alert Time | < 1 minute | Timestamp comparison |
| Form Submission Success | > 95% | Submission analytics |

### User Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Bug Report Rate | > 30% of alpha users | GitHub analytics |
| Form Completion Rate | > 85% | Form analytics |
| Average Submission Time | < 3 minutes | Timing analytics |
| User Satisfaction | > 4/5 | Post-submission survey |

### Developer Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to Triage | < 4 hours | GitHub issue metrics |
| Critical Bug Response | < 1 hour | Slack timestamp |
| Duplicate Detection | > 70% | Manual review |

---

## 📝 Implementation Checklist

### GitHub Templates
- [ ] Create alpha-bug-report.md template
- [ ] Create alpha-feature-request.md template
- [ ] Create alpha-feedback.md template
- [ ] Test templates in GitHub UI

### Auto-Triage System
- [ ] Implement auto-triage-issues.py script
- [ ] Add keyword detection logic
- [ ] Add severity classification
- [ ] Add duplicate detection
- [ ] Write unit tests
- [ ] Deploy to GitHub Actions

### Webhook Integration
- [ ] Create issue-triage.yml workflow
- [ ] Configure Slack webhook integration
- [ ] Set up Slack channels
- [ ] Test webhook delivery
- [ ] Add error handling

### In-Game Form
- [ ] Create bug-report-form.html
- [ ] Add form validation
- [ ] Implement GitHub API integration
- [ ] Add success/error states
- [ ] Test form submission

### Documentation
- [ ] Create ISSUE_TRIAGE.md
- [ ] Document triage procedures
- [ ] Create developer runbook
- [ ] Create user guide for alpha testers

### Dashboard
- [ ] Create saved GitHub issue views
- [ ] Document dashboard URLs
- [ ] Set up issue filters
- [ ] Create RSS feeds

### Operations
- [ ] Configure Slack webhook URL
- [ ] Set up GitHub secrets
- [ ] Test end-to-end flow
- [ ] Monitor first 24 hours
- [ ] Adjust auto-triage rules based on feedback

---

## 🔗 Related Documents

- [Phase 3.1 - Alpha User Selection](03-01-user-selection.md)
- [Phase 3.2 - Feedback Collection System](03-02-feedback-system.md)
- [GitHub Issue Templates](../../../.github/ISSUE_TEMPLATE/)
- [Issue Triage Procedures](../../backend/docs/ISSUE_TRIAGE.md)
- [Alpha User Guide](../../backend/docs/ALPHA_USER_GUIDE.md)

---

## 📅 Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| Design Complete | 2026-03-16 | ✅ Done |
| GitHub Templates | 2026-03-16 | 📋 In Progress |
| Auto-Triage Script | 2026-03-17 | 📋 Pending |
| Webhook Integration | 2026-03-17 | 📋 Pending |
| In-Game Form | 2026-03-17 | 📋 Pending |
| Documentation | 2026-03-17 | 📋 Pending |
| Testing | 2026-03-18 | 📋 Pending |
| Deployment | 2026-03-18 | 📋 Pending |

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-16
**Maintained By**: Development Team
**Status**: 📋 **IN PROGRESS**
