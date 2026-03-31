import { describe, it, expect } from '@jest/globals';
import {
  ValibotSchemas,
  validatePayload,
  createValidationErrorResponse,
  SchemaName,
} from '../validation';

describe('validation module', () => {
  describe('validatePayload', () => {
    it('should validate empty payload with empty schema', () => {
      const result = validatePayload(ValibotSchemas.health_check, '', 'health_check');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it('should parse valid JSON payload', () => {
      const payload = JSON.stringify({ 
        stage_id: 'forest_1', 
        stage_prefix: 'forest',
        stars_earned: 3,
        score: 1500,
        difficulty: 'easy'
      });
      const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stage_id).toBe('forest_1');
        expect(result.data.stars_earned).toBe(3);
      }
    });

    it('should reject invalid JSON payload', () => {
      const result = validatePayload(ValibotSchemas.health_check, 'invalid{json', 'health_check');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid JSON');
      }
    });

    it('should validate field constraints', () => {
      const payload = JSON.stringify({ xp_amount: 0, source: 'pve' });
      const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid value');
      }
    });

    it('should validate enum values', () => {
      const payload = JSON.stringify({ source: 'invalid_source' });
      const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('invalid_source');
      }
    });

    it('should validate gear generation payload', () => {
      const payload = JSON.stringify({ stage_id: 'boss_1', boss_defeated: true });
      const result = validatePayload(ValibotSchemas.generate_gear, payload, 'generate_gear');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stage_id).toBe('boss_1');
        expect(result.data.boss_defeated).toBe(true);
      }
    });

    it('should validate match creation payload', () => {
      const payload = JSON.stringify({ match_type: 'ranked', is_punch_up: true });
      const result = validatePayload(ValibotSchemas.create_match, payload, 'create_match');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.match_type).toBe('ranked');
        expect(result.data.is_punch_up).toBe(true);
      }
    });

    it('should validate purchase payload', () => {
      const payload = JSON.stringify({
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'receipt123',
      });
      const result = validatePayload(ValibotSchemas.validate_purchase, payload, 'validate_purchase');
      expect(result.success).toBe(true);
    });

    it('should validate privacy consent payload', () => {
      const payload = JSON.stringify({ analytics_consent: true, marketing_consent: true, timestamp: 1234567890 });
      const result = validatePayload(ValibotSchemas.consent, payload, 'consent');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analytics_consent).toBe(true);
      }
    });

    it('should validate track_event payload', () => {
      const payload = JSON.stringify({
        event_name: 'level_complete',
        properties: { level: 5, score: 1000 },
        platform: 'ios',
      });
      const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.event_name).toBe('level_complete');
      }
    });

    it('should validate gear slots enum', () => {
      const validSlots = ['weapon', 'armor', 'accessory'];
      for (const slot of validSlots) {
        const payload = JSON.stringify({ gear_id: 'gear_1', slot });
        const result = validatePayload(ValibotSchemas.equip_gear, payload, 'equip_gear');
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid gear slots', () => {
      const payload = JSON.stringify({ gear_id: 'gear_1', slot: 'invalid' });
      const result = validatePayload(ValibotSchemas.equip_gear, payload, 'equip_gear');
      expect(result.success).toBe(false);
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create valid error JSON', () => {
      const response = createValidationErrorResponse('test_rpc', 'Test error message');
      const parsed = JSON.parse(response);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error message');
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
      expect(parsed.rpc_name).toBe('test_rpc');
    });
  });

  describe('ValibotSchemas', () => {
    it('should have all required schemas defined', () => {
      expect(ValibotSchemas.health_check).toBeDefined();
      expect(ValibotSchemas.get_player_stats).toBeDefined();
      expect(ValibotSchemas.complete_stage).toBeDefined();
      expect(ValibotSchemas.gain_xp).toBeDefined();
      expect(ValibotSchemas.allocate_stats).toBeDefined();
      expect(ValibotSchemas.generate_gear).toBeDefined();
      expect(ValibotSchemas.equip_gear).toBeDefined();
      expect(ValibotSchemas.unequip_gear).toBeDefined();
      expect(ValibotSchemas.get_inventory).toBeDefined();
      expect(ValibotSchemas.create_match).toBeDefined();
      expect(ValibotSchemas.validate_purchase).toBeDefined();
      expect(ValibotSchemas.track_event).toBeDefined();
      expect(ValibotSchemas.rollout_check).toBeDefined();
      expect(ValibotSchemas.consent).toBeDefined();
      expect(ValibotSchemas.pii_scan).toBeDefined();
    });

    it('should have gear slots defined', () => {
      const equipPayload = JSON.stringify({ gear_id: 'gear_1', slot: 'weapon' });
      const result = validatePayload(ValibotSchemas.equip_gear, equipPayload, 'equip_gear');
      expect(result.success).toBe(true);
    });

    it('should accept all valid gear slots', () => {
      const slots = ['weapon', 'armor', 'accessory'];
      for (const slot of slots) {
        const payload = JSON.stringify({ gear_id: 'gear_1', slot });
        const result = validatePayload(ValibotSchemas.equip_gear, payload, 'equip_gear');
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid stat names', () => {
      const stats = ['attack', 'defense', 'dodge', 'crit_rate'];
      for (const stat of stats) {
        const payload = JSON.stringify({ stat_name: stat, points: 5 });
        const result = validatePayload(ValibotSchemas.allocate_stats, payload, 'allocate_stats');
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid match types', () => {
      const matchTypes = ['ranked', 'casual'];
      for (const matchType of matchTypes) {
        const payload = JSON.stringify({ match_type: matchType });
        const result = validatePayload(ValibotSchemas.create_match, payload, 'create_match');
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid difficulty levels', () => {
      const difficulties = ['easy', 'medium', 'hard', 'nightmare'];
      for (const difficulty of difficulties) {
        const payload = JSON.stringify({ stage_id: 'test', difficulty, boss_defeated: false });
        const result = validatePayload(ValibotSchemas.stage_complete, payload, 'stage_complete');
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid platforms', () => {
      const platforms = ['ios', 'android'];
      for (const platform of platforms) {
        const payload = JSON.stringify({
          product_id: 'com.armoredarcher.gems.small',
          platform,
          transaction_receipt: 'receipt',
        });
        const result = validatePayload(ValibotSchemas.validate_purchase, payload, 'validate_purchase');
        expect(result.success).toBe(true);
      }
    });
  });
});
