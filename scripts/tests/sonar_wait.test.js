'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wait = require('../ci/sonar/wait');
const sha = 'a'.repeat(40);
function fixture() {
  const source = {path: '.github/workflows/dependabot-sonar-prepare.yml', event: 'pull_request',
    repository: {full_name: 'anchapin/armored-archer'}, head_repository: {full_name: 'anchapin/armored-archer'},
    head_sha: sha, actor: {login: 'dependabot[bot]'}, conclusion: 'success'};
  const receiver = {path: '.github/workflows/dependabot-sonar-scan.yml', event: 'workflow_run',
    repository: {full_name: 'anchapin/armored-archer'}, head_repository: {full_name: 'anchapin/armored-archer'},
    actor: {login: 'dependabot[bot]'}, head_branch: 'main', status: 'completed', conclusion: 'success'};
  const check = {id: 99, name: 'Dependabot Sonar Quality Gate', app: {slug: 'github-actions'},
    external_id: `sonar-isolated:12:34:${sha}`, status: 'completed', conclusion: 'success',
    details_url: 'https://github.com/anchapin/armored-archer/actions/runs/34'};
  const pull = {head: {sha}, state: 'open'};
  const github = {paginate: async () => [check], rest: {
    pulls: {get: async () => ({data: pull})}, checks: {listForRef: () => {}},
    actions: {getWorkflowRun: async ({run_id}) => ({data: run_id === 12 ? source : receiver})}
  }};
  const context = {repo: {owner: 'anchapin', repo: 'armored-archer'}, serverUrl: 'https://github.com',
    payload: {pull_request: {head: {sha}, base: {ref: 'main'}, number: 1533}}};
  return {github, context, source, receiver, check, pull};
}
test('accept exact-head trusted successful result', async () => {await wait(fixture());});
test('GitHub rewritten details URL does not carry identity', async () => {
  const f = fixture(); f.check.details_url = 'https://github.com/anchapin/armored-archer/runs/99';
  await wait(f);
});
for (const [name, mutate] of [
  ['foreign receiver', f => {f.receiver.path = '.github/workflows/evil.yml';}],
  ['failed receiver', f => {f.receiver.conclusion = 'failure';}],
  ['failed quality gate', f => {f.check.conclusion = 'failure';}],
  ['wrong source SHA', f => {f.source.head_sha = 'b'.repeat(40);}],
  ['wrong receiver actor', f => {f.receiver.actor.login = 'attacker';}],
  ['foreign receiver head repo', f => {f.receiver.head_repository.full_name = 'evil/repo';}],
  ['wrong receiver branch', f => {f.receiver.head_branch = 'untrusted';}],
  ['wrong result SHA', f => {f.check.external_id = `sonar-isolated:12:34:${'b'.repeat(40)}`;}],
  ['unsafe receiver ID', f => {f.check.external_id = `sonar-isolated:12:99999999999999999999:${sha}`;}],
  ['stale head', f => {f.pull.head.sha = 'b'.repeat(40);}],
  ['wrong source actor', f => {f.source.actor.login = 'attacker';}],
]) {
  test(`reject ${name}`, async () => {const f = fixture(); mutate(f); await assert.rejects(wait(f));});
}

test('missing result times out without approval', async () => {
  const f = fixture(); f.github.paginate = async () => [];
  let clock = 0; f.now = () => clock; f.sleep = async ms => {clock += ms;};
  await assert.rejects(wait(f), /Timed out/);
});
test('foreign app cannot produce approval', async () => {
  const f = fixture(); f.check.app.slug = 'foreign-app';
  let clock = 0; f.now = () => clock; f.sleep = async ms => {clock += ms;};
  await assert.rejects(wait(f), /Timed out/);
});
test('premature success check cannot approve running receiver', async () => {
  const f = fixture(); f.receiver.status = 'in_progress';
  let clock = 0; f.now = () => clock; f.sleep = async ms => {clock += ms;};
  await assert.rejects(wait(f), /Timed out/);
});
