'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validate} = require('../ci/sonar/provenance');
const sha = 'a'.repeat(40);
const repo = {owner: 'anchapin', repo: 'armored-archer'};
function fixture() {
  return {
    run: {repository: {full_name: 'anchapin/armored-archer'}, head_repository: {full_name: 'anchapin/armored-archer'},
      event: 'pull_request', conclusion: 'success', path: '.github/workflows/dependabot-sonar-prepare.yml',
      actor: {login: 'dependabot[bot]'}, head_sha: sha},
    pull: {number: 1527, state: 'open', user: {login: 'dependabot[bot]'},
      head: {repo: {full_name: 'anchapin/armored-archer'}, sha, ref: 'dependabot/npm/update'},
      base: {repo: {full_name: 'anchapin/armored-archer'}, ref: 'main'}}
  };
}
test('current exact-head Dependabot run is accepted', () => {
  const {run, pull} = fixture();
  assert.equal(validate(run, pull, repo).sha, sha);
});
for (const [name, mutate] of [
  ['foreign repo', f => {f.run.head_repository.full_name = 'attacker/fork';}],
  ['wrong workflow', f => {f.run.path = '.github/workflows/evil.yml';}],
  ['failed preparation', f => {f.run.conclusion = 'failure';}],
  ['wrong actor', f => {f.run.actor.login = 'attacker';}],
  ['wrong event', f => {f.run.event = 'push';}],
  ['stale SHA', f => {f.pull.head.sha = 'b'.repeat(40);}],
  ['closed PR', f => {f.pull.state = 'closed';}],
  ['foreign author', f => {f.pull.user.login = 'attacker';}],
  ['argument injection', f => {f.pull.head.ref = 'x -Dsonar.host.url=evil';}],
  ['invalid SHA', f => {f.run.head_sha = 'not-a-sha';}],
]) {
  test(`reject ${name}`, () => {const f = fixture(); mutate(f); assert.throws(() => validate(f.run, f.pull, repo));});
}
