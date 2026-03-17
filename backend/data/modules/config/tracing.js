"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTracer = getTracer;
exports.extractTraceContext = extractTraceContext;
exports.injectTraceContext = injectTraceContext;
exports.startSpan = startSpan;
exports.traceAsync = traceAsync;
exports.traceSync = traceSync;
exports.addSpanEvent = addSpanEvent;
exports.setSpanAttribute = setSpanAttribute;
exports.wrapRpcHandler = wrapRpcHandler;
exports.initializeTracing = initializeTracing;
exports.getTracingConfig = getTracingConfig;
exports.isTracingEnabled = isTracingEnabled;
exports.shutdownTracing = shutdownTracing;
var tslib_1 = require("tslib");
var api_1 = require("@opentelemetry/api");
var auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
var exporter_jaeger_1 = require("@opentelemetry/exporter-jaeger");
var exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
var exporter_zipkin_1 = require("@opentelemetry/exporter-zipkin");
var resources_1 = require("@opentelemetry/resources");
var sdk_node_1 = require("@opentelemetry/sdk-node");
var semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
var config_1 = require("../config");
var tracing_helpers_1 = require("../utils/tracing-helpers");
var logger_1 = require("./logger");
var tracingInitialized = false;
var sdk = null;
var tracer = null;
/**
 * Get the OpenTelemetry tracer instance.
 * Creates a new tracer if tracing is enabled, otherwise returns a no-op tracer.
 */
function getTracer() {
    if (!tracer) {
        tracer = api_1.trace.getTracer(config_1.config.tracing.serviceName, config_1.config.tracing.serviceVersion);
    }
    return tracer;
}
/**
 * Extract trace context from HTTP headers (W3C Trace Context format).
 * This enables distributed trace context propagation across service calls.
 */
function extractTraceContext(headers) {
    var e_1, _a;
    try {
        // Use OpenTelemetry's built-in W3C Trace Context propagation
        var carrier = {};
        try {
            // Convert headers to simple string record
            for (var _b = tslib_1.__values(Object.entries(headers)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), key = _d[0], value = _d[1];
                if (Array.isArray(value)) {
                    carrier[key] = value[0];
                }
                else if (value) {
                    carrier[key] = value;
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
        var extracted = api_1.propagation.extract(api_1.context.active(), carrier);
        return { extractedContext: extracted };
    }
    catch (error) {
        logger_1.logger.warn('[Tracing] Failed to extract trace context', { error: error });
        return { extractedContext: api_1.context.active() };
    }
}
/**
 * Inject current trace context into headers for outgoing requests.
 * Uses W3C Trace Context format for standardized propagation.
 */
function injectTraceContext(headers) {
    try {
        api_1.propagation.inject(api_1.context.active(), headers);
    }
    catch (error) {
        logger_1.logger.warn('[Tracing] Failed to inject trace context', { error: error });
    }
}
/**
 * Start a new span with optional parent context.
 */
function startSpan(name, options) {
    var tracer = getTracer();
    return tracer.startSpan(name, {
        kind: (options === null || options === void 0 ? void 0 : options.kind) || api_1.SpanKind.INTERNAL,
        attributes: (options === null || options === void 0 ? void 0 : options.attributes) || {},
    });
}
/**
 * Execute a function within a traced span.
 * Automatically handles span creation, status, and end.
 */
function traceAsync(name, fn, options) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, (0, tracing_helpers_1.withSpanAsync)(name, fn, options)];
        });
    });
}
/**
 * Execute a synchronous function within a traced span.
 */
function traceSync(name, fn, options) {
    return (0, tracing_helpers_1.withSpanSync)(name, fn, options);
}
/**
 * Add event to current span.
 */
function addSpanEvent(name, attributes) {
    var activeSpan = api_1.trace.getSpan(api_1.context.active());
    if (activeSpan) {
        activeSpan.addEvent(name, attributes);
    }
}
/**
 * Set attribute on current span.
 */
function setSpanAttribute(key, value) {
    var activeSpan = api_1.trace.getSpan(api_1.context.active());
    if (activeSpan) {
        activeSpan.setAttribute(key, value);
    }
}
/**
 * Wrap an RPC handler with tracing.
 * Automatically creates spans with relevant Nakama context information.
 */
function wrapRpcHandler(handlerName, handler) {
    var _this = this;
    return function (ctx, logger, nk, payload) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var tracer, span, nakamaCtx, result, error_1;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tracer = getTracer();
                    span = tracer.startSpan("rpc.".concat(handlerName), {
                        kind: api_1.SpanKind.SERVER,
                        attributes: {
                            'rpc.system': 'nakama',
                            'rpc.method': handlerName,
                            'deployment.environment': config_1.config.environment,
                        },
                    });
                    nakamaCtx = ctx;
                    (0, tracing_helpers_1.setNakamaContextAttributes)(span, nakamaCtx || {});
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, handler(ctx, logger, nk, payload)];
                case 2:
                    result = _a.sent();
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error_1 instanceof Error ? error_1.message : String(error_1),
                    });
                    span.recordException(error_1 instanceof Error ? error_1 : new Error(String(error_1)));
                    throw error_1;
                case 4:
                    span.end();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
}
/**
 * Initialize the OpenTelemetry tracing SDK.
 */
function initializeTracing() {
    var _a;
    var tracingConfig = config_1.config.tracing;
    if (!tracingConfig.enabled) {
        logger_1.logger.info('[Tracing] Distributed tracing is disabled');
        return;
    }
    if (tracingInitialized) {
        logger_1.logger.warn('[Tracing] Tracing already initialized');
        return;
    }
    try {
        // Create resource with service information
        var resource = (0, resources_1.resourceFromAttributes)((_a = {},
            _a[semantic_conventions_1.SEMRESATTRS_SERVICE_NAME] = tracingConfig.serviceName,
            _a[semantic_conventions_1.SEMRESATTRS_SERVICE_VERSION] = tracingConfig.serviceVersion,
            _a[semantic_conventions_1.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = config_1.config.environment,
            _a));
        // Set up exporters based on configuration
        var exporter = void 0;
        switch (tracingConfig.exporter) {
            case 'jaeger':
                exporter = new exporter_jaeger_1.JaegerExporter({
                    endpoint: tracingConfig.jaegerEndpoint || 'http://localhost:14268',
                });
                logger_1.logger.info("[Tracing] Jaeger exporter configured: ".concat(tracingConfig.jaegerEndpoint));
                break;
            case 'zipkin':
                exporter = new exporter_zipkin_1.ZipkinExporter({
                    url: tracingConfig.zipkinEndpoint || 'http://localhost:9411',
                });
                logger_1.logger.info("[Tracing] Zipkin exporter configured: ".concat(tracingConfig.zipkinEndpoint));
                break;
            case 'otlp':
                exporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
                    url: tracingConfig.otlpEndpoint || 'http://localhost:4318',
                });
                logger_1.logger.info("[Tracing] OTLP exporter configured: ".concat(tracingConfig.otlpEndpoint));
                break;
            case 'none':
                logger_1.logger.info('[Tracing] Tracing initialized without exporter (for development)');
                break;
            default:
                logger_1.logger.warn("[Tracing] Unknown exporter type: ".concat(tracingConfig.exporter));
                break;
        }
        // Build instrumentations list
        var instrumentations = [];
        if (tracingConfig.autoInstrumentations) {
            var autoInst = (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                // Only enable specified instrumentations
                '@opentelemetry/instrumentation-http': {
                    enabled: tracingConfig.instrumentations.includes('http'),
                },
                '@opentelemetry/instrumentation-express': {
                    enabled: tracingConfig.instrumentations.includes('express'),
                },
                '@opentelemetry/instrumentation-pg': {
                    enabled: tracingConfig.instrumentations.includes('pg'),
                },
            });
            // getNodeAutoInstrumentations returns an array
            instrumentations = autoInst;
        }
        // Create and start the SDK
        // Note: Type assertion needed due to version mismatch between exporters in dependency tree
        sdk = new sdk_node_1.NodeSDK({
            resource: resource,
            traceExporter: exporter,
            instrumentations: instrumentations,
            serviceName: tracingConfig.serviceName,
        });
        // Start the SDK
        sdk.start();
        logger_1.logger.info("[Tracing] OpenTelemetry SDK started - service: ".concat(tracingConfig.serviceName, ", environment: ").concat(config_1.config.environment));
        tracingInitialized = true;
        // Handle graceful shutdown
        process.on('SIGTERM', function () {
            logger_1.logger.info('[Tracing] Shutting down OpenTelemetry SDK');
            sdk === null || sdk === void 0 ? void 0 : sdk.shutdown().catch(function (err) {
                logger_1.logger.error('[Tracing] Error shutting down SDK', err);
            });
        });
    }
    catch (error) {
        logger_1.logger.error('[Tracing] Failed to initialize tracing', error);
    }
}
/**
 * Get the current tracing configuration.
 */
function getTracingConfig() {
    return config_1.config.tracing;
}
/**
 * Check if tracing is enabled.
 */
function isTracingEnabled() {
    return config_1.config.tracing.enabled && tracingInitialized;
}
/**
 * Shutdown the tracing SDK.
 */
function shutdownTracing() {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!sdk) return [3 /*break*/, 2];
                    return [4 /*yield*/, sdk.shutdown()];
                case 1:
                    _a.sent();
                    tracingInitialized = false;
                    logger_1.logger.info('[Tracing] Tracing SDK shut down');
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
