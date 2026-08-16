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

  /**
   * Drives the combat system turn-by-turn until a server-side terminal
   * state exists (health-zero), mirroring the hybrid duel model: combat
   * resolution declares the winner; complete_match only settles it.
   */
  const driveCombatToTerminalState = async (
    matchId: string,
    creatorCtx: ReturnType<typeof createMockContext>,
    opponentCtx: ReturnType<typeof createMockContext>,
    maxTurns = 60
  ): Promise<void> => {
    for (let i = 0; i < maxTurns; i++) {
      const stateJson = mockStorage.get(`pvp_match_states:${matchId}`);
      const state: MatchState | undefined = stateJson ? JSON.parse(stateJson) : undefined;
      if (state && (state.winner || state.creator_health <= 0 || state.opponent_health <= 0)) {
        return;
      }
      const actorCtx = state && state.current_turn_user_id === 'opponent-user' ? opponentCtx : creatorCtx;
      await rpcSubmitCombatAction(
        actorCtx,
        mockLogger,
        mockNk,
        JSON.stringify({
          match_id: matchId,
          action_type: 'shoot',
          angle: 1.5,
          power: 0.9,
        })
      );
    }
    throw new Error('Combat did not reach a terminal state within the turn budget');
  };

  it('should execute full pvp lifecycle from create to complete', async () => {
    const creatorCtx = createMockContext({ userId: 'creator-user' });

    // Step 1: Create match
    const createResult = rpcCreateMatch(
      creatorCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_type: 'ranked' })
    );
    const created = JSON.parse(createResult);
    expect(created.success).toBe(true);
    expect(created.match.status).toBe('pending');
    const matchId = created.match.match_id;

    // Step 2: Accept match
    const opponentCtx = createMockContext({ userId: 'opponent-user' });
    const acceptResult = rpcAcceptMatch(
      opponentCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_id: matchId })
    );
    const accepted = JSON.parse(acceptResult);
    expect(accepted.success).toBe(true);
    expect(accepted.match.status).toBe('active');

    // Step 3: Play combat until the server declares a terminal state
    // (health-zero). The combat system declares the winner server-side.
    await driveCombatToTerminalState(matchId, creatorCtx, opponentCtx);
    const finalStateJson = mockStorage.get(`pvp_match_states:${matchId}`);
    const finalState: MatchState = JSON.parse(finalStateJson as string);
    expect(finalState.winner).toBeDefined();

    // Step 4: Trigger settlement. The payload winner is advisory only —
    // settlement must follow the server-declared winner.
    const clientAssertedLoser = finalState.winner === 'creator-user' ? 'opponent-user' : 'creator-user';
    const completeResult = rpcCompleteMatch(
      creatorCtx,
      mockLogger,
      mockNk,
      JSON.stringify({
        match_id: matchId,
        winner_id: clientAssertedLoser, // client lies; must be ignored
        loser_id: finalState.winner,
      })
    );
    const completed = JSON.parse(completeResult);
    expect(completed.success).toBe(true);
    // Server truth wins over the client-asserted payload
    expect(completed.winner.user_id).toBe(finalState.winner);
    expect(completed.end_reason).toBe('health_zero');
  });

  it('should reject action after match is completed', async () => {
    const creatorCtx = createMockContext({ userId: 'creator-user' });

    // Create and accept match
    const createResult = rpcCreateMatch(
      creatorCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_type: 'ranked' })
    );
    const matchId = JSON.parse(createResult).match.match_id;

    const opponentCtx = createMockContext({ userId: 'opponent-user' });
    rpcAcceptMatch(opponentCtx, mockLogger, mockNk, JSON.stringify({ match_id: matchId }));

    // Play combat to a server-declared terminal state
    await driveCombatToTerminalState(matchId, creatorCtx, opponentCtx);

    // Settle the match
    rpcCompleteMatch(
      creatorCtx,
      mockLogger,
      mockNk,
      JSON.stringify({ match_id: matchId })
    );

    // Try to submit action after completion
    const lateActionResult = await rpcSubmitCombatAction(
      creatorCtx,
      mockLogger,
      mockNk,
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
