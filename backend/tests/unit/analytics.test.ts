// Unit tests for analytics module - focusing on constants and utilities
import { AnalyticsEventType } from '../../src/modules/analytics';

describe('analytics', () => {
  describe('AnalyticsEventType', () => {
    it('should have session events', () => {
      expect(AnalyticsEventType.SESSION_START).toBe('session_start');
      expect(AnalyticsEventType.SESSION_END).toBe('session_end');
    });

    it('should have tutorial events', () => {
      expect(AnalyticsEventType.TUTORIAL_STARTED).toBe('tutorial_started');
      expect(AnalyticsEventType.TUTORIAL_COMPLETED).toBe('tutorial_completed');
    });

    it('should have PVE events', () => {
      expect(AnalyticsEventType.PVE_STAGE_STARTED).toBe('pve_stage_started');
      expect(AnalyticsEventType.PVE_STAGE_COMPLETED).toBe('pve_stage_completed');
      expect(AnalyticsEventType.PVE_BOSS_DEFEATED).toBe('pve_boss_defeated');
    });

    it('should have PVP events', () => {
      expect(AnalyticsEventType.PVP_MATCH_STARTED).toBe('pvp_match_started');
      expect(AnalyticsEventType.PVP_MATCH_COMPLETED).toBe('pvp_match_completed');
    });

    it('should have store events', () => {
      expect(AnalyticsEventType.STORE_OPENED).toBe('store_opened');
      expect(AnalyticsEventType.PURCHASE_COMPLETED).toBe('purchase_completed');
      expect(AnalyticsEventType.GEM_PURCHASED).toBe('gem_purchased');
    });

    it('should have progression events', () => {
      expect(AnalyticsEventType.GEAR_OBTAINED).toBe('gear_obtained');
      expect(AnalyticsEventType.LEVEL_UP).toBe('level_up');
    });

    it('should have engagement events', () => {
      expect(AnalyticsEventType.FIRST_SESSION).toBe('first_session');
      expect(AnalyticsEventType.DAILY_LOGIN).toBe('daily_login');
      expect(AnalyticsEventType.RETURNING_PLAYER).toBe('returning_player');
    });

    it('should have network events', () => {
      expect(AnalyticsEventType.NETWORK_ERROR).toBe('network_error');
      expect(AnalyticsEventType.RPC_ERROR).toBe('rpc_error');
      expect(AnalyticsEventType.RPC_LATENCY).toBe('rpc_latency');
    });
  });
});
