'use strict';

// Pure validation shared by the trusted receiver and regression tests.
const SHA = /^[a-f0-9]{40}$/;
function validate(run, pull, repository) {
  const fullName = `${repository.owner}/${repository.repo}`;
  if (run.repository?.full_name !== fullName || run.head_repository?.full_name !== fullName ||
      run.event !== 'pull_request' || run.conclusion !== 'success' ||
      run.path !== '.github/workflows/dependabot-sonar-prepare.yml' ||
      run.actor?.login !== 'dependabot[bot]' || !SHA.test(run.head_sha)) {
    throw new Error('Untrusted preparation run');
  }
  if (pull.user?.login !== 'dependabot[bot]' || pull.state !== 'open' ||
      pull.head?.repo?.full_name !== fullName || pull.base?.repo?.full_name !== fullName ||
      !['main', 'develop'].includes(pull.base?.ref) || pull.head?.sha !== run.head_sha ||
      !Number.isSafeInteger(pull.number) || pull.number <= 0 ||
      typeof pull.head?.ref !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(pull.head.ref)) {
    throw new Error('Stale or foreign pull request');
  }
  return {sha: run.head_sha, number: pull.number, branch: pull.head.ref, base: pull.base.ref};
}
module.exports = {validate};
