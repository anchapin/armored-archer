import { initAntiCheatCleanup, stopAntiCheatCleanup } from '../anti_cheat';

jest.mock('../../config/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('anti-cheat cleanup lifecycle', () => {
  afterEach(() => {
    stopAntiCheatCleanup();
    jest.restoreAllMocks();
  });

  test('importing in development creates no interval', () => {
    const previous = process.env.NODE_ENV;
    const spy = jest.spyOn(global, 'setInterval');
    try {
      process.env.NODE_ENV = 'development';
      jest.isolateModules(() => { require('../anti_cheat'); });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  test('starts once, unrefs the timer, stops safely and can restart', () => {
    const spy = jest.spyOn(global, 'setInterval');
    const first = initAntiCheatCleanup();
    expect(first.hasRef()).toBe(false);
    expect(initAntiCheatCleanup()).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000);
    stopAntiCheatCleanup();
    stopAntiCheatCleanup();
    const second = initAntiCheatCleanup();
    expect(second).not.toBe(first);
    expect(second.hasRef()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
