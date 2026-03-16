# Phase 3.1 - Alpha User Selection Criteria

**Version**: 1.0  
**Created**: 2026-03-16  
**Status**: Draft  
**Owner**: Development Team

---

## 📋 Overview

This document defines the criteria and process for selecting 10-50 alpha users for the Armored Archer Go backend migration (v2.1.0). Alpha users will test the new backend in a controlled environment before beta launch.

---

## 🎯 Alpha Testing Objectives

### Primary Goals
1. **Validate Backend Stability**: Ensure Go backend handles real-world usage
2. **Performance Benchmarking**: Measure latency, throughput, and resource usage
3. **Bug Discovery**: Identify issues before beta launch
4. **Feedback Collection**: Gather user experience insights
5. **Load Testing**: Validate system under concurrent user load

### Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Active Alpha Users | 10-50 | Daily active users |
| Session Duration | 15+ minutes | Analytics tracking |
| Bug Reports | < 20 total | Issue tracker |
| Critical Bugs | 0 | Severity classification |
| User Satisfaction | > 4/5 | Post-session surveys |
| Retention (D7) | > 60% | Return after 7 days |

---

## 👥 Target User Profiles

### Primary Profile: Experienced Players
- **Experience**: 10+ hours in Armored Archer (v2.0.0)
- **Skill Level**: Intermediate to advanced
- **Engagement**: Plays 3+ times per week
- **Technical Comfort**: Comfortable reporting bugs and issues
- **Communication**: Active in Discord/community channels

### Secondary Profile: Technical Contributors
- **Background**: Developers, QA professionals, or testers
- **Value**: Can provide detailed technical feedback
- **Availability**: Can commit 2-3 hours/week for testing
- **Communication**: Clear, structured bug reports

### Exclusion Criteria
- ❌ New players (< 5 hours playtime)
- ❌ Known exploiters or cheaters
- ❌ Inactive users (> 30 days since last login)
- ❌ Users with history of toxic behavior

---

## 📊 Selection Criteria

### Tier 1: Core Alpha (10 users)
**Priority**: Highest engagement and trust

| Criteria | Requirement | Verification |
|----------|-------------|--------------|
| Playtime | 20+ hours | Backend analytics |
| Sessions | 15+ sessions | Login history |
| Account Age | 30+ days | Account creation date |
| Community | Active in Discord | Discord role/activity |
| Trust | No violations | Moderation logs |
| Location | Diverse regions | Geographic distribution |

### Tier 2: Active Players (20 users)
**Priority**: Regular players with good standing

| Criteria | Requirement | Verification |
|----------|-------------|--------------|
| Playtime | 10+ hours | Backend analytics |
| Sessions | 8+ sessions | Login history |
| Account Age | 14+ days | Account creation date |
| Trust | No violations | Moderation logs |
| Engagement | Recent activity (7 days) | Last login date |

### Tier 3: Technical Contributors (20 users)
**Priority**: Can provide detailed technical feedback

| Criteria | Requirement | Verification |
|----------|-------------|--------------|
| Application | Submitted feedback form | Application review |
| Background | Technical/QA experience | Self-reported |
| Availability | 2-3 hours/week | Commitment confirmation |
| Communication | Clear writing sample | Application quality |
| Timezone | Coverage for off-peak hours | Geographic diversity |

---

## 🌍 Geographic Distribution

Target distribution to test regional latency and server performance:

| Region | Target % | User Count (50 users) |
|--------|----------|----------------------|
| North America | 40% | 20 users |
| Europe | 30% | 15 users |
| Asia | 20% | 10 users |
| Other | 10% | 5 users |

---

## 📝 Application Process

### Step 1: Expression of Interest
- **Channel**: Discord announcement + in-game notification
- **Form**: Google Form or Typeform
- **Duration**: Open for 7 days

### Step 2: Application Form Questions

#### Basic Information
1. Discord username
2. In-game username
3. Email address
4. Timezone/Region

#### Experience Questions
5. How many hours have you played Armored Archer?
   - < 5 hours
   - 5-10 hours
   - 10-20 hours
   - 20+ hours
6. How often do you play?
   - Daily
   - 3-5 times per week
   - 1-2 times per week
   - Occasionally
7. What is your current player level? (if applicable)

#### Technical Questions
8. What device(s) do you play on?
   - PC (Windows/Mac/Linux)
   - Mobile (iOS/Android)
   - Both
9. Are you comfortable reporting bugs and technical issues?
   - Yes, very comfortable
   - Somewhat comfortable
   - Prefer not to
10. Do you have any technical/QA background? (optional)

#### Commitment Questions
11. Can you commit 2-3 hours per week for alpha testing?
    - Yes
    - No
    - Maybe
12. Are you willing to sign an NDA? (see Alpha User Agreement)
    - Yes
    - No
13. Why do you want to be an alpha tester? (open text)

### Step 3: Review & Selection
- **Reviewers**: 2-3 team members
- **Scoring**: Weighted scoring based on criteria
- **Timeline**: 3 days for review
- **Notification**: Email + Discord DM

### Step 4: Onboarding
- Send invitation email with access instructions
- Provide alpha user agreement for signature
- Schedule optional onboarding call (for Tier 3)
- Grant alpha access in backend system

---

## 🎖️ Alpha User Roles & Permissions

### Role: Alpha Tester
**Backend Implementation**: Custom Nakama authentication flag

#### Permissions
- ✅ Access to alpha game servers
- ✅ Access to alpha Discord channels
- ✅ Early access to new features (flagged)
- ✅ Direct communication with dev team
- ✅ Exclusive alpha tester badge/role

#### Restrictions
- ❌ Cannot access production backend
- ❌ Cannot share gameplay footage publicly (NDA)
- ❌ Cannot distribute alpha client builds
- ❌ Cannot reverse engineer backend

### Backend Implementation

```go
// Alpha user authentication check
type AlphaAccess struct {
    UserID       string    `json:"user_id"`
    AccessLevel  string    `json:"access_level"` // "alpha", "beta", "production"
    GrantedAt    time.Time `json:"granted_at"`
    ExpiresAt    time.Time `json:"expires_at"`
    DiscordID    string    `json:"discord_id"`
    Email        string    `json:"email"`
    Tier         string    `json:"tier"` // "core", "active", "technical"
    Status       string    `json:"status"` // "active", "suspended", "expired"
}

// Check alpha access during authentication
func CheckAlphaAccess(ctx context.Context, userID string) (*AlphaAccess, error) {
    // Query database for alpha access record
    // Return access details or error if not authorized
}
```

---

## 📀 Alpha User Tracking

### Database Schema

```sql
-- Alpha user tracking table
CREATE TABLE IF NOT EXISTS alpha_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    access_level VARCHAR(20) NOT NULL DEFAULT 'alpha',
    tier VARCHAR(20) NOT NULL, -- 'core', 'active', 'technical'
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'expired'
    discord_id VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    sessions_count INTEGER DEFAULT 0,
    feedback_submitted_count INTEGER DEFAULT 0,
    bugs_reported_count INTEGER DEFAULT 0,
    satisfaction_score INTEGER, -- 1-5 from surveys
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_alpha_users_user_id ON alpha_users(user_id);
CREATE INDEX idx_alpha_users_status ON alpha_users(status);
CREATE INDEX idx_alpha_users_tier ON alpha_users(tier);

-- Audit log for alpha user actions
CREATE TABLE IF NOT EXISTS alpha_user_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alpha_user_id UUID NOT NULL REFERENCES alpha_users(id),
    action VARCHAR(50) NOT NULL, -- 'login', 'logout', 'feedback', 'bug_report'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alpha_audit_user_id ON alpha_user_audit_log(alpha_user_id);
CREATE INDEX idx_alpha_audit_action ON alpha_user_audit_log(action);
```

### Tracking Spreadsheet (Alternative)

For initial alpha (10-50 users), use a Google Sheet:

**Columns**:
- User ID
- Discord Username
- Email
- Tier (Core/Active/Technical)
- Status (Active/Suspended/Expired)
- Access Granted Date
- Access Expiry Date
- Last Login
- Total Sessions
- Feedback Count
- Bugs Reported
- Satisfaction Score
- Notes

**Access**: Restricted to development team only

---

## 🔑 Access Key Generation

### Key Format
```
ALPHA-XXXX-XXXX-XXXX-XXXX
```
- 4 groups of 4 alphanumeric characters
- Case-insensitive
- Includes checksum for validation

### Generation Script
See: `/backend/scripts/generate-alpha-access-keys.sh`

### Usage
1. Generate batch of keys (e.g., 100 keys)
2. Store in database with metadata
3. Distribute to selected users via email
4. User redeems key in-game or via Discord bot
5. Key marked as used, alpha access granted

---

## 📅 Timeline

| Phase | Duration | Dates |
|-------|----------|-------|
| Application Period | 7 days | Days 1-7 |
| Review & Selection | 3 days | Days 8-10 |
| Invitation & Onboarding | 3 days | Days 11-13 |
| Alpha Testing Period | 14 days | Days 14-27 |
| Feedback Collection | Ongoing | Days 14-27 |
| Analysis & Report | 3 days | Days 28-30 |

---

## 🚨 Risk Management

### Risk: Insufficient Applications
**Mitigation**: 
- Extend application period
- Reach out to top players directly
- Offer incentives (exclusive rewards)

### Risk: Too Many Applications
**Mitigation**:
- Increase selection criteria strictness
- Create waitlist for future rounds
- Prioritize by engagement metrics

### Risk: Alpha User Churn
**Mitigation**:
- Regular check-ins and communication
- Exclusive rewards for continued participation
- Flexible time commitment

### Risk: Critical Bugs Discovered
**Mitigation**:
- Rapid response team on standby
- Clear escalation procedures
- Rollback plan ready

---

## 📊 Selection Scoring Matrix

### Scoring Formula
```
Total Score = (Engagement × 0.4) + (Trust × 0.3) + (Technical × 0.2) + (Diversity × 0.1)
```

### Engagement Score (0-100)
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Playtime | 40% | (hours / 50) × 100, max 100 |
| Sessions | 30% | (sessions / 30) × 100, max 100 |
| Recency | 20% | Days since last login: 0=100, 1-3=80, 4-7=60, 8-14=40, 15+=20 |
| Frequency | 10% | Sessions per week × 20, max 100 |

### Trust Score (0-100)
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Account Age | 40% | (days / 90) × 100, max 100 |
| Violations | 60% | 100 - (violations × 25), min 0 |

### Technical Score (0-100)
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Background | 50% | Self-reported: Dev/QA=100, Student=60, None=20 |
| Bug Reports | 30% | Previous reports: 0=20, 1-3=60, 4+=100 |
| Communication | 20% | Application quality review |

### Diversity Score (0-100)
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Region | 50% | Based on current distribution gaps |
| Timezone | 30% | Coverage for off-peak hours |
| Platform | 20% | PC vs Mobile balance |

---

## 📋 Checklist

### Pre-Selection
- [ ] Define selection criteria
- [ ] Create application form
- [ ] Prepare Discord announcement
- [ ] Set up tracking spreadsheet
- [ ] Generate access keys
- [ ] Prepare invitation templates

### During Selection
- [ ] Monitor application count
- [ ] Review applications daily
- [ ] Score and rank candidates
- [ ] Maintain diversity balance
- [ ] Prepare backup waitlist

### Post-Selection
- [ ] Send invitations to selected users
- [ ] Send waitlist notifications
- [ ] Track acceptance rate
- [ ] Onboard accepted users
- [ ] Monitor alpha user activity

---

## 📞 Communication Plan

### Announcement Channels
1. **Discord**: #announcements channel
2. **In-Game**: Notification system
3. **Email**: Newsletter to active users
4. **Social Media**: Twitter/X (optional)

### Message Schedule
| Day | Channel | Message |
|-----|---------|---------|
| 1 | Discord + In-Game | Alpha tester applications open |
| 3 | Discord | Reminder: 5 days left to apply |
| 5 | Email | Last chance to apply (48 hours) |
| 7 | All | Applications closed |
| 10 | Discord | Alpha testers announced |
| 11 | Email | Invitations sent to selected users |
| 13 | Discord | Welcome alpha testers! |

---

## 🎁 Incentives for Alpha Testers

### Exclusive Rewards
- **Alpha Tester Badge**: Permanent in-game badge
- **Exclusive Skin**: Alpha tester cosmetic item
- **Early Access**: First access to beta features
- **Discord Role**: Special alpha tester role
- **Developer Recognition**: Listed in credits

### Potential Future Benefits
- Beta access priority
- Launch day rewards
- Discount on future purchases (if applicable)

---

## 📈 Success Metrics & KPIs

### Recruitment Metrics
- [ ] Application count: Target 100+ applications
- [ ] Acceptance rate: 40-50%
- [ ] Acceptance confirmation: 80% of invited users accept
- [ ] Time to fill: < 14 days

### Engagement Metrics
- [ ] Daily active alpha users: > 60% of total
- [ ] Average session duration: > 15 minutes
- [ ] Sessions per user per week: > 3
- [ ] Retention (D7): > 60%
- [ ] Retention (D14): > 40%

### Feedback Metrics
- [ ] Bug reports per user: > 1
- [ ] Feedback submissions per user: > 2
- [ ] Survey response rate: > 70%
- [ ] Average satisfaction score: > 4/5

---

## 🔗 Related Documents

- [Alpha User Agreement](../../../backend/templates/alpha-user-agreement.md)
- [Invitation Email Template](../../../backend/templates/alpha-invitation-email.md)
- [Alpha User Guide](../../../backend/docs/ALPHA_USER_GUIDE.md)
- [Access Key Generator](../../../backend/scripts/generate-alpha-access-keys.sh)
- [Phase 3.1 Summary](./03-01-SUMMARY.md)

---

**Document Status**: ✅ Complete  
**Next Review**: After first alpha user cohort selection  
**Owner**: Development Team
