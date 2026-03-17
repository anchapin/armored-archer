"use strict";
/**
 * Alerting Service Module
 *
 * This module provides alerting capabilities for production incidents and system health:
 * - Health check alerts (CPU, memory, disk, database connections)
 * - Metric-based alerts (active connections, match queue, response times)
 * - Integration with multiple alert providers (PagerDuty, Slack, webhook, email)
 * - Alert cooldowns to prevent alert fatigue
 * - Integration with Sentry for error alerting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAlerting = initializeAlerting;
exports.sendAlert = sendAlert;
exports.triggerHealthAlert = triggerHealthAlert;
exports.triggerMetricAlert = triggerMetricAlert;
exports.sendErrorAlert = sendErrorAlert;
exports.getAlertStats = getAlertStats;
exports.clearAlertState = clearAlertState;
var tslib_1 = require("tslib");
var config_1 = require("../config");
var alerting_1 = require("../config/alerting");
var errorTracking_1 = require("../config/errorTracking");
var logger_1 = require("../config/logger");
var circuitBreaker_1 = require("../utils/circuitBreaker");
var alertState = new Map();
/**
 * Initialize the alerting service
 */
function initializeAlerting(logger) {
    if (!(0, alerting_1.isAlertingEnabled)()) {
        logger.info('[Alerting] Alerting is disabled for current environment');
        return;
    }
    logger.info("[Alerting] Initialized - provider: ".concat(config_1.config.alerting.defaultProvider, ", min_env: ").concat(config_1.config.alerting.minEnvironmentLevel));
}
/**
 * Check if an alert should be sent based on cooldown period
 */
function shouldSendAlert(alertKey, severity) {
    var state = alertState.get(alertKey);
    var cooldown = (0, alerting_1.getAlertCooldown)(severity) * 1000; // Convert to milliseconds
    var now = Date.now();
    if (!state) {
        return true;
    }
    return now - state.lastAlertTime >= cooldown;
}
/**
 * Update alert state after sending an alert
 */
function updateAlertState(alertKey, _severity) {
    var now = Date.now();
    var state = alertState.get(alertKey) || { lastAlertTime: 0, alertCount: 0 };
    alertState.set(alertKey, {
        lastAlertTime: now,
        alertCount: state.alertCount + 1,
    });
}
/**
 * Route alert to the appropriate provider
 */
function routeAlert(payload, provider) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var alertingCfg, _a;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (provider === 'none') {
                        return [2 /*return*/];
                    }
                    alertingCfg = alerting_1.alertingConfig;
                    _a = provider;
                    switch (_a) {
                        case 'slack': return [3 /*break*/, 1];
                        case 'webhook': return [3 /*break*/, 3];
                        case 'email': return [3 /*break*/, 5];
                        case 'pagerduty': return [3 /*break*/, 7];
                    }
                    return [3 /*break*/, 9];
                case 1: return [4 /*yield*/, sendSlackAlert(payload, alertingCfg.slack)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 3: return [4 /*yield*/, sendWebhookAlert(payload, alertingCfg.webhook)];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 5: return [4 /*yield*/, sendEmailAlert(payload, alertingCfg.email)];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 7: return [4 /*yield*/, sendPagerDutyAlert(payload, alertingCfg.pagerduty)];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 10];
                case 9:
                    logger_1.logger.warn("Unknown provider: ".concat(provider));
                    _b.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * Send alert to Slack
 */
function sendSlackAlert(payload, slackConfig) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var severityEmoji, color, slackPayload;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(slackConfig === null || slackConfig === void 0 ? void 0 : slackConfig.webhookUrl)) {
                        logger_1.logger.warn('Slack webhook URL not configured');
                        return [2 /*return*/];
                    }
                    severityEmoji = {
                        critical: ':rotating_light:',
                        error: ':x:',
                        warning: ':warning:',
                        info: ':information_source:',
                    };
                    color = {
                        critical: '#FF0000',
                        error: '#FFA500',
                        warning: '#FFFF00',
                        info: '#00FF00',
                    };
                    slackPayload = {
                        username: slackConfig.username,
                        icon_emoji: slackConfig.iconEmoji,
                        channel: slackConfig.channel,
                        attachments: [
                            {
                                color: color[payload.severity],
                                title: "".concat(severityEmoji[payload.severity], " ").concat(payload.title),
                                text: payload.message,
                                fields: tslib_1.__spreadArray([
                                    { title: 'Severity', value: payload.severity, short: true },
                                    { title: 'Source', value: payload.source, short: true }
                                ], tslib_1.__read(Object.entries(payload.tags).map(function (_a) {
                                    var _b = tslib_1.__read(_a, 2), key = _b[0], value = _b[1];
                                    return ({
                                        title: key,
                                        value: value,
                                        short: true,
                                    });
                                })), false),
                                footer: 'Armored Archer Alerting',
                                ts: Math.floor(payload.timestamp / 1000),
                            },
                        ],
                    };
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('slack', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch(slackConfig.webhookUrl, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(slackPayload),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Failed to send Slack alert: ".concat(response.statusText));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: log error but don't throw - alerting failures shouldn't break the app
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.error('Slack circuit open - alert not sent:', payload.title);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Send alert to generic webhook
 */
function sendWebhookAlert(payload, webhookConfig) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var headers, credentials;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(webhookConfig === null || webhookConfig === void 0 ? void 0 : webhookConfig.url)) {
                        logger_1.logger.warn('Webhook URL not configured');
                        return [2 /*return*/];
                    }
                    headers = tslib_1.__assign({}, webhookConfig.headers);
                    if (webhookConfig.authType === 'bearer' && webhookConfig.token) {
                        headers['Authorization'] = "Bearer ".concat(webhookConfig.token);
                    }
                    else if (webhookConfig.authType === 'basic' &&
                        webhookConfig.username &&
                        webhookConfig.password) {
                        credentials = Buffer.from("".concat(webhookConfig.username, ":").concat(webhookConfig.password)).toString('base64');
                        headers['Authorization'] = "Basic ".concat(credentials);
                    }
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('alerting_webhook', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch(webhookConfig.url, {
                                            method: webhookConfig.method,
                                            headers: headers,
                                            body: JSON.stringify(payload),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Failed to send webhook alert: ".concat(response.statusText));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: log error but don't throw - alerting failures shouldn't break the app
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.error('Webhook circuit open - alert not sent:', payload.title);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Send alert via email (SMTP)
 */
function sendEmailAlert(payload, emailConfig) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            // Note: This is a placeholder implementation
            // In production, you would use a library like 'nodemailer'
            if (!(emailConfig === null || emailConfig === void 0 ? void 0 : emailConfig.host)) {
                logger_1.logger.warn('Email not configured');
                return [2 /*return*/];
            }
            logger_1.logger.info("Email alert: ".concat(payload.title, " to ").concat(emailConfig.to.join(', ')));
            return [2 /*return*/];
        });
    });
}
/**
 * Send alert to PagerDuty
 */
function sendPagerDutyAlert(payload, pagerdutyConfig) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var urgency, payloadPD;
        var _this = this;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(pagerdutyConfig === null || pagerdutyConfig === void 0 ? void 0 : pagerdutyConfig.apiKey)) {
                        logger_1.logger.warn('PagerDuty not configured');
                        return [2 /*return*/];
                    }
                    urgency = {
                        critical: 'high',
                        error: 'high',
                        warning: 'low',
                        info: 'low',
                    };
                    payloadPD = {
                        routing_key: pagerdutyConfig.integrationKey,
                        event_action: 'trigger',
                        payload: {
                            summary: payload.title,
                            severity: payload.severity,
                            source: payload.source,
                            custom_details: {
                                message: payload.message,
                                tags: payload.tags,
                                metrics: payload.metrics,
                            },
                        },
                        urgency: urgency[payload.severity],
                    };
                    // Wrap external API call with circuit breaker for resilience
                    return [4 /*yield*/, (0, circuitBreaker_1.withCircuitBreaker)('pagerduty', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var response;
                            return tslib_1.__generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch("https://events.pagerduty.com/v2/enqueue", {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payloadPD),
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        if (!response.ok) {
                                            logger_1.logger.error("Failed to send PagerDuty alert: ".concat(response.statusText));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); }, 
                        // Fallback: log error but don't throw - alerting failures shouldn't break the app
                        function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            return tslib_1.__generator(this, function (_a) {
                                logger_1.logger.error('PagerDuty circuit open - alert not sent:', payload.title);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    // Wrap external API call with circuit breaker for resilience
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Send an alert with the given parameters
 */
function sendAlert(title_1, message_1, severity_1) {
    return tslib_1.__awaiter(this, arguments, void 0, function (title, message, severity, tags, metrics) {
        var provider, alertKey, alertPayload, sentrySeverity;
        if (tags === void 0) { tags = {}; }
        if (metrics === void 0) { metrics = {}; }
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(0, alerting_1.isAlertingEnabled)()) {
                        return [2 /*return*/];
                    }
                    provider = (0, alerting_1.getAlertProvider)(severity);
                    alertKey = "".concat(title, ":").concat(severity);
                    if (!shouldSendAlert(alertKey, severity)) {
                        logger_1.logger.info("Alert suppressed due to cooldown: ".concat(title));
                        return [2 /*return*/];
                    }
                    alertPayload = {
                        title: title,
                        message: message,
                        severity: severity,
                        tags: tslib_1.__assign(tslib_1.__assign({}, config_1.config.alerting.tags), tags),
                        metrics: metrics,
                        timestamp: Date.now(),
                        source: 'armored-archer-backend',
                    };
                    return [4 /*yield*/, routeAlert(alertPayload, provider)];
                case 1:
                    _a.sent();
                    updateAlertState(alertKey, severity);
                    // Also send to Sentry for error-level alerts
                    if (severity === 'critical' || severity === 'error') {
                        sentrySeverity = severity === 'critical' ? 'error' : severity;
                        (0, errorTracking_1.captureMessage)("".concat(title, ": ").concat(message), sentrySeverity, {
                            extra: tslib_1.__assign(tslib_1.__assign({}, tags), metrics),
                        });
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Trigger health alert based on metric threshold
 */
function triggerHealthAlert(metricName, value, currentMetrics) {
    var severity = (0, alerting_1.shouldTriggerHealthAlert)(metricName, value);
    if (!severity) {
        return;
    }
    var metricLabel = metricName.replace(/([A-Z])/g, ' $1').trim(); // Convert camelCase to spaces
    var title = "Health Alert: ".concat(metricLabel);
    var message = "Current value: ".concat(value, "% (threshold: ").concat(severity, ")");
    sendAlert(title, message, severity, { metric: metricName }, currentMetrics).catch(function (err) {
        logger_1.logger.error('Failed to send health alert:', err);
    });
}
/**
 * Trigger metric alert based on custom threshold
 */
function triggerMetricAlert(metricName, value, threshold, severity, additionalTags) {
    if (additionalTags === void 0) { additionalTags = {}; }
    var title = "Metric Alert: ".concat(metricName);
    var message = "Current value: ".concat(value, " (threshold: ").concat(threshold, ")");
    sendAlert(title, message, severity, tslib_1.__assign({ metric: metricName }, additionalTags)).catch(function (err) {
        logger_1.logger.error('Failed to send metric alert:', err);
    });
}
/**
 * Send error alert with context
 */
function sendErrorAlert(error, context) {
    if (context === void 0) { context = {}; }
    if (!(0, alerting_1.isAlertingEnabled)()) {
        return;
    }
    (0, errorTracking_1.captureException)(error, { userId: context.userId, rpc: context.rpc, extra: context.extra });
    var title = "Error: ".concat(error.message);
    var message = "An error occurred in ".concat(context.rpc || 'unknown RPC');
    sendAlert(title, message, 'error', {
        errorType: error.constructor.name,
        userId: context.userId || 'unknown',
        rpc: context.rpc || 'unknown',
    }).catch(function (err) {
        logger_1.logger.error('Failed to send error alert:', err);
    });
}
/**
 * Get alert statistics
 */
function getAlertStats() {
    var e_1, _a;
    var stats = {};
    try {
        for (var _b = tslib_1.__values(alertState.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = tslib_1.__read(_c.value, 2), key = _d[0], state = _d[1];
            stats[key] = { lastAlertTime: state.lastAlertTime, alertCount: state.alertCount };
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return stats;
}
/**
 * Clear alert state (useful for testing)
 */
function clearAlertState() {
    alertState.clear();
}
