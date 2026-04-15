"use strict";
/**
 * Product Analytics Module
 * @fileoverview Handles analytics event collection, storage, and forwarding for the game.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEventType = void 0;
exports.registerAnalyticsEndpoints = registerAnalyticsEndpoints;
exports.rpcTrackEvent = rpcTrackEvent;
exports.rpcGetAnalyticsSummary = rpcGetAnalyticsSummary;
exports.rpcTrackRevenue = rpcTrackRevenue;
exports.getDailyMetrics = getDailyMetrics;
exports.rpcGetCircuitBreakerStates = rpcGetCircuitBreakerStates;
exports.getRecentEvents = getRecentEvents;
exports.getAllEvents = getAllEvents;
var tslib_1 = require("tslib");
var config_1 = require("../config");
var logger_1 = require("../config/logger");
var circuitBreaker_1 = require("../utils/circuitBreaker");
var metrics_1 = require("./metrics");
var privacy_compliance_1 = require("./privacy_compliance");
var validation_1 = require("./validation");
// Analytics event types for type safety
var AnalyticsEventType;
(function (AnalyticsEventType) {
    // Session events
    AnalyticsEventType["SESSION_START"] = "session_start";
    AnalyticsEventType["SESSION_END"] = "session_end";
    // Tutorial events
    AnalyticsEventType["TUTORIAL_STARTED"] = "tutorial_started";
    AnalyticsEventType["TUTORIAL_COMPLETED"] = "tutorial_completed";
    AnalyticsEventType["TUTORIAL_FAILED"] = "tutorial_failed";
    // PVE events
    AnalyticsEventType["PVE_STAGE_STARTED"] = "pve_stage_started";
    AnalyticsEventType["PVE_STAGE_COMPLETED"] = "pve_stage_completed";
    AnalyticsEventType["PVE_STAGE_FAILED"] = "pve_stage_failed";
    AnalyticsEventType["PVE_BOSS_DEFEATED"] = "pve_boss_defeated";
    // PVP events
    AnalyticsEventType["PVP_MATCH_STARTED"] = "pvp_match_started";
    AnalyticsEventType["PVP_MATCH_COMPLETED"] = "pvp_match_completed";
    AnalyticsEventType["PVP_MATCH_ABANDONED"] = "pvp_match_abandoned";
    AnalyticsEventType["PVP_DISCONNECT"] = "pvp_disconnect";
    // Store events
    AnalyticsEventType["STORE_OPENED"] = "store_opened";
    AnalyticsEventType["PURCHASE_INITIATED"] = "purchase_initiated";
    AnalyticsEventType["PURCHASE_COMPLETED"] = "purchase_completed";
    AnalyticsEventType["PURCHASE_FAILED"] = "purchase_failed";
    AnalyticsEventType["GEM_PURCHASED"] = "gem_purchased";
    AnalyticsEventType["COSMETIC_PURCHASED"] = "cosmetic_purchased";
    AnalyticsEventType["SUBSCRIPTION_STARTED"] = "subscription_started";
    // Progression events
    AnalyticsEventType["GEAR_OBTAINED"] = "gear_obtained";
    AnalyticsEventType["GEAR_EQUIPPED"] = "gear_equipped";
    AnalyticsEventType["GEAR_UNEQUIPPED"] = "gear_unequipped";
    AnalyticsEventType["LOADOUT_VIEWED"] = "loadout_viewed";
    AnalyticsEventType["TRANSMOG_APPLIED"] = "transmog_applied";
    AnalyticsEventType["LEVEL_UP"] = "level_up";
    AnalyticsEventType["ABILITY_UNLOCKED"] = "ability_unlocked";
    AnalyticsEventType["SEASON_START"] = "season_start";
    AnalyticsEventType["SEASON_END"] = "season_end";
    // Engagement events
    AnalyticsEventType["FIRST_SESSION"] = "first_session";
    AnalyticsEventType["DAILY_LOGIN"] = "daily_login";
    AnalyticsEventType["RETURNING_PLAYER"] = "returning_player";
    // Network events
    AnalyticsEventType["NETWORK_ERROR"] = "network_error";
    AnalyticsEventType["RPC_ERROR"] = "rpc_error";
    AnalyticsEventType["RPC_LATENCY"] = "rpc_latency";
    // Custom events
    AnalyticsEventType["CUSTOM"] = "custom";
})(AnalyticsEventType || (exports.AnalyticsEventType = AnalyticsEventType = {}));
// In-memory storage
var analyticsEvents = [];
var dailyMetrics = new Map();
var MAX_EVENTS = 100000; // Limit in-memory storage
/**
 * Registers the analytics RPC endpoints.
 *
 * @param initializer - Nakama runtime initializer
 */
function registerAnalyticsEndpoints(initializer) {
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/track_event', 'track_event', rpcTrackEvent);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_analytics_summary', 'get_analytics_summary', rpcGetAnalyticsSummary);
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/track_revenue', 'track_revenue', rpcTrackRevenue);
    // Register circuit breaker state monitoring RPC
    (0, metrics_1.registerRpcWithMetrics)(initializer, 'armored_archer/get_circuit_breaker_states', 'get_circuit_breaker_states', rpcGetCircuitBreakerStates);
}
/**
 * Validates analytics event payload.
 */
function validateEventPayload(payload) {
    return (0, validation_1.validatePayload)(validation_1.ZodSchemas.track_event, payload, 'track_event');
}
/**
 * Processes and stores an analytics event.
 */
function processEvent(userId, eventName, properties, platform, sessionId) {
    var event = {
        id: "evt_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 9)),
        userId: userId,
        eventName: eventName,
        timestamp: Date.now(),
        properties: properties,
        platform: platform,
        sessionId: sessionId,
    };
    // Store event
    analyticsEvents.push(event);
    // Trim old events if over limit
    if (analyticsEvents.length > MAX_EVENTS) {
        analyticsEvents.splice(0, analyticsEvents.length - MAX_EVENTS);
    }
    // Update daily metrics
    updateDailyMetrics(event);
    // Record metrics for analytics events
    (0, metrics_1.recordAnalyticsEvent)('game', eventName);
    // Forward to external analytics if configured
    forwardToExternalAnalytics(event);
    return event;
}
/**
 * Updates daily aggregation metrics.
 */
function updateDailyMetrics(event) {
    var date = new Date(event.timestamp).toISOString().split('T')[0];
    var key = "".concat(date, "_").concat(event.eventName);
    if (!dailyMetrics.has(key)) {
        dailyMetrics.set(key, {
            date: date,
            eventName: event.eventName,
            count: 0,
            uniqueUsers: new Set(),
        });
    }
    var metric = dailyMetrics.get(key);
    metric.count++;
    metric.uniqueUsers.add(event.userId);
}
/**
 * Forwards analytics event to external services (Mixpanel, Amplitude, etc.)
 */
function forwardToExternalAnalytics(event) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _d, _e;
        return tslib_1.__generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!((_a = config_1.config.analytics) === null || _a === void 0 ? void 0 : _a.enabled)) {
                        return [2 /*return*/];
                    }
                    if (!(((_b = config_1.config.analytics.mixpanel) === null || _b === void 0 ? void 0 : _b.enabled) && config_1.config.analytics.mixpanel.apiKey)) return [3 /*break*/, 2];
                    return [4 /*yield*/, forwardToMixpanel(event)];
                case 1:
                    _f.sent();
                    _f.label = 2;
                case 2:
                    if (!(((_c = config_1.config.analytics.amplitude) === null || _c === void 0 ? void 0 : _c.enabled) && config_1.config.analytics.amplitude.apiKey)) return [3 /*break*/, 4];
                    return [4 /*yield*/, forwardToAmplitude(event)];
                case 3:
                    _f.sent();
                    _f.label = 4;
                case 4:
                    if (!(((_d = config_1.config.analytics.segment) === null || _d === void 0 ? void 0 : _d.enabled) && config_1.config.analytics.segment.writeKey)) return [3 /*break*/, 6];
                    return [4 /*yield*/, forwardToSegment(event)];
                case 5:
                    _f.sent();
                    _f.label = 6;
                case 6:
                    if (!((_e = config_1.config.analytics.customEndpoint) === null || _e === void 0 ? void 0 : _e.url)) return [3 /*break*/, 8];
                    return [4 /*yield*/, forwardToCustomEndpoint(event)];
                case 7:
                    _f.sent();
                    _f.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    });
}
/**
 * Forward event to Mixpanel
 */
function forwardToMixpanel(event) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var apiKey, mixpanelEvent;
        var _this = this;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    apiKey = (_b = (_a = config_1.config.analytics) === null || _a === void 0 ? void 0 : _a.mixpanel) === null || _b === void 0 ? void 0 : _b.apiKey;
                    if (!apiKey)
                        return [2 /*return*/];
                    mixpanelEvent = {
                        event: event.eventName,
                        properties: tslib_1.__assign(tslib_1.__assign({}, event.properties), { distinct_id: event.userId, time: Math.floor(event.timestamp / 1000), platform: event.platform, session_id: event.sessionId }),
                    };
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('mixpanel', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch('https://api.mixpanel.com/track', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                api_key: apiKey,
                                                data: Buffer.from(JSON.stringify(mixpanelEvent)).toString('base64'),
                                            }),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Mixpanel forward failed: ".concat(response.status));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.warn('Mixpanel circuit open - dropping event');
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Forward event to Amplitude
 */
function forwardToAmplitude(event) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var apiKey, amplitudeEvent;
        var _this = this;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    apiKey = (_b = (_a = config_1.config.analytics) === null || _a === void 0 ? void 0 : _a.amplitude) === null || _b === void 0 ? void 0 : _b.apiKey;
                    if (!apiKey)
                        return [2 /*return*/];
                    amplitudeEvent = {
                        api_key: apiKey,
                        events: [
                            {
                                event_type: event.eventName,
                                user_id: event.userId,
                                time: event.timestamp,
                                platform: event.platform,
                                session_id: event.sessionId,
                                event_properties: event.properties,
                            },
                        ],
                    };
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('amplitude', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch('https://api.amplitude.com/2/httpapi', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify(amplitudeEvent),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Amplitude forward failed: ".concat(response.status));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.warn('Amplitude circuit open - dropping event');
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Forward event to Segment
 */
function forwardToSegment(event) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var writeKey, segmentEvent;
        var _this = this;
        var _a, _b;
        return tslib_1.__generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    writeKey = (_b = (_a = config_1.config.analytics) === null || _a === void 0 ? void 0 : _a.segment) === null || _b === void 0 ? void 0 : _b.writeKey;
                    if (!writeKey)
                        return [2 /*return*/];
                    segmentEvent = {
                        userId: event.userId,
                        event: event.eventName,
                        timestamp: new Date(event.timestamp).toISOString(),
                        properties: event.properties,
                        context: {
                            platform: event.platform,
                            session_id: event.sessionId,
                        },
                    };
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('segment', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch("https://api.segment.io/v1/track", {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: "Basic ".concat(Buffer.from(writeKey + ':').toString('base64')),
                                            },
                                            body: JSON.stringify(segmentEvent),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Segment forward failed: ".concat(response.status));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.warn('Segment circuit open - dropping event');
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Forward event to custom endpoint
 */
function forwardToCustomEndpoint(event) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var endpoint, payload, headers;
        var _this = this;
        var _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    endpoint = (_a = config_1.config.analytics) === null || _a === void 0 ? void 0 : _a.customEndpoint;
                    if (!(endpoint === null || endpoint === void 0 ? void 0 : endpoint.url))
                        return [2 /*return*/];
                    payload = {
                        event: event.eventName,
                        userId: event.userId,
                        timestamp: event.timestamp,
                        properties: event.properties,
                        platform: event.platform,
                        sessionId: event.sessionId,
                    };
                    headers = {
                        'Content-Type': 'application/json',
                    };
                    if (endpoint.apiKey) {
                        headers['Authorization'] = "Bearer ".concat(endpoint.apiKey);
                    }
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('external_api', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch(endpoint.url, {
                                            method: 'POST',
                                            headers: headers,
                                            body: JSON.stringify(payload),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Custom endpoint forward failed: ".concat(response.status));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: silently drop analytics if circuit is open (analytics are non-critical)
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.warn('Custom endpoint circuit open - dropping event');
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * RPC: Track a game analytics event.
 *
 * @example
 * // Request payload
 * {
 *   "event_name": "pve_stage_completed",
 *   "properties": {
 *     "stage_id": "campaign_1",
 *     "stars": 3,
 *     "duration_seconds": 120
 *   },
 *   "platform": "android",
 *   "session_id": "sess_123456"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "event_id": "evt_1234567890_abc123"
 * }
 */
function rpcTrackEvent(ctx, logger, _nk, payload) {
    var e_1, _a;
    logger.info('Analytics event track requested');
    var validation = validateEventPayload(payload);
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('track_event', validation.error);
    }
    var _b = validation.data, event_name = _b.event_name, properties = _b.properties, platform = _b.platform, session_id = _b.session_id;
    // Check for PII in properties before processing
    if (properties) {
        try {
            for (var _c = tslib_1.__values(Object.entries(properties)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = tslib_1.__read(_d.value, 2), key = _e[0], value = _e[1];
                if ((0, privacy_compliance_1.isPII)(value)) {
                    logger.warn("Potential PII detected in event ".concat(event_name, ": ").concat(key));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    try {
        var event = processEvent(ctx.userId, event_name, properties || {}, platform || 'unknown', session_id || '');
        logger.info("Analytics event tracked: ".concat(event_name));
        return JSON.stringify({
            success: true,
            event_id: event.id,
            timestamp: event.timestamp,
        });
    }
    catch (error) {
        logger.error("Failed to track event: ".concat(error));
        return JSON.stringify({
            success: false,
            error: "Failed to track event: ".concat(error),
        });
    }
}
/**
 * RPC: Get analytics summary.
 *
 * @example
 * // Request payload
 * {
 *   "start_date": "2024-01-01",
 *   "end_date": "2024-01-31",
 *   "event_names": ["pve_stage_completed", "purchase_completed"]
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "summary": {
 *     "total_events": 1500,
 *     "unique_users": 450,
 *     "events": {
 *       "pve_stage_completed": {
 *         "count": 1200,
 *         "unique_users": 400
 *       },
 *       "purchase_completed": {
 *         "count": 300,
 *         "unique_users": 50
 *       }
 *     }
 *   }
 * }
 */
function rpcGetAnalyticsSummary(ctx, logger, _nk, payload) {
    var e_2, _a, e_3, _b;
    logger.info('Analytics summary requested by user: %s', ctx.userId);
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.get_analytics_summary, payload, 'get_analytics_summary');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('get_analytics_summary', validation.error);
    }
    var _c = validation.data, start_date = _c.start_date, end_date = _c.end_date, event_names = _c.event_names;
    // Filter events by date range
    var startTime = new Date(start_date).getTime();
    var endTime = new Date(end_date).getTime() + 86400000; // Include entire end date
    var filteredEvents = analyticsEvents.filter(function (e) { return e.timestamp >= startTime && e.timestamp <= endTime; });
    // Filter by event names if specified
    var events = (event_names === null || event_names === void 0 ? void 0 : event_names.length)
        ? filteredEvents.filter(function (e) { return event_names.includes(e.eventName); })
        : filteredEvents;
    // Calculate summary
    var uniqueUsers = new Set();
    var eventCounts = {};
    try {
        for (var events_1 = tslib_1.__values(events), events_1_1 = events_1.next(); !events_1_1.done; events_1_1 = events_1.next()) {
            var event = events_1_1.value;
            uniqueUsers.add(event.userId);
            if (!eventCounts[event.eventName]) {
                eventCounts[event.eventName] = { count: 0, unique_users: new Set() };
            }
            eventCounts[event.eventName].count++;
            eventCounts[event.eventName].unique_users.add(event.userId);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (events_1_1 && !events_1_1.done && (_a = events_1.return)) _a.call(events_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var summary = {
        total_events: events.length,
        unique_users: uniqueUsers.size,
        events: {},
    };
    try {
        for (var _d = tslib_1.__values(Object.entries(eventCounts)), _e = _d.next(); !_e.done; _e = _d.next()) {
            var _f = tslib_1.__read(_e.value, 2), eventName = _f[0], data = _f[1];
            summary.events[eventName] = {
                count: data.count,
                unique_users: data.unique_users.size,
            };
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return JSON.stringify({
        success: true,
        summary: summary,
        start_date: start_date,
        end_date: end_date,
    });
}
/**
 * RPC: Track revenue event.
 *
 * @example
 * // Request payload
 * {
 *   "amount": 99,
 *   "currency": "USD",
 *   "product_id": "com.armoredarcher.gems.small",
 *   "transaction_id": "tx_123456",
 *   "platform": "ios"
 * }
 *
 * // Response
 * {
 *   "success": true,
 *   "revenue_id": "rev_1234567890"
 * }
 */
function rpcTrackRevenue(ctx, logger, _nk, payload) {
    logger.info('Revenue event tracked');
    var validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.track_revenue, payload, 'track_revenue');
    if (!validation.success) {
        return (0, validation_1.createValidationErrorResponse)('track_revenue', validation.error);
    }
    var _a = validation.data, amount = _a.amount, currency = _a.currency, product_id = _a.product_id, transaction_id = _a.transaction_id, platform = _a.platform;
    // Create revenue event
    var revenueEvent = {
        id: "rev_".concat(Date.now(), "_").concat(Math.random().toString(36).substring(2, 9)),
        userId: ctx.userId,
        eventName: 'revenue',
        timestamp: Date.now(),
        properties: {
            amount: amount,
            currency: currency,
            product_id: product_id,
            transaction_id: transaction_id,
            platform: platform,
        },
        platform: platform || 'unknown',
        sessionId: '',
    };
    analyticsEvents.push(revenueEvent);
    // Record revenue metrics
    (0, metrics_1.recordRevenue)(amount * 100, currency, product_id); // Convert to cents for metrics
    (0, metrics_1.recordPurchase)(product_id, true);
    // Update daily metrics
    updateDailyMetrics(tslib_1.__assign(tslib_1.__assign({}, revenueEvent), { eventName: 'revenue' }));
    logger.info("Revenue tracked: ".concat(amount, " ").concat(currency));
    return JSON.stringify({
        success: true,
        revenue_id: revenueEvent.id,
        timestamp: revenueEvent.timestamp,
    });
}
/**
 * Get daily metrics for a specific date range.
 */
function getDailyMetrics(startDate, endDate) {
    var startTime = new Date(startDate).getTime();
    var endTime = new Date(endDate).getTime() + 86400000;
    var result = [];
    dailyMetrics.forEach(function (metric) {
        var metricTime = new Date(metric.date).getTime();
        if (metricTime >= startTime && metricTime <= endTime) {
            result.push(tslib_1.__assign(tslib_1.__assign({}, metric), { uniqueUsers: metric.uniqueUsers }));
        }
    });
    return result;
}
/**
 * RPC: Get circuit breaker states for all monitored services.
 *
 * This RPC provides visibility into the health of external service connections
 * protected by circuit breakers.
 *
 * // Response
 * {
 *   "success": true,
 *   "circuits": [
 *     {
 *       "serviceName": "mixpanel",
 *       "state": "CLOSED",
 *       "stats": {
 *         "failures": 0,
 *         "successes": 10,
 *         "rejects": 0,
 *         "lastFailure": null
 *       },
 *       "options": {
 *         "timeout": 5000,
 *         "errorThresholdPercentage": 50,
 *         "volumeThreshold": 3,
 *         "resetTimeout": 30000
 *       }
 *     }
 *   ]
 * }
 */
function rpcGetCircuitBreakerStates(_ctx, logger, _nk, _payload) {
    logger.info('Circuit breaker states requested');
    try {
        var circuits = (0, circuitBreaker_1.getAllCircuitInfo)();
        return JSON.stringify({
            success: true,
            circuits: circuits.map(function (circuit) { return ({
                serviceName: circuit.serviceName,
                state: circuit.state,
                stats: circuit.stats,
                options: circuit.options,
            }); }),
        });
    }
    catch (error) {
        logger.error('Error getting circuit breaker states: %s', error);
        return JSON.stringify({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to get circuit breaker states',
        });
    }
}
/**
 * Get recent analytics events.
 */
function getRecentEvents(limit) {
    if (limit === void 0) { limit = 100; }
    return analyticsEvents.slice(-limit);
}
/**
 * Get all analytics events (for admin/debug purposes).
 */
function getAllEvents() {
    return tslib_1.__spreadArray([], tslib_1.__read(analyticsEvents), false);
}
