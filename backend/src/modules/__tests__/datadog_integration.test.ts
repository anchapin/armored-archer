jest.mock('dgram', () => ({
  createSocket: jest.fn(() => ({
    bind: jest.fn(),
    send: jest.fn((buf, off, len, port, host, cb) => cb(null)),
    close: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('../../config', () => ({
  config: {
    datadog: { enabled: false },
    environment: 'test',
  },
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('datadog_integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should not throw when calling metric functions without client', async () => {
    const {
      sendRpcMetricsToDataDog,
      sendPlayerMetricsToDataDog,
      sendMatchMetricsToDataDog,
      sendEconomyMetricsToDataDog,
      sendHealthMetricsToDataDog,
      getDataDogConfig,
    } = await import('../datadog_integration');

    expect(() => sendRpcMetricsToDataDog('rpc', 100, true)).not.toThrow();
    expect(() => sendPlayerMetricsToDataDog(10)).not.toThrow();
    expect(() => sendMatchMetricsToDataDog('pvp', 5, 5000)).not.toThrow();
    expect(() => sendEconomyMetricsToDataDog('coins', 100, 'USD', true)).not.toThrow();
    expect(() => sendHealthMetricsToDataDog(true, 50, 60)).not.toThrow();
    expect(getDataDogConfig()).toBeDefined();
  });

  it('should return disabled config when not configured', async () => {
    const { getDataDogConfig, isDataDogEnabled } = await import('../datadog_integration');
    const cfg = getDataDogConfig();
    expect(cfg.enabled).toBe(false);
    expect(isDataDogEnabled()).toBe(false);
  });

  it('should return null client when not initialized', async () => {
    const { getDataDogClient } = await import('../datadog_integration');
    expect(getDataDogClient()).toBeNull();
  });

  it('should send player metrics without error', async () => {
    const { sendPlayerMetricsToDataDog } = await import('../datadog_integration');
    expect(() => sendPlayerMetricsToDataDog(42)).not.toThrow();
    expect(() => sendPlayerMetricsToDataDog(0)).not.toThrow();
  });

  it('should send match metrics without error', async () => {
    const { sendMatchMetricsToDataDog } = await import('../datadog_integration');
    expect(() => sendMatchMetricsToDataDog('ranked', 3, 2500)).not.toThrow();
    expect(() => sendMatchMetricsToDataDog('casual', 10, 1000)).not.toThrow();
  });

  it('should send economy metrics for success and failure', async () => {
    const { sendEconomyMetricsToDataDog } = await import('../datadog_integration');
    expect(() => sendEconomyMetricsToDataDog('gem_pack', 500, 'USD', true)).not.toThrow();
    expect(() => sendEconomyMetricsToDataDog('coin_pack', 1000, 'EUR', false)).not.toThrow();
  });

  it('should send health metrics for healthy and unhealthy states', async () => {
    const { sendHealthMetricsToDataDog } = await import('../datadog_integration');
    expect(() => sendHealthMetricsToDataDog(true, 25, 40)).not.toThrow();
    expect(() => sendHealthMetricsToDataDog(false, 95, 90)).not.toThrow();
  });

  it('should handle initializeDataDog when disabled', async () => {
    const { initializeDataDog } = await import('../datadog_integration');
    expect(() => initializeDataDog()).not.toThrow();
  });

  it('should return config copy to prevent mutation', async () => {
    const { getDataDogConfig } = await import('../datadog_integration');
    const cfg1 = getDataDogConfig();
    const cfg2 = getDataDogConfig();
    expect(cfg1).toEqual(cfg2);
    expect(cfg1).not.toBe(cfg2);
  });
});
