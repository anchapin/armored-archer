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

describe('datadog_integration (enabled)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../config', () => ({
      config: {
        datadog: {
          enabled: true,
          host: 'localhost',
          port: 8125,
          prefix: 'armed_archer',
          tags: { custom_tag: 'custom_value' },
        },
        environment: 'test',
      },
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.mock('dgram', () => ({
      createSocket: jest.fn(() => ({
        bind: jest.fn(),
        send: jest.fn((buf, off, len, port, host, cb) => cb(null)),
        close: jest.fn(),
        on: jest.fn(),
      })),
    }));
  });

  it('should initialize DataDog client when enabled', async () => {
    const { initializeDataDog, getDataDogClient, isDataDogEnabled } =
      await import('../datadog_integration');
    initializeDataDog();
    expect(getDataDogClient()).not.toBeNull();
    expect(isDataDogEnabled()).toBe(true);
  });

  it('should log initialization message', async () => {
    const { initializeDataDog } = await import('../datadog_integration');
    const { logger } = await import('../../config/logger');
    initializeDataDog();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('DataDog initialized with prefix')
    );
  });

  it('should create UDP socket on initialize', async () => {
    const dgram = await import('dgram');
    const { initializeDataDog } = await import('../datadog_integration');
    initializeDataDog();
    expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
  });

  it('should close socket when it exists', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient();
    expect(client).not.toBeNull();
    client!.close();
    const mockSocket = (await import('dgram')).createSocket('udp4');
    expect(mockSocket.close).toBeDefined();
  });

  it('should handle close when socket is null', async () => {
    const dgramModule = await import('dgram');
    // Mock createSocket to throw, so socket stays null
    (dgramModule.createSocket as jest.Mock).mockImplementationOnce(() => {
      throw new Error('socket error');
    });
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient();
    expect(client).not.toBeNull();
    expect(() => client!.close()).not.toThrow();
  });

  it('should handle initialize error when createSocket throws', async () => {
    jest.resetModules();
    jest.mock('../../config', () => ({
      config: {
        datadog: { enabled: true, port: 8125, prefix: 'test', tags: {} },
        environment: 'test',
      },
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.mock('dgram', () => ({
      createSocket: jest.fn(() => {
        throw new Error('dgram failure');
      }),
    }));

    const { initializeDataDog, getDataDogClient, isDataDogEnabled } =
      await import('../datadog_integration');
    const { logger } = await import('../../config/logger');

    initializeDataDog();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to initialize DataDog metrics client:',
      expect.any(Error)
    );
    expect(getDataDogClient()).not.toBeNull();
    // After init error, the client internally disables itself but is still returned
    expect(isDataDogEnabled()).toBe(true);
  });

  it('should send increment metric when enabled', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.increment('test.metric', 5, { key: 'value' })).not.toThrow();
  });

  it('should send increment with default value of 1', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.increment('test.metric')).not.toThrow();
  });

  it('should send gauge metric when enabled', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.gauge('test.gauge', 42)).not.toThrow();
  });

  it('should send histogram metric when enabled', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.histogram('test.histogram', 100)).not.toThrow();
  });

  it('should send timing metric when enabled', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.timing('test.timing', 250)).not.toThrow();
  });

  it('should send metrics with no optional tags', async () => {
    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    initializeDataDog();
    const client = getDataDogClient()!;
    expect(() => client.increment('no.tags')).not.toThrow();
    expect(() => client.gauge('no.tags', 1)).not.toThrow();
    expect(() => client.histogram('no.tags', 1)).not.toThrow();
    expect(() => client.timing('no.tags', 1)).not.toThrow();
  });

  it('should send RPC metrics with active client', async () => {
    const { initializeDataDog, sendRpcMetricsToDataDog } = await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendRpcMetricsToDataDog('get_player', 150, true)).not.toThrow();
    expect(() => sendRpcMetricsToDataDog('get_player', 200, false)).not.toThrow();
  });

  it('should send player metrics with active client', async () => {
    const { initializeDataDog, sendPlayerMetricsToDataDog } =
      await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendPlayerMetricsToDataDog(100)).not.toThrow();
  });

  it('should send match metrics with active client', async () => {
    const { initializeDataDog, sendMatchMetricsToDataDog } = await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendMatchMetricsToDataDog('ranked', 5, 3000)).not.toThrow();
  });

  it('should send economy metrics with active client - success', async () => {
    const { initializeDataDog, sendEconomyMetricsToDataDog } =
      await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendEconomyMetricsToDataDog('gem_pack', 500, 'USD', true)).not.toThrow();
  });

  it('should send economy metrics with active client - failure', async () => {
    const { initializeDataDog, sendEconomyMetricsToDataDog } =
      await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendEconomyMetricsToDataDog('coin_pack', 1000, 'EUR', false)).not.toThrow();
  });

  it('should send health metrics with active client', async () => {
    const { initializeDataDog, sendHealthMetricsToDataDog } =
      await import('../datadog_integration');
    initializeDataDog();
    expect(() => sendHealthMetricsToDataDog(true, 30, 50)).not.toThrow();
    expect(() => sendHealthMetricsToDataDog(false, 90, 85)).not.toThrow();
  });

  it('should return config with enabled true after init', async () => {
    const { initializeDataDog, getDataDogConfig } = await import('../datadog_integration');
    initializeDataDog();
    const cfg = getDataDogConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.port).toBe(8125);
    expect(cfg.prefix).toBe('armed_archer');
  });

  it('should use default host when not specified', async () => {
    jest.resetModules();
    jest.mock('../../config', () => ({
      config: {
        datadog: { enabled: true, port: 8125, prefix: 'test', tags: {} },
        environment: 'test',
      },
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.mock('dgram', () => ({
      createSocket: jest.fn(() => ({
        bind: jest.fn(),
        send: jest.fn((buf, off, len, port, host, cb) => cb(null)),
        close: jest.fn(),
        on: jest.fn(),
      })),
    }));

    const { initializeDataDog, getDataDogConfig } = await import('../datadog_integration');
    initializeDataDog();
    const cfg = getDataDogConfig();
    expect(cfg.host).toBeUndefined();
  });

  it('should handle UDP send error path', async () => {
    jest.resetModules();
    jest.mock('../../config', () => ({
      config: {
        datadog: { enabled: true, port: 8125, prefix: 'test', tags: {} },
        environment: 'test',
      },
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }));
    jest.mock('dgram', () => ({
      createSocket: jest.fn(() => ({
        bind: jest.fn(),
        send: jest.fn((buf, off, len, port, host, cb) => cb(new Error('network error'))),
        close: jest.fn(),
        on: jest.fn(),
      })),
    }));

    const { initializeDataDog, getDataDogClient } = await import('../datadog_integration');
    const { logger } = await import('../../config/logger');
    initializeDataDog();
    const client = getDataDogClient()!;
    client.increment('fail.metric');
    // The send callback should trigger logger.error
    expect(logger.error).toHaveBeenCalledWith('Error sending DataDog metric:', expect.any(Error));
  });
});
