import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import {
  rpcGetMatchReplay,
  rpcListMatchReplays,
  rpcFlagMatchForQa,
  rpcAddDebugNotes,
  rpcReconstructMatchState,
  registerRpcGetMatchReplay,
  registerRpcListMatchReplays,
  registerRpcFlagMatchForQa,
  registerRpcAddDebugNotes,
  registerRpcReconstructMatchState,
  type MatchReplayData,
  type MatchReplaySummary,
  type ReconstructedMatchState,
} from '../match_replay';

describe('match_replay', () => {
  let mockLogger: any;
  let mockCtx: any;
  let mockNk: any;

  const createMockMatchResult = (overrides = {}): any => ({
    match_id: 'match_test_123',
    creator_id: 'creator-user',
    opponent_id: 'opponent-user',
    winner_id: 'creator-user',
    loser_id: 'opponent-user',
    match_type: 'ranked',
    total_turns: 10,
    duration_seconds: 300,
    end_reason: 'health_zero',
    combat_log: JSON.stringify([
      {
        turn: 1,
        attacker_id: 'creator-user',
        action: 'shoot',
        hit: true,
        damage: 25,
        is_crit: false,
        timestamp: Date.now(),
      },
    ]),
    replay_data: JSON.stringify({
      turn_snapshots: [
        {
          turn: 1,
          timestamp: Date.now(),
          creator_health: 75,
          opponent_health: 100,
          creator_turn_data: { action_type: 'shoot', angle: 1.57, power: 0.8 },
          opponent_turn_data: undefined,
          current_player: 'opponent-user',
          match_status: 'active',
        },
      ],
    }),
    debug_notes: null,
    qa_flagged: false,
    qa_flagged_reason: null,
    creator_health_remaining: 75,
    opponent_health_remaining: 0,
    creator_stats_at_match: JSON.stringify({
      level: 5,
      xp: 500,
      stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 },
    }),
    opponent_stats_at_match: JSON.stringify({
      level: 5,
      xp: 500,
      stats: { attack: 18, defense: 14, dodge: 9, crit_rate: 7 },
    }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: 'test-user-123' });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  describe('rpcGetMatchReplay', () => {
    it('should retrieve match replay data successfully', async () => {
      const mockMatch = createMockMatchResult();
      mockNk.dbQuery.mockResolvedValue([mockMatch]);

      const payload = JSON.stringify({ match_id: 'match_test_123' });
      const result = await rpcGetMatchReplay(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.replay).toBeDefined();
      expect(response.replay.match_id).toBe('match_test_123');
      expect(response.replay.total_turns).toBe(10);
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['match_test_123']
      );
    });

    it('should return error when match not found', async () => {
      mockNk.dbQuery.mockResolvedValue([]);

      const payload = JSON.stringify({ match_id: 'nonexistent_match' });
      const result = await rpcGetMatchReplay(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should return error for invalid payload', async () => {
      const payload = JSON.stringify({}); // Missing match_id
      const result = await rpcGetMatchReplay(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('match_id');
    });

    it('should increment replay access count', async () => {
      const mockMatch = createMockMatchResult();
      mockNk.dbQuery.mockResolvedValue([mockMatch]);

      const payload = JSON.stringify({ match_id: 'match_test_123' });
      await rpcGetMatchReplay(mockCtx, mockLogger, mockNk, payload);

      // Check that increment_replay_access was called
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('increment_replay_access'),
        ['match_test_123']
      );
    });
  });

  describe('rpcListMatchReplays', () => {
    it('should list match replays with default parameters', async () => {
      const mockMatches = [
        createMockMatchResult({ match_id: 'match_1' }),
        createMockMatchResult({ match_id: 'match_2' }),
      ];
      mockNk.dbQuery.mockResolvedValue(mockMatches);

      const payload = JSON.stringify({});
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.replays).toHaveLength(2);
      expect(response.count).toBe(2);
      expect(response.limit).toBe(50);
      expect(response.offset).toBe(0);
    });

    it('should filter by match type', async () => {
      const mockMatches = [
        createMockMatchResult({ match_id: 'match_1', match_type: 'ranked' }),
      ];
      mockNk.dbQuery.mockResolvedValue(mockMatches);

      const payload = JSON.stringify({ match_type: 'ranked', limit: 10 });
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.limit).toBe(10);
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('match_type ='),
        expect.arrayContaining(['ranked'])
      );
    });

    it('should filter by QA flagged only', async () => {
      const mockMatches = [
        createMockMatchResult({ match_id: 'match_1', qa_flagged: true }),
      ];
      mockNk.dbQuery.mockResolvedValue(mockMatches);

      const payload = JSON.stringify({ qa_flagged_only: true });
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('qa_flagged = true'),
        expect.any(Array)
      );
    });

    it('should filter by player ID', async () => {
      const mockMatches = [
        createMockMatchResult({ match_id: 'match_1' }),
      ];
      mockNk.dbQuery.mockResolvedValue(mockMatches);

      const payload = JSON.stringify({ player_id: 'creator-user' });
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('(creator_id ='),
        expect.arrayContaining(['creator-user', 'creator-user'])
      );
    });

    it('should apply pagination', async () => {
      mockNk.dbQuery.mockResolvedValue([]);

      const payload = JSON.stringify({ limit: 25, offset: 50 });
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.limit).toBe(25);
      expect(response.offset).toBe(50);
    });

    it('should reject limit > 100', async () => {
      mockNk.dbQuery.mockResolvedValue([]);

      const payload = JSON.stringify({ limit: 200 });
      const result = await rpcListMatchReplays(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      // Validation should reject limit > 100
      expect(response.success).toBe(false);
      expect(response.error).toContain('limit');
    });
  });

  describe('rpcFlagMatchForQa', () => {
    it('should flag a match for QA investigation', async () => {
      mockNk.dbQuery.mockResolvedValue([{ flag_match_for_qa: true }]);

      const payload = JSON.stringify({
        match_id: 'match_test_123',
        reason: 'Suspicious damage values',
      });
      const result = await rpcFlagMatchForQa(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.message).toContain('flagged');
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        'SELECT flag_match_for_qa($1, $2)',
        ['match_test_123', 'Suspicious damage values']
      );
    });

    it('should return error when match not found', async () => {
      mockNk.dbQuery.mockResolvedValue([{ flag_match_for_qa: false }]);

      const payload = JSON.stringify({
        match_id: 'nonexistent_match',
        reason: 'Test',
      });
      const result = await rpcFlagMatchForQa(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should validate payload', async () => {
      const payload = JSON.stringify({ match_id: 'match_123' }); // Missing reason
      const result = await rpcFlagMatchForQa(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('reason');
    });
  });

  describe('rpcAddDebugNotes', () => {
    it('should add debug notes to a match', async () => {
      mockNk.dbQuery.mockResolvedValue([{ match_id: 'match_test_123' }]);

      const payload = JSON.stringify({
        match_id: 'match_test_123',
        notes: 'Player reported unusual behavior',
      });
      const result = await rpcAddDebugNotes(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.message).toContain('added');
      expect(mockNk.dbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE match_results'),
        expect.arrayContaining([
          expect.stringContaining('Player reported unusual behavior'),
          'match_test_123',
        ])
      );
    });

    it('should return error when match not found', async () => {
      mockNk.dbQuery.mockResolvedValue([]);

      const payload = JSON.stringify({
        match_id: 'nonexistent_match',
        notes: 'Test notes',
      });
      const result = await rpcAddDebugNotes(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should validate payload', async () => {
      const payload = JSON.stringify({ match_id: 'match_123' }); // Missing notes
      const result = await rpcAddDebugNotes(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('notes');
    });
  });

  describe('rpcReconstructMatchState', () => {
    it('should reconstruct match state at specific turn', async () => {
      const mockMatch = createMockMatchResult();
      mockNk.dbQuery.mockResolvedValue([mockMatch]);

      const payload = JSON.stringify({
        match_id: 'match_test_123',
        turn: 1,
      });
      const result = await rpcReconstructMatchState(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(true);
      expect(response.state).toBeDefined();
      expect(response.state.turn).toBe(1);
      expect(response.state.creator_health).toBe(75);
      expect(response.state.last_action).toBeDefined();
      expect(response.state.last_action!.action).toBe('shoot');
    });

    it('should return error when turn not found', async () => {
      const mockMatch = createMockMatchResult({
        replay_data: JSON.stringify({ turn_snapshots: [] }),
      });
      mockNk.dbQuery.mockResolvedValue([mockMatch]);

      const payload = JSON.stringify({
        match_id: 'match_test_123',
        turn: 999,
      });
      const result = await rpcReconstructMatchState(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('should validate payload', async () => {
      const payload = JSON.stringify({ match_id: 'match_123' }); // Missing turn
      const result = await rpcReconstructMatchState(mockCtx, mockLogger, mockNk, payload);
      const response = JSON.parse(result);

      expect(response.success).toBe(false);
      expect(response.error).toContain('turn');
    });
  });

  describe('RPC Registration', () => {
    it('should register all replay RPC endpoints', () => {
      const mockInitializer = {
        registerRpc: jest.fn(),
      };

      registerRpcGetMatchReplay(mockInitializer as any);
      registerRpcListMatchReplays(mockInitializer as any);
      registerRpcFlagMatchForQa(mockInitializer as any);
      registerRpcAddDebugNotes(mockInitializer as any);
      registerRpcReconstructMatchState(mockInitializer as any);

      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/get_match_replay',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/list_match_replays',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/flag_match_for_qa',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/add_debug_notes',
        expect.any(Function)
      );
      expect(mockInitializer.registerRpc).toHaveBeenCalledWith(
        'armored_archer/reconstruct_match_state',
        expect.any(Function)
      );
    });
  });
});
