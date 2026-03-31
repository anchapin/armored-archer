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
});
