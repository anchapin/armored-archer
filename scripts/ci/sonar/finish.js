'use strict';
module.exports = async ({github, context}) => {
  const number = Number(process.env.PR_NUMBER);
  const check = Number(process.env.CHECK_ID);
  if (!number || !check) return;
  const {data: pull} = await github.rest.pulls.get({...context.repo, pull_number: number});
  const current = pull.state === 'open' && pull.head.sha === process.env.PR_SHA;
  const success = current && process.env.SCAN_RESULT === 'success';
  await github.rest.checks.update({...context.repo, check_run_id: check,
    status: 'completed', conclusion: success ? 'success' : 'failure',
    output: {title: success ? 'Both Sonar quality gates passed' : 'Sonar gate failed or head changed',
      summary: success ? 'Exact current head passed backend and game analysis in the trusted scanner.' :
        'No merge approval: scan failed, was cancelled, or the PR head changed.'}
  });
};
