import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import { rpcCreateMatch, rpcAcceptMatch, rpcCompleteMatch, PvPMatch } from '../matchmaker';
import { rpcSubmitCombatAction, MatchState } from '../combat_system';
import { Runtime } from '../../types/nakama';

jest.mock('../anti_cheat', () => {
  const actual = jest.requireActual('../anti_cheat');
  return {
    ...actual,
    detectTimingAttack: jest.fn().mockReturnValue(false),
    verifyRequestSignature: jest.fn().mockReturnValue({ valid: true, violations: [] }),
    validateCombatActionParameters: jest.fn().mockReturnValue({ valid: true, violations: [] }),
    isPlayerFlagged: jest.fn().mockReturnValue(false),
    recordMatchResult: jest.fn(),
    getPlayerMatchHistory: jest.fn().mockReturnValue(null),
  };
});

jest.mock('../rate_limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true }),
  checkMatchCooldown: jest.fn().mockReturnValue({ allowed: true }),
  recordMatchAction: jest.fn(),
  checkConcurrentMatchLimit: jest.fn().mockReturnValue({ allowed: true, activeCount: 0, limit: 5 }),
  checkDuplicateTurn: jest.fn().mockReturnValue({ isDuplicate: false }),
  cleanupTurnTracking: jest.fn(),
  detectWinTrading: jest.fn().mockReturnValue({ suspicious: false, confidence: 0 }),
}));

jest.mock('../validation', () => {
  const actual = jest.requireActual('../validation');
  return {
    ...actual,
    validatePayload: (...args: any[]) => actual.validatePayload(...args),
  };
});

describe('PvP lifecycle integration', () => {
  let mockLogger: Runtime.Logger;
  let mockNk: Runtime.Nakama;
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockNk = createMockNakama();
    mockStorage = new Map();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const playerStats = JSON.stringify({
      level: 5,
      xp: 500,
      stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 10 },
    });
    mockStorage.set('player_stats:creator-user', playerStats);
    mockStorage.set('player_stats:opponent-user', playerStats);

    mockNk.storageRead = jest.fn((objects: any[]) => {
      return objects
        .map((obj: any) => {
          const key = `${obj.collection}:${obj.key}`;
          const val = mockStorage.get(key);
          if (val === undefined) return null;
          return { collection: obj.collection, key: obj.key, value: val, userId: obj.userId || '' };
        })
        .filter(Boolean);
    });

    mockNk.storageWrite = jest.fn((objects: any[]) => {
      objects.forEach((obj: any) => {
        mockStorage.set(`${obj.collection}:${obj.key}`, obj.value);
      });
    });
  });

  afterEach(() => {
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('should execute full pvp lifecycle from create to complete', async () => {
    const creatorCtx = createMockContext({ userId: 'creator-user' });

    // Step 1: Create match
    const createResult = rpcCreateMatch(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({ match_type: 'ranked' })
    );
    const created = JSON.parse(createResult);
    expect(created.success).toBe(true);
    expect(created.match.status).toBe('pending');
    const matchId = created.match.match_id;

    // Step 2: Accept match
    const opponentCtx = createMockContext({ userId: 'opponent-user' });
    const acceptResult = rpcAcceptMatch(
      opponentCtx, mockLogger, mockNk,
      JSON.stringify({ match_id: matchId })
    );
    const accepted = JSON.parse(acceptResult);
    expect(accepted.success).toBe(true);
    expect(accepted.match.status).toBe('active');

    // Step 3: Submit combat action for creator
    const actionResult = await rpcSubmitCombatAction(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({
        match_id: matchId,
        action_type: 'shoot',
        angle: 1.5,
        power: 0.5,
      })
    );
    const actionParsed = JSON.parse(actionResult);
    expect(actionParsed.success).toBe(true);

    // Step 4: Complete match
    const completeResult = rpcCompleteMatch(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({
        match_id: matchId,
        winner_id: 'creator-user',
        loser_id: 'opponent-user',
      })
    );
    const completed = JSON.parse(completeResult);
    expect(completed.success).toBe(true);
  });

  it('should reject action after match is completed', async () => {
    const creatorCtx = createMockContext({ userId: 'creator-user' });

    // Create and accept match
    const createResult = rpcCreateMatch(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({ match_type: 'ranked' })
    );
    const matchId = JSON.parse(createResult).match.match_id;

    const opponentCtx = createMockContext({ userId: 'opponent-user' });
    rpcAcceptMatch(opponentCtx, mockLogger, mockNk, JSON.stringify({ match_id: matchId }));

    // Complete the match
    rpcCompleteMatch(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({
        match_id: matchId,
        winner_id: 'creator-user',
        loser_id: 'opponent-user',
      })
    );

    // Try to submit action after completion
    const lateActionResult = await rpcSubmitCombatAction(
      creatorCtx, mockLogger, mockNk,
      JSON.stringify({
        match_id: matchId,
        action_type: 'shoot',
        angle: 1.5,
      })
    );
    const parsed = JSON.parse(lateActionResult);
    expect(parsed.error).toBe('Match is not active');
  });
});
