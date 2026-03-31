"use strict";
/**
 * Mock for cache utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheManager = void 0;
exports.getCacheManager = jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
});
