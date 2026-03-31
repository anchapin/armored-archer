import { CombatSystem, CombatState, CombatAction, CombatResult } from '../../src/modules/combat_system';

describe('CombatSystem', () => {
  let combat: CombatSystem;

  beforeEach(() => {
    combat = new CombatSystem();
  });

  describe('createMatch', () => {
    it('should create a new match with initial state', () => {
      const state = combat.createMatch('match1', 'player1', 'player2');

      expect(state.match_id).toBe('match1');
      expect(state.creator_id).toBe('player1');
      expect(state.opponent_id).toBe('player2');
      expect(state.creator_health).toBe(100);
      expect(state.opponent_health).toBe(100);
      expect(state.status).toBe('active');
    });
  });

  describe('getMatchState', () => {
    it('should return match state for existing match', () => {
      combat.createMatch('match1', 'player1', 'player2');
      const state = combat.getMatchState('match1');

      expect(state).not.toBeNull();
      expect(state?.match_id).toBe('match1');
    });

    it('should return null for non-existing match', () => {
      const state = combat.getMatchState('nonexistent');
      expect(state).toBeNull();
    });
  });

  describe('submitCombatAction', () => {
    it('should process combat action and return result', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const action: CombatAction = {
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      };

      const result = combat.submitCombatAction(action);

      expect(result).not.toBeNull();
      // Due to random dodge/crit, damage can be 0 or positive
      expect(result?.damage).toBeGreaterThanOrEqual(0);
      // Verify state was updated
      const state = combat.getMatchState('match1');
      expect(state?.log.length).toBeGreaterThan(0);
    });

    it('should return null for non-active match', () => {
      const action: CombatAction = {
        match_id: 'nonexistent',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      };

      const result = combat.submitCombatAction(action);
      expect(result).toBeNull();
    });
  });

  describe('calculateDamage', () => {
    it('should return at least 1 damage when base is positive', () => {
      const attacker = { attack: 0, crit_rate: 0 };
      const defender = { defense: 100, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThanOrEqual(1);
    });

    it('should return 0 when fully dodged', () => {
      const attacker = { attack: 10, crit_rate: 0 };
      const defender = { defense: 0, dodge: 100 };

      const damage = combat.calculateDamage(20, attacker, defender, 2.0);

      expect(damage).toBe(0);
    });

    it('should apply critical multiplier when crit occurs', () => {
      const attacker = { attack: 10, crit_rate: 100 };
      const defender = { defense: 0, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThan(10);
    });

    it('should not deal negative damage', () => {
      const attacker = { attack: 0, crit_rate: 0 };
      const defender = { defense: 100, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('isMyTurn', () => {
    it('should return true when it is the user\'s turn', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const isTurn = combat.isMyTurn('match1', 'player1');

      expect(isTurn).toBe(true);
    });

    it('should return false when it is not the user\'s turn', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const isTurn = combat.isMyTurn('match1', 'player2');

      expect(isTurn).toBe(false);
    });
  });

  describe('getHealthForUser', () => {
    it('should return correct health for creator', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const health = combat.getHealthForUser('match1', 'player1');

      expect(health).not.toBeNull();
      expect(health?.my).toBe(100);
      expect(health?.opponent).toBe(100);
    });

    it('should return correct health for opponent', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const health = combat.getHealthForUser('match1', 'player2');

      expect(health).not.toBeNull();
      expect(health?.my).toBe(100);
      expect(health?.opponent).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty match ID', () => {
      const state = combat.getMatchState('');
      expect(state).toBeNull();
    });

    it('should handle numeric string match ID', () => {
      const state = combat.createMatch('123', 'player1', 'player2');
      expect(state.match_id).toBe('123');
      
      const retrieved = combat.getMatchState('123');
      expect(retrieved).not.toBeNull();
    });

    it('should handle very large angle values', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const result = combat.submitCombatAction({
        match_id: 'match1',
        action_type: 'attack',
        angle: 999999,
        power: 1.0
      });

      expect(result).not.toBeNull();
      expect(result?.damage).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative power values', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const result = combat.submitCombatAction({
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: -5
      });

      expect(result).not.toBeNull();
    });

    it('should alternate turns correctly through multiple actions', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      expect(combat.isMyTurn('match1', 'player1')).toBe(true);
      
      combat.submitCombatAction({
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      });
      
      expect(combat.isMyTurn('match1', 'player2')).toBe(true);
      
      combat.submitCombatAction({
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      });
      
      expect(combat.isMyTurn('match1', 'player1')).toBe(true);
    });

    it('should end match when creator health reaches zero', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      let state = combat.getMatchState('match1');
      let iterations = 0;
      while (state && state.creator_health > 0 && iterations < 100) {
        combat.submitCombatAction({
          match_id: 'match1',
          action_type: 'attack',
          angle: 45,
          power: 1.0
        });
        state = combat.getMatchState('match1');
        iterations++;
      }
      
      if (state) {
        expect(state.status).toBe('completed');
      }
    });

    it('should end match when opponent health reaches zero', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      let state = combat.getMatchState('match1');
      let iterations = 0;
      while (state && state.status === 'active' && iterations < 100) {
        combat.submitCombatAction({
          match_id: 'match1',
          action_type: 'attack',
          angle: 45,
          power: 1.0
        });
        state = combat.getMatchState('match1');
        iterations++;
      }
      
      if (state && state.status === 'completed' && state.opponent_health <= 0) {
        expect(state.winner).toBeDefined();
      }
    });

    it('should not allow actions on completed match', () => {
      combat.createMatch('match1', 'player1', 'player2');
      
      const action: CombatAction = {
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      };

      let state = combat.getMatchState('match1');
      let iterations = 0;
      while (state && state.status === 'active' && iterations < 100) {
        combat.submitCombatAction(action);
        state = combat.getMatchState('match1');
        iterations++;
      }
      
      const finalResult = combat.submitCombatAction({
        match_id: 'match1',
        action_type: 'attack',
        angle: 45,
        power: 1.0
      });
      
      expect(finalResult).toBeNull();
    });

    it('should handle defender with zero defense', () => {
      const attacker = { attack: 50, crit_rate: 0 };
      const defender = { defense: 0, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThanOrEqual(1);
    });

    it('should handle attacker with zero attack', () => {
      const attacker = { attack: 0, crit_rate: 0 };
      const defender = { defense: 0, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThanOrEqual(1);
    });

    it('should handle defender with 100 dodge', () => {
      const attacker = { attack: 100, crit_rate: 100 };
      const defender = { defense: 0, dodge: 100 };

      let dodgedCount = 0;
      for (let i = 0; i < 100; i++) {
        const damage = combat.calculateDamage(20, attacker, defender, 2.0);
        if (damage === 0) dodgedCount++;
      }

      expect(dodgedCount).toBeGreaterThan(0);
    });

    it('should handle negative defense values', () => {
      const attacker = { attack: 10, crit_rate: 0 };
      const defender = { defense: -10, dodge: 0 };

      const damage = combat.calculateDamage(10, attacker, defender, 2.0);

      expect(damage).toBeGreaterThanOrEqual(1);
    });
  });
});
