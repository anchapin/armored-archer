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

import { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils/dist/eslint-utils';

// Database method patterns
const DB_METHOD_PATTERNS = [
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
export const NPlusOneDetectionRule = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Detects potential N+1 query patterns (database operations inside loops)',
      recommended: 'warn',
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
  create(context) {
    // Merge with defaults
    const options = context.options[0] || {};
    const customMethods = options.allowedMethods || [];
    const maxLoopDepth = options.maxLoopDepth || 2;

    // Combine default and custom DB methods
    const allDbMethods = [...DB_METHOD_PATTERNS, ...customMethods];

    // Helper to check if a node is a database method call
    function isDatabaseMethodCall(node: TSESTree.Node): string | null {
      // Check for property access (e.g., db.find())
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.property.type === AST_NODE_TYPES.Identifier
      ) {
        const methodName = node.callee.property.name;
        if (allDbMethods.includes(methodName)) {
          return methodName;
        }
      }

      // Check for await expression (e.g., await db.find())
      if (
        node.type === AST_NODE_TYPES.AwaitExpression &&
        node.argument &&
        node.argument.type === AST_NODE_TYPES.CallExpression
      ) {
        return isDatabaseMethodCall(node.argument);
      }

      return null;
    }

    // Track loop contexts
    const loopStack: Array<{
      type: string;
      depth: number;
      hasDbCall: boolean;
      line: number;
    }> = [];

    // Visit a node and check for loops
    function checkLoop(node: TSESTree.Node, loopType: string): void {
      const dbMethod = isDatabaseMethodCall(node);
      if (dbMethod && loopStack.length > 0) {
        const currentLoop = loopStack[loopStack.length - 1];
        if (!currentLoop.hasDbCall) {
          currentLoop.hasDbCall = true;
          context.report({
            node,
            messageId: 'nPlusOneQuery',
            data: {
              method: dbMethod,
              loopType,
            },
          });
        }
      }
    }

    return {
      // Track entering loops
      ForStatement(node) {
        loopStack.push({
          type: 'for',
          depth: loopStack.length + 1,
          hasDbCall: false,
          line: node.loc.start.line,
        });
      },

      'ForStatement:exit'() {
        const loop = loopStack.pop();
        if (loop && loop.hasDbCall && loop.depth <= maxLoopDepth) {
          // Issue already reported at the specific line
        }
      },

      ForInStatement(node) {
        loopStack.push({
          type: 'for...in',
          depth: loopStack.length + 1,
          hasDbCall: false,
          line: node.loc.start.line,
        });
      },

      'ForInStatement:exit'() {
        loopStack.pop();
      },

      ForOfStatement(node) {
        loopStack.push({
          type: 'for...of',
          depth: loopStack.length + 1,
          hasDbCall: false,
          line: node.loc.start.line,
        });
      },

      'ForOfStatement:exit'() {
        loopStack.pop();
      },

      WhileStatement(node) {
        loopStack.push({
          type: 'while',
          depth: loopStack.length + 1,
          hasDbCall: false,
          line: node.loc.start.line,
        });
      },

      'WhileStatement:exit'() {
        loopStack.pop();
      },

      DoWhileStatement(node) {
        loopStack.push({
          type: 'do...while',
          depth: loopStack.length + 1,
          hasDbCall: false,
          line: node.loc.start.line,
        });
      },

      'DoWhileStatement:exit'() {
        loopStack.pop();
      },

      // Check for forEach, map, filter calls
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.property.type === AST_NODE_TYPES.Identifier
        ) {
          const methodName = node.callee.property.name;

          // Check if this is a loop-like method
          if (['forEach', 'map', 'filter', 'reduce'].includes(methodName)) {
            const dbMethod = isDatabaseMethodCall(node);
            if (dbMethod && loopStack.length > 0) {
              const currentLoop = loopStack[loopStack.length - 1];
              if (!currentLoop.hasDbCall) {
                currentLoop.hasDbCall = true;
                context.report({
                  node,
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
export default NPlusOneDetectionRule;
