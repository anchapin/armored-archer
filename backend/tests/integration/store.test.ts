import { testHelper, TestAccount } from './helpers';

describe('Store System Integration Tests', () => {
  let player: TestAccount;

  beforeAll(async () => {
    await testHelper.initialize();
    await testHelper.cleanAllTestData();

    player = await testHelper.createTestAccount('store_player');
  }, 120000);

  afterEach(async () => {
    // Clean up currency and purchases
    await testHelper.deleteStorageObject('player_currency', player.userId, player.userId);
    await testHelper.deleteStorageObject('store_purchases', player.userId, player.userId);
  });

  afterAll(async () => {
    await testHelper.cleanAllTestData();
    await testHelper.cleanup();
  });

  // Helper to call RPC and parse JSON
  async function rpcCall(account: TestAccount, rpcId: string, payload: any): Promise<any> {
    const response = await account.client.rpc(account.session, rpcId, payload);
    return response.payload;
  }

  // Helper to get currency
  async function getCurrency(account: TestAccount): Promise<any> {
    const result = await rpcCall(account, 'armored_archer/get_currency', {});
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  // Helper to set currency
  async function setCurrency(account: TestAccount, gems: number, gold: number): Promise<void> {
    await testHelper.writeStorageObject('player_currency', account.userId, account.userId, {
      user_id: account.userId,
      gems,
      gold,
    });
  }

  describe('rpcGetCurrency', () => {
    test('should return zero currency for new player', async () => {
      const freshPlayer = await testHelper.createTestAccount('fresh_currency');

      const result = await rpcCall(freshPlayer, 'armored_archer/get_currency', {});

      expect(result.gems).toBe(0);
      expect(result.gold).toBe(0);
      expect(result.user_id).toBe(freshPlayer.userId);
    });

    test('should return existing currency balances', async () => {
      await setCurrency(player, 500, 1000);

      const result = await rpcCall(player, 'armored_archer/get_currency', {});

      expect(result.gems).toBe(500);
      expect(result.gold).toBe(1000);
    });

    test('should return only gems if gold not set', async () => {
      await setCurrency(player, 250, 0);

      const result = await rpcCall(player, 'armored_archer/get_currency', {});

      expect(result.gems).toBe(250);
      expect(result.gold).toBe(0);
    });
  });

  describe('rpcValidatePurchase', () => {
    test('should validate small gem bundle purchase', async () => {
      await setCurrency(player, 0, 0);

      const payload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'valid_receipt_123',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.success).toBe(true);
      expect(result.gems_awarded).toBe(100);
      expect(result.new_balance).toBe(100);
      expect(result.product_id).toBe('com.armoredarcher.gems.small');
    });

    test('should validate medium gem bundle purchase', async () => {
      await setCurrency(player, 50, 0);

      const payload = {
        product_id: 'com.armoredarcher.gems.medium',
        platform: 'android',
        transaction_receipt: 'valid_receipt_456',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.success).toBe(true);
      expect(result.gems_awarded).toBe(550);
      expect(result.new_balance).toBe(600); // 50 + 550
    });

    test('should validate large gem bundle purchase', async () => {
      await setCurrency(player, 200, 0);

      const payload = {
        product_id: 'com.armoredarcher.gems.large',
        platform: 'ios',
        transaction_receipt: 'valid_receipt_789',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.success).toBe(true);
      expect(result.gems_awarded).toBe(1200);
      expect(result.new_balance).toBe(1400); // 200 + 1200
    });

    test('should reject invalid product ID', async () => {
      const payload = {
        product_id: 'invalid.product.id',
        platform: 'ios',
        transaction_receipt: 'valid_receipt',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.error).toBe('Invalid product ID');
    });

    test('should validate all available gem bundles', async () => {
      const bundles = [
        'com.armoredarcher.gems.small',
        'com.armoredarcher.gems.medium',
        'com.armoredarcher.gems.large',
      ];

      for (const bundle of bundles) {
        const freshPlayer = await testHelper.createTestAccount(`bundle_${bundle.split('.').pop()}`);
        await setCurrency(freshPlayer, 0, 0);

        const payload = {
          product_id: bundle,
          platform: 'ios',
          transaction_receipt: `receipt_${bundle}`,
        };

        const result = await rpcCall(freshPlayer, 'armored_archer/validate_purchase', payload);
        expect(result.success).toBe(true);
        expect(result.gems_awarded).toBeGreaterThan(0);
      }
    });

    test('should accumulate gems from multiple purchases', async () => {
      // First purchase
      let payload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'receipt_1',
      };
      let result = await rpcCall(player, 'armored_archer/validate_purchase', payload);
      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(100);

      // Second purchase
      payload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'receipt_2',
      };
      result = await rpcCall(player, 'armored_archer/validate_purchase', payload);
      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(200);
    });

    test('should validate receipt parameter is required', async () => {
      const payload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: '',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should validate platform must be ios or android', async () => {
      const payload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'web',
        transaction_receipt: 'receipt',
      };

      const result = await rpcCall(player, 'armored_archer/validate_purchase', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rpcSpendGems', () => {
    test('should spend gems successfully', async () => {
      await setCurrency(player, 500, 0);

      const payload = { amount: 100 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.success).toBe(true);
      expect(result.amount_spent).toBe(100);
      expect(result.new_balance).toBe(400);
    });

    test('should fail when insufficient gems', async () => {
      await setCurrency(player, 50, 0);

      const payload = { amount: 100 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.error).toBe('Insufficient gems');
    });

    test('should spend exact amount requested', async () => {
      await setCurrency(player, 1000, 0);

      const payload = { amount: 375 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(625);
    });

    test('should ensure balance never goes negative', async () => {
      await setCurrency(player, 100, 0);

      const payload = { amount: 150 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.error).toBe('Insufficient gems');

      // Verify balance unchanged
      const currency = await getCurrency(player);
      expect(currency.gems).toBe(100);
    });

    test('should reject zero amount', async () => {
      await setCurrency(player, 100, 0);

      const payload = { amount: 0 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should reject negative amount', async () => {
      await setCurrency(player, 100, 0);

      const payload = { amount: -50 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.error_code).toBe('VALIDATION_ERROR');
    });

    test('should handle spending all gems', async () => {
      await setCurrency(player, 200, 0);

      const payload = { amount: 200 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(0);
    });

    test('should persist spent amount across sessions', async () => {
      await setCurrency(player, 500, 0);

      const payload = { amount: 150 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);
      expect(result.success).toBe(true);
      expect(result.new_balance).toBe(350);

      // Verify persistence by reading storage
      const storageObj = await testHelper.getStorageObject(
        'player_currency',
        player.userId,
        player.userId
      );
      expect(storageObj).not.toBeNull();
      const storedCurrency = JSON.parse(storageObj!.value);
      expect(storedCurrency.gems).toBe(350);
    });

    test('should not affect gold currency', async () => {
      await setCurrency(player, 500, 1000);

      const payload = { amount: 100 };
      const result = await rpcCall(player, 'armored_archer/spend_gems', payload);

      expect(result.success).toBe(true);

      const currency = await getCurrency(player);
      expect(currency.gold).toBe(1000); // Gold unchanged
      expect(currency.gems).toBe(400);
    });
  });

  describe('Purchase and Spend Flow', () => {
    test('should allow purchase followed by spend', async () => {
      // Start with 0 gems
      await setCurrency(player, 0, 0);

      // Purchase gems
      const purchasePayload = {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'receipt_flow',
      };
      const purchaseResult = await rpcCall(
        player,
        'armored_archer/validate_purchase',
        purchasePayload
      );
      expect(purchaseResult.success).toBe(true);
      expect(purchaseResult.new_balance).toBe(100);

      // Spend some gems
      const spendPayload = { amount: 30 };
      const spendResult = await rpcCall(player, 'armored_archer/spend_gems', spendPayload);
      expect(spendResult.success).toBe(true);
      expect(spendResult.new_balance).toBe(70);

      // Check final balance
      const currency = await getCurrency(player);
      expect(currency.gems).toBe(70);
    });

    test('should accumulate from multiple purchases before spending', async () => {
      await setCurrency(player, 0, 0);

      // Buy small bundle
      await rpcCall(player, 'armored_archer/validate_purchase', {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'r1',
      });

      // Buy another small bundle
      await rpcCall(player, 'armored_archer/validate_purchase', {
        product_id: 'com.armoredarcher.gems.small',
        platform: 'ios',
        transaction_receipt: 'r2',
      });

      // Should have 200 gems now
      let currency = await getCurrency(player);
      expect(currency.gems).toBe(200);

      // Spend 150
      await rpcCall(player, 'armored_archer/spend_gems', { amount: 150 });

      // Should have 50 left
      currency = await getCurrency(player);
      expect(currency.gems).toBe(50);
    });
  });
});
