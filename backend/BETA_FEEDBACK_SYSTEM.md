# Beta User Feedback System

## Overview

This document describes the feedback collection infrastructure for beta users.

## Feedback Channels

### 1. In-App Feedback Button
- **Location**: Floating button in game UI
- **Trigger**: User taps button anytime
- **Fields**:
  - Category (Bug, Feature Request, General Feedback)
  - Description (required, 500 char max)
  - Screenshot attachment (optional)
  - Game state snapshot (automatic)

### 2. Post-Match Survey
- **Trigger**: After match completion
- **Fields**:
  - Match rating (1-5 stars)
  - Connection quality (Good/Fair/Poor)
  - Optional comment (200 char max)
- **Frequency**: Every 5th match

### 3. Issue Reporter
- **Access**: Settings → Report Issue
- **Fields**:
  - Issue type
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Attachments

### 4. Weekly Satisfaction Survey
- **Trigger**: Every 7 days of active play
- **Fields**:
  - Overall satisfaction (1-10)
  - Most enjoyed feature
  - Least enjoyed feature
  - Improvement suggestions
  - NPS score (0-10)

## Feedback API Endpoints

### Submit Feedback
```
POST /rpc/submit_feedback
{
  "feedback_type": "bug|feature|general|survey",
  "category": "string",
  "description": "string",
  "metadata": {
    "game_version": "string",
    "platform": "string",
    "match_id": "string (optional)"
  }
}
```

### Submit Rating
```
POST /rpc/submit_match_rating
{
  "match_id": "string",
  "rating": 1-5,
  "connection_quality": "good|fair|poor",
  "comment": "string (optional)"
}
```

## Feedback Storage

| Field | Type | Storage |
|-------|------|---------|
| feedback_id | UUID | Primary Key |
| user_id | UUID | Index |
| feedback_type | Enum | Column |
| category | String | Column |
| description | Text | Column |
| metadata | JSON | Column |
| created_at | Timestamp | Column |

## Feedback Analytics

### Dashboard Metrics
- Total feedback count
- Feedback by category (pie chart)
- Average rating (last 7 days)
- NPS score trend
- Common issues word cloud

### Alerts
- > 5 bug reports in 1 hour → Alert team
- Average rating drops below 3 → Alert team
- > 10 similar issues reported → Create ticket

## User Feedback Permissions

| User Action | Permission |
|-------------|------------|
| Submit feedback | All beta users |
| View own feedback | All beta users |
| View aggregate stats | Beta lead only |
| Export feedback | Admin only |

## Feedback Response SLA

| Priority | Response Time | Example |
|----------|---------------|---------|
| Critical (crash) | 1 hour | Game crash, data loss |
| High | 4 hours | Features not working |
| Medium | 24 hours | UI bugs, minor issues |
| Low | 72 hours | Feature requests |

---

**Document Version**: 1.0  
**Created**: 2026-03-17
