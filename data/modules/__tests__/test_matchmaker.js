"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var nakama_1 = require("../../__mocks__/nakama");
var matchmaker_1 = require("../matchmaker");
var mockCtx = (0, nakama_1.createMockContext)();
var mockLogger = (0, nakama_1.createMockLogger)();
var mockNk = (0, nakama_1.createMockNakama)();
function createMockPlayerStats(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return tslib_1.__assign({ level: 5, xp: 500, stats: { attack: 20, defense: 15, dodge: 10, crit_rate: 8 } }, overrides);
}
describe('rpcCreateMatch', function () {
    beforeEach(function () {
        jest.clearAllMocks();
    });
    test('should create a match with target opponent', function () {
        var playerStats = createMockPlayerStats();
        var targetPlayerStats = createMockPlayerStats();
        mockNk.storageRead = jest.fn(function (objects) {
            console.log('storageRead called with:', objects);
            if (objects[0].key === 'test-user-123') {
                console.log('Returning player stats for test-user-123');
                return [
                    {
                        collection: 'player_stats',
                        key: 'test-user-123',
                        userId: 'test-user-123',
                        value: JSON.stringify(playerStats),
                        version: '1',
                        permissionRead: 1,
                        permissionWrite: 1,
                        createTime: 1,
                        updateTime: 1,
                    },
                ];
            }
            else if (objects[0].key === 'target-user') {
                console.log('Returning player stats for target-user');
                return [
                    {
                        collection: 'player_stats',
                        key: 'target-user',
                        userId: 'target-user',
                        value: JSON.stringify(targetPlayerStats),
                        version: '1',
                        permissionRead: 1,
                        permissionWrite: 1,
                        createTime: 1,
                        updateTime: 1,
                    },
                ];
            }
            console.log('No matching key found');
            return [];
        });
        var payload = JSON.stringify({
            match_type: 'ranked',
            target_opponent_id: 'target-user',
        });
        console.log('Calling rpcCreateMatch...');
        var result = (0, matchmaker_1.rpcCreateMatch)(mockCtx, mockLogger, mockNk, payload);
        console.log('Result:', typeof result, result);
        if (result) {
            var parsed = JSON.parse(result);
            console.log('Parsed result:', parsed);
            expect(parsed.success).toBe(true);
            expect(parsed.match.opponent_id).toBe('target-user');
        }
        else {
            expect(result).toBeDefined();
        }
    });
});
