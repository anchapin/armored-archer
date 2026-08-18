// Minimal bundle-shaped fixture for validate-nakama-bundle.js — issue #994.
// Mirrors the TEST INJECTION block recovered from the pr-review-merge session
// stash ("test-injection debris in backend/data/modules/index.js", issue #957
// follow-up). Every construct below LOOKS like ES6 but lives inside a string,
// template, or comment context — the validator must report ZERO violations.
// Fixture B (this file + the real-ES6 block appended by the test) must flag
// every pattern name instead.

// TEST INJECTION (start) — verifies string-context stripping
// These string literals contain ES6-looking code but are NOT actual ES6 patterns.
var __testStringSingle   = 'let arrow = () => 1; class Foo {}; const x = 1; async function f() {}';
var __testStringDouble   = "let arrow = () => 1; class Foo {}; const x = 1; async function f() {}";
var __testStringTemplate = `let arrow = () => 1; class Foo {}; const x = 1; async function f() {}`;
var __testStringTemplate2 = `
  const x = 1;
  let y = 2;
  class Foo { method() { return async () => await 1; } }
`;
var __testStringEscapes  = 'don\'t "use" \`backticks\` here \\n newline';
var __testStringNested   = "outer 'inner \"deepest\" done' tail";
// Comments carrying ES6-looking code must not be flagged either.
// const commented = 1; let commented2 = () => {}; class Commented {}; async () => await 1;
/* Block comment trap: const blocked = `x ${y}`; let blocked2 = 2; */
// TEST INJECTION (end)

function healthCheck(ctx, logger, nk, payload) {
  return true;
}
