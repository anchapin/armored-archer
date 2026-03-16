# Feedback Management Guide

**Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Phase**: v2.1.0 - Phase 3.2 (Feedback Collection System)

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Developer Dashboard](#developer-dashboard)
6. [Feedback Workflow](#feedback-workflow)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Feedback Collection System enables alpha users to submit feedback directly from the game and provides developers with tools to manage, categorize, and respond to feedback efficiently.

### Key Features

- **User Feedback Submission**: In-game form for easy feedback submission
- **Categorization**: 7 feedback categories (Bug, Suggestion, Balance, Performance, UI/UX, Audio, Other)
- **Priority System**: 4-tier priority levels (Low, Medium, High, Critical)
- **Status Workflow**: 8-stage workflow from submission to resolution
- **Developer Dashboard**: Web-based dashboard for managing feedback
- **Voting System**: Community voting on feedback for prioritization
- **Developer Responses**: Public and internal response capabilities
- **Notifications**: Automated notifications for status changes
- **Analytics**: Statistics and reporting for feedback trends

### Benefits

| Stakeholder | Benefits |
|-------------|----------|
| **Players** | Easy feedback submission, visibility into status, community voting |
| **Developers** | Centralized management, categorization, priority tracking |
| **Product** | Data-driven prioritization, user sentiment analysis |
| **Support** | Reduced support tickets, self-service status checking |

---

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Godot)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              In-Game Feedback Form UI                    │   │
│  │  - Category selection                                    │   │
│  │  - Title/Description inputs                              │   │
│  │  - Screenshot capture                                    │   │
│  │  - Auto-detected device info                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              NetworkManager.gd                           │   │
│  │  - RPC: submit_feedback                                  │   │
│  │  - RPC: list_feedback                                    │   │
│  │  - RPC: get_feedback                                     │   │
│  │  - RPC: vote_feedback                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Nakama RPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Go + Nakama)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              RPC Handlers (rpc/feedback.go)              │   │
│  │  - SubmitFeedback                                        │   │
│  │  - GetFeedback                                           │   │
│  │  - ListFeedback                                          │   │
│  │  - VoteFeedback                                          │   │
│  │  - AddFeedbackResponse                                   │   │
│  │  - GetFeedbackStatistics                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Internal Module (internal/feedback/)             │   │
│  │  - Data models and validation                            │   │
│  │  - Business logic                                        │   │
│  │  - Status workflow management                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                         │   │
│  │  - feedback_submissions                                  │   │
│  │  - feedback_responses                                    │   │
│  │  - feedback_votes                                        │   │
│  │  - feedback_notifications                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Web Interface
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Developer Dashboard                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Web UI (templates/feedback/)                │   │
│  │  - Feedback list with filters                            │   │
│  │  - Statistics dashboard                                  │   │
│  │  - Status/priority management                            │   │
│  │  - Developer responses                                   │   │
│  │  - Export functionality                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Submission Flow**:
   ```
   User → Form UI → NetworkManager → RPC: submit_feedback → 
   Validation → Database Insert → Notification → Success Response
   ```

2. **Management Flow**:
   ```
   Developer → Dashboard → Filter/Search → View Details → 
   Update Status/Assign → Add Response → Database Update → 
   User Notification
   ```

3. **Voting Flow**:
   ```
   User → View Feedback → Vote (Up/Down) → RPC: vote_feedback → 
   Database Upsert → Update Vote Count → Refresh UI
   ```

---

## Database Schema

### Tables

#### feedback_submissions

Main table storing all feedback submissions.

| Column | Type | Description |
|--------|------|-------------|
| `feedback_id` | UUID | Primary key |
| `user_id` | UUID | FK to users table |
| `category` | ENUM | Feedback category |
| `title` | TEXT | Brief title (max 200 chars) |
| `description` | TEXT | Detailed description (max 5000 chars) |
| `priority` | ENUM | Priority level |
| `status` | ENUM | Current status |
| `game_version` | TEXT | Game version when submitted |
| `platform` | TEXT | Platform (iOS, Android, etc.) |
| `device_info` | TEXT | Device model and OS |
| `session_id` | TEXT | Game session identifier |
| `screenshot_url` | TEXT | URL to screenshot |
| `replay_data` | JSONB | Context/replay data |
| `assigned_to` | TEXT | Developer username |
| `tags` | TEXT[] | Custom tags |
| `internal_notes` | TEXT | Internal notes |
| `submitted_at` | TIMESTAMP | Submission timestamp |
| `reviewed_at` | TIMESTAMP | When review started |
| `resolved_at` | TIMESTAMP | When resolved |

#### feedback_responses

Developer responses to feedback.

| Column | Type | Description |
|--------|------|-------------|
| `response_id` | UUID | Primary key |
| `feedback_id` | UUID | FK to feedback_submissions |
| `user_id` | UUID | Developer user ID |
| `response_text` | TEXT | Response content |
| `is_internal` | BOOLEAN | Internal note flag |
| `created_at` | TIMESTAMP | Response timestamp |

#### feedback_votes

User votes on feedback.

| Column | Type | Description |
|--------|------|-------------|
| `vote_id` | UUID | Primary key |
| `feedback_id` | UUID | FK to feedback_submissions |
| `user_id` | UUID | Voter user ID |
| `vote_type` | INTEGER | +1 (upvote) or -1 (downvote) |

#### feedback_notifications

Notifications for feedback updates.

| Column | Type | Description |
|--------|------|-------------|
| `notification_id` | UUID | Primary key |
| `feedback_id` | UUID | FK to feedback_submissions |
| `user_id` | UUID | Recipient user ID |
| `notification_type` | ENUM | Type of notification |
| `old_value` | TEXT | Previous value |
| `new_value` | TEXT | New value |
| `message` | TEXT | Notification message |
| `is_read` | BOOLEAN | Read status |
| `sent_at` | TIMESTAMP | When sent |

### Enums

#### feedback_category

```sql
'bug'         -- Bug reports
'suggestion'  -- Feature suggestions
'balance'     -- Game balance feedback
'performance' -- Performance issues
'ui_ux'       -- UI/UX feedback
'audio'       -- Audio/sound feedback
'other'       -- Other feedback
```

#### feedback_priority

```sql
'low'       -- Low priority
'medium'    -- Medium priority
'high'      -- High priority
'critical'  -- Critical/blocking issues
```

#### feedback_status

```sql
'submitted'     -- Newly submitted
'acknowledged'  -- Acknowledged by team
'in_review'     -- Under review
'planned'       -- Planned for future
'in_progress'   -- Being worked on
'resolved'      -- Resolved/fixed
'closed'        -- Closed
'rejected'      -- Rejected (invalid/spam)
```

---

## API Reference

### RPC Endpoints

All RPC endpoints are accessed through Nakama's RPC system.

#### submit_feedback

Submit new feedback.

**Request**:
```json
{
  "category": "bug",
  "title": "Arrow collision detection fails",
  "description": "Arrows pass through enemies without damage...",
  "platform": "ios",
  "device_info": "iPhone 14 Pro, iOS 17.2",
  "game_version": "v2.0.5",
  "screenshot_url": "https://..."
}
```

**Response**:
```json
{
  "success": true,
  "feedback_id": "fb_1234567890",
  "feedback": {
    "feedback_id": "fb_1234567890",
    "user_id": "user_abc",
    "category": "bug",
    "title": "Arrow collision detection fails",
    "status": "submitted",
    "priority": "high",
    "submitted_at": 1710604800000
  }
}
```

#### get_feedback

Get a specific feedback by ID.

**Request**:
```json
{
  "feedback_id": "fb_1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "feedback": [
    {
      "feedback_id": "fb_1234567890",
      "vote_count": 24,
      "response_count": 5,
      ...
    }
  ],
  "total": 1
}
```

#### list_feedback

List feedback with filters.

**Request**:
```json
{
  "limit": 50,
  "offset": 0,
  "category": "bug",
  "status": "submitted",
  "sort_by": "submitted_at",
  "order_by": "desc"
}
```

**Response**:
```json
{
  "success": true,
  "feedback": [...],
  "total": 247,
  "limit": 50,
  "offset": 0
}
```

#### vote_feedback

Vote on feedback.

**Request**:
```json
{
  "feedback_id": "fb_1234567890",
  "vote_type": 1
}
```

**Response**:
```json
{
  "success": true
}
```

#### add_feedback_response

Add a developer response.

**Request**:
```json
{
  "feedback_id": "fb_1234567890",
  "response_text": "Thanks for reporting! We're investigating...",
  "is_internal": false
}
```

**Response**:
```json
{
  "success": true,
  "response_id": "resp_1234567890",
  "response": {
    "response_id": "resp_1234567890",
    "feedback_id": "fb_1234567890",
    "response_text": "Thanks for reporting!...",
    "is_internal": false,
    "created_at": 1710604800000
  }
}
```

#### get_feedback_statistics

Get feedback statistics (admin only).

**Request**:
```json
{
  "days": 30
}
```

**Response**:
```json
{
  "success": true,
  "statistics": {
    "total_submissions": 247,
    "total_resolved": 89,
    "total_pending": 23,
    "avg_resolution_time_hours": 24.5,
    "submissions_by_category": {
      "bug": 45,
      "suggestion": 89,
      ...
    },
    "submissions_by_status": {...},
    "submissions_by_priority": {...}
  }
}
```

---

## Developer Dashboard

### Access

The developer dashboard is accessible at: `http://localhost:7351/feedback/dashboard` (development) or your production URL.

### Features

#### Dashboard Overview

- **Statistics Cards**: Total feedback, pending review, resolved, avg resolution time
- **Trend Indicators**: Week-over-week changes
- **Quick Filters**: Category, status, priority, search

#### Feedback List

- **Sortable Columns**: Click headers to sort
- **Filtering**: Multi-filter support
- **Search**: Full-text search on title/description
- **Pagination**: Navigate through pages

#### Feedback Detail View

- **Full Details**: All feedback metadata
- **Status Management**: Change status dropdown
- **Priority Setting**: Adjust priority level
- **Assignment**: Assign to developer
- **Internal Notes**: Private team notes
- **Response Thread**: Public and internal responses

#### Actions

| Action | Description | Permissions |
|--------|-------------|-------------|
| View | View feedback details | All developers |
| Edit Status | Change feedback status | All developers |
| Assign | Assign to developer | All developers |
| Respond | Add public response | All developers |
| Internal Note | Add private note | All developers |
| Delete | Delete feedback | Admin only |
| Export | Export to CSV/JSON | Admin only |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close modal |
| `R` | Refresh data |
| `E` | Export |

---

## Feedback Workflow

### Status Workflow

```
submitted → acknowledged → in_review → in_progress → resolved → closed
                              ↓
                          planned
```

### Status Definitions

| Status | Description | When to Use |
|--------|-------------|-------------|
| `submitted` | New feedback | Default on submission |
| `acknowledged` | Team has seen it | Initial triage complete |
| `in_review` | Being investigated | Developer actively reviewing |
| `planned` | Scheduled for future | Added to roadmap |
| `in_progress` | Being fixed/implemented | Active development |
| `resolved` | Fixed/implemented | Changes deployed |
| `closed` | No further action | User confirmed or stale |
| `rejected` | Invalid/spam | Doesn't meet criteria |

### Priority Guidelines

| Priority | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **Critical** | Game-breaking, affects many users | < 4 hours | Crash on launch, data loss, progression blocker |
| **High** | Major functionality broken | < 24 hours | Feature not working, significant bug |
| **Medium** | Minor issues, quality of life | < 1 week | UI glitch, minor balance issue |
| **Low** | Nice to have | Next sprint | Cosmetic issues, minor suggestions |

### Triage Process

1. **Daily Review**: Designated developer reviews new submissions
2. **Categorization**: Verify correct category
3. **Prioritization**: Set priority based on guidelines
4. **Assignment**: Assign to appropriate team member
5. **Acknowledgment**: Update status to `acknowledged`
6. **Response**: Add initial response if needed

### Response Templates

#### Bug Acknowledgment

```
Thanks for reporting this issue! We've confirmed the bug and it's been 
added to our tracking system. Our team is investigating and we'll provide 
an update soon.

Reference: BUG-{{feedback_id}}
```

#### Suggestion Acknowledgment

```
Great suggestion! We appreciate you taking the time to share your ideas 
for improving Armored Archer. This has been forwarded to the product team 
for consideration in future updates.
```

#### Resolution Notification

```
Good news! This issue has been resolved in the latest update (v{{version}}). 
Please update your game and let us know if you continue to experience problems.

Thanks for your patience and feedback!
```

---

## Best Practices

### For Users Submitting Feedback

1. **Be Specific**: Provide clear, detailed descriptions
2. **Include Context**: Game version, device, steps to reproduce
3. **One Issue Per Submission**: Don't combine multiple issues
4. **Search First**: Check if similar feedback exists
5. **Use Correct Category**: Helps with triage
6. **Add Screenshots**: Visual evidence for bugs
7. **Be Constructive**: Helpful tone gets better results

### For Developers Managing Feedback

1. **Respond Quickly**: Acknowledge within 24 hours
2. **Be Transparent**: Share status updates regularly
3. **Use Internal Notes**: Track investigation details
4. **Link Related Items**: Connect duplicates and related feedback
5. **Close the Loop**: Notify users when resolved
6. **Prioritize Community Votes**: High-vote items need attention
7. **Document Patterns**: Track recurring issues

### For Product Managers

1. **Review Statistics Weekly**: Identify trends
2. **Prioritize by Impact**: Consider votes + severity
3. **Communicate Roadmap**: Update `planned` items regularly
4. **Close Feedback Loop**: Report on resolved items
5. **Segment by Category**: Analyze patterns

### Data Retention

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Submitted feedback | 2 years | Active + archived |
| Resolved feedback | 1 year after resolution | Then archived |
| Rejected feedback | 90 days | Then deleted |
| User notifications | 180 days | Then deleted |
| Internal notes | 2 years | With feedback |

---

## Troubleshooting

### Common Issues

#### Feedback Not Submitting

**Symptoms**: User reports form not working

**Check**:
1. Network connectivity
2. Nakama server status
3. RPC endpoint registration
4. Database connection
5. Validation errors (check logs)

**Logs**:
```bash
docker logs armored_archer_server | grep "submit_feedback"
```

#### Dashboard Not Loading

**Symptoms**: Developer dashboard shows blank/error

**Check**:
1. Server is running
2. Database migrations applied
3. User has admin permissions
4. Browser console for errors

**Fix**:
```bash
# Check migration status
docker exec -it armored_archer_postgres psql -U postgres -d nakama -c "SELECT * FROM feedback_submissions LIMIT 1;"
```

#### Notifications Not Sending

**Symptoms**: Users not receiving status update notifications

**Check**:
1. `feedback_notifications` table for entries
2. Notification service configuration
3. User notification preferences
4. Email/push service status

**Fix**:
```sql
-- Check pending notifications
SELECT * FROM feedback_notifications WHERE is_read = false ORDER BY sent_at DESC LIMIT 10;
```

#### Vote Count Not Updating

**Symptoms**: Vote count stuck or incorrect

**Check**:
1. `feedback_votes` table for duplicate entries
2. Vote calculation query
3. Cache invalidation

**Fix**:
```sql
-- Recalculate vote counts
UPDATE feedback_submissions fs
SET vote_count = (
    SELECT COALESCE(SUM(vote_type), 0)
    FROM feedback_votes fv
    WHERE fv.feedback_id = fs.feedback_id
);
```

### Debug Queries

```sql
-- Get feedback count by status
SELECT status, COUNT(*) FROM feedback_submissions GROUP BY status;

-- Get feedback count by category
SELECT category, COUNT(*) FROM feedback_submissions GROUP BY category;

-- Get average resolution time
SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - submitted_at)) / 3600) as avg_hours
FROM feedback_submissions
WHERE status = 'resolved' AND resolved_at IS NOT NULL;

-- Get top voted feedback
SELECT feedback_id, title, 
       (SELECT COALESCE(SUM(vote_type), 0) FROM feedback_votes WHERE feedback_id = fs.feedback_id) as votes
FROM feedback_submissions fs
ORDER BY votes DESC
LIMIT 10;

-- Get feedback with no response
SELECT feedback_id, title, submitted_at
FROM feedback_submissions
WHERE feedback_id NOT IN (
    SELECT feedback_id FROM feedback_responses WHERE is_internal = false
)
ORDER BY submitted_at DESC;
```

### Performance Optimization

#### Indexes

Ensure these indexes exist:

```sql
-- Already created in migration
CREATE INDEX idx_feedback_submissions_status ON feedback_submissions(status);
CREATE INDEX idx_feedback_submissions_category ON feedback_submissions(category);
CREATE INDEX idx_feedback_submissions_submitted_at ON feedback_submissions(submitted_at DESC);
CREATE INDEX idx_feedback_votes_feedback_id ON feedback_votes(feedback_id);
```

#### Query Optimization

- Use pagination for large lists
- Cache statistics (5-minute TTL recommended)
- Denormalize vote counts if needed
- Use materialized views for complex aggregations

---

## Appendix

### File Locations

| Component | Path |
|-----------|------|
| Database Migration | `backend/data/08_create_feedback_tables.sql` |
| Internal Module | `backend/internal/feedback/feedback.go` |
| RPC Handlers | `backend/internal/rpc/feedback.go` |
| Main Registration | `backend/cmd/server/main.go` |
| Dashboard UI | `backend/templates/feedback/dashboard.html` |
| In-Game Form | `backend/templates/feedback/in-game-form.html` |
| This Guide | `backend/docs/FEEDBACK_GUIDE.md` |

### Related Documentation

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Full database documentation
- [ALPHA_USER_GUIDE.md](ALPHA_USER_GUIDE.md) - Alpha user instructions
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions

### Support

For issues with the feedback system:
- **Technical Issues**: Check server logs, database connectivity
- **Process Questions**: Refer to this guide
- **Escalation**: Contact the backend team

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Maintained By**: Backend Team
