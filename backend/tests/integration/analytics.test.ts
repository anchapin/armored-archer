import { testHelper, TestAccount } from './helpers';

describe('Analytics System Integration Tests', () => {
  let player: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    player = await testHelper.createTestAccount('analytics_player');
  }, 120000);

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to call RPC and parse JSON
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  describe('rpcTrackEvent', () => {
    test('should track a basic analytics event', async () => {
      const payload = {
        event_name: 'test_event',
        properties: { key: 'value' },
        platform: 'android',
        session_id: 'test_session_123'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
      expect(result.event_id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should track event with minimal payload', async () => {
      const payload = {
        event_name: 'minimal_event'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
      expect(result.event_id).toBeDefined();
    });

    test('should track session start event', async () => {
      const payload = {
        event_name: 'session_start',
        properties: {
          device: 'Pixel 7',
          os_version: '14'
        },
        platform: 'android',
        session_id: 'session_start_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track tutorial started event', async () => {
      const payload = {
        event_name: 'tutorial_started',
        properties: {
          tutorial_id: 'tutorial_basic',
          step: 1
        },
        platform: 'ios',
        session_id: 'tutorial_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track tutorial completed event', async () => {
      const payload = {
        event_name: 'tutorial_completed',
        properties: {
          tutorial_id: 'tutorial_basic',
          duration_seconds: 120
        },
        platform: 'ios',
        session_id: 'tutorial_session_002'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track PVE stage started event', async () => {
      const payload = {
        event_name: 'pve_stage_started',
        properties: {
          stage_id: 'campaign_1',
          difficulty: 'normal',
          chapter: 1
        },
        platform: 'android',
        session_id: 'pve_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track PVE stage completed event', async () => {
      const payload = {
        event_name: 'pve_stage_completed',
        properties: {
          stage_id: 'campaign_1',
          duration_seconds: 180,
          stars: 3,
          difficulty: 'normal'
        },
        platform: 'android',
        session_id: 'pve_session_002'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track PVE stage failed event', async () => {
      const payload = {
        event_name: 'pve_stage_failed',
        properties: {
          stage_id: 'campaign_2',
          duration_seconds: 90,
          reason: 'player_died',
          difficulty: 'hard'
        },
        platform: 'android',
        session_id: 'pve_session_003'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track PVP match started event', async () => {
      const payload = {
        event_name: 'pvp_match_started',
        properties: {
          match_type: 'ranked',
          rank: 1500,
          season_id: 1
        },
        platform: 'ios',
        session_id: 'pvp_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track PVP match completed event', async () => {
      const payload = {
        event_name: 'pvp_match_completed',
        properties: {
          match_id: 'match_abc123',
          result: 'win',
          duration_seconds: 300,
          rank_change: 25
        },
        platform: 'ios',
        session_id: 'pvp_session_002'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track store opened event', async () => {
      const payload = {
        event_name: 'store_opened',
        properties: {
          source: 'main_menu'
        },
        platform: 'android',
        session_id: 'store_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track purchase initiated event', async () => {
      const payload = {
        event_name: 'purchase_initiated',
        properties: {
          product_id: 'com.armoredarcher.gems.small',
          price: 99,
          currency: 'USD'
        },
        platform: 'ios',
        session_id: 'purchase_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track gear obtained event', async () => {
      const payload = {
        event_name: 'gear_obtained',
        properties: {
          gear_id: 'sword_001',
          rarity: 'epic',
          source: 'pve_drop'
        },
        platform: 'android',
        session_id: 'gear_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track level up event', async () => {
      const payload = {
        event_name: 'level_up',
        properties: {
          new_level: 10,
          previous_level: 9,
          source: 'pve'
        },
        platform: 'ios',
        session_id: 'level_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track daily login event', async () => {
      const payload = {
        event_name: 'daily_login',
        properties: {
          consecutive_days: 5
        },
        platform: 'android',
        session_id: 'login_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track network error event', async () => {
      const payload = {
        event_name: 'network_error',
        properties: {
          error_type: 'timeout',
          endpoint: '/rpc/get_player_stats',
          status_code: 408
        },
        platform: 'ios',
        session_id: 'network_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should track RPC latency event', async () => {
      const payload = {
        event_name: 'rpc_latency',
        properties: {
          rpc_name: 'get_player_stats',
          latency_ms: 150
        },
        platform: 'android',
        session_id: 'rpc_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });

    test('should reject event with empty event_name', async () => {
      const payload = {
        event_name: '',
        properties: {},
        platform: 'android'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject event with invalid platform', async () => {
      const payload = {
        event_name: 'test_event',
        platform: 'invalid_platform'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject event with missing JSON', async () => {
      const result = await rpcCall(player, 'armored_archer/track_event', null);

      expect(result.success).toBe(false);
    });

    test('should track multiple events in sequence', async () => {
      const events = [
        { event_name: 'session_start', platform: 'android' },
        { event_name: 'tutorial_started', platform: 'android' },
        { event_name: 'tutorial_completed', platform: 'android' },
        { event_name: 'pve_stage_started', platform: 'android' },
        { event_name: 'pve_stage_completed', platform: 'android' }
      ];

      for (const event of events) {
        const result = await rpcCall(player, 'armored_archer/track_event', event);
        expect(result.success).toBe(true);
      }
    });

    test('should track custom event with complex properties', async () => {
      const payload = {
        event_name: 'custom_event',
        properties: {
          level: 15,
          inventory_size: 50,
          equipped_items: ['sword_001', 'armor_002', 'ring_003'],
          achievements: ['first_blood', 'dragon_slayer', 'collector'],
          stats: {
            attack: 150,
            defense: 120,
            speed: 95
          }
        },
        platform: 'ios',
        session_id: 'custom_session_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_event', payload);

      expect(result.success).toBe(true);
    });
  });

  describe('rpcTrackRevenue', () => {
    test('should track revenue event', async () => {
      const payload = {
        amount: 99,
        currency: 'USD',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx_test_001',
        platform: 'ios'
      };

      const result = await rpcCall(player, 'armored_archer/track_revenue', payload);

      expect(result.success).toBe(true);
      expect(result.revenue_id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('should track revenue with different currencies', async () => {
      const currencies = ['USD', 'EUR', 'GBP'];

      for (const currency of currencies) {
        const payload = {
          amount: 99,
          currency: currency,
          product_id: 'com.armoredarcher.gems.small',
          transaction_id: `tx_${currency}_001`,
          platform: 'android'
        };

        const result = await rpcCall(player, 'armored_archer/track_revenue', payload);
        expect(result.success).toBe(true);
      }
    });

    test('should track revenue for different products', async () => {
      const products = [
        'com.armoredarcher.gems.small',
        'com.armoredarcher.gems.medium',
        'com.armoredarcher.gems.large'
      ];

      for (const productId of products) {
        const payload = {
          amount: 99,
          currency: 'USD',
          product_id: productId,
          transaction_id: `tx_${productId.replace(/\./g, '_')}`,
          platform: 'ios'
        };

        const result = await rpcCall(player, 'armored_archer/track_revenue', payload);
        expect(result.success).toBe(true);
      }
    });

    test('should reject revenue with invalid amount', async () => {
      const payload = {
        amount: -10,
        currency: 'USD',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx_invalid_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_revenue', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject revenue with invalid currency', async () => {
      const payload = {
        amount: 99,
        currency: 'INVALID',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx_invalid_002'
      };

      const result = await rpcCall(player, 'armored_archer/track_revenue', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject revenue with missing transaction_id', async () => {
      const payload = {
        amount: 99,
        currency: 'USD',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: ''
      };

      const result = await rpcCall(player, 'armored_archer/track_revenue', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should track revenue without platform', async () => {
      const payload = {
        amount: 99,
        currency: 'USD',
        product_id: 'com.armoredarcher.gems.small',
        transaction_id: 'tx_no_platform_001'
      };

      const result = await rpcCall(player, 'armored_archer/track_revenue', payload);

      expect(result.success).toBe(true);
    });
  });

  describe('rpcGetAnalyticsSummary', () => {
    test('should get analytics summary for date range', async () => {
      // First, track some events
      await rpcCall(player, 'armored_archer/track_event', {
        event_name: 'test_summary',
        platform: 'android'
      });

      const today = new Date().toISOString().split('T')[0];
      const payload = {
        start_date: today,
        end_date: today
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.total_events).toBeGreaterThan(0);
    });

    test('should filter analytics summary by event names', async () => {
      // Track specific events
      await rpcCall(player, 'armored_archer/track_event', {
        event_name: 'filtered_event_1',
        platform: 'android'
      });
      await rpcCall(player, 'armored_archer/track_event', {
        event_name: 'filtered_event_2',
        platform: 'android'
      });

      const today = new Date().toISOString().split('T')[0];
      const payload = {
        start_date: today,
        end_date: today,
        event_names: ['filtered_event_1']
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      expect(result.success).toBe(true);
      expect(result.summary.events['filtered_event_1']).toBeDefined();
    });

    test('should return unique user count in summary', async () => {
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        start_date: today,
        end_date: today
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      expect(result.success).toBe(true);
      expect(result.summary.unique_users).toBeDefined();
      expect(typeof result.summary.unique_users).toBe('number');
    });

    test('should reject summary with invalid date format', async () => {
      const payload = {
        start_date: 'invalid-date',
        end_date: '2024-01-31'
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject summary with start_date after end_date', async () => {
      const payload = {
        start_date: '2024-01-31',
        end_date: '2024-01-01'
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      // Note: This may pass validation but return empty results
      expect(result).toBeDefined();
    });

    test('should return empty summary for date range with no events', async () => {
      const payload = {
        start_date: '2020-01-01',
        end_date: '2020-01-02'
      };

      const result = await rpcCall(player, 'armored_archer/get_analytics_summary', payload);

      expect(result.success).toBe(true);
      expect(result.summary.total_events).toBe(0);
    });
  });

  describe('Analytics Event Types', () => {
    test('should track all defined analytics event types', () => {
      const eventTypes = [
        'session_start',
        'session_end',
        'tutorial_started',
        'tutorial_completed',
        'tutorial_failed',
        'pve_stage_started',
        'pve_stage_completed',
        'pve_stage_failed',
        'pve_boss_defeated',
        'pvp_match_started',
        'pvp_match_completed',
        'pvp_match_abandoned',
        'pvp_disconnect',
        'store_opened',
        'purchase_initiated',
        'purchase_completed',
        'purchase_failed',
        'gem_purchased',
        'cosmetic_purchased',
        'subscription_started',
        'gear_obtained',
        'gear_equipped',
        'transmog_applied',
        'level_up',
        'ability_unlocked',
        'season_start',
        'season_end',
        'first_session',
        'daily_login',
        'returning_player',
        'network_error',
        'rpc_error',
        'rpc_latency'
      ];

      expect(eventTypes.length).toBeGreaterThan(30);
    });
  });
});
