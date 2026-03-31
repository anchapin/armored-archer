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
import type { RuleModule } from '@typescript-eslint/utils/dist/ts-eslint/Rule';
interface RuleOptions {
    allowedMethods?: string[];
    maxLoopDepth?: number;
}
export declare const NPlusOneDetectionRule: RuleModule<'nPlusOneQuery' | 'nPlusOneIteration', [RuleOptions?]>;
export default NPlusOneDetectionRule;
