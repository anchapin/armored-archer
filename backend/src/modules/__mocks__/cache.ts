/**
 * Mock for cache utility
 */

export const getCacheManager = jest.fn().mockReturnValue({
  get: jest.fn().mockReturnValue(undefined),
  set: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true),
});
