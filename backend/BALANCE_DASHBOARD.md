# Balance Analytics Dashboard

This document describes the balance analytics system for Armored Archer, which provides data-driven insights for tuning drop distribution and stage completion rates.

## Overview

The balance analytics system tracks:
- **Drop Distribution**: Gear drops by rarity, difficulty, stage, and boss encounters
- **Stage Completion**: Stage completion rates, average stars/scores, and difficulty performance
- **Balance Insights**: Automated detection of balance issues with recommendations

## RPC Endpoints

### 1. Record Drop

Records a gear drop event for balance analytics.

**Endpoint**: `armored_archer/record_drop`

**Request**:
```json
{
  "stage_id": "1_1",
  "stage_prefix": "campaign_1",
  "difficulty": "medium",
  "boss_defeated": false,
  "gear_rarity": "rare",
  "gear_type": "bow",
  "gear_id": "bow_crossbow_rare_123",
  "drop_rate_used": 0.35,
  "roll_value": 0.25
}
```

**Response**:
```json
{
  "success": true,
  "drop_id": "drop_1234567890_abc123"
}
```

### 2. Record Stage Attempt

Records a stage attempt (including failures) for completion rate tracking.

**Endpoint**: `armored_archer/record_stage_attempt`

**Request**:
```json
{
  "stage_id": "1_1",
  "stage_prefix": "campaign_1",
  "difficulty": "medium",
  "boss_defeated": false,
  "completed": true,
  "stars_earned": 3,
  "score": 1500,
  "attempt_number": 1
}
```

**Response**:
```json
{
  "success": true,
  "attempt_id": "attempt_1234567890_abc123"
}
```

### 3. Get Drop Statistics

Retrieves aggregated drop distribution statistics.

**Endpoint**: `armored_archer/get_drop_statistics`

**Request**:
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "statistics": {
    "total_drops": 1000,
    "total_attempts": 500,
    "drop_rate": 2.0,
    "by_rarity": {
      "common": {
        "count": 600,
        "percentage": 60.0,
        "expected_percentage": 60.0,
        "deviation": 0.0
      },
      "rare": {
        "count": 250,
        "percentage": 25.0,
        "expected_percentage": 25.0,
        "deviation": 0.0
      },
      "epic": {
        "count": 100,
        "percentage": 10.0,
        "expected_percentage": 10.0,
        "deviation": 0.0
      },
      "legendary": {
        "count": 50,
        "percentage": 5.0,
        "expected_percentage": 5.0,
        "deviation": 0.0
      }
    },
    "by_difficulty": {
      "easy": {
        "attempts": 200,
        "drops": 100,
        "drop_rate": 0.5
      },
      "medium": {
        "attempts": 200,
        "drops": 80,
        "drop_rate": 0.4
      },
      "hard": {
        "attempts": 100,
        "drops": 20,
        "drop_rate": 0.2
      }
    },
    "by_stage": {
      "1_1": {
        "attempts": 50,
        "drops": 25,
        "drop_rate": 0.5,
        "by_rarity": {
          "common": 15,
          "rare": 8,
          "epic": 2
        }
      }
    },
    "boss_bonus_drops": {
      "attempts": 50,
      "drops": 25,
      "drop_rate": 0.5
    },
    "timestamp": 1704067200000
  }
}
```

### 4. Get Stage Completion Statistics

Retrieves aggregated stage completion statistics.

**Endpoint**: `armored_archer/get_stage_completion_statistics`

**Request**:
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "statistics": {
    "total_attempts": 1000,
    "total_completions": 600,
    "overall_completion_rate": 0.6,
    "by_stage": {
      "1_1": {
        "attempts": 200,
        "completions": 190,
        "completion_rate": 0.95,
        "average_stars": 2.8,
        "average_score": 1450,
        "difficulty": "easy"
      },
      "1_2": {
        "attempts": 150,
        "completions": 30,
        "completion_rate": 0.2,
        "average_stars": 1.2,
        "average_score": 800,
        "difficulty": "hard"
      }
    },
    "by_difficulty": {
      "easy": {
        "attempts": 300,
        "completions": 285,
        "completion_rate": 0.95,
        "average_stars": 2.9
      },
      "medium": {
        "attempts": 400,
        "completions": 240,
        "completion_rate": 0.6,
        "average_stars": 2.0
      },
      "hard": {
        "attempts": 300,
        "completions": 75,
        "completion_rate": 0.25,
        "average_stars": 1.0
      }
    },
    "by_chapter": {
      "campaign_1": {
        "total_stages": 4,
        "total_attempts": 400,
        "total_completions": 320,
        "completion_rate": 0.8,
        "stages": ["1_1", "1_2", "1_3", "1_4"]
      },
      "campaign_2": {
        "total_stages": 4,
        "total_attempts": 600,
        "total_completions": 280,
        "completion_rate": 0.467,
        "stages": ["2_1", "2_2", "2_3", "2_4"]
      }
    },
    "boss_stages": {
      "attempts": 100,
      "completions": 40,
      "completion_rate": 0.4
    },
    "timestamp": 1704067200000
  }
}
```

### 5. Get Balance Insights

Retrieves automated balance insights with issues and recommendations.

**Endpoint**: `armored_archer/get_balance_insights`

**Request**:
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**Response**:
```json
{
  "success": true,
  "insights": {
    "generated_at": 1704067200000,
    "time_range": {
      "start": 1704067200000,
      "end": 1706745600000
    },
    "drops": {
      "summary": { /* DropStatistics object */ },
      "issues": [
        "rare drop rate is above expected by 15.0%",
        "epic drop rate is above expected by 5.0%"
      ],
      "recommendations": [
        "Consider increasing drop rates for nightmare difficulty"
      ]
    },
    "stages": {
      "summary": { /* StageCompletionStatistics object */ },
      "issues": [
        "1_2 has very low completion rate (20.0%)",
        "1_1 has very high completion rate (95.0%) - may be too easy",
        "Large progression gap: campaign_1 (80.0%) vs campaign_2 (46.7%)",
        "Boss stages have low completion rate (40.0%)"
      ],
      "recommendations": [
        "Consider lowering 1_2 difficulty or adjusting rewards",
        "Consider increasing 1_1 difficulty",
        "Consider adding progression bridges or difficulty scaling between chapters",
        "Consider reducing boss difficulty or improving player tools"
      ]
    }
  }
}
```

## Integration Points

### Integrating with Stage Completion

When a player completes a stage, you should record both the completion and any drops:

```typescript
// After stage completion
await recordStageAttempt(nk, {
  userId: ctx.userId,
  timestamp: Date.now(),
  stageId: '1_1',
  stagePrefix: 'campaign_1',
  difficulty: 'medium',
  bossDefeated: false,
  completed: true,
  starsEarned: 3,
  score: 1500,
  attemptNumber: 1,
});

// If a drop occurred
if (lootResult.dropped && lootResult.gear) {
  await recordDrop(nk, {
    userId: ctx.userId,
    timestamp: Date.now(),
    stageId: '1_1',
    stagePrefix: 'campaign_1',
    difficulty: 'medium',
    bossDefeated: false,
    gearRarity: lootResult.gear.rarity,
    gearType: lootResult.gear.type,
    gearId: lootResult.gear.id,
    dropRateUsed: lootResult.dropRate || 0,
    rollValue: Math.random(),
  });
}
```

## Dashboard Usage

### Checking Drop Distribution

1. Call `get_drop_statistics` with your desired date range
2. Review the `by_rarity` section to see if actual rates match expected rates
3. Check `deviation` values - large deviations (>10%) indicate balance issues
4. Review `by_difficulty` to see if certain difficulties have low drop rates
5. Check `boss_bonus_drops` to verify boss bonus is working correctly

### Checking Stage Completion Rates

1. Call `get_stage_completion_statistics` with your desired date range
2. Review `overall_completion_rate` for the game-wide completion rate
3. Check `by_stage` to identify problematic stages
   - Low completion rate (<20%) may indicate too difficult
   - High completion rate (>95%) may indicate too easy
4. Review `by_difficulty` to see if difficulty scaling is working
5. Check `by_chapter` to identify progression bottlenecks
6. Review `boss_stages` for boss-specific completion rates

### Using Balance Insights

1. Call `get_balance_insights` for automated issue detection
2. Review the `issues` arrays for identified problems
3. Consider the `recommendations` for suggested fixes
4. Use the full statistics in `summary` to make data-driven decisions

## Best Practices

1. **Record All Attempts**: Always record stage attempts, including failures, to get accurate completion rates
2. **Use Consistent Time Ranges**: When comparing data, use the same date ranges
3. **Monitor Over Time**: Track trends by comparing insights across different time periods
4. **Sample Size Matters**: Only trust statistics with sufficient sample sizes (the system has built-in minimums)
5. **Correlate Metrics**: Look at drops and completion rates together to understand player progression

## Acceptance Criteria Tracking

The implementation satisfies the following acceptance criteria from GitHub issue #702:

- [x] Dashboard shows drop distribution by rarity
- [x] Stage completion rates are tracked
- [x] Data is up-to-date and accessible
- [x] Dashboard helps identify balance issues
- [x] Team can make data-driven tuning decisions

## Implementation Details

- **Storage**: Uses Nakama storage for persistence with in-memory caching for performance
- **Caching**: Statistics are cached for 5 minutes to reduce computational overhead
- **Data Retention**: Maintains up to 100,000 recent drops and attempts in memory
- **Privacy**: No PII is stored; only game-relevant analytics data is collected
