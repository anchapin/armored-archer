# Beta Test Plan

**Phase**: 06 - Beta Readiness
**Plan**: 06-01
**Version**: v2.1.0-beta.1
**Created**: 2026-03-20

---

## Executive Summary

This document defines the beta test criteria, user feedback mechanisms, and success metrics for the Armored Archer beta release. The beta phase will validate production readiness under real-world conditions with 100+ active users.

---

## Beta Test Objectives

### Primary Objectives

1. **Validate Production Readiness**: Confirm all systems function correctly under real-world load
2. **Identify Critical Bugs**: Discover and fix high-severity issues before production launch
3. **Performance Validation**: Verify P95 latency < 80ms and error rate < 0.5%
4. **User Experience Testing**: Validate UI/UX polish and gameplay enjoyment
5. **Stakeholder Approval**: Obtain sign-off for production launch

### Secondary Objectives

1. Collect user feedback for post-launch improvements
2. Validate monitoring and alerting systems
3. Test customer support workflows
4. Validate onboarding flow effectiveness
5. Assess community engagement metrics

---

## Success Criteria

### Must-Have Criteria (Blocking)

| Criteria | Target | Measurement | Status |
|----------|--------|-------------|--------|
| Zero Critical Incidents | 0 critical incidents | Incident count | ⬜ Not Started |
| Beta User Capacity | 100+ active users | User registration count | ⬜ Not Started |
| Error Rate | < 0.5% across all RPCs | Prometheus metrics | ⬜ Not Started |
| P95 Latency | < 80ms under normal load | Load test results | ⬜ Not Started |
| Bug Severity | 0 critical/high bugs | Issue tracker count | ⬜ Not Started |
| Stakeholder Approval | Approved for production | Signed approval document | ⬜ Not Started |

### Nice-to-Have Criteria (Non-Blocking)

| Criteria | Target | Measurement |
|----------|--------|-------------|
| Daily Active Users | 50+ DAU | Analytics count |
| Session Duration | 15+ minutes average | Analytics average |
| User Retention | 60%+ return next day | Cohort analysis |
| Crash Rate | < 0.1% sessions | Crash analytics |
| Feedback Response Rate | 30%+ users submit feedback | Feedback count / users |

---

## Test Coverage

### Critical User Journeys

#### 1. User Registration & Onboarding

**Steps**:
1. Launch game client
2. Click "Sign Up"
3. Enter email and password
4. Complete email verification (if enabled)
5. Create character name
6. Complete tutorial
7. Access main menu

**Acceptance Criteria**:
- [ ] Registration completes without errors
- [ ] Email verification sends and validates correctly
- [ ] Tutorial completes without crashes
- [ ] User reaches main menu with functional UI

**Test Cases**:
- TC-01: Valid registration with correct email format
- TC-02: Invalid email format shows error message
- [ ] TC-03: Duplicate email shows appropriate error
- [ ] TC-04: Password strength validation works
- [ ] TC-05: Tutorial can be skipped
- [ ] TC-06: Tutorial completion saves progress

---

#### 2. Combat Gameplay (PvE)

**Steps**:
1. Select "Campaign" from main menu
2. Choose campaign level
4. Complete combat encounter
5. View results screen
6. Return to main menu

**Acceptance Criteria**:
- [ ] Combat loads within 3 seconds
- [ ] Frame rate stays above 30 FPS
- [ ] Combat calculations execute correctly
- [ ] Loot drops reward appropriate items
- [ ] XP gains update player stats correctly

**Test Cases**:
- [ ] TC-07: Combat completes without crashes
- [ ] TC-08: Player death handles correctly
- [ ] TC-09: Victory condition rewards properly
- [ ] TC-10: Defeat condition shows retry option
- [ ] TC-11: Loot drops display correct stats
- [ ] TC-12: XP gains apply to player level

---

#### 3. Matchmaking (PvP)

**Steps**:
1. Select "PvP" from main menu
2. Click "Find Match"
3. Wait for matchmaking
4. Load into match
5. Complete PvP encounter
6. View results

**Acceptance Criteria**:
- [ ] Matchmaking completes within 60 seconds
- [ ] Match pairs players of similar skill
- [ ] Match state synchronizes correctly
- [ ] Turn-based gameplay executes without desync
- [ ] Match results record accurately

**Test Cases**:
- [ ] TC-13: Matchmaking finds opponent
- [ ] TC-14: Matchmaking timeout handles gracefully
- [ ] TC-15: Match state syncs across players
- [ ] TC-16: Turn order executes correctly
- [ ] TC-17: Match completion rewards both players
- [ ] TC-18: Match cancellation works

---

#### 4. Gear Acquisition & Loadout

**Steps**:
1. Open inventory
2. View acquired gear
3. Equip gear to loadout slots
4. View stat changes
5. Save loadout

**Acceptance Criteria**:
- [ ] Inventory loads without delay
- [ ] Gear displays correct stats and rarity
- [ ] Equipping gear updates stats immediately
- [ ] Loadout saves persist across sessions
- [ ] Visual updates reflect gear changes

**Test Cases**:
- [ ] TC-19: Inventory displays all owned gear
- [ ] TC-20: Gear stats display correctly
- [ ] TC-21: Equipping gear updates character
- [ ] TC-22: Loadout limits enforced (5 slots)
- [ ] TC-23: Loadout saves to server
- [ ] TC-24: Loadout loads on next login

---

#### 5. Progression (Leveling & Stats)

**Steps**:
1. Gain XP from combat
2. Level up
3. Allocate ability points
4. View updated stats
5. Verify stat bonuses apply

**Acceptance Criteria**:
- [ ] XP gains display correctly
- [ ] Level up triggers notification
- [ ] Ability points allocate correctly
- [ ] Stat updates apply to combat
- [ ] Progression saves to server

**Test Cases**:
- [ ] TC-25: XP gains display in UI
- [ ] TC-26: Level up notification shows
- [ ] TC-27: Ability points allocate
- [ ] TC-28: Stat bonuses apply to combat
- [ ] TC-29: Max level caps correctly
- [ ] TC-30: Progression persists across sessions

---

#### 6. Seasonal Leaderboards

**Steps**:
1. Open leaderboards
2. View current season rankings
3. Filter by friends/global
4. View own ranking
5. Compare stats with top players

**Acceptance Criteria**:
- [ ] Leaderboard loads within 2 seconds
- [ ] Rankings display correctly
- [ ] Filters work (friends/global)
- [ ] Own ranking highlights
- [ ] Leaderboard updates in real-time

**Test Cases**:
- [ ] TC-31: Leaderboard displays top players
- [ ] TC-32: Leaderboard filters work
- [ ] TC-33: Own ranking shows
- [ ] TC-34: Leaderboard updates after match
- [ ] TC-35: Season countdown displays
- [ ] TC-36: Season rewards preview works

---

#### 7. Store Transactions

**Steps**:
1. Open in-game store
2. Browse available items
3. Select item to purchase
4. Complete purchase (test mode)
5. Verify item received

**Acceptance Criteria**:
- [ ] Store loads without errors
- [ ] Items display correct prices
- [ ] Purchase flow completes without crashes
- [ ] RevenueCat validation works
- [ ] Purchased items appear in inventory

**Test Cases**:
- [ ] TC-37: Store displays available items
- [ ] TC-38: Item prices display correctly
- [ ] TC-39: Purchase flow completes
- [ ] TC-40: RevenueCat validation passes
- [ ] TC-41: Purchased items appear in inventory
- [ ] TC-42: Purchase history shows

---

#### 8. Push Notifications

**Steps**:
1. Enable notifications in settings
2. Trigger notification event (e.g., energy refill)
3. Receive push notification
4. Tap notification to open app
5. Verify deep link works

**Acceptance Criteria**:
- [ ] Notification permission requests correctly
- [ ] Notifications send successfully
- [ ] Notification content displays correctly
- [ ] Tapping notification opens app
- [ ] Deep link navigates to correct screen

**Test Cases**:
- [ ] TC-43: Notification permission requests
- [ ] TC-44: Notifications send on events
- [ ] TC-45: Notification content displays
- [ ] TC-46: Tapping notification opens app
- [ ] TC-47: Deep link navigates correctly
- [ ] TC-48: Notifications can be disabled

---

## User Feedback Mechanisms

### In-Game Feedback System

**Location**: Settings → Feedback
**Enabled**: `BETA_FEEDBACK_ENABLED=true`

**Feedback Categories**:
1. Bug Report
2. Feature Request
3. Balance Suggestion
4. UI/UX Feedback
5. Performance Issue
6. Other

**Feedback Data Collection**:
- User ID (anonymous)
- Device type and OS version
- Game version (beta build ID)
- Category and severity
- Description (free text)
- Screenshots (optional)
- System logs (automatic)
- Performance metrics (automatic)

**Feedback Workflow**:
1. User submits feedback via in-game form
2. Feedback sent to backend RPC handler
3. Backend stores in `beta_feedback` table
4. Dev team reviews daily
5. Critical issues triaged immediately
6. Users notified of fixes (if email provided)

---

### Analytics & Telemetry

**Data Collection** (Anonymous):
- Session duration
- Screens visited
- Features used
- Error encounters
- Performance metrics (FPS, latency)
- Crash reports

**Privacy**:
- No personally identifiable information (PII)
- GDPR compliant
- Users can opt-out in settings
- Data used solely for product improvement

---

### Community Feedback Channels

**Discord Server**:
- `#beta-feedback` channel
- `#bug-reports` channel
- `#feature-requests` channel

**GitHub Issues**:
- Template for bug reports
- Template for feature requests
- Labels for beta vs. production

**In-Game Survey** (Post-Beta):
- Net Promoter Score (NPS) question
- Overall satisfaction rating
- Feature satisfaction ratings
- Open-ended feedback

---

## Performance Metrics & Monitoring

### Real-Time Metrics

**Dashboard**: Grafana (http://localhost:3000)

**Key Metrics**:
1. **Error Rate**: `sum(rate(nakama_rpc_errors_total[5m]))/sum(rate(nakama_rpc_calls_total[5m]))`
   - Target: < 0.005 (0.5%)
   - Alert: > 0.01 (1%)

2. **P95 Latency**: `histogram_quantile(0.95, nakama_rpc_latency_seconds)`
   - Target: < 0.08s (80ms)
   - Alert: > 0.12s (120ms)

3. **Active Connections**: `nakama_active_connections`
   - Target: 100+ concurrent users
   - Alert: < 10 (unusual drop)

4. **Cache Hit Rate**: `cache_hits_total/(cache_hits_total+cache_misses_total)`
   - Target: > 0.80 (80%)
   - Warning: < 0.70 (70%)

5. **Database Connections**: `pg_stat_database.numbackends`
   - Target: < 80% of max_connections
   - Alert: > 90%

---

### Alerting Configuration

**Alert Manager**: Prometheus Alertmanager

**Alert Rules**:
```yaml
groups:
  - name: beta_alerts
    rules:
      - alert: HighErrorRate
        expr: error_rate > 0.01
        for: 5m
        annotations:
          summary: "Error rate exceeds 1%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, nakama_rpc_latency_seconds) > 0.12
        for: 5m
        annotations:
          summary: "P95 latency exceeds 120ms"

      - alert: LowActiveUsers
        expr: nakama_active_connections < 10
        for: 15m
        annotations:
          summary: "Active user count unusually low"
```

**Notification Channels**:
- Slack: `#beta-alerts`
- Email: devops@armored-archer.internal

---

## Bug Triage & Fix Process

### Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| Critical | App crashes, data loss, security breach | 1 hour | Cannot login, progress lost |
| High | Major feature broken, severe performance | 4 hours | Combat doesn't work, 5s+ latency |
| Medium | Minor feature broken, workaround exists | 24 hours | Leaderboard doesn't sort |
| Low | Cosmetic issue, minor annoyance | 7 days | Typos, visual glitches |

### Triage Workflow

1. **Bug Reported** (In-game feedback, Discord, GitHub)
2. **Triage Team Reviews** (Daily standup at 10 AM)
   - Assign severity level
   - Assign to developer
   - Estimate fix time
3. **Developer Fixes**
   - Create fix branch
   - Write test case
   - Implement fix
   - Create PR
4. **Code Review**
   - Review fix and test
   - Approve or request changes
5. **Deploy to Beta**
   - Merge to main
   - Deploy to beta environment
   - Verify fix works
6. **Verify & Close**
   - Confirm bug resolved
   - Notify reporter (if applicable)
   - Close issue

---

## Beta Timeline

### Week 1: Onboarding (Days 1-7)

**Focus**: User registration, onboarding flow, basic gameplay

**Goals**:
- 100+ users registered
- Onboarding completion rate > 80%
- Zero critical bugs in registration flow

**Activities**:
- Deploy beta environment
- Open registration to beta testers
- Monitor onboarding metrics
- Fix blocking issues immediately

---

### Week 2: Core Gameplay (Days 8-14)

**Focus**: Combat, matchmaking, progression

**Goals**:
- 50+ daily active users
- Average session length 15+ minutes
- Error rate < 0.5%

**Activities**:
- Monitor combat performance
- Validate matchmaking quality
- Track progression systems
- Collect gameplay feedback

---

### Week 3: Advanced Features (Days 15-21)

**Focus**: Gear system, leaderboards, store

**Goals**:
- 60+ day-7 retention rate
- P95 latency < 80ms sustained
- Zero high-severity bugs

**Activities**:
- Validate gear acquisition flow
- Test leaderboard accuracy
- Verify store transactions
- Optimize performance

---

### Week 4: Polish & Validation (Days 22-28)

**Focus**: UI/UX polish, stakeholder demo

**Goals**:
- All success criteria met
- Stakeholder approval received
- Production deployment ready

**Activities**:
- Fix remaining medium/low bugs
- Conduct stakeholder demo
- Prepare production deployment plan
- Document lessons learned

---

## Acceptance Testing

### Pre-Beta Checklist

- [ ] Beta environment deployed and healthy
- [ ] All monitoring dashboards configured
- [ ] Alerting rules tested and working
- [ ] Onboarding flow tested end-to-end
- [ ] Feedback system functional
- [ ] Support team trained on beta issues
- [ ] Rollback procedure documented
- [ ] Communication plan ready

---

### Beta Exit Criteria

- [ ] All 6 must-have success criteria met
- [ ] Zero critical or high-severity bugs remaining
- [ ] Performance metrics sustained for 7 days
- [ ] Stakeholder approval document signed
- [ ] Production deployment plan approved
- [ ] Post-launch backlog prioritized

---

## Roles & Responsibilities

| Role | Name | Responsibilities |
|------|------|------------------|
| Beta Coordinator | [TBD] | Overall beta coordination, stakeholder communication |
| DevOps Engineer | [TBD] | Environment management, monitoring, alerting |
| Backend Developer | [TBD] | Server-side bug fixes, performance optimization |
| Frontend Developer | [TBD] | Client-side bug fixes, UI/UX improvements |
| QA Engineer | [TBD] | Bug triage, test case execution, validation |
| Community Manager | [TBD] | User feedback collection, community engagement |
| Product Owner | [TBD] | Prioritization, stakeholder demo, approval |

---

## Communication Plan

### Internal Updates

**Daily Standup** (10 AM, 15 min):
- Yesterday's accomplishments
- Today's plan
- Blockers and risks

**Weekly Stakeholder Update** (Friday, 30 min):
- Beta metrics overview
- Critical issues summary
- Upcoming priorities

**Beta Retrospective** (Post-Beta, 2 hours):
- Lessons learned
- What went well
- What to improve
- Action items for production

---

### External Communication

**Beta Tester Welcome Email**:
- Beta instructions
- Feedback channels
- Known issues
- Support contact

**Weekly Beta Update** (Discord, Email):
- New features deployed
- Bugs fixed
- Upcoming changes
- Thank you for participation

**Beta Completion Announcement**:
- Beta results summary
- Production launch timeline
- Rewards for participation
- How to continue playing

---

## Risk Management

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Critical bug discovered during beta | Medium | High | Rapid response team, rollback procedure |
| Performance degradation under load | Low | High | Load testing before beta, caching |
| Low user engagement | Medium | Medium | Community outreach, incentives |
| Security vulnerability | Low | Critical | Security audit before beta, monitoring |
| Stakeholder rejects beta | Low | High | Regular updates, demo early and often |

### Contingency Plans

**If Critical Bug Discovered**:
1. Assess severity and impact
2. Decide: fix or rollback
3. Communicate to beta testers
4. Fix and redeploy within 24 hours
5. Extend beta if needed

**If Performance Degrades**:
1. Identify bottleneck (DB, cache, network)
2. Scale resources if needed
3. Optimize queries and caching
4. Monitor improvements

**If User Engagement Low**:
1. Survey beta testers for reasons
2. Address friction points
3. Add incentives (exclusive rewards)
4. Extend beta recruitment

---

## Appendix

### Test Case Template

```markdown
## TC-XX: [Test Case Name]

**Priority**: [Critical/High/Medium/Low]
**Type**: [Functional/Performance/Usability/Security]
**Journey**: [User Journey Name]

**Steps**:
1. [Action]
2. [Action]
3. [Action]

**Expected Result**:
- [Expected outcome]

**Actual Result**:
- [Actual outcome]

**Status**: [Pass/Fail/Blocked]
**Notes**: [Additional context]
```

### Bug Report Template

```markdown
## Bug Report: [Title]

**Severity**: [Critical/High/Medium/Low]
**Priority**: [P1/P2/P3/P4]
**Environment**: Beta v2.1.0-beta.1
**Device**: [Device type, OS version]

**Steps to Reproduce**:
1. [Action]
2. [Action]
3. [Action]

**Expected Behavior**:
- [What should happen]

**Actual Behavior**:
- [What actually happens]

**Attachments**:
- Screenshots
- Videos
- Logs

**Frequency**:
- [Always/Sometimes/Once]
```

---

**Document Version**: 1.0
**Last Updated**: 2026-03-20
**Next Review**: After beta completion

---

*Generated by Beta Readiness Phase (06-01)*
