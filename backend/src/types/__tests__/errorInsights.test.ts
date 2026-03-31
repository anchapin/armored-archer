import {
  RawErrorData,
  ErrorSeverity,
  ErrorSource,
  ErrorPattern,
  ErrorInsight,
  InsightPriority,
  InsightImpact,
  ErrorSummary,
  TimeRange,
  TrendData,
  ErrorInsightConfig,
  ErrorDashboardData,
  PipelineStats,
} from '../errorInsights';

describe('RawErrorData interface', () => {
  test('should accept complete error data', () => {
    const error: RawErrorData = {
      id: 'err_123',
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Database connection failed',
      stack: 'Error: Connection refused\n  at connect()',
      errorType: 'DatabaseError',
      rpcName: 'get_player_stats',
      userId: 'user_456',
      requestId: 'req_789',
      metadata: { host: 'db.example.com', port: 5432 },
      severity: 'critical',
      source: 'database',
    };

    expect(error.id).toBe('err_123');
    expect(error.severity).toBe('critical');
    expect(error.source).toBe('database');
    expect(error.metadata?.host).toBe('db.example.com');
  });

  test('should work with minimal required fields', () => {
    const error: RawErrorData = {
      id: 'err_minimal',
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Something went wrong',
      errorType: 'UnknownError',
      severity: 'error',
      source: 'unknown',
    };

    expect(error.stack).toBeUndefined();
    expect(error.rpcName).toBeUndefined();
    expect(error.userId).toBeUndefined();
  });
});

describe('ErrorSeverity type', () => {
  test('should accept all severity levels', () => {
    const severities: ErrorSeverity[] = ['critical', 'error', 'warning', 'info'];
    expect(severities).toHaveLength(4);
  });
});

describe('ErrorSource type', () => {
  test('should accept all source types', () => {
    const sources: ErrorSource[] = ['nakama', 'database', 'cache', 'external', 'validation', 'unknown'];
    expect(sources).toHaveLength(6);
  });
});

describe('ErrorPattern interface', () => {
  test('should accept complete pattern data', () => {
    const pattern: ErrorPattern = {
      patternId: 'pattern_001',
      signature: 'abc123hash',
      count: 150,
      firstSeen: '2024-01-01T00:00:00Z',
      lastSeen: '2024-01-02T00:00:00Z',
      errorType: 'TimeoutError',
      messageTemplate: 'Request to {endpoint} timed out after {ms}ms',
      affectedRpcs: ['get_player_stats', 'submit_combat_action'],
      affectedUsers: ['user_1', 'user_2', 'user_3'],
      occurrencesPerHour: 6.25,
      severity: 'high',
      source: 'external',
    };

    expect(pattern.patternId).toBe('pattern_001');
    expect(pattern.count).toBe(150);
    expect(pattern.affectedRpcs).toHaveLength(2);
    expect(pattern.affectedUsers).toHaveLength(3);
    expect(pattern.occurrencesPerHour).toBe(6.25);
  });
});

describe('ErrorInsight interface', () => {
  test('should accept complete insight data', () => {
    const insight: ErrorInsight = {
      id: 'insight_001',
      generatedAt: '2024-01-02T01:00:00Z',
      patternId: 'pattern_001',
      title: 'High timeout rate on external API',
      description: 'The external payment API is experiencing elevated timeout rates.',
      priority: 'high',
      recommendations: [
        'Add circuit breaker for payment API',
        'Implement retry with exponential backoff',
      ],
      impact: {
        userImpact: 'Players unable to complete purchases',
        systemImpact: 'Increased error rate and user complaints',
        affectedPercentage: 15.5,
        estimatedDowntime: '2-3 hours',
      },
      actionable: true,
      errorCount: 150,
      affectedUserCount: 45,
    };

    expect(insight.id).toBe('insight_001');
    expect(insight.priority).toBe('high');
    expect(insight.recommendations).toHaveLength(2);
    expect(insight.impact.affectedPercentage).toBe(15.5);
    expect(insight.actionable).toBe(true);
  });

  test('should accept non-actionable insight', () => {
    const insight: ErrorInsight = {
      id: 'insight_002',
      generatedAt: '2024-01-02T02:00:00Z',
      patternId: 'pattern_002',
      title: 'Intermittent cache miss',
      description: 'Cache miss rate is slightly elevated but within normal bounds.',
      priority: 'low',
      recommendations: ['Monitor for trends'],
      impact: {
        userImpact: 'Negligible',
        systemImpact: 'Slight increase in database load',
      },
      actionable: false,
      errorCount: 10,
      affectedUserCount: 2,
    };

    expect(insight.actionable).toBe(false);
    expect(insight.impact.affectedPercentage).toBeUndefined();
  });
});

describe('InsightPriority type', () => {
  test('should accept all priority levels', () => {
    const priorities: InsightPriority[] = ['critical', 'high', 'medium', 'low'];
    expect(priorities).toHaveLength(4);
  });
});

describe('InsightImpact interface', () => {
  test('should accept complete impact data', () => {
    const impact: InsightImpact = {
      userImpact: 'Players cannot load inventory',
      systemImpact: 'Database connection pool exhausted',
      affectedPercentage: 25.0,
      estimatedDowntime: '1 hour',
    };

    expect(impact.userImpact).toBe('Players cannot load inventory');
    expect(impact.affectedPercentage).toBe(25.0);
  });

  test('should work with optional fields omitted', () => {
    const impact: InsightImpact = {
      userImpact: 'Minor slowdown',
      systemImpact: 'Increased CPU usage',
    };

    expect(impact.affectedPercentage).toBeUndefined();
    expect(impact.estimatedDowntime).toBeUndefined();
  });
});

describe('ErrorSummary interface', () => {
  test('should accept complete summary data', () => {
    const summary: ErrorSummary = {
      totalErrors: 500,
      errorsBySeverity: {
        critical: 5,
        error: 50,
        warning: 200,
        info: 245,
      },
      errorsBySource: {
        nakama: 100,
        database: 150,
        cache: 50,
        external: 100,
        validation: 80,
        unknown: 20,
      },
      topPatterns: [],
      recentInsights: [],
      errorTrend: [
        { timestamp: '2024-01-01T00:00:00Z', count: 100 },
        { timestamp: '2024-01-02T00:00:00Z', count: 150 },
      ],
      timeRange: {
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
      },
    };

    expect(summary.totalErrors).toBe(500);
    expect(summary.errorsBySeverity.critical).toBe(5);
    expect(summary.errorsBySource.database).toBe(150);
    expect(summary.errorTrend).toHaveLength(2);
  });
});

describe('TimeRange interface', () => {
  test('should accept time range data', () => {
    const range: TimeRange = {
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
    };

    expect(range.startTime).toBe('2024-01-01T00:00:00Z');
    expect(range.endTime).toBe('2024-01-02T00:00:00Z');
  });
});

describe('TrendData interface', () => {
  test('should accept trend data point', () => {
    const trend: TrendData = {
      timestamp: '2024-01-01T12:00:00Z',
      count: 42,
      type: 'TimeoutError',
    };

    expect(trend.timestamp).toBe('2024-01-01T12:00:00Z');
    expect(trend.count).toBe(42);
    expect(trend.type).toBe('TimeoutError');
  });

  test('should work without optional type', () => {
    const trend: TrendData = {
      timestamp: '2024-01-01T12:00:00Z',
      count: 42,
    };

    expect(trend.type).toBeUndefined();
  });
});

describe('ErrorInsightConfig interface', () => {
  test('should accept configuration', () => {
    const config: ErrorInsightConfig = {
      enabled: true,
      aggregationWindowMinutes: 15,
      minOccurrencesForInsight: 10,
      insightWindowHours: 24,
      maxPatterns: 100,
      maxInsights: 50,
      autoResolvePatterns: true,
      patternTtlDays: 7,
    };

    expect(config.enabled).toBe(true);
    expect(config.aggregationWindowMinutes).toBe(15);
    expect(config.maxPatterns).toBe(100);
  });
});

describe('ErrorDashboardData interface', () => {
  test('should accept complete dashboard data', () => {
    const dashboard: ErrorDashboardData = {
      summary: {
        totalErrors: 100,
        errorsBySeverity: { critical: 1, error: 10, warning: 40, info: 49 },
        errorsBySource: { nakama: 20, database: 30, cache: 10, external: 20, validation: 15, unknown: 5 },
        topPatterns: [],
        recentInsights: [],
        errorTrend: [],
        timeRange: { startTime: '2024-01-01T00:00:00Z', endTime: '2024-01-02T00:00:00Z' },
      },
      patterns: [],
      insights: [],
      lastUpdated: '2024-01-02T00:00:00Z',
      config: {
        enabled: true,
        aggregationWindowMinutes: 15,
        minOccurrencesForInsight: 10,
        insightWindowHours: 24,
        maxPatterns: 100,
        maxInsights: 50,
        autoResolvePatterns: true,
        patternTtlDays: 7,
      },
    };

    expect(dashboard.summary.totalErrors).toBe(100);
    expect(dashboard.lastUpdated).toBe('2024-01-02T00:00:00Z');
    expect(dashboard.config.enabled).toBe(true);
  });
});

describe('PipelineStats interface', () => {
  test('should accept pipeline statistics', () => {
    const stats: PipelineStats = {
      totalErrorsProcessed: 10000,
      totalPatternsIdentified: 50,
      totalInsightsGenerated: 12,
      uptime: '7d 12h 30m',
      lastErrorProcessed: '2024-01-02T00:00:00Z',
      errorsPerMinute: 12.5,
    };

    expect(stats.totalErrorsProcessed).toBe(10000);
    expect(stats.totalInsightsGenerated).toBe(12);
    expect(stats.errorsPerMinute).toBe(12.5);
  });

  test('should work without optional lastErrorProcessed', () => {
    const stats: PipelineStats = {
      totalErrorsProcessed: 0,
      totalPatternsIdentified: 0,
      totalInsightsGenerated: 0,
      uptime: '0h 0m',
      errorsPerMinute: 0,
    };

    expect(stats.lastErrorProcessed).toBeUndefined();
    expect(stats.errorsPerMinute).toBe(0);
  });
});
