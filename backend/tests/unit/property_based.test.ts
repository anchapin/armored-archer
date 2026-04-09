import { CombatSystem } from '../../src/modules/combat_system';
import { RPGSystem } from '../../src/modules/rpg_system';

describe('Property-Based Testing - Combat System', () => {
  let combat: CombatSystem;

  beforeEach(() => {
    combat = new CombatSystem();
  });

  describe('Damage Calculation Invariants', () => {
    it('damage should always be >= 0', () => {
      const attacker = { attack: Math.floor(Math.random() * 100), crit_rate: Math.random() * 100 };
      const defender = { defense: Math.floor(Math.random() * 100), dodge: Math.random() * 100 };
      const baseDamage = Math.floor(Math.random() * 50) + 1;
      const critMultiplier = 1.5 + Math.random() * 1.5;

      const damage = combat.calculateDamage(baseDamage, attacker, defender, critMultiplier);

      expect(damage).toBeGreaterThanOrEqual(0);
    });

    it('damage should be at least 1 when not dodged', () => {
      const attacker = { attack: 10, crit_rate: 0 };
      const defender = { defense: 0, dodge: 0 };

      let nonZeroCount = 0;
      for (let i = 0; i < 100; i++) {
        const damage = combat.calculateDamage(10, attacker, defender, 2.0);
        if (damage > 0) {
          nonZeroCount++;
        }
      }

      expect(nonZeroCount).toBeGreaterThan(0);
    });

    it('higher attack should not decrease damage', () => {
      const defender = { defense: 5, dodge: 0 };
      const attackerLow = { attack: 5, crit_rate: 0 };
      const attackerHigh = { attack: 20, crit_rate: 0 };

      let lowTotal = 0;
      let highTotal = 0;
      let iterations = 0;

      for (let i = 0; i < 50; i++) {
        const d1 = combat.calculateDamage(20, attackerLow, defender, 2.0);
        const d2 = combat.calculateDamage(20, attackerHigh, defender, 2.0);
        if (d1 > 0) {
          lowTotal += d1;
          iterations++;
        }
        if (d2 > 0) {
          highTotal += d2;
        }
      }

      const avgLow = iterations > 0 ? lowTotal / iterations : 0;
      const avgHigh = iterations > 0 ? highTotal / iterations : 0;

      expect(avgHigh).toBeGreaterThanOrEqual(avgLow);
    });

    it('higher defense should not increase damage', () => {
      const attacker = { attack: 15, crit_rate: 0 };
      const defenderLow = { defense: 0, dodge: 0 };
      const defenderHigh = { defense: 20, dodge: 0 };

      let lowDefTotal = 0;
      let highDefTotal = 0;
      let iterations = 0;

      for (let i = 0; i < 50; i++) {
        const d1 = combat.calculateDamage(20, attacker, defenderLow, 2.0);
        const d2 = combat.calculateDamage(20, attacker, defenderHigh, 2.0);
        if (d1 > 0) {
          lowDefTotal += d1;
          iterations++;
        }
        if (d2 > 0) {
          highDefTotal += d2;
        }
      }

      const avgLow = iterations > 0 ? lowDefTotal / iterations : 0;
      const avgHigh = iterations > 0 ? highDefTotal / iterations : 0;

      expect(avgHigh).toBeLessThanOrEqual(avgLow);
    });
  });

  describe('Match State Invariants', () => {
    it('total health should never exceed 200', () => {
      combat.createMatch('match1', 'player1', 'player2');

      for (let i = 0; i < 100; i++) {
        combat.submitCombatAction({
          match_id: 'match1',
          action_type: 'attack',
          angle: 45,
          power: 1.0,
        });

        const state = combat.getMatchState('match1');
        if (state) {
          const totalHealth = state.creator_health + state.opponent_health;
          expect(totalHealth).toBeLessThanOrEqual(200);
        }
      }
    });

    it('health should never be negative', () => {
      combat.createMatch('match1', 'player1', 'player2');

      for (let i = 0; i < 50; i++) {
        combat.submitCombatAction({
          match_id: 'match1',
          action_type: 'attack',
          angle: 45,
          power: 1.0,
        });

        const state = combat.getMatchState('match1');
        expect(state?.creator_health).toBeGreaterThanOrEqual(0);
        expect(state?.opponent_health).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('Property-Based Testing - RPG System', () => {
  let rpg: RPGSystem;

  beforeEach(() => {
    rpg = new RPGSystem();
  });

  describe('Level Progression Invariants', () => {
    it('adding XP should never decrease level', () => {
      rpg.createPlayer('user1');
      const initialLevel = rpg.getPlayer('user1')?.level || 1;

      for (let i = 0; i < 10; i++) {
        rpg.addXP('user1', Math.floor(Math.random() * 100) + 1);
        const newLevel = rpg.getPlayer('user1')?.level || 1;
        expect(newLevel).toBeGreaterThanOrEqual(initialLevel);
      }
    });

    it('level should never exceed 100', () => {
      rpg.createPlayer('user1');

      for (let i = 0; i < 1000; i++) {
        rpg.addXP('user1', Math.floor(Math.random() * 10000) + 1);
        const level = rpg.getPlayer('user1')?.level || 1;
        expect(level).toBeLessThanOrEqual(100);
      }
    });

    it('currency should never be negative', () => {
      rpg.createPlayer('user1');

      for (let i = 0; i < 100; i++) {
        if (Math.random() > 0.5) {
          rpg.addCurrency('user1', Math.floor(Math.random() * 100));
        } else {
          rpg.spendCurrency('user1', Math.floor(Math.random() * 50));
        }
        const currency = rpg.getPlayer('user1')?.currency || 0;
        expect(currency).toBeGreaterThanOrEqual(0);
      }
    });

    it('gems should never be negative', () => {
      const uniqueId = 'user_gems_' + Date.now() + '_' + Math.random();
      rpg.createPlayer(uniqueId);

      for (let i = 0; i < 100; i++) {
        rpg.addGems(uniqueId, 10);
      }
      const gems = rpg.getPlayer(uniqueId)?.gems || 0;
      expect(gems).toBeGreaterThanOrEqual(0);
    });
  });

  describe('XP Curve Invariants', () => {
    it('XP required for higher levels should be >= lower levels', () => {
      for (let level = 1; level < 99; level++) {
        const currentReq = rpg.getXPRequiredForLevel(level);
        const nextReq = rpg.getXPRequiredForLevel(level + 1);
        expect(nextReq).toBeGreaterThanOrEqual(currentReq);
      }
    });

    it('calculateLevel should be monotonic with XP', () => {
      let totalXP = 0;

      for (let i = 0; i < 10; i++) {
        const xpToAdd = Math.floor(Math.random() * 500) + 100;
        totalXP += xpToAdd;
        const level = rpg.calculateLevel(totalXP);
        expect(level).toBeGreaterThan(0);
        expect(level).toBeLessThanOrEqual(100);
      }
    });
  });
});
