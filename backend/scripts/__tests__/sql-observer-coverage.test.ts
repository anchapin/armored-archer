import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

type HostCall = { api: string; line: number };

/** Syntactic guard for direct, statically named host API calls, not alias/data-flow analysis. */
function hostSqlCalls(source: string): HostCall[] {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  const calls: HostCall[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      let api: string | undefined;
      if (ts.isPropertyAccessExpression(callee)) api = callee.name.text;
      if (ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression)) {
        api = callee.argumentExpression.text;
      }
      if (api && ['sqlQuery', 'sqlExec', 'dbQuery'].includes(api)) {
        calls.push({ api, line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

function runtimeSources(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['__tests__', '__mocks__'].includes(entry.name) ? [] : runtimeSources(full);
    }
    return entry.name.endsWith('.ts') && !/\.(?:d|test|spec)\.ts$/.test(entry.name) ? [full] : [];
  });
}

it.each([
  'nk.sqlQuery("SELECT 1")',
  'nk["sqlExec"]("DELETE FROM fixture")',
  'nk.sqlQuery?.("SELECT 1")',
  'nk?.sqlQuery("SELECT 1")',
  'nk.dbQuery("SELECT 1")',
])('detects a direct statically named host SQL call: %s', (source) => {
  expect(hostSqlCalls(source)).toHaveLength(1);
});

it('ignores comments, strings, declarations and observer calls', () => {
  expect(
    hostSqlCalls(`
    // nk.sqlQuery('comment');
    const text = "nk.sqlQuery('text')";
    interface Host { sqlQuery(query: string): unknown[]; }
    observedSqlQuery(nk, 'fixed.read', 'SELECT 1');
  `)
  ).toEqual([]);
});

it('keeps direct runtime SQL calls inside the shared observer', () => {
  const root = path.resolve(__dirname, '../../src');
  const violations: string[] = [];
  let observerCalls = 0;
  for (const file of runtimeSources(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    for (const call of hostSqlCalls(fs.readFileSync(file, 'utf8'))) {
      if (relative === 'utils/sql-observability.ts' && call.api === 'sqlQuery') {
        observerCalls++;
      } else {
        violations.push(`${relative}:${call.line} direct ${call.api}`);
      }
    }
  }
  expect(violations).toEqual([]);
  expect(observerCalls).toBe(1);
});
