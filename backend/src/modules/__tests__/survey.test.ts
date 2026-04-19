import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { rpcSubmitSurvey, rpcGetSurveyStatus } from '../survey';
import { Runtime } from '../../types/nakama';

jest.mock('../metrics', () => ({
  registerRpcWithMetrics: jest.fn(),
}));

jest.mock('../../index', () => ({
  getStructuredLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('survey', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user-123' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('rpcSubmitSurvey', () => {
    const validPostMatchPayload = JSON.stringify({
      survey_type: 'post_match',
      survey_data: {
        experience_rating: 4,
        difficulty_rating: 3,
        would_recommend: 5,
        match_id: 'match_001',
        match_type: 'ranked',
        is_victory: true,
      },
      client_timestamp: Date.now(),
    });

    const validPostPurchasePayload = JSON.stringify({
      survey_type: 'post_purchase',
      survey_data: {
        satisfaction_rating: 5,
        value_rating: 4,
        product_id: 'gems_100',
        gems_awarded: 100,
      },
      client_timestamp: Date.now(),
    });

    it('should accept a valid post-match survey', () => {
      mockNk.storageList = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, validPostMatchPayload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.survey_id).toContain('post_match_test-user-123_');
      expect(mockNk.storageWrite).toHaveBeenCalledTimes(1);
    });

    it('should accept a valid post-purchase survey', () => {
      mockNk.storageList = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, validPostPurchasePayload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.survey_id).toContain('post_purchase_test-user-123_');
    });

    it('should reject invalid payload', () => {
      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, JSON.stringify({ bad: 'data' }));
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should reject out-of-range rating', () => {
      const payload = JSON.stringify({
        survey_type: 'post_match',
        survey_data: { experience_rating: 10 },
        client_timestamp: Date.now(),
      });

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it('should reject when rate limit exceeded (3 submissions in 24h)', () => {
      const recentTime = new Date().toISOString();
      mockNk.storageList = jest.fn().mockReturnValue([
        { key: 'post_match_test_1', updateTime: recentTime },
        { key: 'post_match_test_2', updateTime: recentTime },
        { key: 'post_match_test_3', updateTime: recentTime },
      ]);

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, validPostMatchPayload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain('Rate limit');
      expect(mockNk.storageWrite).not.toHaveBeenCalled();
    });

    it('should allow submission when old submissions are outside 24h window', () => {
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      mockNk.storageList = jest.fn().mockReturnValue([
        { key: 'post_match_test_1', updateTime: oldTime },
        { key: 'post_match_test_2', updateTime: oldTime },
        { key: 'post_match_test_3', updateTime: oldTime },
      ]);
      mockNk.storageWrite = jest.fn();

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, validPostMatchPayload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
    });

    it('should accept survey with optional free text', () => {
      const payload = JSON.stringify({
        survey_type: 'post_match',
        survey_data: {
          experience_rating: 4,
          free_text: 'Great match, loved the balance!',
        },
        client_timestamp: Date.now(),
      });
      mockNk.storageList = jest.fn().mockReturnValue([]);
      mockNk.storageWrite = jest.fn();

      const result = rpcSubmitSurvey(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);

      const writeCall = mockNk.storageWrite.mock.calls[0][0][0];
      const stored = JSON.parse(writeCall.value);
      expect(stored.survey_data.free_text).toBe('Great match, loved the balance!');
    });
  });

  describe('rpcGetSurveyStatus', () => {
    it('should return eligible when no prior submissions', () => {
      mockNk.storageList = jest.fn().mockReturnValue([]);

      const result = rpcGetSurveyStatus(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ survey_type: 'post_match' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.eligible).toBe(true);
      expect(parsed.cooldown_remaining_sec).toBe(0);
    });

    it('should return not eligible when within cooldown', () => {
      const recentTime = new Date().toISOString();
      mockNk.storageList = jest.fn().mockReturnValue([
        { key: 'post_match_test_1', updateTime: recentTime },
      ]);

      const result = rpcGetSurveyStatus(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ survey_type: 'post_match' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.eligible).toBe(false);
      expect(parsed.cooldown_remaining_sec).toBeGreaterThan(0);
    });

    it('should return eligible when cooldown has expired', () => {
      const oldTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      mockNk.storageList = jest.fn().mockReturnValue([
        { key: 'post_match_test_1', updateTime: oldTime },
      ]);

      const result = rpcGetSurveyStatus(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ survey_type: 'post_match' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.eligible).toBe(true);
      expect(parsed.cooldown_remaining_sec).toBe(0);
    });

    it('should reject invalid survey type', () => {
      const result = rpcGetSurveyStatus(
        mockCtx,
        mockLogger,
        mockNk,
        JSON.stringify({ survey_type: 'invalid_type' })
      );
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });
  });
});
