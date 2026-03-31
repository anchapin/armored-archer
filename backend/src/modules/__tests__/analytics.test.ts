import { AnalyticsEventType } from '../analytics';

describe('Analytics Event Types', () => {
  test('should have all expected session event types', () => {
    expect(AnalyticsEventType.SESSION_START).toBe('session_start');
    expect(AnalyticsEventType.SESSION_END).toBe('session_end');
  });

  test('should have all expected tutorial event types', () => {
    expect(AnalyticsEventType.TUTORIAL_STARTED).toBe('tutorial_started');
    expect(AnalyticsEventType.TUTORIAL_COMPLETED).toBe('tutorial_completed');
    expect(AnalyticsEventType.TUTORIAL_FAILED).toBe('tutorial_failed');
  });

  test('should have all expected PVE event types', () => {
    expect(AnalyticsEventType.PVE_STAGE_STARTED).toBe('pve_stage_started');
    expect(AnalyticsEventType.PVE_STAGE_COMPLETED).toBe('pve_stage_completed');
    expect(AnalyticsEventType.PVE_STAGE_FAILED).toBe('pve_stage_failed');
    expect(AnalyticsEventType.PVE_BOSS_DEFEATED).toBe('pve_boss_defeated');
  });

  test('should have all expected PVP event types', () => {
    expect(AnalyticsEventType.PVP_MATCH_STARTED).toBe('pvp_match_started');
    expect(AnalyticsEventType.PVP_MATCH_COMPLETED).toBe('pvp_match_completed');
    expect(AnalyticsEventType.PVP_MATCH_ABANDONED).toBe('pvp_match_abandoned');
    expect(AnalyticsEventType.PVP_DISCONNECT).toBe('pvp_disconnect');
  });

  test('should have all expected store event types', () => {
    expect(AnalyticsEventType.STORE_OPENED).toBe('store_opened');
    expect(AnalyticsEventType.PURCHASE_INITIATED).toBe('purchase_initiated');
    expect(AnalyticsEventType.PURCHASE_COMPLETED).toBe('purchase_completed');
    expect(AnalyticsEventType.PURCHASE_FAILED).toBe('purchase_failed');
    expect(AnalyticsEventType.GEM_PURCHASED).toBe('gem_purchased');
    expect(AnalyticsEventType.COSMETIC_PURCHASED).toBe('cosmetic_purchased');
    expect(AnalyticsEventType.SUBSCRIPTION_STARTED).toBe('subscription_started');
  });

  test('should have all expected progression event types', () => {
    expect(AnalyticsEventType.GEAR_OBTAINED).toBe('gear_obtained');
    expect(AnalyticsEventType.GEAR_EQUIPPED).toBe('gear_equipped');
    expect(AnalyticsEventType.TRANSMOG_APPLIED).toBe('transmog_applied');
    expect(AnalyticsEventType.LEVEL_UP).toBe('level_up');
    expect(AnalyticsEventType.ABILITY_UNLOCKED).toBe('ability_unlocked');
    expect(AnalyticsEventType.SEASON_START).toBe('season_start');
    expect(AnalyticsEventType.SEASON_END).toBe('season_end');
  });

  test('should have all expected engagement event types', () => {
    expect(AnalyticsEventType.FIRST_SESSION).toBe('first_session');
    expect(AnalyticsEventType.DAILY_LOGIN).toBe('daily_login');
    expect(AnalyticsEventType.RETURNING_PLAYER).toBe('returning_player');
  });

  test('should have all expected network event types', () => {
    expect(AnalyticsEventType.NETWORK_ERROR).toBe('network_error');
    expect(AnalyticsEventType.RPC_ERROR).toBe('rpc_error');
    expect(AnalyticsEventType.RPC_LATENCY).toBe('rpc_latency');
  });

  test('should have custom event type', () => {
    expect(AnalyticsEventType.CUSTOM).toBe('custom');
  });
});

describe('AnalyticsEventType enum values', () => {
  test('should have correct string values', () => {
    const allEvents = Object.values(AnalyticsEventType);
    for (const event of allEvents) {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    }
  });

  test('should have no duplicates', () => {
    const allEvents = Object.values(AnalyticsEventType);
    const uniqueEvents = new Set(allEvents);
    expect(uniqueEvents.size).toBe(allEvents.length);
  });
});
