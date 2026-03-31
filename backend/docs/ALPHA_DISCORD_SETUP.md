# Armored Archer Alpha Discord Setup Guide

**Version**: 1.0
**Created**: 2026-03-16
**Status**: ✅ Complete
**Owner**: Community Manager / DevOps

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Server Creation](#server-creation)
4. [Role Configuration](#role-configuration)
5. [Channel Setup](#channel-setup)
6. [Bot Integration](#bot-integration)
7. [Automation Setup](#automation-setup)
8. [Testing & Validation](#testing-validation)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide covers the complete setup of the Armored Archer Alpha Testing Discord
server, including roles, channels, bots, and automation for effective alpha user
communication.

### Key Features
- Structured role hierarchy for alpha testers
- Organized channel categories
- Automated bug report creation
- Status page integration
- Weekly update distribution
- Emergency alert system

### Time Estimate
- **Initial Setup**: 2-3 hours
- **Bot Configuration**: 1-2 hours
- **Testing**: 30 minutes
- **Total**: 4-5 hours

---

## ✅ Prerequisites

### Required Accounts
- [ ] Discord account with server creation capability
- [ ] Discord Developer account (for bot creation)
- [ ] GitHub account (for integrations)
- [ ] Status page account (Instatus/Statuspage.io)

### Required Permissions
- Server Owner or Administrator permissions
- Ability to create and manage bots
- Webhook creation permissions

### Resources
- Server icon (512x512 PNG recommended)
- Alpha tester badge image (for roles)
- Welcome message content
- Server rules document

---

## 🖥️ Server Creation

### Step 1: Create Server

1. Open Discord
2. Click the **+** button in server list
3. Select **Create My Own**
4. Choose **For a community**
5. Enter server name: `Armored Archer - Alpha Testing`
6. Upload server icon (alpha badge variant)
7. Click **Create**

### Step 2: Configure Server Settings

#### Server Name & Icon
```
Settings → Overview
- Name: Armored Archer - Alpha Testing
- Upload icon: alpha_badge_512.png
- Description: Official alpha testing community for Armored Archer v2.1.0
```

#### Verification Level
```
Settings → Safety Setup
- Verification Level: Medium (must have verified email)
- Explicit Content Filter: Scan media content from all members
- 2FA Requirement: Enable for staff roles
```

#### Default Notifications
```
Settings → Notifications
- Notify Me About: Only @mentions
- Suppress @everyone and @role: Enabled
```

#### Community Settings
```
Settings → Community
- Enable Community Server: Yes
- Rules Channel: #welcome-and-rules
- Updates Channel: #alpha-announcements
- Welcome Screen: Enable and configure
```

### Step 3: Configure Welcome Screen

```
Settings → Community → Welcome Screen

**Description**: Welcome to the Armored Archer Alpha Testing Program!

**Channels to Show**:
1. #welcome-and-rules - Start here! Read the rules
2. #alpha-introductions - Introduce yourself
3. #alpha-announcements - Official updates
4. #alpha-general - General discussion

**Setup Complete**: ✅
```

---

## 👑 Role Configuration

### Step 1: Create Role Hierarchy

Create roles in this exact order (top to bottom):

```
Settings → Roles → Create Role
```

#### 1. 🎮 Server Owner
```
Role Name: 🎮 Server Owner
Color: #FFD700 (Gold)
Permissions: Administrator
Display Separately: Yes
Hoist: Yes
```

#### 2. 🛡️ Admin
```
Role Name: 🛡️ Admin
Color: #FF6B6B (Red)
Permissions:
  - Manage Server: ✅
  - Manage Channels: ✅
  - Manage Roles: ✅
  - Kick Members: ✅
  - Ban Members: ✅
  - Manage Messages: ✅
  - Mention @everyone: ✅
  - Manage Webhooks: ✅
  - Manage Emojis: ✅
Display Separately: Yes
Hoist: Yes
```

#### 3. 👨‍💻 Developer
```
Role Name: 👨‍💻 Developer
Color: #4ECDC4 (Teal)
Permissions:
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Mention @everyone: ✅ (for emergencies)
  - Manage Messages: ✅ (own messages)
  - Priority Speaker: ✅
  - Video: ✅
Display Separately: Yes
Hoist: Yes
```

#### 4. 📢 Community Manager
```
Role Name: 📢 Community Manager
Color: #FFE66D (Yellow)
Permissions:
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Mention @everyone: ✅ (for announcements)
  - Manage Messages: ✅
  - Manage Webhooks: ✅
  - Priority Speaker: ✅
Display Separately: Yes
Hoist: Yes
```

#### 5. ⭐ Alpha Tester (Core)
```
Role Name: ⭐ Alpha Tester (Core)
Color: #C7A1FF (Purple)
Permissions:
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Attach Files: ✅
  - Add Reactions: ✅
  - Priority Speaker: ✅
  - Connect to Voice: ✅
  - Speak: ✅
Display Separately: Yes
Hoist: Yes
```

#### 6. 🎯 Alpha Tester (Active)
```
Role Name: 🎯 Alpha Tester (Active)
Color: #95E1D3 (Mint)
Permissions:
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Attach Files: ✅
  - Add Reactions: ✅
  - Connect to Voice: ✅
  - Speak: ✅
Display Separately: Yes
Hoist: Yes
```

#### 7. 🔰 Alpha Tester (New)
```
Role Name: 🔰 Alpha Tester (New)
Color: #F38181 (Salmon)
Permissions:
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Attach Files: ✅
  - Add Reactions: ✅
  - Connect to Voice: ✅
  - Speak: ✅
Display Separately: No
Hoist: No
```

#### 8. ⏳ Waitlist
```
Role Name: ⏳ Waitlist
Color: #95A5A6 (Gray)
Permissions:
  - Read Text Channels: Limited (info channels only)
  - Send Messages: ❌
Display Separately: No
Hoist: No
```

#### 9. 👤 Member
```
Role Name: 👤 Member
Color: Default (no color)
Permissions:
  - Read Text Channels: ✅
  - Send Messages: ✅
  - Send Files: ✅
  - Embed Links: ✅
  - Attach Files: ✅
  - Add Reactions: ✅
  - Connect to Voice: ✅
  - Speak: ✅
Display Separately: No
Hoist: No
```

#### 10. 🤖 Bots
```
Role Name: 🤖 Bots
Color: #3498DB (Blue)
Permissions:
  - Administrator: ❌ (give specific permissions per bot)
  - Manage Messages: ✅ (for moderation bots)
  - Send Messages: ✅
  - Embed Links: ✅
  - Manage Webhooks: ✅
Display Separately: Yes
Hoist: No
```

### Step 2: Configure @everyone Permissions

```
Settings → Roles → @everyone

Permissions:
  - Read Text Channels: ✅
  - Send Messages: ✅ (in allowed channels)
  - Send Files: ✅
  - Embed Links: ✅
  - Attach Files: ✅
  - Add Reactions: ✅
  - Connect to Voice: ✅
  - Speak: ✅
  - Mention @everyone: ❌
  - Manage Messages: ❌
  - Manage Roles: ❌
```

---

## 📺 Channel Setup

### Step 1: Create Channel Categories

Create categories in this order:

#### 📌 INFORMATION
```
Category Name: 📌 INFORMATION
Permissions:
  - @everyone: Read Messages ✅, Send Messages ❌
  - Staff roles: Read ✅, Send ✅
```

#### 🎮 ALPHA TESTING
```
Category Name: 🎮 ALPHA TESTING
Permissions:
  - @everyone: Read ✅, Send ✅
  - Alpha Tester roles: Full access
  - Waitlist: Read ❌
```

#### 💬 COMMUNITY
```
Category Name: 💬 COMMUNITY
Permissions:
  - @everyone: Read ✅, Send ✅
  - Alpha Tester roles: Full access
  - Waitlist: Read ❌
```

#### 🔧 SUPPORT
```
Category Name: 🔧 SUPPORT
Permissions:
  - @everyone: Read ✅, Send ✅
  - Developer: Full access
  - Waitlist: Read ❌
```

#### 📊 FEEDBACK COLLECTION
```
Category Name: 📊 FEEDBACK COLLECTION
Permissions:
  - @everyone: Read ✅, Send ✅ (limited)
  - Staff: Full access
  - Waitlist: Read ❌
```

#### 🔊 VOICE CHANNELS
```
Category Name: 🔊 VOICE CHANNELS
Permissions:
  - @everyone: Connect ✅, Speak ✅
  - Alpha Tester roles: Full access
  - Waitlist: Connect ❌
```

#### 📁 STAGE CHANNELS
```
Category Name: 📁 STAGE CHANNELS
Permissions:
  - @everyone: View ✅
  - Alpha Tester roles: Full access
  - Waitlist: View ❌
```

#### 🔒 STAFF ONLY
```
Category Name: 🔒 STAFF ONLY
Permissions:
  - @everyone: Read ❌, Send ❌
  - Staff roles: Read ✅, Send ✅
```

### Step 2: Create Text Channels

#### 📌 INFORMATION Category

**#welcome-and-rules**
```
Type: Text Channel
Topic: Server rules and welcome information
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
```

**#alpha-announcements**
```
Type: Text Channel
Topic: Official announcements from the development team
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
```

**#server-status**
```
Type: Text Channel
Topic: Real-time server status and incident updates
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
  - Status Bot: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: Status page integration
```

**#known-issues**
```
Type: Text Channel
Topic: Track acknowledged bugs and issues
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
  - GitHub Bot: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: GitHub integration
```

**#weekly-updates**
```
Type: Text Channel
Topic: Weekly progress reports and updates
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
```

**#alpha-schedule**
```
Type: Text Channel
Topic: Testing schedule and upcoming events
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
```

#### 🎮 ALPHA TESTING Category

**#alpha-general**
```
Type: Text Channel
Topic: General alpha testing discussion
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off (enable if spam occurs)
NSFW: No
```

**#alpha-bug-reports**
```
Type: Text Channel
Topic: Report bugs using /bug-report command
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: 30 seconds (prevent spam)
NSFW: No
Bot Commands: /bug-report
```

**#alpha-feedback**
```
Type: Text Channel
Topic: General feedback on gameplay and features
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off
NSFW: No
```

**#alpha-performance**
```
Type: Text Channel
Topic: Performance feedback and metrics discussion
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off
NSFW: No
```

**#alpha-balance**
```
Type: Text Channel
Topic: Game balance discussion and feedback
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off
NSFW: No
```

**#alpha-ux**
```
Type: Text Channel
Topic: User experience and UI feedback
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off
NSFW: No
```

#### 💬 COMMUNITY Category

**#alpha-introductions**
```
Type: Text Channel
Topic: Introduce yourself to the alpha community
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: 1 minute (prevent spam)
NSFW: No
```

**#alpha-off-topic**
```
Type: Text Channel
Topic: Off-topic discussion and casual chat
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: Off
NSFW: No
```

**#alpha-showcase**
```
Type: Text Channel
Topic: Share your achievements and highlights (NDA-safe)
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: 2 minutes
NSFW: No
```

**#alpha-lfg**
```
Type: Text Channel
Topic: Looking for group - coordinate testing sessions
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
Slowmode: 1 minute
NSFW: No
```

#### 🔧 SUPPORT Category

**#alpha-technical-support**
```
Type: Text Channel
Topic: Technical support and troubleshooting
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
  - Developer: Full access
Slowmode: Off
NSFW: No
```

**#account-help**
```
Type: Text Channel
Topic: Account and access key support
Permissions:
  - Alpha Testers: Full access
  - Waitlist: No access
  - Staff: Full access
Slowmode: Off
NSFW: No
```

**#faq**
```
Type: Text Channel
Topic: Frequently asked questions and answers
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
  - FAQ Bot: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: FAQ bot
```

#### 📊 FEEDBACK COLLECTION Category

**#weekly-survey-reminders**
```
Type: Text Channel
Topic: Automated weekly survey reminders
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
  - Survey Bot: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: Survey bot
```

**#feedback-acknowledged**
```
Type: Text Channel
Topic: Acknowledged feedback from the team
Permissions:
  - @everyone: Read ✅, Send ❌
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: Feedback bot
```

**#feedback-implemented**
```
Type: Text Channel
Topic: Feedback that has been implemented
Permissions:
  - @everyone: Read ✅, Send ✅
  - Staff: Read ✅, Send ✅
Slowmode: Off
NSFW: No
```

#### 🔒 STAFF ONLY Category

**#staff-general**
```
Type: Text Channel
Topic: Staff coordination and discussion
Permissions:
  - Staff roles: Read ✅, Send ✅
  - Everyone else: No access
Slowmode: Off
NSFW: No
```

**#staff-bug-triage**
```
Type: Text Channel
Topic: Bug report triage and prioritization
Permissions:
  - Staff roles: Read ✅, Send ✅
  - Everyone else: No access
Slowmode: Off
NSFW: No
```

**#staff-feedback-review**
```
Type: Text Channel
Topic: Feedback review and categorization
Permissions:
  - Staff roles: Read ✅, Send ✅
  - Everyone else: No access
Slowmode: Off
NSFW: No
```

**#staff-metrics**
```
Type: Text Channel
Topic: Alpha metrics and analytics
Permissions:
  - Staff roles: Read ✅, Send ✅
  - Everyone else: No access
Slowmode: Off
NSFW: No
Webhook: Metrics dashboard
```

**#staff-logs**
```
Type: Text Channel
Topic: Moderation and bot logs
Permissions:
  - Admin: Read ✅, Send ✅
  - Other staff: Read only
  - Moderation Bot: Read ✅, Send ✅
Slowmode: Off
NSFW: No
Webhook: Moderation bot logs
```

### Step 3: Create Voice Channels

**🎤 General Voice**
```
Type: Voice Channel
Category: 🔊 VOICE CHANNELS
User Limit: 10
Bitrate: 64kbps
Permissions:
  - Alpha Testers: Connect ✅, Speak ✅
  - Waitlist: No access
```

**🎤 Testing Coordination**
```
Type: Voice Channel
Category: 🔊 VOICE CHANNELS
User Limit: 5
Bitrate: 64kbps
Permissions:
  - Alpha Testers: Connect ✅, Speak ✅
  - Waitlist: No access
```

**🎤 Developer AMA**
```
Type: Voice Channel
Category: 🔊 VOICE CHANNELS
User Limit: 50
Bitrate: 96kbps
Permissions:
  - Alpha Testers: Connect ✅, Speak ✅ (during events)
  - Waitlist: No access
```

**🔇 AFK**
```
Type: Voice Channel
Category: 🔊 VOICE CHANNELS
User Limit: 0 (unlimited)
Bitrate: 64kbps
AFK: Yes (auto-move after 5 minutes)
Permissions:
  - @everyone: Connect ✅, Speak ❌ (auto-muted)
```

### Step 4: Create Stage Channel

**🎭 Alpha Events Stage**
```
Type: Stage Channel
Category: 📁 STAGE CHANNELS
Permissions:
  - @everyone: View ✅, Request to Speak ✅
  - Staff: Speak ✅, Moderate ✅
  - Alpha Testers: Request to Speak ✅
```

---

## 🤖 Bot Integration

### Bot 1: MEE6 (Moderation)

#### Setup Steps

1. **Invite MEE6**
   - Go to https://mee6.xyz
   - Click "Add to Discord"
   - Select your server
   - Authorize with these permissions:
     - Manage Roles
     - Manage Channels
     - Manage Messages
     - Send Messages
     - Embed Links
     - Kick/Ban Members

2. **Configure Welcome Messages**
```
MEE6 Dashboard → Plugins → Welcome

**Welcome Channel**: #alpha-introductions
**Welcome Message**:
```
👋 Welcome {user} to the Armored Archer Alpha Testing Program!

Please read the rules in #welcome-and-rules and introduce yourself!

To get started:
1. Read the server rules
2. React with ✅ to get access
3. Introduce yourself here
4. Check out #alpha-announcements for updates

Happy testing! 🎯
```
**DM Welcome**: Enable
**DM Message**:
```
Welcome to the Armored Archer Alpha! 🎉

Please make sure to read the rules in #welcome-and-rules.

If you have any questions, ask in #alpha-general or #alpha-technical-support.

— Alpha Team
```
```

3. **Configure Auto-Moderation**
```
MEE6 Dashboard → Plugins → Moderation

**Enable**:
- Delete links (for non-staff)
- Delete invites (prevent server invite spam)
- Anti-scam detection
- Anti-raid mode
- Banned words filter

**Configure**:
- Banned words: Add NDA-sensitive terms
- Link protection: Enabled for non-staff
- Invite deletion: Enabled
```

4. **Configure Level System (Optional)**
```
MEE6 Dashboard → Plugins → Level

**Enable**: Yes
**XP per message**: 15
**XP delay**: 60 seconds
**Leaderboard channel**: #alpha-showcase
**Role rewards**: Optional (configure for engagement)
```

### Bot 2: Custom Alpha Bot

#### Deployment Steps

1. **Create Discord Application**
```
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name: "Armored Archer Alpha Bot"
4. Go to "Bot" section
5. Click "Add Bot"
6. Configure:
   - Username: Alpha Bot
   - Icon: Alpha badge
   - Public Bot: No
   - Require OAuth2 Code Grant: No
```

2. **Configure Bot Permissions**
```
Bot → OAuth2 → URL Generator

**Scopes**:
- bot
- applications.commands

**Bot Permissions**:
- Send Messages
- Embed Links
- Manage Roles
- Manage Webhooks
- Use Slash Commands
```

3. **Deploy Bot Code**
```bash
# Backend directory
cd backend/src/alpha-bot

# Configure environment
cp .env.example .env
# Edit .env with Discord bot token

# Install dependencies
npm install

# Deploy
npm run deploy:bot
```

4. **Configure Bot Commands**
```typescript
// Bot commands configuration
/bug-report - Create bug report
/feedback - Submit feedback
/redeem - Redeem alpha access key
/status - Check server status
/help - Show help information
```

### Bot 3: GitHub Integration

#### Setup Steps

1. **Install GitHub App**
```
1. Go to https://github.com/apps/github-for-discord
2. Click "Install"
3. Select your organization/account
4. Select repositories to connect
5. Install
```

2. **Configure Webhooks**
```
Discord Server → Integrations → Webhooks
1. Create Webhook
2. Name: GitHub Updates
3. Channel: #known-issues
4. Copy Webhook URL
5. Add to GitHub repository settings
```

3. **Configure Events**
```
GitHub Repository → Settings → Webhooks

**Events to send**:
- Issues (opened, closed, reopened)
- Issue Comments
- Pull Requests (opened, merged, closed)

**Content type**: application/json
**Secret**: [Generate secure secret]
```

### Bot 4: Status Page Integration

#### Setup Steps

1. **Configure Status Page Webhook**
```
Status Page → Settings → Webhooks
1. Add Webhook
2. URL: Discord webhook URL
3. Events:
   - Incident Created
   - Incident Updated
   - Incident Resolved
   - Scheduled Maintenance
4. Save
```

2. **Create Discord Webhook**
```
Server Settings → Integrations → Webhooks
1. New Webhook
2. Name: Status Updates
3. Channel: #server-status
4. Copy URL
5. Add to status page
```

---

## ⚙️ Automation Setup

### Welcome & Role Assignment Flow

#### Step 1: Create Reaction Role Message
```
In #welcome-and-rules, post:

📜 **SERVER RULES** 📜

1. Be respectful to all testers
2. No harassment or discrimination
3. Keep discussions NDA-compliant
4. No spam or self-promotion
5. Use appropriate channels
6. Follow staff instructions
7. Report bugs in #alpha-bug-reports
8. Provide constructive feedback

By reacting with ✅, you agree to these rules and gain access to the server.

**Alpha Testers**: Use your access key in #alpha-introductions to get your role.
```

#### Step 2: Configure Reaction Role Bot
```
MEE6 Dashboard → Plugins → Reaction Roles

**Message**: [Link to rules message]
**Emoji**: ✅
**Role**: 👤 Member
**Channel**: #welcome-and-rules
```

### Bug Report Automation

#### Command Configuration
```typescript
// /bug-report command
{
  name: "bug-report",
  description: "Submit a bug report",
  options: [
    {
      name: "title",
      type: STRING,
      required: true,
      description: "Brief bug title"
    },
    {
      name: "description",
      type: STRING,
      required: true,
      description: "Detailed description"
    },
    {
      name: "severity",
      type: STRING,
      required: true,
      choices: [
        { name: "Critical", value: "critical" },
        { name: "High", value: "high" },
        { name: "Medium", value: "medium" },
        { name: "Low", value: "low" }
      ]
    },
    {
      name: "steps-to-reproduce",
      type: STRING,
      required: true,
      description: "How to reproduce the bug"
    }
  ]
}
```

#### GitHub Issue Creation
```typescript
// When bug report is submitted
async function createGitHubIssue(bugReport) {
  const issue = {
    title: `[Alpha] ${bugReport.title}`,
    body: formatBugReport(bugReport),
    labels: ['bug', `severity:${bugReport.severity}`, 'alpha'],
    assignees: ['dev-on-call']
  };
  
  await github.issues.create(issue);
  
  // Post confirmation to Discord
  await discord.channels.cache
    .get(BUG_REPORT_CHANNEL)
    .send(`Bug report created: #${issue.number}`);
}
```

### Weekly Update Automation

#### Schedule Configuration
```yaml
# Weekly update schedule
weekly-update:
  channel: "#weekly-updates"
  schedule: "Friday 15:00 EST"
  template: "backend/templates/weekly-update-template.md"
  distribution:
    - discord: true
    - email: true
    - status-page: true
```

#### Metrics Collection
```typescript
// Automated metrics collection
async function collectWeeklyMetrics() {
  const metrics = {
    activeTesters: await getActiveTesters(),
    bugReports: await getBugCount(),
    bugsFixed: await getFixedBugs(),
    feedbackItems: await getFeedbackCount(),
    serverUptime: await getUptime(),
    avgResponseTime: await getAvgResponseTime(),
    p95Latency: await getP95Latency()
  };
  
  return metrics;
}
```

### Emergency Alert Automation

#### Alert Configuration
```typescript
// Emergency alert function
async function sendEmergencyAlert(severity, message) {
  const pingRole = severity === 1 ? '@everyone' : '@Alpha Tester';
  
  const alert = {
    content: `${pingRole} 🚨 EMERGENCY ALERT 🚨`,
    embeds: [{
      title: `Severity ${severity} Incident`,
      description: message,
      color: getSeverityColor(severity),
      fields: [
        { name: 'Status', value: 'Investigating' },
        { name: 'Started', value: new Date().toISOString() },
        { name: 'Next Update', value: getNextUpdateTime(severity) }
      ]
    }]
  };
  
  await discord.channels
    .get(ANNOUNCEMENT_CHANNEL)
    .send(alert);
  
  // Also post to status page
  await statusPage.createIncident({
    severity,
    title: message,
    status: 'investigating'
  });
}
```

---

## ✅ Testing & Validation

### Pre-Launch Checklist

#### Server Configuration
- [ ] Server name and icon set correctly
- [ ] Verification level configured
- [ ] 2FA requirement enabled for staff
- [ ] Community features enabled
- [ ] Welcome screen configured

#### Roles
- [ ] All roles created in correct order
- [ ] Role colors match design
- [ ] Permissions configured correctly
- [ ] Role hoisting set properly
- [ ] Staff roles display separately

#### Channels
- [ ] All categories created
- [ ] All channels created with correct names
- [ ] Channel permissions set correctly
- [ ] Channel topics configured
- [ ] Slowmode enabled where needed
- [ ] Voice channels configured
- [ ] Stage channel created

#### Bots
- [ ] MEE6 added and configured
- [ ] Custom alpha bot deployed
- [ ] GitHub integration active
- [ ] Status page webhook working
- [ ] Bot commands tested

#### Automation
- [ ] Welcome message triggers
- [ ] Reaction role assignment works
- [ ] Bug report command creates GitHub issues
- [ ] Emergency alert flow tested
- [ ] Weekly update schedule configured

### Functional Testing

#### Test 1: User Onboarding Flow
```
1. Create test Discord account
2. Join server
3. Verify welcome DM received
4. React to rules message
5. Verify Member role assigned
6. Verify channels unlocked
7. Post introduction
8. Verify role upgrade process
```

#### Test 2: Bug Report Flow
```
1. Use /bug-report command
2. Fill out all fields
3. Submit report
4. Verify GitHub issue created
5. Verify Discord confirmation
6. Verify issue appears in #known-issues
7. Test triage workflow
```

#### Test 3: Emergency Alert Flow
```
1. Trigger test emergency alert
2. Verify @everyone ping sent
3. Verify status page updated
4. Verify email sent (if configured)
5. Verify update cadence works
6. Test resolution flow
```

#### Test 4: Role Permissions
```
1. Test each role's permissions
2. Verify channel access
3. Verify command access
4. Test voice channel access
5. Verify staff-only channels secure
```

### User Acceptance Testing

Invite 3-5 team members to test:
- [ ] Onboarding experience
- [ ] Channel navigation
- [ ] Bug reporting
- [ ] Feedback submission
- [ ] Voice channel usage
- [ ] Mobile app experience
- [ ] Desktop app experience

---

## 🔧 Maintenance

### Daily Tasks

| Task | Owner | Time |
|------|-------|------|
| Monitor bug reports | Dev on-call | 15 min |
| Triage new issues | Developer | 30 min |
| Respond to support tickets | Community Manager | As needed |
| Update known issues | Developer | 10 min |
| Check bot health | DevOps | 5 min |

### Weekly Tasks

| Task | Owner | Time |
|------|-------|------|
| Publish weekly update | Community Manager | 1 hour |
| Review feedback | Staff | 2 hours |
| Update FAQ | Community Manager | 30 min |
| Clean up old messages | Moderation Bot | Auto |
| Review analytics | Community Manager | 30 min |
| Staff sync meeting | All staff | 1 hour |

### Monthly Tasks

| Task | Owner | Time |
|------|-------|------|
| Review role assignments | Community Manager | 1 hour |
| Audit bot permissions | DevOps | 30 min |
| Update server icon/theme | Community Manager | 1 hour |
| Review and archive old channels | Staff | 2 hours |
| Update documentation | Community Manager | 2 hours |

### Backup & Recovery

#### Server Settings Backup
```
1. Export server settings monthly
2. Save role configurations
3. Document channel structure
4. Backup bot configurations
5. Store in secure location
```

#### Bot Backup
```
1. Version control all bot code
2. Regular dependency updates
3. Backup environment variables
4. Document deployment process
5. Test rollback procedures
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Users Can't See Channels
**Symptoms**: New users report empty channel list
**Cause**: Role permissions not configured
**Solution**:
1. Check user has Member role
2. Verify @everyone permissions
3. Check channel category permissions
4. Test with alt account

#### Issue 2: Bot Commands Not Working
**Symptoms**: /bug-report or other commands fail
**Cause**: Bot permissions or connectivity
**Solution**:
1. Check bot is online
2. Verify bot has required permissions
3. Check command registration
4. Review bot logs for errors
5. Restart bot if needed

#### Issue 3: Webhooks Not Posting
**Symptoms**: Status updates not appearing
**Cause**: Invalid webhook URL or permissions
**Solution**:
1. Verify webhook URL is correct
2. Check channel permissions
3. Test webhook manually
4. Regenerate webhook if needed
5. Check rate limits

#### Issue 4: Role Assignment Not Working
**Symptoms**: Users react but don't get role
**Cause**: Bot permissions or reaction role config
**Solution**:
1. Check bot has Manage Roles permission
2. Verify role is below bot's highest role
3. Check reaction role configuration
4. Test with fresh reaction

#### Issue 5: Voice Channels Not Working
**Symptoms**: Users can't connect to voice
**Cause**: Permission or limit issues
**Solution**:
1. Check channel user limits
2. Verify role permissions
3. Check category permissions
4. Test with different users

### Support Resources

- **Discord Developer Docs**: https://discord.com/developers/docs
- **MEE6 Documentation**: https://help.mee6.xyz
- **GitHub Docs**: https://docs.github.com
- **Status Page Docs**: [Platform-specific]

---

## 📊 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Server Setup Complete | 100% | Checklist |
| All Bots Functional | 100% | Bot status |
| Onboarding Flow Works | 100% | Test users |
| Bug Reports Auto-Created | 100% | GitHub integration |
| Emergency Alerts Tested | Pass | Drill results |
| User Satisfaction | > 4/5 | Survey |

---

## 🔗 Related Documents

- [Communication Plan](../../.planning/phases/03-user-onboarding/03-04-communication.md)
- [Alpha User Guide](./ALPHA_USER_GUIDE.md)
- [Feedback Guide](./FEEDBACK_GUIDE.md)
- [Issue Triage](./ISSUE_TRIAGE.md)
- [Status Page Setup](./STATUS_PAGE_SETUP.md)

---

**Document Status**: ✅ Complete
**Owner**: Community Manager / DevOps
**Last Updated**: 2026-03-16
**Next Review**: Before alpha launch
