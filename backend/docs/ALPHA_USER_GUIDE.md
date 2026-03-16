# Armored Archer Alpha User Guide

**Version**: 1.0  
**Last Updated**: 2026-03-16  
**For**: Alpha Testers of v2.1.0 Go Backend Migration

---

## 🎯 Welcome, Alpha Tester!

Thank you for joining the Armored Archer Alpha Testing Program! This guide will 
help you understand what to expect, how to participate effectively, and how to 
provide valuable feedback.

---

## 📋 Table of Contents

1. [What is Alpha Testing?](#what-is-alpha-testing)
2. [Getting Started](#getting-started)
3. [What's New in v2.1.0](#whats-new-in-v210)
4. [How to Report Bugs](#how-to-report-bugs)
5. [Providing Feedback](#providing-feedback)
6. [Alpha Testing Schedule](#alpha-testing-schedule)
7. [Communication Channels](#communication-channels)
8. [Known Issues](#known-issues)
9. [FAQ](#faq)
10. [Tips for Effective Testing](#tips-for-effective-testing)

---

## 🎮 What is Alpha Testing?

### Purpose
Alpha testing is a **closed testing phase** where a select group of players test 
new infrastructure before public release. Your role is crucial in ensuring the 
Go backend migration is successful.

### What You're Testing
- **New Go Backend**: The game logic now runs on Go instead of TypeScript
- **Performance**: Improved response times and stability
- **Reliability**: Server stability under load
- **Compatibility**: Works with existing Godot client

### What's NOT Being Tested
- New gameplay features (focus is on backend migration)
- Client-side changes (Godot client is unchanged)
- New content (weapons, enemies, levels)

### Your Goals as an Alpha Tester
1. **Find Bugs**: Identify issues before public release
2. **Test Performance**: Experience and report on game responsiveness
3. **Provide Feedback**: Share your honest impressions
4. **Validate Stability**: Ensure the game runs smoothly

---

## 🚀 Getting Started

### Step 1: Accept Your Invitation
1. Check your email for the invitation
2. Click the link to review the Alpha User Agreement
3. Sign the agreement electronically
4. Save a copy for your records

### Step 2: Redeem Your Access Key

#### Method A: In-Game Redemption
1. Launch Armored Archer
2. Navigate to **Settings** → **Account**
3. Select **Redeem Alpha Access**
4. Enter your access key: `ALPHA-XXXX-XXXX-XXXX-XXXX`
5. Confirm and restart the game

#### Method B: Discord Redemption
1. Join the official Discord: [Invite Link]
2. Use the command: `!redeem ALPHA-XXXX-XXXX-XXXX-XXXX`
3. Bot will verify and grant you the Alpha Tester role
4. Your account is now linked

### Step 3: Join Discord
1. Click the Discord invite link in your email
2. Introduce yourself in `#alpha-introductions`
3. Review the rules in `#alpha-rules-and-guidelines`
4. Check your new **Alpha Tester** role

### Step 4: Verify Access
1. Launch the game
2. Look for the "Alpha" badge in the main menu
3. Try logging in - you should connect to alpha servers
4. Verify you can matchmake with other alpha testers

### Step 5: Start Playing!
1. Play as you normally would
2. Pay attention to any unusual behavior
3. Report issues when you encounter them
4. Have fun!

---

## ⚡ What's New in v2.1.0

### Backend Migration: TypeScript → Go

#### What Changed
- **Server Language**: Now running on Go (Golang)
- **Performance**: Improved response times
- **Stability**: Better error handling and recovery
- **Scalability**: Enhanced capacity for concurrent users

#### What Stayed the Same
- **Gameplay**: All game mechanics unchanged
- **Graphics**: No visual changes
- **Controls**: Same controls and UI
- **Progress**: Your progress carries over

#### Expected Improvements
- **Faster Response Times**: Target < 100ms P95 latency
- **Better Stability**: Fewer disconnects and errors
- **Improved Scaling**: Handles more concurrent players
- **Enhanced Monitoring**: Better error tracking

### Technical Details (For Interested Testers)

#### Architecture Overview
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Godot     │────▶│   Nakama     │────▶│  PostgreSQL │
│   Client    │◀────│   Go Backend │◀────│  Database   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Monitoring │
                    │   (Prometheus│
                    │    Grafana)  │
                    └──────────────┘
```

#### Key RPC Endpoints
- `authenticate` - User login and session management
- `matchmake` - Find and join matches
- `combat_action` - Combat calculations
- `player_stats` - Player statistics
- `inventory` - Item management
- `leaderboard` - Score rankings

---

## 🐛 How to Report Bugs

### Bug Reporting Best Practices

#### Before Reporting
1. **Reproduce**: Try to make the bug happen again
2. **Document**: Note what you were doing when it occurred
3. **Screenshot**: Capture visual bugs if possible
4. **Check Known Issues**: See if it's already reported

#### Bug Report Template

Use the `/bug-report` command in Discord or the in-game reporter:

```
**Bug Title**: [Brief description]

**Description**: 
[Detailed description of what happened]

**Steps to Reproduce**:
1. [First step]
2. [Second step]
3. [etc.]

**Expected Behavior**: 
[What should have happened]

**Actual Behavior**: 
[What actually happened]

**Frequency**: 
- [ ] Happened once
- [ ] Happens occasionally
- [ ] Happens every time

**Severity**:
- [ ] Minor (cosmetic, doesn't affect gameplay)
- [ ] Moderate (annoying but playable)
- [ ] Major (significantly impacts gameplay)
- [ ] Critical (game-breaking, crash)

**Environment**:
- Platform: [PC/Mobile]
- OS: [Windows/Mac/Linux/iOS/Android]
- Game Version: [Found in Settings]
- Time of Issue: [Date and time]

**Additional Info**:
[Any other relevant details]

**Attachments**:
[Screenshots, videos, logs]
```

### Bug Report Channels

#### Discord (Preferred)
- **Channel**: `#alpha-bug-reports`
- **Command**: `/bug-report`
- **Response Time**: < 24 hours

#### In-Game Reporter
- **Location**: Settings → Help → Report Bug
- **Best For**: Bugs with logs attached
- **Response Time**: < 48 hours

#### Email (For Sensitive Issues)
- **Address**: alpha-bugs@armoredarcher.com
- **Best For**: Security issues, exploits
- **Response Time**: < 24 hours

### Bug Severity Examples

#### Critical (Game-Breaking)
- Game crashes on launch
- Cannot log in
- Progress loss
- Cannot complete matches
- Game-breaking exploits

#### Major (Significant Impact)
- Frequent disconnections
- Major performance drops
- Key features not working
- Unfair advantages possible

#### Moderate (Annoying)
- Occasional lag spikes
- Minor visual glitches
- UI elements misaligned
- Sound issues

#### Minor (Cosmetic)
- Typographical errors
- Minor visual artifacts
- Sound not playing
- Color inconsistencies

---

## 💬 Providing Feedback

### Types of Feedback We Want

#### Performance Feedback
- Response time impressions
- Lag or latency issues
- Frame rate changes
- Loading times

#### Gameplay Feedback
- Combat balance
- Matchmaking quality
- Progression pacing
- Overall fun factor

#### User Experience
- UI/UX clarity
- Menu navigation
- Tutorial clarity
- Accessibility

#### Technical Feedback
- Connection stability
- Error messages clarity
- Platform compatibility
- Account management

### How to Provide Feedback

#### Weekly Surveys
- **When**: Sent every Friday via email
- **Duration**: 5-10 minutes
- **Topics**: Performance, bugs, satisfaction
- **Required**: Yes, part of participation

#### Discord Feedback Channels
- `#alpha-general-feedback` - General thoughts
- `#alpha-performance` - Performance discussion
- `#alpha-balance` - Game balance feedback
- `#alpha-ux` - UI/UX feedback

#### Direct Messages
- **Who**: Developers in Discord
- **When**: For detailed discussions
- **What**: In-depth feedback on specific topics

#### Feedback Form (Always Open)
- **Link**: [Google Form/Typeform Link]
- **Best For**: Structured, detailed feedback
- **Anonymous**: Optional

### Feedback Tips

#### Be Specific
❌ "The game feels laggy"  
✅ "I experience 2-3 second delays when opening the inventory, usually after 10+ minutes of play"

#### Be Constructive
❌ "This update sucks"  
✅ "The new inventory system takes more clicks than before. Consider adding a quick-equip option"

#### Include Context
❌ "Matchmaking is broken"  
✅ "Matchmaking takes 3-5 minutes during off-peak hours (2-4 AM EST), compared to 30 seconds during peak"

#### Prioritize
- What's the **biggest** issue you've encountered?
- What would **most improve** your experience?
- What's working **well** that shouldn't change?

---

## 📅 Alpha Testing Schedule

### Week 1: Core Functionality

**Focus**: Basic gameplay and stability

| Day | Date | Focus Area | Tasks |
|-----|------|------------|-------|
| Mon | [Date] | Login & Authentication | Test login, account creation, session persistence |
| Tue | [Date] | Matchmaking | Test queue times, match quality, connection stability |
| Wed | [Date] | Combat System | Test combat actions, damage calculation, abilities |
| Thu | [Date] | Progression | Test XP gain, leveling, unlocks |
| Fri | [Date] | Social Features | Test friends, chat, parties |
| Sat | [Date] | Free Play | Play normally, report any issues |
| Sun | [Date] | Weekly Survey | Complete Week 1 survey |

### Week 2: Performance & Load

**Focus**: Performance under various conditions

| Day | Date | Focus Area | Tasks |
|-----|------|------------|-------|
| Mon | [Date] | Peak Hours Testing | Play during peak hours (7-10 PM local) |
| Tue | [Date] | Extended Sessions | Play for 1+ hour continuously |
| Wed | [Date] | Multi-Device Testing | Test on multiple devices if possible |
| Thu | [Date] | Stress Testing | Coordinated group play (announced in Discord) |
| Fri | [Date] | Edge Cases | Test unusual scenarios, boundary conditions |
| Sat | [Date] | Free Play | Play normally, focus on overall experience |
| Sun | [Date] | Weekly Survey | Complete Week 2 survey |

### Week 3: Polish & Wrap-up

**Focus**: Final feedback and validation

| Day | Date | Focus Area | Tasks |
|-----|------|------------|-------|
| Mon | [Date] | Regression Testing | Re-test previously reported bugs |
| Tue | [Date] | Overall Experience | Holistic feedback on the experience |
| Wed | [Date] | Comparison | Compare v2.1.0 vs v2.0.0 experience |
| Thu | [Date] | Final Bug Sweep | Report any remaining issues |
| Fri | [Date] | Final Survey | Complete comprehensive final survey |
| Sat | [Date] | AMA Session | Developer Q&A in Discord (announced time) |
| Sun | [Date] | Alpha Ends | Program concludes, rewards processing begins |

### Special Events

#### Kickoff AMA (Ask Me Anything)
- **When**: [Date, Time]
- **Where**: Discord Voice Channel
- **What**: Meet the devs, ask questions about the migration

#### Mid-Alpha Check-in
- **When**: [Date, Time]
- **Where**: Discord Text Channel
- **What**: Progress update and community discussion

#### Stress Test Event
- **When**: [Date, Time]
- **Where**: In-game
- **What**: Coordinated play session to test server load

#### Wrap-up AMA
- **When**: [Date, Time]
- **Where**: Discord Voice Channel
- **What**: Final Q&A, next steps, beta preview

---

## 💬 Communication Channels

### Discord Server Structure

#### Alpha-Only Channels
- `#alpha-announcements` - Official updates from devs
- `#alpha-introductions` - Introduce yourself
- `#alpha-general` - General discussion
- `#alpha-bug-reports` - Report bugs (use `/bug-report`)
- `#alpha-feedback` - General feedback
- `#alpha-performance` - Performance discussion
- `#alpha-balance` - Game balance feedback
- `#alpha-off-topic` - Non-game discussion

#### Developer Channels
- `#dev-updates` - Development team announcements
- `#dev-ama` - AMA session announcements
- `#alpha-support` - Technical support from devs

### Discord Etiquette

#### Do's ✅
- Be respectful to other testers
- Use appropriate channels for topics
- Search before asking questions
- Help other testers when possible
- Report bugs in the right channel

#### Don'ts ❌
- Don't share Confidential Information
- Don't spam or flood channels
- Don't harass or discriminate
- Don't share access keys
- Don't discuss alpha outside alpha channels

### Other Communication Methods

#### Email
- **Purpose**: Official communications, surveys
- **Address**: alpha@armoredarcher.com
- **Response Time**: < 48 hours

#### In-Game Notifications
- **Purpose**: Maintenance alerts, important updates
- **Location**: Main menu notification panel

#### Status Page
- **Purpose**: Server status, known issues
- **URL**: [status.armoredarcher.com](https://status.armoredarcher.com)

---

## 📝 Known Issues

### Current Known Issues

#### Issue #001: Occasional Login Delay
- **Status**: Under Investigation
- **Impact**: Minor
- **Workaround**: Wait 30 seconds and retry
- **Expected Fix**: Week 2

#### Issue #002: Inventory Display Glitch
- **Status**: Identified
- **Impact**: Minor (cosmetic only)
- **Workaround**: Reopen inventory
- **Expected Fix**: Week 2

#### Issue #003: Matchmaking Queue Timer
- **Status**: In Progress
- **Impact**: Moderate
- **Workaround**: None
- **Expected Fix**: Week 1

### Issue Tracking

View the full list of known issues:
- **Public Board**: [GitHub Issues Link]
- **Discord**: `#alpha-known-issues`
- **Updates**: Posted in `#alpha-announcements`

### Reporting Duplicate Issues

If you report an issue that's already known:
- You'll be notified it's a duplicate
- Your report will be linked to the original
- This is still helpful (confirms impact)

---

## ❓ FAQ

### General Questions

**Q: Will my progress carry over to the live version?**  
A: Yes! All progress, items, and achievements earned during alpha will be 
preserved and transferred to the live version.

**Q: Can I play with friends who aren't alpha testers?**  
A: No. Alpha is a separate environment. You can only match with other alpha 
testers. Your non-alpha friends can join the waitlist for future rounds.

**Q: How long will the alpha last?**  
A: Approximately 3 weeks, from [Start Date] to [End Date]. Exact dates are in 
your invitation email.

**Q: What happens after alpha ends?**  
A: We'll analyze all feedback, fix bugs, and prepare for beta. Alpha testers 
will get priority access to beta testing.

**Q: Will there be more alpha testing rounds?**  
A: Possibly! If we need additional testing, current alpha testers get priority 
for future rounds.

### Technical Questions

**Q: Do I need to download a new client?**  
A: No. Use the same Godot client you already have. Alpha access is granted 
via your account.

**Q: Will the game run differently?**  
A: The gameplay should feel the same or better. You might notice faster 
response times and improved stability.

**Q: What if I encounter a game-breaking bug?**  
A: Report it immediately via Discord or in-game. If it prevents you from 
playing, contact alpha-support@armoredarcher.com.

**Q: Can I switch between alpha and live servers?**  
A: No. Once you redeem your alpha key, your account is on the alpha 
environment for the duration.

**Q: What platforms are supported?**  
A: All platforms: PC (Windows/Mac/Linux) and Mobile (iOS/Android).

### Rewards Questions

**Q: What do I get for participating?**  
A: Alpha testers receive:
- Exclusive Alpha Tester badge
- Exclusive cosmetic skin
- Special Discord role
- Recognition in game credits
- Beta testing priority

**Q: Do I need to complete specific tasks to get rewards?**  
A: Yes. Minimum requirements:
- Play at least 2-3 hours per week
- Submit at least 1 bug report or feedback
- Complete weekly surveys

**Q: When will I receive my rewards?**  
A: Within 30 days after the alpha program ends.

**Q: What if I can't complete the minimum requirements?**  
A: Contact us. We understand life happens. We'll work with you.

### NDA Questions

**Q: What can I share on social media?**  
A: Nothing about the alpha until after public release. No screenshots, videos, 
or discussion of technical details.

**Q: Can I talk about alpha with other testers?**  
A: Yes! Discuss freely in the private alpha Discord channels.

**Q: When does the NDA expire?**  
A: When v2.1.0 is publicly released. You'll be notified.

**Q: What if I accidentally break the NDA?**  
A: Contact us immediately. Accidents happen, but intentional violations may 
result in removal from the program.

---

## 🎯 Tips for Effective Testing

### General Testing Tips

#### 1. Play Naturally
Don't try to "break" the game intentionally. Play as you normally would. 
Natural play reveals the most valuable issues.

#### 2. Pay Attention
Notice small things:
- Does something feel slower than usual?
- Is a menu harder to navigate?
- Does combat feel different?

#### 3. Document Everything
Keep notes while playing:
- Time of issues
- What you were doing
- Error messages
- Screenshots if possible

#### 4. Test Edge Cases
Try unusual things:
- What happens if I...?
- Can I do this while...?
- What if I spam this button?

#### 5. Compare to Live Version
If possible, play both versions and note differences:
- Response times
- Visual changes
- Gameplay feel

### Specific Areas to Focus On

#### Login & Authentication
- Try logging in at different times
- Test session persistence (close and reopen)
- Test on different devices

#### Matchmaking
- Note queue times
- Test at peak and off-peak hours
- Report match quality issues

#### Combat
- Test all abilities/weapons
- Note any damage calculation issues
- Report desync or lag

#### Progression
- Track XP gains
- Verify level-ups work correctly
- Check unlock rewards

#### Social Features
- Test friend system
- Try party formation
- Test chat functionality

### Bug Hunting Strategies

#### The Scientific Method
1. **Observe**: Notice something unusual
2. **Hypothesize**: What might cause it?
3. **Test**: Try to reproduce it
4. **Document**: Record your findings
5. **Report**: Share with the team

#### Boundary Testing
- Test limits: maximum items, friends, etc.
- Try rapid inputs
- Test with poor connection

#### Regression Testing
- Re-test bugs that were "fixed"
- Verify issues from previous sessions
- Check if workarounds still work

### Providing Quality Feedback

#### Be Specific and Detailed
❌ "Matchmaking is slow"  
✅ "Matchmaking takes 3-5 minutes at 3 PM EST on weekdays, but only 30 seconds at 8 PM"

#### Include Context
❌ "Game crashed"  
✅ "Game crashed after 45-minute session when opening the inventory immediately after a match"

#### Suggest Solutions (Optional)
"The inventory takes 5 clicks to equip an item. In the live version, it's 3 clicks. 
Consider adding a quick-equip feature."

#### Prioritize Your Feedback
"If I could only report one thing, it would be..."  
"The biggest improvement I've noticed is..."

---

## 🏆 Alpha Tester Rewards

### Confirmed Rewards

Upon successful completion of the alpha program:

#### 🏆 Alpha Tester Badge
- Permanent in-game badge
- Displayed on your profile
- Shows your contributor status

#### 🎨 Exclusive Alpha Skin
- Cosmetic item only available to alpha testers
- [Description of skin]
- Delivered within 30 days

#### 💬 Discord Role
- Special "Alpha Tester" role
- Access to alumni channel
- Priority in future testing

#### 📜 Credits Recognition
- Your name in game credits
- Under "Alpha Testers" section
- Permanent recognition

#### 🎮 Beta Priority
- First access to beta testing
- Early notification
- Guaranteed beta spot

### Reward Distribution

- **Timeline**: Within 30 days after alpha ends
- **Method**: Automatically added to your account
- **Notification**: Email when rewards are distributed
- **Issues**: Contact alpha-support@armoredarcher.com

---

## 📞 Support & Contact

### Getting Help

#### Technical Issues
- **Discord**: `#alpha-support`
- **Response Time**: < 24 hours
- **Best For**: Login issues, bugs, errors

#### General Questions
- **Discord**: `#alpha-general`
- **Response Time**: Community + devs
- **Best For**: Questions about alpha, gameplay

#### Bug Reports
- **Discord**: `/bug-report` command
- **In-Game**: Settings → Help → Report Bug
- **Best For**: Reporting issues

#### Private Matters
- **Email**: alpha@armoredarcher.com
- **Response Time**: < 48 hours
- **Best For**: Account issues, NDA questions

### Developer Contact

#### Discord AMAs
- Scheduled voice channels
- Announced in `#alpha-announcements`
- Open Q&A with developers

#### Office Hours
- [Day, Time] in Discord
- Drop-in voice channel
- Casual chat with devs

---

## 📊 Your Impact

### Why Your Participation Matters

You're not just testing a game—you're helping shape its future. Your feedback 
will directly influence:

- **Bug Fixes**: Issues you report get fixed
- **Performance**: Your experience guides optimization
- **Features**: Your suggestions may become reality
- **Community**: You're building the foundation for beta and launch

### Success Metrics

We'll measure alpha success by:
- Number of bugs found and fixed
- Performance improvements achieved
- User satisfaction scores
- Retention and engagement

### Thank You!

Thank you for dedicating your time and energy to making Armored Archer better. 
Your contributions are invaluable, and we're excited to have you on the team!

---

## 🔗 Quick Links

- **Discord Server**: [Invite Link]
- **Bug Tracker**: [GitHub Issues Link]
- **Feedback Form**: [Form Link]
- **Status Page**: [status.armoredarcher.com](https://status.armoredarcher.com)
- **Alpha User Agreement**: [Link to agreement]
- **Selection Criteria**: [Link to criteria]

---

## 📱 Appendix: Mobile-Specific Notes

### iOS Testing
- Minimum iOS version: [Version]
- Known issues: [List]
- Tips: [Recommendations]

### Android Testing
- Minimum Android version: [Version]
- Known issues: [List]
- Tips: [Recommendations]

### Mobile-Specific Bugs to Watch For
- Touch input responsiveness
- UI scaling on different screen sizes
- Battery drain
- Performance on older devices
- Network switching (WiFi ↔ Cellular)

---

## 🖥️ Appendix: PC-Specific Notes

### System Requirements
- **OS**: [Windows/Mac/Linux versions]
- **Processor**: [Minimum]
- **Memory**: [Minimum RAM]
- **Graphics**: [Minimum GPU]
- **Storage**: [Free space required]

### PC-Specific Bugs to Watch For
- Keyboard/mouse input
- Windowed vs fullscreen
- Resolution scaling
- Performance on integrated graphics
- Multi-monitor setups

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-16  
**Next Review**: Weekly during alpha program  
**Questions?** Contact alpha@armoredarcher.com

---

*Thank you for being part of the Armored Archer Alpha Testing Program!*
