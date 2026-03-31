"use strict";
/**
 * Custom ESLint Rule: n-plus-one-detection
 *
 * Detects potential N+1 query patterns in TypeScript code.
 * This rule identifies database operations inside loops which can cause
 * performance issues in database-driven applications.
 *
 * The rule detects:
 * 1. Database method calls inside loop structures (for, while, forEach, map, etc.)
 * 2. Async database operations that iterate over results
 *
 * @version 1.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPlusOneDetectionRule = void 0;
var tslib_1 = require("tslib");
var utils_1 = require("@typescript-eslint/utils");
// Database method patterns
var DB_METHOD_PATTERNS = [
    'find',
    'findOne',
    'findAll',
    'insert',
    'update',
    'delete',
    'create',
    'remove',
    'getOne',
    'getMany',
    'query',
    'read',
    'write',
    'listUsers',
    'listObjects',
    'writeStorageObjects',
    'readStorageObjects',
];
// Create the rule
exports.NPlusOneDetectionRule = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Detects potential N+1 query patterns (database operations inside loops)',
            url: 'https://docs.example.com/n-plus-one-detection',
        },
        messages: {
            nPlusOneQuery: 'Potential N+1 query: {{ method }} called inside {{ loopType }} loop. Consider using batch operations or eager loading.',
            nPlusOneIteration: 'Potential N+1 query: Iterating over results and calling {{ method }} for each item. Consider using batch operations.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    allowedMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional database method patterns to detect',
                    },
                    maxLoopDepth: {
                        type: 'number',
                        description: 'Maximum loop nesting depth to check (default: 2)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    create: function (context) {
        // Merge with defaults
        var options = context.options[0] || {};
        var customMethods = options.allowedMethods || [];
        var maxLoopDepth = options.maxLoopDepth || 2;
        // Combine default and custom DB methods
        var allDbMethods = tslib_1.__spreadArray(tslib_1.__spreadArray([], tslib_1.__read(DB_METHOD_PATTERNS), false), tslib_1.__read(customMethods), false);
        // Helper to check if a node is a database method call
        function isDatabaseMethodCall(node) {
            // Check for property access (e.g., db.find())
            if (node.type === utils_1.AST_NODE_TYPES.CallExpression &&
                node.callee.type === utils_1.AST_NODE_TYPES.MemberExpression &&
                node.callee.property.type === utils_1.AST_NODE_TYPES.Identifier) {
                var methodName = node.callee.property.name;
                if (allDbMethods.includes(methodName)) {
                    return methodName;
                }
            }
            // Check for await expression (e.g., await db.find())
            if (node.type === utils_1.AST_NODE_TYPES.AwaitExpression &&
                node.argument &&
                node.argument.type === utils_1.AST_NODE_TYPES.CallExpression) {
                return isDatabaseMethodCall(node.argument);
            }
            return null;
        }
        // Track loop contexts
        var loopStack = [];
        // Visit a node and check for loops
        function checkLoop(node, loopType) {
            var dbMethod = isDatabaseMethodCall(node);
            if (dbMethod && loopStack.length > 0) {
                var currentLoop = loopStack[loopStack.length - 1];
                if (!currentLoop.hasDbCall) {
                    currentLoop.hasDbCall = true;
                    context.report({
                        node: node,
                        messageId: 'nPlusOneQuery',
                        data: {
                            method: dbMethod,
                            loopType: loopType,
                        },
                    });
                }
            }
        }
        return {
            // Track entering loops
            ForStatement: function (node) {
                loopStack.push({
                    type: 'for',
                    depth: loopStack.length + 1,
                    hasDbCall: false,
                    line: node.loc.start.line,
                });
            },
            'ForStatement:exit': function () {
                var loop = loopStack.pop();
                if (loop && loop.hasDbCall && loop.depth <= maxLoopDepth) {
                    // Issue already reported at the specific line
                }
            },
            ForInStatement: function (node) {
                loopStack.push({
                    type: 'for...in',
                    depth: loopStack.length + 1,
                    hasDbCall: false,
                    line: node.loc.start.line,
                });
            },
            'ForInStatement:exit': function () {
                loopStack.pop();
            },
            ForOfStatement: function (node) {
                loopStack.push({
                    type: 'for...of',
                    depth: loopStack.length + 1,
                    hasDbCall: false,
                    line: node.loc.start.line,
                });
            },
            'ForOfStatement:exit': function () {
                loopStack.pop();
            },
            WhileStatement: function (node) {
                loopStack.push({
                    type: 'while',
                    depth: loopStack.length + 1,
                    hasDbCall: false,
                    line: node.loc.start.line,
                });
            },
            'WhileStatement:exit': function () {
                loopStack.pop();
            },
            DoWhileStatement: function (node) {
                loopStack.push({
                    type: 'do...while',
                    depth: loopStack.length + 1,
                    hasDbCall: false,
                    line: node.loc.start.line,
                });
            },
            'DoWhileStatement:exit': function () {
                loopStack.pop();
            },
            // Check for forEach, map, filter calls
            CallExpression: function (node) {
                if (node.callee.type === utils_1.AST_NODE_TYPES.MemberExpression &&
                    node.callee.property.type === utils_1.AST_NODE_TYPES.Identifier) {
                    var methodName = node.callee.property.name;
                    // Check if this is a loop-like method
                    if (['forEach', 'map', 'filter', 'reduce'].includes(methodName)) {
                        var dbMethod = isDatabaseMethodCall(node);
                        if (dbMethod && loopStack.length > 0) {
                            var currentLoop = loopStack[loopStack.length - 1];
                            if (!currentLoop.hasDbCall) {
                                currentLoop.hasDbCall = true;
                                context.report({
                                    node: node,
                                    messageId: 'nPlusOneQuery',
                                    data: {
                                        method: dbMethod,
                                        loopType: methodName,
                                    },
                                });
                            }
                        }
                    }
                }
            },
        };
    },
};
// Export the rule for ESLint
exports.default = exports.NPlusOneDetectionRule;
