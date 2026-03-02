import { createMockLogger, createMockContext, createMockNakama } from "../../__mocks__/nakama";
import { 
  rpcValidatePurchase, 
  rpcGetCurrency, 
  rpcSpendGems,
  PlayerCurrency,
  GEM_BUNDLES
} from "../store";
import { Runtime } from "../../types/nakama";

describe('store', () => {
  let mockLogger: Runtime.Logger;
  let mockCtx: Runtime.Context;
  let mockNk: Runtime.Nakama;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockCtx = createMockContext({ userId: "test-user" });
    mockNk = createMockNakama();
    jest.clearAllMocks();
  });

  const createMockCurrency = (overrides?: Partial<PlayerCurrency>): PlayerCurrency => ({
    user_id: "test-user",
    gems: 100,
    gold: 500,
    ...overrides,
  });

  describe('rpcValidatePurchase', () => {
    it('should validate purchase and add gems', () => {
      const currency = createMockCurrency();
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_currency",
        key: "test-user",
        value: JSON.stringify(currency)
      }]);

      const payload = JSON.stringify({
        product_id: "com.armoredarcher.gems.small",
        platform: "ios",
        transaction_receipt: "base64receipt"
      });
      const result = rpcValidatePurchase(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.gems_awarded).toBe(100);
      expect(parsed.product_id).toBe("com.armoredarcher.gems.small");
    });

    it('should return error for invalid product ID', () => {
      const payload = JSON.stringify({
        product_id: "invalid.product.id",
        platform: "ios",
        transaction_receipt: "receipt"
      });
      const result = rpcValidatePurchase(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toContain("Invalid option");
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({
        product_id: 123,
        platform: "invalid"
      });
      const result = rpcValidatePurchase(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe("VALIDATION_ERROR");
    });
  });

  describe('rpcGetCurrency', () => {
    it('should return player currency', () => {
      const currency = createMockCurrency({ gems: 500, gold: 1000 });
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_currency",
        key: "test-user",
        value: JSON.stringify(currency)
      }]);

      const payload = JSON.stringify({});
      const result = rpcGetCurrency(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gems).toBe(500);
      expect(parsed.gold).toBe(1000);
    });

    it('should return default currency when none exists', () => {
      mockNk.storageRead = jest.fn().mockReturnValue([]);

      const payload = JSON.stringify({});
      const result = rpcGetCurrency(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.gems).toBe(0);
      expect(parsed.gold).toBe(0);
    });
  });

  describe('rpcSpendGems', () => {
    it('should spend gems successfully', () => {
      const currency = createMockCurrency({ gems: 500 });
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_currency",
        key: "test-user",
        value: JSON.stringify(currency)
      }]);

      const payload = JSON.stringify({ amount: 100 });
      const result = rpcSpendGems(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.new_balance).toBe(400);
      expect(parsed.amount_spent).toBe(100);
    });

    it('should return error when insufficient gems', () => {
      const currency = createMockCurrency({ gems: 50 });
      mockNk.storageRead = jest.fn().mockReturnValue([{
        collection: "player_currency",
        key: "test-user",
        value: JSON.stringify(currency)
      }]);

      const payload = JSON.stringify({ amount: 100 });
      const result = rpcSpendGems(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("Insufficient gems");
    });

    it('should validate input payload', () => {
      const payload = JSON.stringify({ amount: -10 });
      const result = rpcSpendGems(mockCtx, mockLogger, mockNk, payload);
      const parsed = JSON.parse(result);

      expect(parsed.error_code).toBe("VALIDATION_ERROR");
    });
  });

  describe('GEM_BUNDLES', () => {
    it('should have correct gem bundles defined', () => {
      expect(GEM_BUNDLES["com.armoredarcher.gems.small"]).toBeDefined();
      expect(GEM_BUNDLES["com.armoredarcher.gems.medium"]).toBeDefined();
      expect(GEM_BUNDLES["com.armoredarcher.gems.large"]).toBeDefined();
    });

    it('should have correct gem amounts', () => {
      expect(GEM_BUNDLES["com.armoredarcher.gems.small"].gem_amount).toBe(100);
      expect(GEM_BUNDLES["com.armoredarcher.gems.medium"].gem_amount).toBe(550);
      expect(GEM_BUNDLES["com.armoredarcher.gems.large"].gem_amount).toBe(1200);
    });

    it('should have correct prices', () => {
      expect(GEM_BUNDLES["com.armoredarcher.gems.small"].price_usd).toBe(0.99);
      expect(GEM_BUNDLES["com.armoredarcher.gems.medium"].price_usd).toBe(4.99);
      expect(GEM_BUNDLES["com.armoredarcher.gems.large"].price_usd).toBe(9.99);
    });
  });
});
