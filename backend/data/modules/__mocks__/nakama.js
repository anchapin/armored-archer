"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockNakama = exports.createMockContext = exports.createMockLogger = void 0;
var tslib_1 = require("tslib");
var createMockLogger = function () { return ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}); };
exports.createMockLogger = createMockLogger;
var createMockContext = function (overrides) { return (tslib_1.__assign({ userId: 'test-user-123', username: 'TestPlayer', variables: {}, env: {}, sessionExpiry: Date.now() + 3600000 }, overrides)); };
exports.createMockContext = createMockContext;
var createMockNakama = function () {
    var storage = new Map();
    var storageWriteCalls = [];
    return {
        storageRead: jest.fn(function (objects) {
            // console.log('storageRead called with:', JSON.stringify(objects));
            return objects
                .map(function (obj) {
                var _a;
                var userId = (_a = obj.userId) !== null && _a !== void 0 ? _a : 'test-user-123';
                var key = "".concat(obj.collection, ":").concat(obj.key);
                var value = storage.get(key);
                // console.log(`Reading key ${key}, found: ${value === undefined ? 'undefined' : 'value'}`);
                if (value === undefined)
                    return null;
                return {
                    collection: obj.collection,
                    key: obj.key,
                    userId: userId,
                    value: value,
                    version: '1',
                    permissionRead: 1,
                    permissionWrite: 1,
                    createTime: Date.now(),
                    updateTime: Date.now(),
                };
            })
                .filter(Boolean);
        }),
        notificationSend: jest.fn(),
        storageWrite: jest.fn(function (objects) {
            objects.forEach(function (obj) {
                var _a;
                var userId = (_a = obj.userId) !== null && _a !== void 0 ? _a : 'test-user-123';
                var key = "".concat(obj.collection, ":").concat(obj.key);
                storage.set(key, obj.value);
                storageWriteCalls.push({
                    collection: obj.collection,
                    key: obj.key,
                    userId: userId,
                    value: obj.value,
                    version: '1',
                    permissionRead: 1,
                    permissionWrite: 1,
                    createTime: Date.now(),
                    updateTime: Date.now(),
                });
            });
        }),
        storageList: jest.fn(function (_userId, _collection, _limit, _cursor, _prefix) {
            return [];
        }),
        leaderboardRecordList: jest.fn(function (_id, _ownerIds, _limit, _cursor, _overrideLimit) {
            return [];
        }),
        leaderboardRecordWrite: jest.fn(function (_id, ownerId, _username, score, _subScore, _metadata) {
            return { ownerId: ownerId, score: score };
        }),
        leaderboardCreate: jest.fn(function (id, _authoritative, _sortOrder, _operator, _reset, _metadata) {
            return { id: id };
        }),
        walletUpdate: jest.fn(function (_userId, _changes) {
            return { updated: true };
        }),
    };
};
exports.createMockNakama = createMockNakama;
