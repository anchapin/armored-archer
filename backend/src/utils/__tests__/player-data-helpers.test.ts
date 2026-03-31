/**
 * Tests for player-data-helpers utility
 */

import {
  createPlayerDataNotFoundResponse,
  createPlayerDataReadErrorResponse,
  parsePlayerStatsValue,
  PLAYER_DATA_NOT_FOUND_RESPONSE,
  PLAYER_DATA_READ_ERROR_RESPONSE,
} from '../player-data-helpers';

describe('player-data-helpers', () => {
  describe('PLAYER_DATA_NOT_FOUND_RESPONSE', () => {
    it('should have correct error message', () => {
      expect(PLAYER_DATA_NOT_FOUND_RESPONSE).toEqual({ error: 'Player data not found' });
    });
  });

  describe('PLAYER_DATA_READ_ERROR_RESPONSE', () => {
    it('should have correct error message', () => {
      expect(PLAYER_DATA_READ_ERROR_RESPONSE).toEqual({ error: 'Failed to read player data' });
    });
  });

  describe('createPlayerDataNotFoundResponse', () => {
    it('should return default error message', () => {
      const result = createPlayerDataNotFoundResponse();
      expect(JSON.parse(result)).toEqual({ error: 'Player data not found' });
    });

    it('should return custom error message', () => {
      const result = createPlayerDataNotFoundResponse('Custom not found');
      expect(JSON.parse(result)).toEqual({ error: 'Custom not found' });
    });
  });

  describe('createPlayerDataReadErrorResponse', () => {
    it('should return default error message', () => {
      const result = createPlayerDataReadErrorResponse();
      expect(JSON.parse(result)).toEqual({ error: 'Failed to read player data' });
    });

    it('should return custom error message', () => {
      const result = createPlayerDataReadErrorResponse('Custom error');
      expect(JSON.parse(result)).toEqual({ error: 'Custom error' });
    });
  });

  describe('parsePlayerStatsValue', () => {
    it('should return null for undefined value', () => {
      expect(parsePlayerStatsValue(undefined)).toBeNull();
    });

    it('should return null for null value', () => {
      expect(parsePlayerStatsValue(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parsePlayerStatsValue('')).toBeNull();
    });

    it('should parse JSON string', () => {
      const input = '{"level":5,"xp":100,"stats":{}}';
      const result = parsePlayerStatsValue(input);
      expect(result).toEqual({ level: 5, xp: 100, stats: {} });
    });

    it('should return null for invalid JSON string', () => {
      expect(parsePlayerStatsValue('not json')).toBeNull();
    });

    it('should return object as-is when already parsed', () => {
      const input = { level: 5, xp: 100, stats: {} };
      const result = parsePlayerStatsValue(input);
      expect(result).toEqual(input);
    });

    it('should return null for non-object types', () => {
      expect(parsePlayerStatsValue(123)).toBeNull();
      expect(parsePlayerStatsValue(true)).toBeNull();
    });

    it('should return arrays as-is since they are objects', () => {
      expect(parsePlayerStatsValue([])).toEqual([]);
    });

    it('should return arrays as-is since they are objects', () => {
      expect(parsePlayerStatsValue([])).toEqual([]);
    });
  });
});
