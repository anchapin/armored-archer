"use strict";
/**
 * Mock for circuit breaker utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCircuitBreaker = exports.getCircuitBreakerStats = exports.withCircuitBreaker = void 0;
var tslib_1 = require("tslib");
// Use jest.doMock for proper hoisting
exports.withCircuitBreaker = jest.fn(function (_serviceName, fn) { return tslib_1.__awaiter(void 0, void 0, void 0, function () {
    return tslib_1.__generator(this, function (_a) {
        return [2 /*return*/, fn()];
    });
}); });
exports.getCircuitBreakerStats = jest.fn();
exports.resetCircuitBreaker = jest.fn();
