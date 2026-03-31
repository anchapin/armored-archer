import { RPGSystem } from '../../src/modules/rpg_system';

describe('RPGSystem', () => {
  let rpg: RPGSystem;

  beforeEach(() => {
    rpg = new RPGSystem();
  });

  describe('createPlayer', () => {
    it('should create a new player with default stats', () => {
      const player = rpg.createPlayer('user1');

      expect(player.user_id).toBe('user1');
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.currency).toBe(100);
      expect(player.gems).toBe(10);
    });
  });

  describe('getPlayer', () => {
    it('should return player for existing user', () => {
      rpg.createPlayer('user1');
      const player = rpg.getPlayer('user1');

      expect(player).not.toBeNull();
      expect(player?.user_id).toBe('user1');
    });

    it('should return null for non-existing user', () => {
      const player = rpg.getPlayer('nonexistent');
      expect(player).toBeNull();
    });
  });

  describe('addXP', () => {
    it('should add XP to player', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 50);

      expect(player?.xp).toBe(50);
    });

    it('should level up when XP threshold is reached', () => {
      rpg.createPlayer('user1');
      // XP required for level 1 is 100, so 150 XP should level up
      const player = rpg.addXP('user1', 150);

      expect(player?.level).toBe(2);
    });

    it('should not exceed level 100 even with huge XP', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 100000);

      expect(player?.level).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateLevel', () => {
    it('should calculate correct level from total XP', () => {
      const level = rpg.calculateLevel(0);
      expect(level).toBe(1);
    });

    it('should return level 2 for 100 XP', () => {
      const level = rpg.calculateLevel(100);
      expect(level).toBe(2);
    });
  });

  describe('addCurrency', () => {
    it('should add currency to player', () => {
      rpg.createPlayer('user1');
      const player = rpg.addCurrency('user1', 50);

      expect(player?.currency).toBe(150);
    });

    it('should not add currency to non-existing player', () => {
      const player = rpg.addCurrency('nonexistent', 50);

      expect(player).toBeNull();
    });
  });

  describe('spendCurrency', () => {
    it('should spend currency when sufficient balance', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendCurrency('user1', 50);

      expect(success).toBe(true);
    });

    it('should fail when insufficient balance', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendCurrency('user1', 200);

      expect(success).toBe(false);
    });
  });

  describe('addGems', () => {
    it('should add gems to player', () => {
      rpg.createPlayer('user1');
      const player = rpg.addGems('user1', 20);

      expect(player?.gems).toBe(30);
    });
  });

  describe('spendGems', () => {
    it('should spend gems when sufficient balance', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendGems('user1', 5);

      expect(success).toBe(true);
    });

    it('should fail when insufficient gems', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendGems('user1', 100);

      expect(success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user ID', () => {
      const player = rpg.getPlayer('');
      expect(player).toBeNull();
    });

    it('should handle numeric string user ID', () => {
      const player = rpg.createPlayer('12345');
      expect(player.user_id).toBe('12345');
      
      const retrieved = rpg.getPlayer('12345');
      expect(retrieved).not.toBeNull();
    });

    it('should handle negative XP amounts', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', -50);

      expect(player).not.toBeNull();
      expect(player?.xp).toBe(-50);
    });

    it('should handle zero XP amounts', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 0);

      expect(player).not.toBeNull();
      expect(player?.xp).toBe(0);
      expect(player?.level).toBe(1);
    });

    it('should handle negative currency amounts', () => {
      rpg.createPlayer('user1');
      const player = rpg.addCurrency('user1', -50);

      expect(player).not.toBeNull();
      expect(player?.currency).toBe(50);
    });

    it('should handle negative gem amounts', () => {
      rpg.createPlayer('user1');
      const player = rpg.addGems('user1', -5);

      expect(player).not.toBeNull();
      expect(player?.gems).toBe(5);
    });

    it('should handle zero currency spend', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendCurrency('user1', 0);

      expect(success).toBe(true);
    });

    it('should handle zero gems spend', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendGems('user1', 0);

      expect(success).toBe(true);
    });

    it('should handle exact currency spend', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendCurrency('user1', 100);

      expect(success).toBe(true);
      expect(rpg.getPlayer('user1')?.currency).toBe(0);
    });

    it('should handle exact gems spend', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendGems('user1', 10);

      expect(success).toBe(true);
      expect(rpg.getPlayer('user1')?.gems).toBe(0);
    });

    it('should handle over-spending currency (more than balance)', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendCurrency('user1', 150);

      expect(success).toBe(false);
      expect(rpg.getPlayer('user1')?.currency).toBe(100);
    });

    it('should handle over-spending gems (more than balance)', () => {
      rpg.createPlayer('user1');
      const success = rpg.spendGems('user1', 20);

      expect(success).toBe(false);
      expect(rpg.getPlayer('user1')?.gems).toBe(10);
    });

    it('should handle multiple level ups from large XP', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 10000);

      expect(player).not.toBeNull();
      expect(player?.level).toBeGreaterThan(1);
      expect(player?.level).toBeLessThanOrEqual(100);
    });

    it('should handle XP exactly at level boundary', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 100);

      expect(player?.level).toBe(2);
      expect(player?.xp).toBe(0);
    });

    it('should not level up with XP just below threshold', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 99);

      expect(player?.level).toBe(1);
      expect(player?.xp).toBe(99);
    });

    it('should handle getXPRequiredForLevel for level 1', () => {
      const xp = rpg.getXPRequiredForLevel(1);
      expect(xp).toBe(100);
    });

    it('should handle getXPRequiredForLevel for max level', () => {
      const xp = rpg.getXPRequiredForLevel(100);
      expect(xp).toBeGreaterThan(0);
    });

    it('should handle getXPRequiredForLevel for invalid level', () => {
      const xp = rpg.getXPRequiredForLevel(0);
      expect(xp).toBe(66);
    });

    it('should handle calculateLevel for zero XP', () => {
      const level = rpg.calculateLevel(0);
      expect(level).toBe(1);
    });

    it('should handle calculateLevel for very large XP', () => {
      const level = rpg.calculateLevel(1000000);
      expect(level).toBe(22);
    });

    it('should handle adding currency to non-existent player', () => {
      const player = rpg.addCurrency('nonexistent', 50);
      expect(player).toBeNull();
    });

    it('should handle spending currency from non-existent player', () => {
      const success = rpg.spendCurrency('nonexistent', 50);
      expect(success).toBe(false);
    });

    it('should handle adding gems to non-existent player', () => {
      const player = rpg.addGems('nonexistent', 50);
      expect(player).toBeNull();
    });

    it('should handle spending gems from non-existent player', () => {
      const success = rpg.spendGems('nonexistent', 50);
      expect(success).toBe(false);
    });

    it('should maintain xp_to_next_level after level up', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 150);

      expect(player?.level).toBe(2);
      expect(player?.xp_to_next_level).toBeGreaterThan(0);
    });

    it('should reset XP to zero at max level', () => {
      rpg.createPlayer('user1');
      const player = rpg.addXP('user1', 1000000);

      expect(player?.level).toBe(22);
      expect(player?.xp).toBeGreaterThanOrEqual(0);
    });
  });
});
