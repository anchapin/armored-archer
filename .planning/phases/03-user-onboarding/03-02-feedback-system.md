# Phase 3.2 - Feedback Collection System

**Version**: 1.0.0  
**Created**: 2026-03-16  
**Status**: ✅ Complete  
**Owner**: Development Team  
**Phase**: v2.1.0 - Alpha Launch & Stabilization  
**Parent**: Phase 3 - Alpha User Onboarding

---

## 📋 Overview

This document defines the design and implementation of the Feedback Collection System for Armored Archer alpha users. The system enables users to submit feedback directly from the game and provides developers with tools to manage, categorize, and respond to feedback efficiently.

### Purpose

The Feedback Collection System serves as the primary channel for alpha users to report bugs, suggest features, and provide input on game balance and performance. This feedback is critical for identifying issues and prioritizing improvements before the beta launch.

### Scope

**In Scope**:
- In-game feedback form UI (Godot)
- Backend feedback submission API (Go RPC)
- Feedback database schema (PostgreSQL)
- Developer dashboard (Web UI)
- Feedback categorization and prioritization
- Developer response system
- User notifications for feedback updates

**Out of Scope** (Future Phases):
- Public feedback portal (beta phase)
- Community voting on feedback (beta phase)
- Integration with issue tracking systems (Jira, GitHub)
- Automated feedback analysis with AI
- Multi-language support

---

## 🎯 Objectives

### Primary Goals

1. **Easy Submission**: Users can submit feedback in under 2 minutes
2. **Comprehensive Categorization**: 7 categories covering all feedback types
3. **Developer Efficiency**: Streamlined triage and management workflow
4. **User Visibility**: Users can track status of their submissions
5. **Actionable Insights**: Data-driven prioritization for development

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feedback Submission Rate | > 50% of alpha users | Analytics |
| Average Submission Time | < 2 minutes | Form analytics |
| Developer Response Time | < 24 hours | Database tracking |
| User Satisfaction | > 4/5 | Post-submission survey |
| Bug Resolution Rate | > 80% in 7 days | Status tracking |
| Duplicate Rate | < 10% | Manual review |

---

## 🏗️ System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌───────────────────┐         ┌───────────────────┐           │
│  │  Godot Game UI    │         │  Developer Web UI │           │
│  │  (Feedback Form)  │         │  (Dashboard)      │           │
│  └─────────┬─────────┘         └─────────┬─────────┘           │
│            │                              │                      │
└────────────┼──────────────────────────────┼──────────────────────┘
             │                              │
             │ Nakama RPC                   │ HTTP/WebSocket
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              RPC Handlers (Go)                           │   │
│  │  - submit_feedback                                       │   │
│  │  - get_feedback                                          │   │
│  │  - list_feedback                                         │   │
│  │  - vote_feedback                                         │   │
│  │  - add_feedback_response                                 │   │
│  │  - get_feedback_statistics                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Internal Module (feedback/)                      │   │
│  │  - Data models                                           │   │
│  │  - Validation logic                                      │   │
│  │  - Business rules                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
             │
             │ SQL
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                         │   │
│  │  - feedback_submissions                                  │   │
│  │  - feedback_responses                                    │   │
│  │  - feedback_votes                                        │   │
│  │  - feedback_notifications                                │   │
│  │  - feedback_categories                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Backend Language** | Go 1.21 | Performance, type safety, Nakama support |
| **Game Client** | Godot 4.x | Existing game engine, GDScript |
| **Web Dashboard** | HTML/CSS/JS | Simple, no build step, easy deployment |
| **Database** | PostgreSQL | Existing Nakama database, JSONB support |
| **RPC Framework** | Nakama RPC | Integrated with existing auth/session |
| **Notifications** | Nakama Notifications | Built-in notification system |

---

## 📊 Database Design

### Entity Relationship

```
┌─────────────────────┐
│  users (Nakama)     │
│  - id (UUID)        │
│  - username         │
│  - email            │
└──────────┬──────────┘
           │
           │ 1:N
           ▼
┌─────────────────────┐       ┌─────────────────────┐
│ feedback_submissions│       │  feedback_categories│
│  - feedback_id      │       │  - category_id      │
│  - user_id (FK)     │       │  - name             │
│  - category         │       │  - color_code       │
│  - title            │       │  - icon_name        │
│  - description      │       │  - sort_order       │
│  - priority         │       └─────────────────────┘
│  - status           │
│  - assigned_to      │
│  - submitted_at     │
│  - resolved_at      │
└──────────┬──────────┘
           │
           │ 1:N                          ┌─────────────────────┐
           ├─────────────────────────────▶│  feedback_votes     │
           │                              │  - vote_id          │
           │ 1:N                          │  - feedback_id (FK) │
           ├─────────────────────────────▶│  - user_id (FK)     │
           │                              │  - vote_type        │
           │                              └─────────────────────┘
           │
           │ 1:N                          ┌─────────────────────┐
           ├─────────────────────────────▶│ feedback_responses  │
           │                              │  - response_id      │
           │                              │  - feedback_id (FK) │
           │                              │  - user_id (FK)     │
           │                              │  - response_text    │
           │                              │  - is_internal      │
           │                              └─────────────────────┘
           │
           │ 1:N                          ┌─────────────────────┐
           └─────────────────────────────▶│feedback_notifications
                                          │  - notification_id  │
                                          │  - feedback_id (FK) │
                                          │  - user_id (FK)     │
                                          │  - notification_type│
                                          │  - message          │
                                          │  - is_read          │
                                          └─────────────────────┘
```

### Schema Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `feedback_submissions` | Main feedback storage | category, status, priority, assigned_to |
| `feedback_categories` | Category metadata | name, color_code, icon_name |
| `feedback_responses` | Developer responses | response_text, is_internal |
| `feedback_votes` | User voting | vote_type (+1/-1) |
| `feedback_notifications` | User notifications | notification_type, is_read |

### Migration

**File**: `backend/data/08_create_feedback_tables.sql`

**Key Features**:
- Enum types for category, priority, status
- Indexes for common queries
- Triggers for updated_at timestamps
- Helper functions for common operations
- Denormalized view for dashboard

---

## 🔌 API Design

### RPC Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `submit_feedback` | RPC | Submit new feedback | Yes |
| `get_feedback` | RPC | Get feedback by ID | Yes |
| `list_feedback` | RPC | List feedback with filters | Yes |
| `vote_feedback` | RPC | Vote on feedback | Yes |
| `add_feedback_response` | RPC | Add developer response | Yes (Admin) |
| `get_feedback_statistics` | RPC | Get statistics | Yes (Admin) |

### Request/Response Examples

#### Submit Feedback

**Request**:
```json
{
  "category": "bug",
  "title": "Arrow collision detection fails on mobile",
  "description": "Players report that arrows sometimes pass through enemies...",
  "platform": "ios",
  "device_info": "iPhone 14 Pro, iOS 17.2",
  "game_version": "v2.0.5",
  "screenshot_url": "https://storage.../screenshot.png"
}
```

**Response**:
```json
{
  "success": true,
  "feedback_id": "fb_1710604800123",
  "feedback": {
    "feedback_id": "fb_1710604800123",
    "status": "submitted",
    "priority": "high",
    "submitted_at": 1710604800000
  }
}
```

#### List Feedback

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
  "feedback": [
    {
      "feedback_id": "fb_1710604800123",
      "title": "Arrow collision detection fails",
      "category": "bug",
      "status": "submitted",
      "vote_count": 24,
      "response_count": 2,
      "submitted_at": 1710604800000
    }
  ],
  "total": 47,
  "limit": 50,
  "offset": 0
}
```

### Error Handling

**Standard Error Response**:
```json
{
  "success": false,
  "error": "Error message here",
  "error_details": "Optional detailed information"
}
```

**HTTP-like Status Codes** (in error_details):
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🎨 User Interface Design

### In-Game Feedback Form

**Location**: Settings → Feedback or dedicated button in main menu

**Flow**:
1. User clicks "Submit Feedback" button
2. Form modal opens
3. User selects category (visual buttons with icons)
4. User enters title (max 200 chars)
5. User enters description (max 5000 chars)
6. Auto-detected info displayed (platform, device, version)
7. Optional: User attaches screenshot
8. User submits
9. Success confirmation shown
10. Form closes

**Design Principles**:
- Minimal clicks to submit
- Clear visual category selection
- Character counters for inputs
- Auto-save draft (local)
- Validation with helpful error messages
- Mobile-responsive layout

**Reference**: `backend/templates/feedback/in-game-form.html`

### Developer Dashboard

**Location**: `http://localhost:7351/feedback/dashboard` (dev) or admin subdomain (prod)

**Features**:
- Statistics overview (cards with metrics)
- Filterable feedback list
- Search functionality
- Status/priority management
- Assignment to developers
- Response thread (public + internal)
- Export functionality (CSV/JSON)

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  Header: Logo | Search | Filters | User Profile            │
├────────────────────────────────────────────────────────────┤
│  Stats: Total | Pending | Resolved | Avg Resolution Time   │
├────────────────────────────────────────────────────────────┤
│  Feedback List                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Badge] Title | Category | Status | Priority | Votes │  │
│  │ Description preview...                               │  │
│  │ User | Platform | Version | Responses | Actions     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ ... (repeat for each feedback)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  Pagination: ← Prev | 1 | 2 | 3 | Next →                   │
└────────────────────────────────────────────────────────────┘
```

**Reference**: `backend/templates/feedback/dashboard.html`

---

## 📋 Feedback Categorization

### Categories

| Category | Icon | Color | Use Case |
|----------|------|-------|----------|
| **Bug** | 🐛 | Red (#DC2626) | Something not working correctly |
| **Suggestion** | 💡 | Blue (#2563EB) | New feature or improvement idea |
| **Balance** | ⚖️ | Purple (#7C3AED) | Game balance, difficulty, stats |
| **Performance** | ⚡ | Orange (#EA580C) | FPS, lag, optimization |
| **UI/UX** | 🎨 | Cyan (#0891B2) | Interface, usability, accessibility |
| **Audio** | 🔊 | Green (#059669) | Sound effects, music, volume |
| **Other** | 📝 | Gray (#6B7280) | Doesn't fit other categories |

### Priority Levels

| Priority | Color | Response Time | Examples |
|----------|-------|---------------|----------|
| **Critical** | Red | < 4 hours | Game crash, data loss, progression blocker |
| **High** | Orange | < 24 hours | Major feature broken, widespread issue |
| **Medium** | Yellow | < 1 week | Minor bug, quality of life improvement |
| **Low** | Green | Next sprint | Cosmetic issue, nice-to-have feature |

### Status Workflow

```
┌─────────────┐
│ submitted   │ ← User submits
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ acknowledged│ ← Developer acknowledges
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│ in_review   │────▶│  planned    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│in_progress  │     │  resolved   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────────────────┘
                 │
                 ▼
       ┌─────────────┐
       │   closed    │ ← Final state
       └─────────────┘
```

**Status Definitions**:
- `submitted`: Default state when user submits
- `acknowledged`: Developer has reviewed initial submission
- `in_review`: Actively being investigated
- `planned`: Scheduled for future release
- `in_progress`: Currently being fixed/implemented
- `resolved`: Fix deployed, waiting for user confirmation
- `closed`: Issue confirmed resolved or stale
- `rejected`: Invalid, duplicate, or won't fix

---

## 🔔 Notification System

### Notification Types

| Type | Trigger | Recipient | Channel |
|------|---------|-----------|---------|
| `status_change` | Feedback status updated | Submitter | In-game + Push |
| `developer_response` | Developer responds | Submitter | In-game + Push |
| `resolved` | Feedback marked resolved | Submitter | In-game + Push + Email |
| `assigned` | Feedback assigned to developer | Developer | In-game |
| `mention` | User mentioned in response | Mentioned user | In-game + Push |

### Notification Preferences

Users can configure:
- Enable/disable notification types
- Quiet hours (no notifications during sleep)
- Channel preferences (push, email, in-game)

### Notification Template

```
{
  "notification_id": "notif_123",
  "feedback_id": "fb_456",
  "type": "status_change",
  "title": "Feedback Status Update",
  "message": "Your feedback 'Arrow collision bug' has been updated",
  "old_value": "submitted",
  "new_value": "in_progress",
  "action_url": "feedback://fb_456",
  "sent_at": 1710604800000
}
```

---

## 🔐 Security & Permissions

### Authentication

All RPC endpoints require authentication via Nakama session.

### Authorization

| Action | User | Developer | Admin |
|--------|------|-----------|-------|
| Submit feedback | ✅ | ✅ | ✅ |
| View own feedback | ✅ | ✅ | ✅ |
| View all feedback | ❌ | ✅ | ✅ |
| Vote on feedback | ✅ | ✅ | ✅ |
| Respond to feedback | ❌ | ✅ | ✅ |
| Change status | ❌ | ✅ | ✅ |
| Assign feedback | ❌ | ✅ | ✅ |
| Add internal notes | ❌ | ✅ | ✅ |
| Delete feedback | ❌ | ❌ | ✅ |
| Export data | ❌ | ❌ | ✅ |
| View statistics | ❌ | ✅ | ✅ |

### Data Protection

- User PII encrypted at rest
- Feedback data backed up daily
- Access logs retained for 90 days
- Internal notes never exposed to users
- Screenshot URLs signed with expiration

---

## 📈 Analytics & Reporting

### Tracked Events

| Event | Properties | Purpose |
|-------|------------|---------|
| `feedback_submitted` | category, platform, game_version | Submission tracking |
| `feedback_viewed` | feedback_id, user_role | Engagement tracking |
| `feedback_status_changed` | old_status, new_status, feedback_id | Workflow analytics |
| `feedback_response_added` | feedback_id, is_internal | Response tracking |
| `feedback_voted` | feedback_id, vote_type | Voting analytics |

### Dashboard Metrics

**Real-time**:
- Total feedback count
- Pending review count
- Average response time
- Feedback by category (pie chart)
- Feedback by status (bar chart)
- Feedback trend (line chart)

**Historical** (configurable date range):
- Submissions per day/week/month
- Resolution time distribution
- Category trends
- Developer workload
- User satisfaction score

### Reports

**Weekly Summary** (auto-generated):
- Total submissions this week
- Top categories
- Average resolution time
- Pending items > 7 days
- Top voted feedback

**Export Formats**:
- CSV (for spreadsheet analysis)
- JSON (for programmatic access)
- PDF (for stakeholder reports)

---

## 🧪 Testing Strategy

### Unit Tests

**Coverage Target**: > 80%

**Test Files**:
- `backend/internal/feedback/feedback_test.go` - Model tests
- `backend/internal/rpc/feedback_test.go` - RPC handler tests

**Test Cases**:
- Feedback creation and validation
- Status transitions
- Vote calculation
- Response creation
- Permission checks

### Integration Tests

**Test Scenarios**:
1. Submit feedback → Verify in database
2. List feedback with filters → Verify results
3. Vote on feedback → Verify count update
4. Add response → Verify notification created
5. Change status → Verify notification sent

**Test Setup**:
```bash
# Run feedback integration tests
cd backend
npm run test:integration -- --grep "feedback"
```

### End-to-End Tests

**User Flow**:
1. Open game
2. Navigate to feedback form
3. Fill out form
4. Submit
5. Verify success message
6. Check feedback appears in list

**Developer Flow**:
1. Login to dashboard
2. View feedback list
3. Filter by category
4. Open feedback detail
5. Change status
6. Add response
7. Verify notification sent

---

## 🚀 Deployment Plan

### Phase 1: Database Migration

```bash
# Apply feedback schema migration
docker exec -it armored_archer_server /nakama/nakama migrate up
```

**Verification**:
```sql
-- Verify tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'feedback_%';
```

### Phase 2: Backend Deployment

```bash
# Deploy Go backend with feedback RPC
cd backend
npm run build
docker-compose -f docker-compose.alpha.yml up -d
```

**Verification**:
```bash
# Check RPC endpoints registered
curl -X POST http://localhost:7351/api/v2/rpc/get_feedback_statistics \
  -H "Authorization: Bearer <token>" \
  -d '{}'
```

### Phase 3: Dashboard Deployment

```bash
# Copy dashboard templates
cp backend/templates/feedback/* /var/nakama/modules/feedback/
```

**Verification**:
- Access `http://localhost:7351/feedback/dashboard`
- Verify statistics load
- Verify feedback list displays

### Phase 4: Client Integration

**Godot Integration**:
1. Add feedback form scene to project
2. Connect to NetworkManager RPC
3. Test submission flow
4. Deploy test build to alpha users

### Rollback Plan

If issues detected:
1. Disable feedback RPC endpoints
2. Revert database migration (if needed)
3. Deploy previous backend version
4. Notify alpha users of temporary unavailability

---

## 📊 Success Criteria

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| RPC Error Rate | < 1% | Prometheus metrics |
| P95 Latency | < 100ms | Response time tracking |
| Database Query Time | < 50ms | Query profiling |
| Uptime | > 99.5% | Monitoring dashboard |

### User Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Submission Rate | > 50% of alpha users | Analytics |
| Form Completion Rate | > 90% | Form analytics |
| Average Submission Time | < 2 minutes | Timing analytics |
| User Satisfaction | > 4/5 | Post-submission survey |

### Developer Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response Time | < 24 hours | Database tracking |
| Resolution Rate | > 80% in 7 days | Status tracking |
| Triage Accuracy | > 90% correct category | Manual review |

---

## 📝 Implementation Checklist

### Backend
- [x] Database schema created (`08_create_feedback_tables.sql`)
- [x] Internal module implemented (`internal/feedback/feedback.go`)
- [x] RPC handlers implemented (`internal/rpc/feedback.go`)
- [x] RPC endpoints registered (`cmd/server/main.go`)
- [x] Unit tests written
- [x] Integration tests written

### Frontend (Web)
- [x] Dashboard UI mockup created
- [x] Filter functionality implemented
- [x] Statistics display implemented
- [x] Response interface implemented

### Frontend (Godot)
- [ ] Feedback form scene created
- [ ] NetworkManager integration
- [ ] Form validation implemented
- [ ] Screenshot capture implemented
- [ ] Success/error states implemented

### Documentation
- [x] Feedback management guide created
- [x] API documentation written
- [x] Phase design document created
- [ ] User guide for alpha testers

### Operations
- [ ] Database migration tested
- [ ] Backup strategy configured
- [ ] Monitoring alerts configured
- [ ] Dashboard deployed to alpha environment

---

## 🔗 Related Documents

- [Phase 3.1 - Alpha User Selection](03-01-user-selection.md)
- [Phase 3.3 - Issue Reporting Pipeline](03-03-issue-reporting.md) (TBD)
- [Backend Feedback Guide](../../backend/docs/FEEDBACK_GUIDE.md)
- [Database Schema](../../backend/DATABASE_SCHEMA.md)
- [API Documentation](../../backend/docs/openapi.yaml)

---

## 📅 Timeline

| Milestone | Date | Status |
|-----------|------|--------|
| Design Complete | 2026-03-16 | ✅ Done |
| Backend Implementation | 2026-03-17 | ✅ Done |
| Dashboard UI | 2026-03-17 | ✅ Done |
| Documentation | 2026-03-17 | ✅ Done |
| Godot Integration | 2026-03-18 | 📋 Pending |
| Alpha Deployment | 2026-03-19 | 📋 Pending |
| User Testing | 2026-03-20 | 📋 Pending |

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-03-16  
**Maintained By**: Development Team  
**Status**: ✅ **COMPLETE** (Backend + Dashboard)
