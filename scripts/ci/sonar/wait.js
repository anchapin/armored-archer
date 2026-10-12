'use strict';
module.exports = async ({github, context, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) => {
  const repo = context.repo;
  const pull = context.payload.pull_request;
  const sha = pull.head.sha;
  const deadline = now() + 35 * 60 * 1000;
  while (now() < deadline) {
    const {data: current} = await github.rest.pulls.get({...repo, pull_number: pull.number});
    if (current.head.sha !== sha || current.state !== 'open') throw new Error('Head changed or PR closed');
    const checks = await github.paginate(github.rest.checks.listForRef, {...repo, ref: sha, per_page: 100});
    const candidates = checks.filter(c => c.name === 'Dependabot Sonar Quality Gate' &&
      c.app?.slug === 'github-actions' && /^sonar-preparation:\d+:[a-f0-9]{40}$/.test(c.external_id || ''));
    candidates.sort((a, b) => b.id - a.id);
    if (candidates.length) {
      const check = candidates[0];
      const preparation = Number(check.external_id.split(':')[1]);
      const expected = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/`;
      if (!check.details_url?.startsWith(expected) || check.external_id.split(':')[2] !== sha) {
        throw new Error('Wrong result provenance');
      }
      const receiverId = Number(check.details_url.slice(expected.length));
      if (!Number.isSafeInteger(receiverId)) throw new Error('Invalid receiver ID');
      const {data: receiver} = await github.rest.actions.getWorkflowRun({...repo, run_id: receiverId});
      const {data: source} = await github.rest.actions.getWorkflowRun({...repo, run_id: preparation});
      if (receiver.path !== '.github/workflows/dependabot-sonar-scan.yml' || receiver.event !== 'workflow_run' ||
          receiver.repository.full_name !== `${repo.owner}/${repo.repo}` ||
          source.path !== '.github/workflows/dependabot-sonar-prepare.yml' || source.event !== 'pull_request' ||
          source.repository?.full_name !== `${repo.owner}/${repo.repo}` ||
          source.head_repository?.full_name !== `${repo.owner}/${repo.repo}` || source.head_sha !== sha || source.actor.login !== 'dependabot[bot]' || source.conclusion !== 'success') {
        throw new Error('Result did not originate from trusted scanner and exact-head preparation');
      }
      if (check.status === 'completed' && receiver.status === 'completed') {
        if (receiver.conclusion !== 'success') throw new Error('Trusted scanner workflow did not pass');
        if (check.conclusion !== 'success') throw new Error('Sonar quality gate did not pass');
        return;
      }
    }
    await sleep(30000);
  }
  throw new Error('Timed out awaiting exact-head trusted Sonar quality gate');
};
