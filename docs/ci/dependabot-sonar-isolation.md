# Dependabot Sonar isolation

Dependabot `pull_request` runs cannot read ordinary Actions secrets. A human
rerun retains those restrictions. Do not fix this by running PR installs or
tests under `pull_request_target` with elevated credentials.

## Trust boundary

`Dependabot Sonar Preparation` installs, builds, and tests the exact PR head
without Sonar credentials. It uploads only backend LCOV and Python coverage.
The trusted `workflow_run` receiver runs the default branch's policy, verifies
the source workflow/event/repository/actor/current open PR SHA through GitHub's
API, and downloads the one expected artifact from that exact run.

The receiver creates a fresh passive source tree. It rejects source symlinks,
special files, coverage path traversal, unexpected archive members, oversized
inputs, and XML entities. It does not load PR scanner configuration, install
packages, execute tests, import PR scripts, or run PR-generated binaries. The
scanner and its inputs are fixed in the trusted workflow. Checkout credentials
are not persisted; scanner actions and setup actions use immutable revisions.

Fresh SCM metadata is fetched from the fixed repository without checking out
fetched files or copying the PR checkout's Git configuration. Both project
quality gates must pass for the exact current PR head. The CI result waiter
verifies the result's producer, preparation run, trusted receiver workflow and
receiver completion. Missing, stale, failed, cancelled or timed-out results
never approve a merge. No broad Dependabot secret or privileged PR build is
introduced.

## Bootstrap and verification

The receiver must first exist on the default branch. The workflow PR retains
the existing Sonar job for non-Dependabot PRs so it can pass ordinary CI before
landing. Dependabot PRs use the isolated path only after those workflows and
policy scripts land. Refresh a dependency PR through a reviewed update and
verify preparation, both scanner quality gates, the exact-head result and CI
waiter. A local test run alone is not proof the live receiver works.

Security-sensitive workflow changes need human review before merge. Keep
ordinary PR/main gates in force; do not mark a dependency PR ready merely
because its old Sonar job is skipped. The replacement gate must succeed.

## Remaining risk

PR code is still untrusted. Source parsers and the pinned scanner are part of
the trusted computing boundary. Dependency tests can falsify their own report;
coverage artifacts are not authentication. Separate CI tests and quality gates
remain required. This design limits credential exposure; it does not prove a
dependency is safe or eliminate supply-chain risks. Use least-privilege Sonar
credentials and avoid configuring sensitive server-side analysis settings.

References:

- https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-on-actions
- https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
