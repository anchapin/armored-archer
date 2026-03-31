/**
 * Tests for n1-query-detector utility
 */

import { N1QueryDetector } from '../n1-query-detector';

describe('n1-query-detector', () => {
  beforeEach(() => {
    N1QueryDetector.setEnabled(true);
    N1QueryDetector.setThreshold(5);
    N1QueryDetector.clear();
  });

  describe('setEnabled', () => {
    it('should disable query tracking', () => {
      N1QueryDetector.setEnabled(false);
      N1QueryDetector.logQuery('SELECT * FROM users');
      const result = N1QueryDetector.analyze();
      expect(result.totalQueries).toBe(0);
    });

    it('should enable query tracking', () => {
      N1QueryDetector.setEnabled(true);
      N1QueryDetector.logQuery('SELECT * FROM users');
      const result = N1QueryDetector.analyze();
      expect(result.totalQueries).toBe(1);
    });
  });

  describe('setThreshold', () => {
    it('should set custom threshold', () => {
      N1QueryDetector.setThreshold(2);
      for (let i = 0; i < 3; i++) {
        N1QueryDetector.logQuery('SELECT * FROM users');
      }
      const result = N1QueryDetector.analyze();
      expect(result.n1Queries).toContain('users');
    });
  });

  describe('logQuery', () => {
    it('should log query with SQL', () => {
      N1QueryDetector.logQuery('SELECT * FROM players');
      const queries = N1QueryDetector.getRecentQueries();
      expect(queries.length).toBe(1);
      expect(queries[0].sql).toBe('SELECT * FROM players');
    });

    it('should sanitize string literals in SQL', () => {
      N1QueryDetector.logQuery("SELECT * FROM users WHERE name = 'secret'");
      const queries = N1QueryDetector.getRecentQueries();
      expect(queries[0].sql).toBe('SELECT * FROM users WHERE name = ?');
    });

    it('should log query with duration', () => {
      N1QueryDetector.logQuery('SELECT 1', 42);
      const queries = N1QueryDetector.getRecentQueries();
      expect(queries[0].duration).toBe(42);
    });

    it('should log query with stack trace', () => {
      N1QueryDetector.logQuery('SELECT 1', undefined, 'at test.ts:10');
      const queries = N1QueryDetector.getRecentQueries();
      expect(queries[0].stackTrace).toBe('at test.ts:10');
    });
  });

  describe('analyze', () => {
    it('should detect N+1 query pattern', () => {
      for (let i = 0; i < 7; i++) {
        N1QueryDetector.logQuery('SELECT * FROM players WHERE id = ' + i);
      }
      const result = N1QueryDetector.analyze();
      expect(result.totalQueries).toBe(7);
      expect(result.n1Queries).toContain('players');
    });

    it('should not flag queries below threshold', () => {
      for (let i = 0; i < 3; i++) {
        N1QueryDetector.logQuery('SELECT * FROM players');
      }
      const result = N1QueryDetector.analyze();
      expect(result.n1Queries).toHaveLength(0);
    });

    it('should track queries per operation', () => {
      for (let i = 0; i < 10; i++) {
        N1QueryDetector.logQuery('SELECT * FROM items');
      }
      const result = N1QueryDetector.analyze();
      expect(result.maxQueriesPerOperation).toBe(10);
    });

    it('should return empty result when no queries', () => {
      const result = N1QueryDetector.analyze();
      expect(result.totalQueries).toBe(0);
      expect(result.n1Queries).toHaveLength(0);
      expect(result.queries).toHaveLength(0);
    });

    it('should only analyze SELECT queries for N+1', () => {
      for (let i = 0; i < 10; i++) {
        N1QueryDetector.logQuery('INSERT INTO logs VALUES (1)');
      }
      const result = N1QueryDetector.analyze();
      expect(result.n1Queries).toHaveLength(0);
    });
  });

  describe('track', () => {
    it('should execute operation and return result', async () => {
      const result = await N1QueryDetector.track(async () => 'done');
      expect(result).toBe('done');
    });

    it('should track queries during operation', async () => {
      await N1QueryDetector.track(async () => {
        N1QueryDetector.logQuery('SELECT 1');
        N1QueryDetector.logQuery('SELECT 2');
      });
      const queries = N1QueryDetector.getRecentQueries();
      expect(queries.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip tracking when disabled', async () => {
      N1QueryDetector.setEnabled(false);
      await N1QueryDetector.track(async () => {
        N1QueryDetector.logQuery('SELECT 1');
      });
      const result = N1QueryDetector.analyze();
      expect(result.totalQueries).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all logged queries', () => {
      N1QueryDetector.logQuery('SELECT 1');
      N1QueryDetector.logQuery('SELECT 2');
      N1QueryDetector.clear();
      expect(N1QueryDetector.getRecentQueries()).toHaveLength(0);
    });
  });

  describe('getRecentQueries', () => {
    it('should return limited number of queries', () => {
      for (let i = 0; i < 20; i++) {
        N1QueryDetector.logQuery('SELECT ' + i);
      }
      const queries = N1QueryDetector.getRecentQueries(5);
      expect(queries.length).toBe(5);
    });

    it('should return all queries when count exceeds total', () => {
      N1QueryDetector.logQuery('SELECT 1');
      const queries = N1QueryDetector.getRecentQueries(100);
      expect(queries.length).toBe(1);
    });

    it('should return last N queries', () => {
      N1QueryDetector.logQuery('SELECT first');
      N1QueryDetector.logQuery('SELECT second');
      N1QueryDetector.logQuery('SELECT third');
      const queries = N1QueryDetector.getRecentQueries(2);
      expect(queries[0].sql).toBe('SELECT second');
      expect(queries[1].sql).toBe('SELECT third');
    });
  });
});
