import {
  validatePayload,
  createValidationErrorResponse,
  ValibotSchemas,
  ZodSchemas,
} from '../validation';

describe('validation', () => {
  describe('ZodSchemas', () => {
    it('should be an alias for ValibotSchemas', () => {
      expect(ZodSchemas).toBe(ValibotSchemas);
    });
  });

  describe('validatePayload', () => {
    describe('happy path', () => {
      it('should validate complete_stage with all required fields', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_01',
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'hard',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({
            stage_id: 'stage_01',
            stage_prefix: 'campaign',
            stars_earned: 3,
            score: 5000,
            difficulty: 'hard',
          });
        }
      });

      it('should validate complete_stage with optional fields', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_01',
          stage_prefix: 'campaign',
          stars_earned: 2,
          score: 3000,
          difficulty: 'nightmare',
          boss_defeated: true,
          boss_id: 'boss_dragon',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.boss_defeated).toBe(true);
          expect(result.data.boss_id).toBe('boss_dragon');
        }
      });

      it('should validate gain_xp with valid data', () => {
        const payload = JSON.stringify({
          xp_amount: 500,
          source: 'pve',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.xp_amount).toBe(500);
          expect(result.data.source).toBe('pve');
        }
      });

      it('should validate submit_combat_action with required fields only', () => {
        const payload = JSON.stringify({
          match_id: 'match_123',
          action_type: 'shoot',
          angle: 3.14,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.match_id).toBe('match_123');
          expect(result.data.action_type).toBe('shoot');
          expect(result.data.angle).toBe(3.14);
        }
      });

      it('should validate submit_combat_action with optional anti-cheat fields', () => {
        const payload = JSON.stringify({
          match_id: 'match_456',
          action_type: 'shoot',
          angle: 0.5,
          power: 0.8,
          requestId: 'a'.repeat(32),
          timestamp: 1700000000000,
          signature: 'b'.repeat(64),
          nonce: 'c'.repeat(32),
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.power).toBe(0.8);
          expect(result.data.requestId).toBe('a'.repeat(32));
        }
      });

      it('should validate track_event with required fields', () => {
        const payload = JSON.stringify({
          event_name: 'level_up',
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.event_name).toBe('level_up');
        }
      });

      it('should validate track_event with optional fields', () => {
        const payload = JSON.stringify({
          event_name: 'purchase_completed',
          properties: { item_id: 'gem_pack_1', price: 9.99 },
          platform: 'ios',
          session_id: 'sess_abc123',
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBe('ios');
          expect(result.data.properties).toEqual({ item_id: 'gem_pack_1', price: 9.99 });
        }
      });

      it('should validate consent with required fields', () => {
        const payload = JSON.stringify({
          analytics_consent: true,
          timestamp: 1700000000000,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.analytics_consent).toBe(true);
          expect(result.data.timestamp).toBe(1700000000000);
        }
      });

      it('should validate consent with optional fields', () => {
        const payload = JSON.stringify({
          analytics_consent: false,
          marketing_consent: true,
          timestamp: 1700000000000,
          version: '2.0',
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.marketing_consent).toBe(true);
          expect(result.data.version).toBe('2.0');
        }
      });

      it('should validate privacy_check with valid operation enum', () => {
        const payload = JSON.stringify({
          data: { user_id: '123', email: 'test@example.com' },
          operation: 'store',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.operation).toBe('store');
        }
      });

      it('should validate privacy_check with optional context', () => {
        const payload = JSON.stringify({
          data: { key: 'value' },
          operation: 'transmit',
          context: 'Sending data to analytics partner',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.context).toBe('Sending data to analytics partner');
        }
      });

      it('should validate health_check with empty object', () => {
        const payload = JSON.stringify({});

        const result = validatePayload(ValibotSchemas.health_check, payload, 'health_check');

        expect(result.success).toBe(true);
      });

      it('should validate create_match with required fields', () => {
        const payload = JSON.stringify({
          match_type: 'ranked',
        });

        const result = validatePayload(ValibotSchemas.create_match, payload, 'create_match');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.match_type).toBe('ranked');
        }
      });

      it('should validate create_match with optional fields', () => {
        const payload = JSON.stringify({
          match_type: 'casual',
          is_punch_up: true,
          target_opponent_id: 'player_42',
        });

        const result = validatePayload(ValibotSchemas.create_match, payload, 'create_match');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.is_punch_up).toBe(true);
          expect(result.data.target_opponent_id).toBe('player_42');
        }
      });

      it('should validate report_player with all fields', () => {
        const payload = JSON.stringify({
          reported_user_id: 'user_99',
          reason: 'harassment',
          match_id: 'match_123',
          additional_info: 'Player was using offensive language',
        });

        const result = validatePayload(ValibotSchemas.report_player, payload, 'report_player');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.reason).toBe('harassment');
          expect(result.data.additional_info).toBe('Player was using offensive language');
        }
      });

      it('should validate validate_purchase with valid data', () => {
        const payload = JSON.stringify({
          product_id: 'com.armoredarcher.gems.medium',
          platform: 'android',
          transaction_receipt: 'receipt_abc123xyz',
        });

        const result = validatePayload(
          ValibotSchemas.validate_purchase,
          payload,
          'validate_purchase'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.product_id).toBe('com.armoredarcher.gems.medium');
          expect(result.data.platform).toBe('android');
        }
      });
    });

    describe('empty string payload', () => {
      it('should treat empty string as empty object for health_check', () => {
        const result = validatePayload(ValibotSchemas.health_check, '', 'health_check');

        expect(result.success).toBe(true);
      });

      it('should treat empty string as empty object for get_player_stats', () => {
        const result = validatePayload(ValibotSchemas.get_player_stats, '', 'get_player_stats');

        expect(result.success).toBe(true);
      });

      it('should fail validation when schema requires fields and payload is empty string', () => {
        const result = validatePayload(ValibotSchemas.complete_stage, '', 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for complete_stage');
        }
      });

      it('should fail validation for gain_xp with empty string', () => {
        const result = validatePayload(ValibotSchemas.gain_xp, '', 'gain_xp');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for gain_xp');
        }
      });
    });

    describe('invalid JSON', () => {
      it('should return error for malformed JSON', () => {
        const result = validatePayload(
          ValibotSchemas.complete_stage,
          '{invalid json}',
          'complete_stage'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Invalid JSON in complete_stage');
        }
      });

      it('should return error for truncated JSON', () => {
        const result = validatePayload(ValibotSchemas.gain_xp, '{"xp_amount": 500', 'gain_xp');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Invalid JSON in gain_xp');
        }
      });

      it('should return error for bare string value', () => {
        const result = validatePayload(
          ValibotSchemas.health_check,
          'not json at all',
          'health_check'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Invalid JSON in health_check');
        }
      });

      it('should return error for JSON array instead of object', () => {
        const result = validatePayload(ValibotSchemas.consent, '[]', 'consent');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for consent');
        }
      });
    });

    describe('missing required fields', () => {
      it('should fail when complete_stage missing stage_id', () => {
        const payload = JSON.stringify({
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for complete_stage');
          expect(result.error).toContain('stage_id');
        }
      });

      it('should fail when gain_xp missing source', () => {
        const payload = JSON.stringify({
          xp_amount: 100,
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for gain_xp');
          expect(result.error).toContain('source');
        }
      });

      it('should fail when submit_combat_action missing action_type', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          angle: 1.5,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('action_type');
        }
      });

      it('should fail when consent missing analytics_consent', () => {
        const payload = JSON.stringify({
          timestamp: 1700000000000,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('analytics_consent');
        }
      });

      it('should fail when privacy_check missing data field', () => {
        const payload = JSON.stringify({
          operation: 'store',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('data');
        }
      });

      it('should fail when validate_purchase missing platform', () => {
        const payload = JSON.stringify({
          product_id: 'com.armoredarcher.gems.small',
          transaction_receipt: 'receipt_123',
        });

        const result = validatePayload(
          ValibotSchemas.validate_purchase,
          payload,
          'validate_purchase'
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('platform');
        }
      });
    });

    describe('wrong types', () => {
      it('should fail when string provided where number expected for stars_earned', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 'three',
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for complete_stage');
        }
      });

      it('should fail when number provided where string expected for stage_id', () => {
        const payload = JSON.stringify({
          stage_id: 123,
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('stage_id');
        }
      });

      it('should fail when string provided where boolean expected for analytics_consent', () => {
        const payload = JSON.stringify({
          analytics_consent: 'yes',
          timestamp: 1700000000000,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('analytics_consent');
        }
      });

      it('should fail when boolean provided where number expected for xp_amount', () => {
        const payload = JSON.stringify({
          xp_amount: true,
          source: 'pve',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('xp_amount');
        }
      });

      it('should fail when object provided where string expected for event_name', () => {
        const payload = JSON.stringify({
          event_name: { name: 'level_up' },
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('event_name');
        }
      });
    });

    describe('out of range values', () => {
      it('should fail when stars_earned exceeds max of 3', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 4,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for complete_stage');
        }
      });

      it('should fail when stars_earned is negative', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: -1,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
      });

      it('should fail when xp_amount is 0 (min is 1)', () => {
        const payload = JSON.stringify({
          xp_amount: 0,
          source: 'pve',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
      });

      it('should fail when xp_amount exceeds max of 1000000', () => {
        const payload = JSON.stringify({
          xp_amount: 1000001,
          source: 'pvp',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
      });

      it('should fail when angle exceeds max (2*pi)', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: 7.0,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(false);
      });

      it('should fail when angle is negative', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: -0.1,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(false);
      });

      it('should fail when stage_id exceeds max length of 100', () => {
        const payload = JSON.stringify({
          stage_id: 'a'.repeat(101),
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
      });

      it('should fail when stage_id is empty string (minLength 1)', () => {
        const payload = JSON.stringify({
          stage_id: '',
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
      });

      it('should fail when score is negative', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 1,
          score: -100,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
      });

      it('should fail when power exceeds max of 1', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: 1.0,
          power: 1.5,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(false);
      });
    });

    describe('enum validation', () => {
      it('should fail when complete_stage has invalid difficulty', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 5000,
          difficulty: 'insane',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for complete_stage');
        }
      });

      it('should fail when gain_xp has invalid source', () => {
        const payload = JSON.stringify({
          xp_amount: 100,
          source: 'crafting',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Validation failed for gain_xp');
        }
      });

      it('should fail when submit_combat_action has invalid action_type', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'dodge',
          angle: 1.0,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(false);
      });

      it('should fail when privacy_check has invalid operation', () => {
        const payload = JSON.stringify({
          data: { key: 'val' },
          operation: 'delete',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(false);
      });

      it('should fail when validate_purchase has invalid product_id', () => {
        const payload = JSON.stringify({
          product_id: 'com.armoredarcher.gems.xlarge',
          platform: 'ios',
          transaction_receipt: 'receipt_123',
        });

        const result = validatePayload(
          ValibotSchemas.validate_purchase,
          payload,
          'validate_purchase'
        );

        expect(result.success).toBe(false);
      });

      it('should fail when validate_purchase has invalid platform', () => {
        const payload = JSON.stringify({
          product_id: 'com.armoredarcher.gems.small',
          platform: 'windows',
          transaction_receipt: 'receipt_123',
        });

        const result = validatePayload(
          ValibotSchemas.validate_purchase,
          payload,
          'validate_purchase'
        );

        expect(result.success).toBe(false);
      });

      it('should fail when report_player has invalid reason', () => {
        const payload = JSON.stringify({
          reported_user_id: 'user_1',
          reason: 'bad_player',
        });

        const result = validatePayload(ValibotSchemas.report_player, payload, 'report_player');

        expect(result.success).toBe(false);
      });

      it('should accept all valid report_player reasons', () => {
        const reasons = [
          'win_trading',
          'match_manipulation',
          'suspicious_win_rate',
          'harassment',
          'exploiting_bugs',
          'other',
        ];

        for (const reason of reasons) {
          const payload = JSON.stringify({
            reported_user_id: 'user_1',
            reason,
          });

          const result = validatePayload(ValibotSchemas.report_player, payload, 'report_player');

          expect(result.success).toBe(true);
        }
      });
    });

    describe('optional fields', () => {
      it('should pass when optional boss_defeated is absent in complete_stage', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 1,
          score: 100,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.boss_defeated).toBeUndefined();
          expect(result.data.boss_id).toBeUndefined();
        }
      });

      it('should pass when optional power is absent in submit_combat_action', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: 2.0,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.power).toBeUndefined();
        }
      });

      it('should pass when optional marketing_consent is absent in consent', () => {
        const payload = JSON.stringify({
          analytics_consent: true,
          timestamp: 1700000000000,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.marketing_consent).toBeUndefined();
        }
      });

      it('should pass when optional match_id is absent in report_player', () => {
        const payload = JSON.stringify({
          reported_user_id: 'user_1',
          reason: 'other',
        });

        const result = validatePayload(ValibotSchemas.report_player, payload, 'report_player');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.match_id).toBeUndefined();
          expect(result.data.additional_info).toBeUndefined();
        }
      });

      it('should pass when optional context is absent in privacy_check', () => {
        const payload = JSON.stringify({
          data: { key: 'val' },
          operation: 'log',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.context).toBeUndefined();
        }
      });

      it('should pass when optional platform is absent in track_event', () => {
        const payload = JSON.stringify({
          event_name: 'daily_login',
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.platform).toBeUndefined();
          expect(result.data.properties).toBeUndefined();
          expect(result.data.session_id).toBeUndefined();
        }
      });
    });

    describe('integer validation', () => {
      it('should fail when stars_earned is a float', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 2.5,
          score: 5000,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(false);
      });

      it('should fail when xp_amount is a float', () => {
        const payload = JSON.stringify({
          xp_amount: 100.5,
          source: 'pve',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(false);
      });

      it('should accept integer values for xp_amount', () => {
        const payload = JSON.stringify({
          xp_amount: 100,
          source: 'pvp',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should accept boundary value stars_earned = 0', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 0,
          score: 0,
          difficulty: 'easy',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
      });

      it('should accept boundary value stars_earned = 3', () => {
        const payload = JSON.stringify({
          stage_id: 'stage_1',
          stage_prefix: 'campaign',
          stars_earned: 3,
          score: 999999,
          difficulty: 'nightmare',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
      });

      it('should accept boundary value xp_amount = 1', () => {
        const payload = JSON.stringify({
          xp_amount: 1,
          source: 'pve',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(true);
      });

      it('should accept boundary value xp_amount = 1000000', () => {
        const payload = JSON.stringify({
          xp_amount: 1000000,
          source: 'pvp',
        });

        const result = validatePayload(ValibotSchemas.gain_xp, payload, 'gain_xp');

        expect(result.success).toBe(true);
      });

      it('should accept angle = 0', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: 0,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(true);
      });

      it('should accept angle near 2*pi', () => {
        const payload = JSON.stringify({
          match_id: 'match_1',
          action_type: 'shoot',
          angle: 6.28318530718,
        });

        const result = validatePayload(
          ValibotSchemas.submit_combat_action,
          payload,
          'submit_combat_action'
        );

        expect(result.success).toBe(true);
      });

      it('should include path info in error messages for nested fields', () => {
        const payload = JSON.stringify({
          data: 'not_an_object',
          operation: 'store',
        });

        const result = validatePayload(ValibotSchemas.privacy_check, payload, 'privacy_check');

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('data');
        }
      });

      it('should handle track_event with empty properties object', () => {
        const payload = JSON.stringify({
          event_name: 'test_event',
          properties: {},
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.properties).toEqual({});
        }
      });

      it('should fail when event_name is empty (minLength 1)', () => {
        const payload = JSON.stringify({
          event_name: '',
        });

        const result = validatePayload(ValibotSchemas.track_event, payload, 'track_event');

        expect(result.success).toBe(false);
      });

      it('should accept 1-char stage_id at boundary', () => {
        const payload = JSON.stringify({
          stage_id: 'a',
          stage_prefix: 'x',
          stars_earned: 1,
          score: 1,
          difficulty: 'medium',
        });

        const result = validatePayload(ValibotSchemas.complete_stage, payload, 'complete_stage');

        expect(result.success).toBe(true);
      });

      it('should fail when timestamp is negative in consent', () => {
        const payload = JSON.stringify({
          analytics_consent: true,
          timestamp: 0,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(false);
      });

      it('should accept timestamp = 1 in consent (minValue 1)', () => {
        const payload = JSON.stringify({
          analytics_consent: true,
          timestamp: 1,
        });

        const result = validatePayload(ValibotSchemas.consent, payload, 'consent');

        expect(result.success).toBe(true);
      });
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should return valid JSON with correct structure', () => {
      const response = createValidationErrorResponse(
        'complete_stage',
        'Validation failed for complete_stage: stage_id: Required'
      );

      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error_code).toBe('VALIDATION_ERROR');
      expect(parsed.rpc_name).toBe('complete_stage');
      expect(parsed.error).toBe('Validation failed for complete_stage: stage_id: Required');
    });

    it('should include the rpc_name in the response', () => {
      const response = createValidationErrorResponse('gain_xp', 'some error');
      const parsed = JSON.parse(response);

      expect(parsed.rpc_name).toBe('gain_xp');
    });

    it('should always set error_code to VALIDATION_ERROR', () => {
      const response = createValidationErrorResponse('health_check', 'error');
      const parsed = JSON.parse(response);

      expect(parsed.error_code).toBe('VALIDATION_ERROR');
    });

    it('should always set success to false', () => {
      const response = createValidationErrorResponse('test_rpc', 'details');
      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
    });

    it('should preserve the error message as-is', () => {
      const errorMsg = 'Validation failed for consent: analytics_consent: Expected boolean';
      const response = createValidationErrorResponse('consent', errorMsg);
      const parsed = JSON.parse(response);

      expect(parsed.error).toBe(errorMsg);
    });

    it('should produce parseable JSON', () => {
      const response = createValidationErrorResponse('test', 'test error');

      expect(() => JSON.parse(response)).not.toThrow();
    });
  });
});
