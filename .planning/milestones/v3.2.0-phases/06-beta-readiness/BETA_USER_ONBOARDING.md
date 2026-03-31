# Beta User Onboarding System

**Phase**: 06 - Beta Readiness
**Plan**: 06-01
**Version**: v2.1.0-beta.1
**Created**: 2026-03-20

---

## Overview

The beta user onboarding system is designed to support 100+ beta users with a seamless registration and first-time experience flow. This document describes the onboarding process, user management, and capacity planning.

---

## Onboarding Flow

### Step 1: Beta Access Request

**Entry Points**:
1. Discord invite link (`#beta-recruitment` channel)
2. Email invitation from beta coordinator
3. GitHub Issues signup form
4. Referral from existing beta user

**Qualification Criteria**:
- Age 18+ (or parental consent)
- Mobile device (iOS 13+ or Android 8+)
- Interest in action/archery games
- Willingness to provide feedback

**Signup Form**:
- Email address
- Device type (iOS/Android)
- Previous game experience
- Preferred beta start date

---

### Step 2: Account Registration

**In-App Registration Flow**:

1. **Launch Game**
   - User opens beta build of Armored Archer
   - Welcome screen displays "Beta Version v2.1.0-beta.1"

2. **Sign Up Screen**
   - Email input field
   - Password input field (min 8 characters)
   - "Sign Up" button
   - "Already have an account? Sign In" link

3. **Email Verification** (Optional for Beta)
   - Send verification email
   - User clicks verification link
   - Account activated

4. **Character Creation**
   - Enter character name (3-16 characters, alphanumeric)
   - Choose avatar (optional)
   - "Create Character" button

5. **Tutorial**
   - Skip option available
   - 5-minute interactive tutorial
   - Covers: movement, combat, inventory, skills

6. **Main Menu Access**
   - Tutorial completion grants access to full game
   - Welcome message displayed
   - Beta feedback prompt shown

---

### Step 3: First-Time Experience

**Day 1 Goals**:
- Complete tutorial
- Play first combat mission
- Acquire first piece of gear
- Visit in-game store
- Join Discord community

**Guided Experience**:
- Pop-up tips for first 3 sessions
- Highlight key features (combat, PvP, progression)
- Prompt for feedback after first match
- Offer rewards for completing onboarding checklist

---

## Beta User Management

### User Limits

**Environment**: Beta (`.env.beta`)

```bash
BETA_MAX_TEST_USERS=500
BETA_ONBOARDING_ENABLED=true
BETA_TEST_USERS_ENABLED=true
```

**Capacity Planning**:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Max Registered Users | 500 | 0 | ⬜ Ready |
| Concurrent Users | 100 | 0 | ⬜ Ready |
| Daily Active Users | 50 | 0 | ⬜ Ready |
| Week 1 Signups | 100 | 0 | ⬜ Target |

---

### User Registration RPC

**Endpoint**: `client.rpc.register_beta_user`

**Request**:
```typescript
{
  email: string;
  password: string;
  device_type: "ios" | "android";
  referral_code?: string;
}
```

**Response**:
```typescript
{
  user_id: string;
  username: string;
  token: string;
  created_at: string;
  is_beta_user: true;
}
```

**Validation**:
- Email format validation
- Password strength check (8+ chars, mixed case, number)
- Device type must be ios or android
- Check against existing users (no duplicates)
- Verify beta capacity not exceeded

---

### User Profile Creation

**Endpoint**: `client.rpc.create_beta_profile`

**Request**:
```typescript
{
  user_id: string;
  character_name: string;
  avatar_id?: string;
  preferred_language: "en" | "es" | "fr" | "de";
}
```

**Response**:
```typescript
{
  profile_id: string;
  character_name: string;
  level: 1;
  xp: 0;
  created_at: string;
}
```

**Initial State**:
- Level: 1
- XP: 0
- Gold: 100 (starter currency)
- Gear: Basic Bow + 50 Arrows
- Abilities: None (unlock at level 5)

---

## Onboarding Analytics

### Tracking Events

**Event 1: Registration Started**
```typescript
{
  event: "beta_registration_started",
  timestamp: "2026-03-20T12:00:00Z",
  device_type: "ios",
  source: "discord"
}
```

**Event 2: Registration Completed**
```typescript
{
  event: "beta_registration_completed",
  timestamp: "2026-03-20T12:05:00Z",
  user_id: "user_123",
  time_to_complete: 300 // seconds
}
```

**Event 3: Tutorial Started**
```typescript
{
  event: "beta_tutorial_started",
  timestamp: "2026-03-20T12:06:00Z",
  user_id: "user_123"
}
```

**Event 4: Tutorial Completed**
```typescript
{
  event: "beta_tutorial_completed",
  timestamp: "2026-03-20T12:11:00Z",
  user_id: "user_123",
  time_to_complete: 300 // seconds
}
```

**Event 5: First Match Played**
```typescript
{
  event: "beta_first_match",
  timestamp: "2026-03-20T12:15:00Z",
  user_id: "user_123",
  match_type: "pve",
  result: "victory"
}
```

---

### Funnel Metrics

**Onboarding Funnel**:

| Step | Users | Drop-off | Conversion |
|------|-------|-----------|------------|
| Launched Game | 100 | 0% | 100% |
| Started Registration | 95 | 5% | 95% |
| Completed Registration | 90 | 5.3% | 90% |
| Created Character | 88 | 2.2% | 88% |
| Started Tutorial | 85 | 3.4% | 85% |
| Completed Tutorial | 80 | 5.9% | 80% |
| Played First Match | 75 | 6.3% | 75% |

**Target**: 75% conversion from launch to first match

---

## Beta User Support

### Welcome Email

**Subject**: Welcome to Armored Archer Beta! 🏹

**Content**:
```
Hi [Username],

Welcome to the Armored Archer Beta Program! You're one of the first 100 players to experience our game.

Your Beta Access:
- Download: [App Store / Google Play Link]
- Beta Code: BETA-2026-001
- Discord: [Invite Link]
- Support: beta@armored-archer.internal

What to Expect:
- Weekly updates and patches
- Direct access to the dev team
- Exclusive beta rewards
- Chance to shape the game's future

Getting Started:
1. Download the beta build
2. Create your account
3. Complete the tutorial
4. Join our Discord community
5. Share your feedback!

Your feedback matters! Use the in-game feedback system or join #beta-feedback on Discord.

Thanks for being part of our journey!

The Armored Archer Team
```

---

### Onboarding Checklist

**In-Game Checklist**:

- [ ] Create account
- [ ] Complete tutorial
- [ ] Win first combat match
- [ ] Equip gear from inventory
- [ ] Visit in-game store
- [ ] Join Discord community
- [ ] Submit first feedback

**Reward**: 500 Gold + Exclusive Beta Avatar (upon completion)

---

### Troubleshooting Guide

**Issue 1: Cannot Register**
- **Symptom**: "Registration failed" error
- **Cause**: Email already exists or invalid format
- **Solution**: Use different email or check email format
- **Support**: Contact beta@armored-archer.internal

**Issue 2: Account Not Verified**
- **Symptom**: "Account pending verification" message
- **Cause**: Email verification not clicked (if enabled)
- **Solution**: Check email inbox/spam for verification link
- **Support**: Resend verification from settings

**Issue 3: Tutorial Stuck**
- **Symptom**: Tutorial cannot progress
- **Cause**: Bug or missing trigger
- **Solution**: Skip tutorial (button in top-right)
- **Support**: Report bug in Discord #bug-reports

**Issue 4: Cannot Find Match**
- **Symptom**: Matchmaking timeout
- **Cause**: No other players online or network issue
- **Solution**: Check internet connection, try again later
- **Support**: Join Discord to find other beta testers

---

## Capacity Management

### Scaling Strategy

**Phase 1 (Week 1)**: 25 users
- Test onboarding flow
- Identify bottlenecks
- Fix critical bugs

**Phase 2 (Week 2)**: 50 users
- Increase load gradually
- Monitor performance metrics
- Optimize database queries

**Phase 3 (Week 3)**: 100 users
- Full beta capacity
- Stress test systems
- Validate P95 latency < 80ms

**Phase 4 (Week 4)**: 150 users
- Overflow capacity
- Test auto-scaling
- Prepare for production

---

### Resource Allocation

**Database Connections**:
```yaml
max_open_conns: 25
max_idle_conns: 10
```
- Supports 100 concurrent users
- Scale up if P95 latency > 80ms

**Cache Configuration**:
```yaml
cache_capacity: 1000
cache_ttl: 3600
```
- LRU cache for player stats
- Reduces database load by 80%

**Matchmaking Capacity**:
```yaml
max_concurrent_matches: 50
match_timeout: 60s
```
- Supports 100 concurrent players
- 50 matches (2 players each)

---

## Beta User Communication

### Announcement Channels

**1. Discord (#beta-announcements)**
- Daily updates
- Patch notes
- Known issues
- Maintenance schedules

**2. In-Game Notifications**
- Push notifications for major updates
- In-game mail for rewards
- Popup announcements for downtime

**3. Email Digest**
- Weekly summary (Fridays)
- Top feedback items
- Upcoming features
- Thank you messages

---

### Feedback Collection

**In-Game Feedback Form**:
- Located in Settings → Feedback
- Categories: Bug, Feature, Balance, UX, Performance
- Screenshot attachment
- Automatic system logs included
- Direct to dev team

**Discord Channels**:
- `#beta-feedback` - General feedback
- `#bug-reports` - Bug reports only
- `#feature-requests` - Feature suggestions
- `#balance-discussion` - Game balance feedback

**Weekly Surveys** (optional):
- Net Promoter Score (NPS)
- Feature satisfaction ratings
- Open-ended feedback
- 5-10 minutes to complete
- Reward: 100 Gold

---

## Success Metrics

### Week 1 Targets

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Signups | 25 | 0 | ⬜ Pending |
| Tutorial Completion | 80% | - | ⬜ Pending |
| DAU/MAU Ratio | 40% | - | ⬜ Pending |
| Avg Session Length | 15min | - | ⬜ Pending |
| Feedback Submissions | 10 | 0 | ⬜ Pending |

### Week 2 Targets

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Signups | 50 | 0 | ⬜ Pending |
| Day 7 Retention | 60% | - | ⬜ Pending |
| P95 Latency | <80ms | - | ⬜ Pending |
| Error Rate | <0.5% | - | ⬜ Pending |
| Critical Bugs | 0 | 0 | ✅ Clear |

---

## Rollback Plan

### If Onboarding Issues Detected

**Scenario**: Critical bug prevents user registration

**Steps**:
1. Stop beta onboarding (`BETA_ONBOARDING_ENABLED=false`)
2. Notify existing users of issue
3. Fix bug in staging environment
4. Deploy fix to beta
5. Re-enable onboarding
6. Offer compensation (extra gold, exclusive avatar)

**Scenario**: Performance degradation under load

**Steps**:
1. Monitor metrics (P95 latency, error rate)
2. If P95 > 120ms for 5 minutes, alert
3. Scale database connections (max_open_conns: 25 → 50)
4. Add more cache capacity (1000 → 2000)
5. If still degraded, pause new signups
6. Investigate bottleneck (DB query, cache hit rate, network)

---

## Next Steps

1. **Deploy Beta Environment** (Task 3) - ✅ Complete
2. **Test Onboarding Flow** - Manual testing by dev team
3. **Open Beta Registration** - Send first 25 invites
4. **Monitor Metrics** - Check Prometheus/Grafana dashboards
5. **Address Issues** - Triage and fix blocking bugs
6. **Scale Up** - Gradually increase to 100 users

---

**Document Version**: 1.0
**Last Updated**: 2026-03-20
**Next Review**: After Week 1 of beta

---

*Generated by Beta Readiness Phase (06-01)*
