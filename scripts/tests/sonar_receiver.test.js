'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const receive = require('../ci/sonar/receive');
const finish = require('../ci/sonar/finish');
const sha = 'a'.repeat(40);
function fixture() {
  const repo = {full_name: 'anchapin/armored-archer'};
  const run = {id: 12, repository: repo, head_repository: repo, event: 'pull_request',
    conclusion: 'success', path: '.github/workflows/dependabot-sonar-prepare.yml', actor: {login: 'dependabot[bot]'}, head_sha: sha};
  const pull = {number: 1533, state: 'open', user: {login: 'dependabot[bot]'},
    head: {repo, sha, ref: 'dependabot/npm/a'}, base: {repo, ref: 'main'}};
  const artifacts = [{id: 77, name: `sonar-coverage-${sha}`, expired: false, size_in_bytes: 5}];
  const outputs = {}, updates = [], created = [];
  const github = {paginate: async () => artifacts, rest: {
    actions: {getWorkflowRun: async () => ({data: run}), listWorkflowRunArtifacts: () => {},
      downloadArtifact: async () => ({data: new Uint8Array([1, 2, 3])})},
    repos: {listPullRequestsAssociatedWithCommit: async () => ({data: [{number: pull.number}]})},
    pulls: {get: async () => ({data: pull})},
    checks: {create: async body => {created.push(body); return {data: {id: 88}};}, update: async body => {updates.push(body);}}
  }};
  const context = {repo: {owner: 'anchapin', repo: 'armored-archer'}, payload: {workflow_run: {id: 12}},
    runId: 34, serverUrl: 'https://github.com'};
  return {github, context, core: {setOutput: (k, v) => {outputs[k] = v;}}, run, pull, artifacts, outputs, updates, created};
}
test('receiver downloads only exact-run artifact and creates SHA result', async () => {
  const before = process.cwd();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-receiver-test-'));
  try {
    process.chdir(temporary);
    const f = fixture(); await receive(f); assert.equal(f.outputs.sha, sha); assert.equal(f.outputs.check, '88');
    assert.equal(f.created[0].external_id, `sonar-isolated:12:34:${sha}`);
    assert.equal(fs.readFileSync('trusted-artifact/sonar-coverage.zip').length, 3);
    assert.equal(fs.statSync('trusted-artifact').mode & 0o777, 0o700);
    assert.equal(fs.statSync('trusted-artifact/sonar-coverage.zip').mode & 0o777, 0o600);
    await assert.rejects(receive(f));
  } finally { process.chdir(before); fs.rmSync(temporary, {recursive: true}); }
});
test('receiver rejects pre-placed artifact-directory symlinks', async () => {
  const before = process.cwd();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-receiver-test-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-outside-test-'));
  try {
    process.chdir(temporary);
    fs.symlinkSync(outside, 'trusted-artifact');
    await assert.rejects(receive(fixture()));
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally {
    process.chdir(before);
    fs.rmSync(temporary, {recursive: true}); fs.rmSync(outside, {recursive: true});
  }
});
for (const [name, mutate] of [
  ['wrong workflow', f => {f.run.path = 'evil.yml';}],
  ['stale head', f => {f.pull.head.sha = 'b'.repeat(40);}],
  ['missing artifact', f => {f.artifacts.length = 0;}],
  ['duplicate artifact', f => {f.artifacts.push({...f.artifacts[0]});}],
  ['expired artifact', f => {f.artifacts[0].expired = true;}],
  ['oversize artifact', f => {f.artifacts[0].size_in_bytes = 30 * 1024 * 1024;}],
]) {
  test(`receiver rejects ${name}`, async () => {const f = fixture(); mutate(f); await assert.rejects(receive(f));});
}
for (const [name, state, result, expected] of [
  ['success', 'open', 'success', 'success'], ['scan failure', 'open', 'failure', 'failure'],
  ['closed PR', 'closed', 'success', 'failure'], ['cancelled', 'open', 'cancelled', 'failure'],
]) {
  test(`finish ${name}`, async () => {
    const f = fixture(); f.pull.state = state;
    process.env.PR_NUMBER = '1533'; process.env.CHECK_ID = '88'; process.env.PR_SHA = sha; process.env.SCAN_RESULT = result;
    await finish(f); assert.equal(f.updates[0].conclusion, expected);
  });
}
test('finish ignores missing check', async () => {
  const f = fixture(); process.env.CHECK_ID = ''; await finish(f); assert.equal(f.updates.length, 0);
});
