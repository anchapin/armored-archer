# Branch Protection Rules

This document describes the branch protection rules configured for this repository per Issue #313.

## Current Enforcement Status (2026-08-18 audit — issue #1035)

**Branch protection is NOT currently enforced on `main`.** The repository is
**private on GitHub Free**, and branch protection rules are a paid/public-plan
feature. Verification (any collaborator can run this):

```bash
gh api repos/anchapin/armored-archer/branches/main/protection
# 403: "Upgrade to GitHub Pro or make this repository public to enable this feature."
gh repo view anchapin/armored-archer --json isPrivate   # isPrivate: true
```

Consequences:

- Direct pushes to `main` are **not blocked** today; the rules below are the
  intended target configuration, not live state.
- To actually enforce them, a repo owner must either make the repository public
  or upgrade the plan (GitHub Pro / Team), then apply the configuration below.
  Until then, the PR-first rule (see AGENTS.md "Commit & PR Guidelines") is
  convention only and must be policed in commit-window audits.

### Rule: verify "duplicate landings" before flagging them

Issue #1035 flagged commits `a093fdb2` (alleged direct push) and `bbade2c5`
(alleged PR #997 squash) as the same change landing twice with divergent
content. Audit conclusion — **not a duplicate landing**:

- `bbade2c5` is a **merge commit** with parents `7797d964 a093fdb2`; its second
  parent **is** the PR #997 branch head (`gh pr view 997 --json headRefOid,mergeCommit`).
- `a093fdb2` is absent from `main`'s first-parent chain; exactly one commit on
  `main` references it as a parent. The change landed exactly once.
- The two "divergent" 4-insertion diffs are byte-identical patches
  (`git diff a093fdb2^ a093fdb2 -- AGENTS.md` == `git diff bbade2c5^1 bbade2c5 -- AGENTS.md`),
  because the PR branch was based on the main-side parent. Current `AGENTS.md`
  retains the union of both diffs — nothing was dropped.

Process rule for future audits: before flagging a same-subject commit pair on
`main` as a duplicate landing, run:

```bash
git log --format='%H %P' -1 <merge-sha>                 # is it a merge? is the other sha a parent?
git rev-list --first-parent origin/main | grep -c <sha> # 0 => landed only via the merge's side branch
gh pr view <number> --json headRefOid,mergeCommit       # does the PR head equal the "direct" commit?
```

A merge commit that carries a same-subject commit as its second parent is the
normal result of merging (not squashing) a PR — not a second landing.

---

## OWNER DECISION REQUIRED — Branch Protection (issue #1060)

Branch protection on `main` cannot be enabled today because this repository is
**private on GitHub Free**. The owner must choose one of the three options below.
**Record the chosen option and its date in this file** when a decision is made.

### Option A — Upgrade to a paid plan ✅ Recommended if repo must stay private

- **What:** Upgrade to GitHub Pro (per-user, ~$4/mo) or GitHub Team (per-seat).
- **Effect:** Keeps the repo private; branch protection becomes available and
  enforceable immediately after applying the rules in this document.
- **Action:** Settings → Billing → Upgrade plan; then apply rules via
  Settings → Branches or the `branch-protection.yml` workflow.
- **Pros:** Full protection without visibility change.
- **Cons:** Ongoing cost.

### Option B — Make the repository public ✅ Available on GitHub Free

- **What:** Change repo visibility from private to public.
- **Effect:** Branch protection is available on public repos with Free plan;
  apply the rules in this document after making the repo public.
- **Action:** Settings → Change visibility → Make public; then apply rules.
  Consider whether game assets / secrets / history are safe to expose.
- **Pros:** No cost; full protection available immediately.
- **Cons:** Repository and full commit history become publicly visible.

### Option C — Accept the risk and rely on compensating controls

- **What:** Keep the repo private on Free plan; do not enable branch protection.
  Accept that direct pushes to `main` remain possible and must be managed
  through process instead of technical enforcement.
- **Compensating controls already in place:**
  - PR-gated AI workflow: the `ai-trailer-check` CI job (`.github/workflows/ci.yml`)
    validates that every commit follows the `[AI-assisted]` + `AI Model:` / `Task:`
    trailer convention before merging — see AGENTS.md "AI Agent-Assisted Development".
  - Commit-window audit: the `ci-check-ai-trailers.sh` script walks commits on the
    PR branch and rejects merges if trailers are missing (workflow: `ai-trailer-check`).
  - `make commit-check MSG=<file>` validates commit messages before push.
- **Action:** Select this option and record the decision date below.
- **Pros:** No cost, no visibility change.
- **Cons:** No technical barrier to direct pushes; relies entirely on process.
- **Decision:** If chosen, add a line like:
  > **Risk accepted** on `YYYY-MM-DD` by `<owner>` — option C selected.

---

## Protected Branches

- `main` (default branch)

## Current Configuration

The following branch protection rules are currently enforced on the `main` branch:

### Pull Request Reviews ✓
- Require at least 1 pull request review before merging
- Dismiss stale reviews when new commits are pushed
- Require review from code owners

### Status Checks ✓
- Require all status checks to pass before merging
- Require branches to be up to date with base branch before merging (strict mode)

#### Required Status Checks

The following GitHub Actions jobs must pass before merging to `main`:

| Status Check | Description | Required |
|--------------|-------------|----------|
| `coverage-gate` | Enforces coverage thresholds (Stage 3: 60% overall, 80% critical packages) | ✅ Yes |
| `backend-coverage` | Generates Go coverage report | ✅ Yes |
| `godot-coverage` | Runs Godot GUT tests | ✅ Yes |

**Note:** The `coverage-gate` job is a collector that blocks PRs if coverage thresholds are not met. Set `coverage-gate` as a required status check in branch protection settings.

### Other Protections ✓
- Require conversation resolution before merging
- Include administrators in protection rules
- Prevent force pushes
- Prevent branch deletion

## Manual Configuration

If automatic configuration is not available (e.g., requires GitHub Pro),
you can configure branch protection manually at:

https://github.com/anchapin/armored-archer/settings/branches

### Steps to Configure Manually

1. Go to Repository Settings
2. Navigate to Branches section
3. Click "Add branch protection rule"
4. Enter "main" as branch name
   5. Configure the following:
    - [x] Require pull request reviews before merging
    - [x] Dismiss stale reviews when new commits are pushed
    - [x] Require code owner reviews
    - [x] Require status checks to pass before merging
    - [x] Select `coverage-gate` as a required check
    - [x] Require branches to be up to date
    - [x] Require conversation resolution before merging
    - [x] Include administrators
    - [x] Prevent force pushes
    - [x] Prevent branch deletion

## GitHub Actions Workflow

This repository includes a GitHub Actions workflow (`branch-protection.yml`)
that can be run manually to configure branch protection rules.

To run the workflow:
1. Go to the Actions tab
2. Select "Configure Branch Protection"
3. Click "Run workflow"
4. Select the branch to protect and configuration options
5. Click "Run workflow"

## Requirements

| Repository Type | Branch Protection Available |
|-----------------|---------------------------|
| Public          | Yes (Free)                |
| Private (User)  | Requires GitHub Pro       |
| Organization    | Requires GitHub Team+     |

## Note

**Historical claim, now stale:** this section previously stated the repository
"was made public to enable branch protection features" and that protection was
"fully configured and active". As of the 2026-08-18 audit (issue #1035) the
repository is private on GitHub Free and no branch protection is enforced —
see [Current Enforcement Status](#current-enforcement-status-2026-08-18-audit--issue-1035)
above for the verified state and how to re-verify it.
