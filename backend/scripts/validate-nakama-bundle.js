#!/usr/bin/env node
/**
 * Validates the Nakama bundle for ES6+ syntax incompatibility.
 * Nakama's Duktape/QuickJS runtime only supports ES5.1.
 *
 * The validator strips string contexts (single-quoted, double-quoted,
 * template literals with nested ${...} expressions, and comments) before
 * pattern-matching against ES6 patterns. That way only ES6 patterns in
 * REAL code are flagged — content inside string literals or comments is
 * ignored, eliminating false positives from APM instrumentation payloads
 * (e.g. parse(...), ajv draft-2020-12 interpolation, Sentry SQL
 * sanitization) — see issue #957.
 */

// Lexer states used by stripNonCode to track carry-over between lines.
const LEX = {
  CODE: 'code',
  SQUOTE: 'squote',
  DQUOTE: 'dquote',
  TEMPLATE: 'template',
  LINE_COMMENT: 'lineComment',
  BLOCK_COMMENT: 'blockComment',
};

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.resolve(__dirname, '../data/modules/index.js');

// ES6+ patterns that Nakama's runtime cannot parse.
// Note: We check for actual code, not in strings or comments.
const es6Patterns = [
  // Check for actual const/let/class declarations (not in strings or comments)
  { pattern: /^\s*const\s+[a-zA-Z_$]/, name: 'const declaration', strict: true },
  { pattern: /^\s*let\s+[a-zA-Z_$]/, name: 'let declaration', strict: true },
  { pattern: /^\s*(export\s+)?class\s+[a-zA-Z_$]/, name: 'class declaration', strict: true },
  { pattern: /^\s*async\s+[a-zA-Z_$\(\)]/, name: 'async keyword', strict: true },
  { pattern: /^\s*await\s+/, name: 'await keyword', strict: true },
  // Arrow functions: look for actual function patterns (param) => { or param =>
  { pattern: /\([^)]*\)\s*=>\s*[\{\(]/, name: 'arrow function', strict: true },
  { pattern: /[a-zA-Z_$]\s*=>\s*\{/, name: 'arrow function (single param)', strict: true },
  // Template literals with actual interpolation (not in strings)
  { pattern: /`[^`]*\$\{[^}]+\}[^`]*`/, name: 'template literal', strict: false },
  // ES2020 BigInt literals (e.g. ioredis 6 RESP decoder). Babel cannot
  // downlevel them and Nakama 3.21's goja parser rejects them at load time
  // ("Unexpected token ILLEGAL") — they must be rewritten to BigInt("…")
  // calls by scripts/transpile-bundle.js before validation runs. The
  // boundary guards keep identifier tails (i18n, …n) from matching.
  {
    pattern: /(?:^|[^A-Za-z0-9_$])[0-9]+n(?:[^A-Za-z0-9_$]|$)/,
    name: 'BigInt literal',
    strict: true,
  },
];

/**
 * Strip the contents of strings, template literals, and comments from a
 * source line, returning a new line where non-code characters are replaced
 * by spaces (with newlines preserved). The carry state lets multi-line
 * constructs (template literals, block comments) survive across lines.
 *
 * Template literal expressions (${...}) are treated as code: their contents
 * are recursively stripped, and any nested string/template/comment contexts
 * inside them are also blanked out.
 *
 * @param {string} line - Source line to process.
 * @param {string} state - Carry-in lexer state (default: CODE).
 * @returns {{line: string, state: string}} Stripped line and carry-out state.
 */
function stripNonCode(line, state = LEX.CODE) {
  // `bundle.split('\n')` strips the trailing newline from each line, so a
  // // comment that occupied an entire line would otherwise leave the carry
  // state stuck in LINE_COMMENT and swallow the next line. Reset that
  // pseudo-state at the line boundary — real line comments can never span
  // lines.
  if (state === LEX.LINE_COMMENT) {
    state = LEX.CODE;
  }

  let result = '';
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    switch (state) {
      case LEX.LINE_COMMENT: {
        // Inside a // comment — blank until newline (which closes the comment).
        if (ch === '\n') {
          result += '\n';
          state = LEX.CODE;
        } else {
          result += ' ';
        }
        i++;
        break;
      }

      case LEX.BLOCK_COMMENT: {
        // Inside a /* ... */ comment — blank until closing */.
        if (ch === '*' && next === '/') {
          result += '  ';
          i += 2;
          state = LEX.CODE;
        } else {
          result += ch === '\n' ? '\n' : ' ';
          i++;
        }
        break;
      }

      case LEX.SQUOTE: {
        // Inside a 'string' — blank content (handle \\ escape sequences).
        if (ch === '\\') {
          result += '  ';
          i += 2;
        } else if (ch === "'") {
          result += "'";
          i++;
          state = LEX.CODE;
        } else {
          result += ch === '\n' ? '\n' : ' ';
          i++;
        }
        break;
      }

      case LEX.DQUOTE: {
        // Inside a "string" — blank content (handle \\ escape sequences).
        if (ch === '\\') {
          result += '  ';
          i += 2;
        } else if (ch === '"') {
          result += '"';
          i++;
          state = LEX.CODE;
        } else {
          result += ch === '\n' ? '\n' : ' ';
          i++;
        }
        break;
      }

      case LEX.TEMPLATE: {
        // Inside a `template literal` — blank non-expression content,
        // but preserve ${...} expressions (real code).
        if (ch === '\\') {
          result += '  ';
          i += 2;
        } else if (ch === '`') {
          // Closing backtick — exit template.
          result += '`';
          i++;
          state = LEX.CODE;
        } else if (ch === '$' && next === '{') {
          // Template expression — preserve ${...} but recursively strip
          // strings/comments inside.
          result += '${';
          i += 2;
          const slice = readBalancedExpr(line, i);
          // Recurse: expression is code, so strip its own strings/comments.
          const exprStripped = stripNonCode(slice.text, LEX.CODE);
          result += exprStripped.line;
          i = slice.end;
          if (i < line.length && line[i] === '}') {
            result += '}';
            i++;
          }
        } else {
          result += ch === '\n' ? '\n' : ' ';
          i++;
        }
        break;
      }

      case LEX.CODE:
      default: {
        if (ch === '/' && next === '/') {
          // Single-line comment.
          result += '  ';
          i += 2;
          state = LEX.LINE_COMMENT;
        } else if (ch === '/' && next === '*') {
          // Block comment.
          result += '  ';
          i += 2;
          state = LEX.BLOCK_COMMENT;
        } else if (ch === "'") {
          result += "'";
          i++;
          state = LEX.SQUOTE;
        } else if (ch === '"') {
          result += '"';
          i++;
          state = LEX.DQUOTE;
        } else if (ch === '`') {
          result += '`';
          i++;
          state = LEX.TEMPLATE;
        } else {
          result += ch;
          i++;
        }
        break;
      }
    }
  }

  return { line: result, state };
}

/**
 * Walk through `line` starting at index `start` to find the substring that
 * balances braces up to (and not including) the matching closing `}`.
 * Nested braces, strings, template literals, and template expressions are
 * tracked so we don't count braces that live inside any of those contexts.
 *
 * @param {string} line
 * @param {number} start
 * @returns {{text: string, end: number}} Expression text and the index of
 *   the closing `}` (or end-of-line if unmatched).
 */
function readBalancedExpr(line, start) {
  let depth = 1;
  let i = start;
  while (i < line.length && depth > 0) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '{') {
      depth++;
      i++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) break;
      i++;
    } else if (ch === "'" || ch === '"') {
      // Skip a nested string literal so its braces don't count.
      const quote = ch;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === '\\' && i + 1 < line.length) {
          i += 2;
        } else {
          i++;
        }
      }
      if (i < line.length) i++; // closing quote
    } else if (ch === '`') {
      // Skip a nested template literal (including its ${...} expressions).
      i++;
      while (i < line.length && line[i] !== '`') {
        if (line[i] === '\\' && i + 1 < line.length) {
          i += 2;
        } else if (line[i] === '$' && line[i + 1] === '{') {
          i += 2;
          let nestedDepth = 1;
          while (i < line.length && nestedDepth > 0) {
            if (line[i] === '{') nestedDepth++;
            else if (line[i] === '}') nestedDepth--;
            i++;
          }
        } else {
          i++;
        }
      }
      if (i < line.length) i++; // closing backtick
    } else {
      i++;
    }
  }
  return { text: line.substring(start, i), end: i };
}

function validateBundle() {
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error(`❌ Bundle not found at: ${BUNDLE_PATH}`);
    console.error('Run: npm run build && npx webpack --mode=production');
    process.exit(1);
  }

  const bundle = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const lines = bundle.split('\n');

  // Pre-process the entire bundle: replace the contents of strings,
  // template literals, and comments with spaces (preserving newlines and
  // quote/backtick characters). The carry-state lets us correctly handle
  // multi-line template literals and block comments.
  let carryState = LEX.CODE;
  const strippedLines = lines.map((line) => {
    const out = stripNonCode(line, carryState);
    carryState = out.state;
    return out.line;
  });

  let totalErrors = 0;
  const errorsByType = {};

  console.log('🔍 Validating Nakama bundle for ES5 compatibility...\n');
  console.log(`Bundle size: ${(bundle.length / 1024).toFixed(2)} KB`);
  console.log(`Total lines: ${lines.length}\n`);

  es6Patterns.forEach(({ pattern, name }) => {
    let count = 0;
    const examples = [];

    strippedLines.forEach((strippedLine, index) => {
      if (pattern.test(strippedLine)) {
        count++;
        if (examples.length < 3) {
          examples.push({
            line: index + 1,
            content: lines[index].trim().substring(0, 80),
          });
        }
      }
    });

    if (count > 0) {
      totalErrors += count;
      errorsByType[name] = count;
      console.error(`� ${name}: ${count} occurrences`);
      examples.forEach((ex) => {
        console.error(`   Line ${ex.line}: ${ex.content}`);
      });
    } else {
      console.log(`✅ ${name}: No occurrences`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (totalErrors > 0) {
    console.error(`\n❌ Bundle validation FAILED: ${totalErrors} ES6+ patterns found`);
    console.error('\nThese patterns are not compatible with Nakama\'s ES5.1 runtime.');
    console.error('The bundle needs to be transpiled with Babel to ES5.\n');
    process.exit(1);
  } else {
    console.log(`\n✅ Bundle validation PASSED: ES5 compatible`);
    console.log('The bundle is ready for Nakama runtime.\n');
    process.exit(0);
  }
}

validateBundle();
