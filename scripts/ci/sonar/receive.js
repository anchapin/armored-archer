'use strict';
const fs = require('node:fs');
const {validate} = require('./provenance');
module.exports = async ({github, context, core}) => {
  const repo = context.repo;
  const id = context.payload.workflow_run.id;
  const {data: run} = await github.rest.actions.getWorkflowRun({...repo, run_id: id});
  const matches = await github.rest.repos.listPullRequestsAssociatedWithCommit({...repo, commit_sha: run.head_sha});
  const candidates = [];
  for (const associated of matches.data) {
    const {data: pull} = await github.rest.pulls.get({...repo, pull_number: associated.number});
    try { candidates.push(validate(run, pull, repo)); } catch { /* not eligible */ }
  }
  if (candidates.length !== 1) throw new Error('Expected one current eligible pull request');
  const input = candidates[0];
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {...repo, run_id: id});
  const eligible = artifacts.filter(a => a.name === `sonar-coverage-${input.sha}` && !a.expired);
  if (eligible.length !== 1 || eligible[0].size_in_bytes > 25 * 1024 * 1024) {
    throw new Error('Missing, duplicate or oversize coverage artifact');
  }
  const {data: archive} = await github.rest.actions.downloadArtifact({
    ...repo, artifact_id: eligible[0].id, archive_format: 'zip'
  });
  fs.writeFileSync('/tmp/sonar-coverage.zip', Buffer.from(archive));
  const {data: check} = await github.rest.checks.create({
    ...repo, name: 'Dependabot Sonar Quality Gate', head_sha: input.sha,
    status: 'in_progress', external_id: `sonar-preparation:${id}:${input.sha}`,
    details_url: `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`,
    output: {title: 'Secret-isolated analysis', summary: 'Both project quality gates must pass for this exact head.'}
  });
  for (const [key, value] of Object.entries({...input, check: check.id, preparation: id})) {
    core.setOutput(key, String(value));
  }
};
