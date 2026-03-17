"use strict";
/**
 * Error to Insight Pipeline
 *
 * This module provides an automated pipeline that transforms raw error data
 * into meaningful patterns and recommendations for the Armored Archer backend.
 *
 * Features:
 * - Collect error data from logs
 * - Aggregate and analyze error patterns
 * - Generate insights and recommendations
 * - Provide RPC endpoints for error analysis dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectError = collectError;
exports.registerErrorInsightRpcs = registerErrorInsightRpcs;
exports.initializeErrorInsightsPipeline = initializeErrorInsightsPipeline;
exports.getErrorStore = getErrorStore;
var tslib_1 = require("tslib");
var crypto_1 = require("crypto");
var config_1 = require("../config");
var logger_1 = require("../config/logger");
var validation_1 = require("./validation");
/**
 * In-memory error data store
 */
var ErrorInsightStore = /** @class */ (function () {
    function ErrorInsightStore() {
        this.errors = [];
        this.patterns = new Map();
        this.insights = [];
        this.startTime = new Date();
    }
    /**
     * Add an error to the store
     */
    ErrorInsightStore.prototype.addError = function (error) {
        this.errors.push(error);
        this.lastErrorProcessed = new Date();
        // Trim old errors if needed (keep last 10000)
        if (this.errors.length > 10000) {
            this.errors = this.errors.slice(-10000);
        }
    };
    /**
     * Get all errors within a time range
     */
    ErrorInsightStore.prototype.getErrorsInRange = function (startTime, endTime) {
        return this.errors.filter(function (e) { return new Date(e.timestamp) >= startTime && new Date(e.timestamp) <= endTime; });
    };
    /**
     * Get all patterns
     */
    ErrorInsightStore.prototype.getPatterns = function () {
        return Array.from(this.patterns.values());
    };
    /**
     * Add or update a pattern
     */
    ErrorInsightStore.prototype.upsertPattern = function (pattern) {
        this.patterns.set(pattern.patternId, pattern);
    };
    /**
     * Get all insights
     */
    ErrorInsightStore.prototype.getInsights = function () {
        return this.insights;
    };
    /**
     * Add an insight
     */
    ErrorInsightStore.prototype.addInsight = function (insight) {
        this.insights.unshift(insight);
        // Keep only maxInsights
        var maxInsights = config_1.config.errorInsights.maxInsights;
        if (this.insights.length > maxInsights) {
            this.insights = this.insights.slice(0, maxInsights);
        }
    };
    /**
     * Get pipeline statistics
     */
    ErrorInsightStore.prototype.getStats = function () {
        var _a;
        var now = new Date();
        var uptimeMs = now.getTime() - this.startTime.getTime();
        var uptimeSec = Math.floor(uptimeMs / 1000);
        // Calculate errors per minute
        var recentErrors = this.getErrorsInRange(new Date(now.getTime() - 5 * 60 * 1000), now);
        var errorsPerMinute = recentErrors.length / 5;
        return {
            totalErrorsProcessed: this.errors.length,
            totalPatternsIdentified: this.patterns.size,
            totalInsightsGenerated: this.insights.length,
            uptime: this.formatUptime(uptimeSec),
            lastErrorProcessed: (_a = this.lastErrorProcessed) === null || _a === void 0 ? void 0 : _a.toISOString(),
            errorsPerMinute: Math.round(errorsPerMinute * 10) / 10,
        };
    };
    /**
     * Format uptime string
     */
    ErrorInsightStore.prototype.formatUptime = function (seconds) {
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        var minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) {
            return "".concat(days, "d ").concat(hours, "h ").concat(minutes, "m");
        }
        if (hours > 0) {
            return "".concat(hours, "h ").concat(minutes, "m");
        }
        return "".concat(minutes, "m");
    };
    /**
     * Clear old patterns that have expired TTL
     */
    ErrorInsightStore.prototype.cleanupExpiredPatterns = function () {
        var e_1, _a;
        var ttlMs = config_1.config.errorInsights.patternTtlDays * 24 * 60 * 60 * 1000;
        var cutoffTime = new Date(Date.now() - ttlMs);
        try {
            for (var _b = tslib_1.__values(this.patterns), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), patternId = _d[0], pattern = _d[1];
                if (new Date(pattern.lastSeen) < cutoffTime) {
                    this.patterns.delete(patternId);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    /**
     * Clear all data (for testing)
     */
    ErrorInsightStore.prototype.clear = function () {
        this.errors = [];
        this.patterns.clear();
        this.insights = [];
    };
    return ErrorInsightStore;
}());
// Global store instance
var errorStore = new ErrorInsightStore();
/**
 * Generate a signature for an error to identify patterns
 */
function generateErrorSignature(error) {
    // Create a signature based on error type, RPC, and normalized message
    var parts = [error.errorType, error.rpcName || 'unknown', error.source];
    // Normalize message by removing specific values
    var normalizedMessage = error.message;
    // Remove UUIDs
    normalizedMessage = normalizedMessage.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
    // Remove numbers
    normalizedMessage = normalizedMessage.replace(/\d+/g, '<N>');
    // Remove file paths
    normalizedMessage = normalizedMessage.replace(/\/[\w/.-]+/g, '<PATH>');
    parts.push(normalizedMessage.substring(0, 100));
    // Simple hash
    var hash = 0;
    var str = parts.join('|');
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}
/**
 * Detect error source from error characteristics
 */
function detectErrorSource(error) {
    var _a;
    if (error.source !== 'unknown') {
        return error.source;
    }
    var message = error.message.toLowerCase();
    var stack = ((_a = error.stack) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
    if (message.includes('database') || message.includes('postgres') || stack.includes('db_')) {
        return 'database';
    }
    if (message.includes('cache') || message.includes('redis')) {
        return 'cache';
    }
    if (message.includes('validation') || message.includes('invalid')) {
        return 'validation';
    }
    if (message.includes('nakama') || message.includes('rpc')) {
        return 'nakama';
    }
    if (message.includes('external') || message.includes('api')) {
        return 'external';
    }
    return 'unknown';
}
/**
 * Determine error severity
 */
function determineSeverity(error) {
    if (error.severity !== 'info') {
        return error.severity;
    }
    var message = error.message.toLowerCase();
    var stack = error.stack || '';
    // Critical patterns
    if (message.includes('fatal') ||
        message.includes('crash') ||
        message.includes('out of memory') ||
        stack.includes('segmentation')) {
        return 'critical';
    }
    // Error patterns
    if (message.includes('error') || message.includes('exception') || message.includes('failed')) {
        return 'error';
    }
    // Warning patterns
    if (message.includes('warning') || message.includes('deprecated')) {
        return 'warning';
    }
    return 'info';
}
/**
 * Analyze errors and identify patterns
 */
function analyzePatterns(errors) {
    var e_2, _a, e_3, _b;
    var patternMap = new Map();
    try {
        for (var errors_1 = tslib_1.__values(errors), errors_1_1 = errors_1.next(); !errors_1_1.done; errors_1_1 = errors_1.next()) {
            var error = errors_1_1.value;
            var signature = generateErrorSignature(error);
            var existingPattern = patternMap.get(signature);
            if (existingPattern) {
                // Update existing pattern
                existingPattern.count++;
                existingPattern.lastSeen = error.timestamp;
                if (error.rpcName && !existingPattern.affectedRpcs.includes(error.rpcName)) {
                    existingPattern.affectedRpcs.push(error.rpcName);
                }
                if (error.userId && !existingPattern.affectedUsers.includes(error.userId)) {
                    existingPattern.affectedUsers.push(error.userId);
                }
            }
            else {
                // Create new pattern
                var pattern = {
                    patternId: (0, crypto_1.randomUUID)(),
                    signature: signature,
                    count: 1,
                    firstSeen: error.timestamp,
                    lastSeen: error.timestamp,
                    errorType: error.errorType,
                    messageTemplate: error.message.substring(0, 200),
                    affectedRpcs: error.rpcName ? [error.rpcName] : [],
                    affectedUsers: error.userId ? [error.userId] : [],
                    occurrencesPerHour: 0,
                    severity: determineSeverity(error),
                    source: detectErrorSource(error),
                };
                patternMap.set(signature, pattern);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (errors_1_1 && !errors_1_1.done && (_a = errors_1.return)) _a.call(errors_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // Calculate occurrences per hour
    var now = new Date();
    try {
        for (var _c = tslib_1.__values(patternMap.values()), _d = _c.next(); !_d.done; _d = _c.next()) {
            var pattern = _d.value;
            var firstSeen = new Date(pattern.firstSeen);
            var hoursDiff = Math.max(1, (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60));
            pattern.occurrencesPerHour = Math.round((pattern.count / hoursDiff) * 10) / 10;
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return Array.from(patternMap.values());
}
/**
 * Generate insights from patterns
 */
function generateInsights(patterns) {
    var e_4, _a;
    var insights = [];
    var minOccurrences = config_1.config.errorInsights.minOccurrencesForInsight;
    try {
        for (var patterns_1 = tslib_1.__values(patterns), patterns_1_1 = patterns_1.next(); !patterns_1_1.done; patterns_1_1 = patterns_1.next()) {
            var pattern = patterns_1_1.value;
            if (pattern.count < minOccurrences) {
                continue;
            }
            var insight = createInsightFromPattern(pattern);
            if (insight) {
                insights.push(insight);
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (patterns_1_1 && !patterns_1_1.done && (_a = patterns_1.return)) _a.call(patterns_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return insights;
}
/**
 * Create an insight from a pattern
 */
function createInsightFromPattern(pattern) {
    var recommendations = generateRecommendations(pattern);
    var impact = assessImpact(pattern);
    // Determine priority based on severity and count
    var priority;
    if (pattern.severity === 'critical' || pattern.count > 100) {
        priority = 'critical';
    }
    else if (pattern.severity === 'error' || pattern.count > 50) {
        priority = 'high';
    }
    else if (pattern.severity === 'warning' || pattern.count > 10) {
        priority = 'medium';
    }
    else {
        priority = 'low';
    }
    var insight = {
        id: (0, crypto_1.randomUUID)(),
        generatedAt: new Date().toISOString(),
        patternId: pattern.patternId,
        title: generateInsightTitle(pattern),
        description: generateInsightDescription(pattern),
        priority: priority,
        recommendations: recommendations,
        impact: impact,
        actionable: recommendations.length > 0,
        errorCount: pattern.count,
        affectedUserCount: pattern.affectedUsers.length,
    };
    return insight;
}
/**
 * Generate insight title
 */
function generateInsightTitle(pattern) {
    var sourceLabel = pattern.source.charAt(0).toUpperCase() + pattern.source.slice(1);
    switch (pattern.source) {
        case 'database':
            return "Database Errors in ".concat(pattern.affectedRpcs.join(', ') || 'operations');
        case 'cache':
            return "Cache Issues Affecting ".concat(pattern.affectedRpcs.join(', ') || 'operations');
        case 'validation':
            return "Validation Errors in ".concat(pattern.affectedRpcs.join(', ') || 'input processing');
        case 'nakama':
            return "Server Errors in ".concat(pattern.affectedRpcs.join(', ') || 'RPC calls');
        case 'external':
            return "External Service Errors (".concat(sourceLabel, ")");
        default:
            return "Recurring Error: ".concat(pattern.errorType);
    }
}
/**
 * Generate insight description
 */
function generateInsightDescription(pattern) {
    var timeSpan = getTimeSpanDescription(pattern.firstSeen, pattern.lastSeen);
    var userCount = pattern.affectedUsers.length;
    var description = "This error pattern has occurred ".concat(pattern.count, " times over ").concat(timeSpan, ".");
    if (userCount > 0) {
        description += " Affecting approximately ".concat(userCount, " unique user(s).");
    }
    if (pattern.affectedRpcs.length > 0) {
        description += " Primarily affecting: ".concat(pattern.affectedRpcs.join(', '), ".");
    }
    description += "\n\nError type: ".concat(pattern.errorType);
    description += "\nSource: ".concat(pattern.source);
    return description;
}
/**
 * Get time span description
 */
function getTimeSpanDescription(firstSeen, lastSeen) {
    var start = new Date(firstSeen);
    var end = new Date(lastSeen);
    var diffMs = end.getTime() - start.getTime();
    var diffMins = Math.floor(diffMs / (1000 * 60));
    var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 60) {
        return "".concat(diffMins, " minute(s)");
    }
    if (diffHours < 24) {
        return "".concat(diffHours, " hour(s)");
    }
    return "".concat(diffDays, " day(s)");
}
/**
 * Assess impact of a pattern
 */
function assessImpact(pattern) {
    var userPercentage = Math.min(100, Math.round((pattern.affectedUsers.length / 1000) * 100));
    var userImpact = 'Minimal user impact';
    var systemImpact = 'Low system impact';
    if (pattern.severity === 'critical') {
        userImpact = 'Users experiencing service disruption or crashes';
        systemImpact = 'Potential service degradation or outage';
    }
    else if (pattern.severity === 'error') {
        userImpact = 'Users experiencing failed operations';
        systemImpact = 'Increased error rates affecting service reliability';
    }
    else if (pattern.severity === 'warning') {
        userImpact = 'Some users experiencing issues';
        systemImpact = 'Minor performance degradation';
    }
    return {
        userImpact: userImpact,
        systemImpact: systemImpact,
        affectedPercentage: pattern.affectedUsers.length > 0 ? userPercentage : undefined,
    };
}
/**
 * Generate recommendations based on pattern
 */
function generateRecommendations(pattern) {
    var recommendations = [];
    switch (pattern.source) {
        case 'database':
            recommendations.push('Review database query performance and add indexes where needed');
            recommendations.push('Check for connection pool exhaustion');
            if (pattern.messageTemplate.toLowerCase().includes('timeout')) {
                recommendations.push('Increase database query timeout settings');
            }
            break;
        case 'cache':
            recommendations.push('Review cache eviction policies');
            recommendations.push('Check cache availability and memory limits');
            if (pattern.occurrencesPerHour > 10) {
                recommendations.push('Consider implementing circuit breaker pattern');
            }
            break;
        case 'validation':
            recommendations.push('Review client-side validation logic');
            recommendations.push('Add more descriptive error messages for users');
            recommendations.push('Consider implementing input sanitization');
            break;
        case 'nakama':
            recommendations.push('Review RPC handler implementation');
            recommendations.push('Check for race conditions in state management');
            if (pattern.affectedRpcs.length > 0) {
                recommendations.push("Focus on fixing: ".concat(pattern.affectedRpcs.join(', ')));
            }
            break;
        case 'external':
            recommendations.push('Monitor external service health');
            recommendations.push('Implement retry logic with exponential backoff');
            recommendations.push('Consider adding fallback mechanisms');
            break;
        default:
            recommendations.push('Investigate error root cause');
            recommendations.push('Add detailed logging around this operation');
    }
    // High frequency recommendation
    if (pattern.occurrencesPerHour > 50) {
        recommendations.unshift('URGENT: This error is occurring frequently - investigate immediately');
    }
    return recommendations;
}
/**
 * Calculate error trend data
 */
function calculateTrendData(errors, hours) {
    var e_5, _a, e_6, _b;
    var now = new Date();
    var startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    var trendMap = new Map();
    // Initialize all hours with 0
    for (var i = 0; i < hours; i++) {
        var hourTime = new Date(startTime.getTime() + i * 60 * 60 * 1000);
        var key = hourTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        trendMap.set(key, 0);
    }
    try {
        // Count errors per hour
        for (var errors_2 = tslib_1.__values(errors), errors_2_1 = errors_2.next(); !errors_2_1.done; errors_2_1 = errors_2.next()) {
            var error = errors_2_1.value;
            var errorTime = new Date(error.timestamp);
            if (errorTime >= startTime && errorTime <= now) {
                var key = errorTime.toISOString().substring(0, 13);
                trendMap.set(key, (trendMap.get(key) || 0) + 1);
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (errors_2_1 && !errors_2_1.done && (_a = errors_2.return)) _a.call(errors_2);
        }
        finally { if (e_5) throw e_5.error; }
    }
    // Convert to array
    var trends = [];
    try {
        for (var trendMap_1 = tslib_1.__values(trendMap), trendMap_1_1 = trendMap_1.next(); !trendMap_1_1.done; trendMap_1_1 = trendMap_1.next()) {
            var _c = tslib_1.__read(trendMap_1_1.value, 2), timestamp = _c[0], count = _c[1];
            trends.push({
                timestamp: timestamp + ':00:00Z',
                count: count,
            });
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (trendMap_1_1 && !trendMap_1_1.done && (_b = trendMap_1.return)) _b.call(trendMap_1);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return trends.sort(function (a, b) { return a.timestamp.localeCompare(b.timestamp); });
}
/**
 * Get error summary
 */
function getErrorSummary(timeRange) {
    var e_7, _a;
    var startTime = new Date(timeRange.startTime);
    var endTime = new Date(timeRange.endTime);
    var errors = errorStore.getErrorsInRange(startTime, endTime);
    var patterns = errorStore.getPatterns();
    var insights = errorStore.getInsights();
    // Calculate errors by severity
    var errorsBySeverity = {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0,
    };
    // Calculate errors by source
    var errorsBySource = {
        nakama: 0,
        database: 0,
        cache: 0,
        external: 0,
        validation: 0,
        unknown: 0,
    };
    try {
        for (var errors_3 = tslib_1.__values(errors), errors_3_1 = errors_3.next(); !errors_3_1.done; errors_3_1 = errors_3.next()) {
            var error = errors_3_1.value;
            errorsBySeverity[error.severity]++;
            errorsBySource[error.source]++;
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (errors_3_1 && !errors_3_1.done && (_a = errors_3.return)) _a.call(errors_3);
        }
        finally { if (e_7) throw e_7.error; }
    }
    // Sort patterns by count
    var topPatterns = tslib_1.__spreadArray([], tslib_1.__read(patterns), false).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
    // Recent insights
    var recentInsights = insights.slice(0, 5);
    // Calculate trend (last 24 hours)
    var hours = Math.min(24, Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)));
    var errorTrend = calculateTrendData(errors, hours);
    return {
        totalErrors: errors.length,
        errorsBySeverity: errorsBySeverity,
        errorsBySource: errorsBySource,
        topPatterns: topPatterns,
        recentInsights: recentInsights,
        errorTrend: errorTrend,
        timeRange: timeRange,
    };
}
/**
 * Get dashboard data
 */
function getDashboardData() {
    var now = new Date();
    var hours = config_1.config.errorInsights.insightWindowHours;
    var startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    var timeRange = {
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
    };
    return {
        summary: getErrorSummary(timeRange),
        patterns: errorStore.getPatterns(),
        insights: errorStore.getInsights(),
        lastUpdated: now.toISOString(),
        config: config_1.config.errorInsights,
    };
}
/**
 * Process errors and update patterns/insights
 */
function processErrors() {
    var e_8, _a, e_9, _b;
    if (!config_1.config.errorInsights.enabled) {
        return;
    }
    var now = new Date();
    var windowMs = config_1.config.errorInsights.aggregationWindowMinutes * 60 * 1000;
    var startTime = new Date(now.getTime() - windowMs);
    // Get errors in current window
    var recentErrors = errorStore.getErrorsInRange(startTime, now);
    if (recentErrors.length === 0) {
        return;
    }
    // Analyze patterns
    var patterns = analyzePatterns(recentErrors);
    var _loop_1 = function (pattern) {
        var e_10, _c, e_11, _d;
        var existingPatterns = errorStore.getPatterns();
        var existing = existingPatterns.find(function (p) { return p.signature === pattern.signature; });
        if (existing) {
            // Merge with existing
            existing.count += pattern.count;
            existing.lastSeen = pattern.lastSeen;
            try {
                for (var _e = (e_10 = void 0, tslib_1.__values(pattern.affectedRpcs)), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var rpc = _f.value;
                    if (!existing.affectedRpcs.includes(rpc)) {
                        existing.affectedRpcs.push(rpc);
                    }
                }
            }
            catch (e_10_1) { e_10 = { error: e_10_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_c = _e.return)) _c.call(_e);
                }
                finally { if (e_10) throw e_10.error; }
            }
            try {
                for (var _g = (e_11 = void 0, tslib_1.__values(pattern.affectedUsers)), _h = _g.next(); !_h.done; _h = _g.next()) {
                    var user = _h.value;
                    if (!existing.affectedUsers.includes(user)) {
                        existing.affectedUsers.push(user);
                    }
                }
            }
            catch (e_11_1) { e_11 = { error: e_11_1 }; }
            finally {
                try {
                    if (_h && !_h.done && (_d = _g.return)) _d.call(_g);
                }
                finally { if (e_11) throw e_11.error; }
            }
            errorStore.upsertPattern(existing);
        }
        else {
            errorStore.upsertPattern(pattern);
        }
    };
    try {
        // Update patterns in store
        for (var patterns_2 = tslib_1.__values(patterns), patterns_2_1 = patterns_2.next(); !patterns_2_1.done; patterns_2_1 = patterns_2.next()) {
            var pattern = patterns_2_1.value;
            _loop_1(pattern);
        }
    }
    catch (e_8_1) { e_8 = { error: e_8_1 }; }
    finally {
        try {
            if (patterns_2_1 && !patterns_2_1.done && (_a = patterns_2.return)) _a.call(patterns_2);
        }
        finally { if (e_8) throw e_8.error; }
    }
    // Generate insights
    var newInsights = generateInsights(patterns);
    var _loop_2 = function (insight) {
        // Check if similar insight already exists
        var existingInsights = errorStore.getInsights();
        var exists = existingInsights.some(function (i) { return i.patternId === insight.patternId; });
        if (!exists) {
            errorStore.addInsight(insight);
            // Log new insight
            logger_1.logger.warn('New error insight generated', {
                insightId: insight.id,
                title: insight.title,
                priority: insight.priority,
                errorCount: insight.errorCount,
                operation: 'error_insight_generated',
            });
        }
    };
    try {
        for (var newInsights_1 = tslib_1.__values(newInsights), newInsights_1_1 = newInsights_1.next(); !newInsights_1_1.done; newInsights_1_1 = newInsights_1.next()) {
            var insight = newInsights_1_1.value;
            _loop_2(insight);
        }
    }
    catch (e_9_1) { e_9 = { error: e_9_1 }; }
    finally {
        try {
            if (newInsights_1_1 && !newInsights_1_1.done && (_b = newInsights_1.return)) _b.call(newInsights_1);
        }
        finally { if (e_9) throw e_9.error; }
    }
    // Cleanup expired patterns
    errorStore.cleanupExpiredPatterns();
}
/**
 * Collect an error from log data
 */
function collectError(error, context) {
    if (!config_1.config.errorInsights.enabled) {
        return;
    }
    var rawError = {
        id: (0, crypto_1.randomUUID)(),
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
        rpcName: context.rpcName,
        userId: context.userId,
        requestId: context.requestId,
        metadata: context.metadata,
        severity: context.severity || determineSeverityFromError(error),
        source: context.source || 'unknown',
    };
    // Update source based on error characteristics
    rawError.source = detectErrorSource(rawError);
    rawError.severity = determineSeverity(rawError);
    errorStore.addError(rawError);
    // Process errors periodically
    processErrors();
}
/**
 * Determine severity from error
 */
function determineSeverityFromError(error) {
    var message = error.message.toLowerCase();
    if (message.includes('fatal') || message.includes('crash')) {
        return 'critical';
    }
    if (message.includes('error') || message.includes('exception')) {
        return 'error';
    }
    if (message.includes('warning')) {
        return 'warning';
    }
    return 'info';
}
/**
 * Register RPC handlers for error insights
 */
function registerErrorInsightRpcs(initializer) {
    initializer.registerRpc('armored_archer/error_insights_dashboard', rpcGetErrorDashboard);
    initializer.registerRpc('armored_archer/error_insights_summary', rpcGetErrorSummary);
    initializer.registerRpc('armored_archer/error_insights_patterns', rpcGetErrorPatterns);
    initializer.registerRpc('armored_archer/error_insights_stats', rpcGetErrorStats);
    initializer.registerRpc('armored_archer/error_insights_dismiss', rpcDismissInsight);
}
/**
 * RPC: Get error dashboard data
 */
function rpcGetErrorDashboard(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var validation, dashboardData;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Error insights dashboard requested by user: %s', ctx.userId);
            validation = (0, validation_1.validatePayload)(validation_1.ZodSchemas.health_check, payload, 'error_insights_dashboard');
            if (!validation.success && payload) {
                return [2 /*return*/, (0, validation_1.createValidationErrorResponse)('error_insights_dashboard', validation.error)];
            }
            dashboardData = getDashboardData();
            return [2 /*return*/, JSON.stringify(dashboardData)];
        });
    });
}
/**
 * RPC: Get error summary
 */
function rpcGetErrorSummary(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var timeRange, parsed, hours, hours, summary;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Error insights summary requested by user: %s', ctx.userId);
            try {
                if (payload) {
                    parsed = JSON.parse(payload);
                    timeRange = {
                        startTime: parsed.startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                        endTime: parsed.endTime || new Date().toISOString(),
                    };
                }
                else {
                    hours = config_1.config.errorInsights.insightWindowHours;
                    timeRange = {
                        startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
                        endTime: new Date().toISOString(),
                    };
                }
            }
            catch (_b) {
                hours = config_1.config.errorInsights.insightWindowHours;
                timeRange = {
                    startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
                    endTime: new Date().toISOString(),
                };
            }
            summary = getErrorSummary(timeRange);
            return [2 /*return*/, JSON.stringify(summary)];
        });
    });
}
/**
 * RPC: Get error patterns
 */
function rpcGetErrorPatterns(ctx, logger, _nk, _payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var patterns, sorted, limit;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Error insights patterns requested by user: %s', ctx.userId);
            patterns = errorStore.getPatterns();
            sorted = tslib_1.__spreadArray([], tslib_1.__read(patterns), false).sort(function (a, b) { return b.count - a.count; });
            limit = config_1.config.errorInsights.maxPatterns;
            return [2 /*return*/, JSON.stringify(sorted.slice(0, limit))];
        });
    });
}
/**
 * RPC: Get pipeline statistics
 */
function rpcGetErrorStats(ctx, logger, _nk, _payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var stats;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Error insights stats requested by user: %s', ctx.userId);
            stats = errorStore.getStats();
            return [2 /*return*/, JSON.stringify(stats)];
        });
    });
}
/**
 * RPC: Dismiss an insight
 */
function rpcDismissInsight(ctx, logger, _nk, payload) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var insightId_1, insights, index;
        return tslib_1.__generator(this, function (_a) {
            logger.info('Error insight dismiss requested by user: %s', ctx.userId);
            if (!payload) {
                return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing insight ID' })];
            }
            try {
                insightId_1 = JSON.parse(payload).insightId;
                if (!insightId_1) {
                    return [2 /*return*/, JSON.stringify({ success: false, error: 'Missing insight ID' })];
                }
                insights = errorStore.getInsights();
                index = insights.findIndex(function (i) { return i.id === insightId_1; });
                if (index === -1) {
                    return [2 /*return*/, JSON.stringify({ success: false, error: 'Insight not found' })];
                }
                // Remove the insight
                insights.splice(index, 1);
                return [2 /*return*/, JSON.stringify({ success: true })];
            }
            catch (_b) {
                return [2 /*return*/, JSON.stringify({ success: false, error: 'Invalid payload' })];
            }
            return [2 /*return*/];
        });
    });
}
/**
 * Initialize the error insight pipeline
 */
function initializeErrorInsightsPipeline(_logger) {
    if (!config_1.config.errorInsights.enabled) {
        logger_1.logger.info('Error Insights Pipeline is disabled');
        return;
    }
    logger_1.logger.info('Initializing Error Insights Pipeline', {
        aggregationWindowMinutes: config_1.config.errorInsights.aggregationWindowMinutes,
        minOccurrencesForInsight: config_1.config.errorInsights.minOccurrencesForInsight,
        insightWindowHours: config_1.config.errorInsights.insightWindowHours,
        maxPatterns: config_1.config.errorInsights.maxPatterns,
        maxInsights: config_1.config.errorInsights.maxInsights,
    });
    // Log initialization
    logger_1.logger.info('Error Insights Pipeline initialized successfully', {
        operation: 'error_insights_init',
    });
}
/**
 * Get the error store for testing
 */
function getErrorStore() {
    return errorStore;
}
