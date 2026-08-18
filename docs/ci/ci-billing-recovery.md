# CI Billing Recovery Runbook

> **Origin:** Issue #855 — *CI down repo-wide: GitHub Actions billing failure — all jobs exit before starting* (opened 2026-08-16).
> **Scope:** Hosted GitHub Actions only. This file describes what happens when the account-level billing/spending-limit gate prevents jobs from starting, and how to triage and recover. It does **not** cover workflow, runner, or code-level failures — those have dedicated runbooks (see `docs/CI_ISSUES_AND_PLAN.md`).

---

## 1. Symptom

Every hosted Actions job in this repo fails **before starting** with the GitHub-generated check-run annotation:

```text
The job was not started because recent account payments have failed or your
spending limit needs to be increased. Please check the 'Billing & plans'
section in your settings
```

The annotation appears as a `failure` annotation within ~1 second of run creation. **No job step is executed**, so no runner log exists and `act`-style local reproductions cannot recreate the failure mode.

Reference incident: annotation on check run `95179007068` (PR #851, run `31952888117`, 2026-08-16). Identical sub-second failures reproduced across all 40+ checks on PRs #851, #852, #853.

---

## 2. Diagnosis

### 2.1 Confirm it's billing, not a workflow error

| Check | What you see if it's billing | What you see for a real workflow failure |
|-------|------------------------------|-------------------------------------------|
| Run duration | 0–5 seconds, `failure` | Minutes-to-hours, `failure` or pass |
| Annotations | GitHub-generated "spending limit / payments failed" string | Steps, runner names, stack traces |
| Runner logs | Empty (`No logs available`) | Full step-by-step stdout/stderr |
| `conclusion` | `failure` | `failure` / `success` / `cancelled` |

### 2.2 Web UI

Open the org or repo **Settings → Billing & plans**. Look for any of:

- A red banner: *"Recent account payments have failed…"*
- A *"Spending limit"* widget showing `$0.00 / $0.00` or *"Limit reached"*
- A *"Payment method"* widget with *"Last payment failed"* or no card on file

This is repo-admin-only; engineers without billing access will see a read-only view.

### 2.3 GitHub CLI / API

For engineers who *do* have access, the billing endpoint returns the same numbers shown in the UI:

```bash
gh api orgs/anchapin/settings/billing/actions
```

```json
{
  "total_minutes_used": 1234,
  "total_paid_minutes_used": 0,
  "included_minutes": 2000,
  "minutes_used_breakdown": { ... },
  "is_pay_as_you_go_enabled": false
}
```

Useful signals:

- `is_pay_as_you_go_enabled: false` **and** `included_minutes: 0` ⇒ spending limit is the bottleneck.
- `included_minutes > 0` but `total_minutes_used >= included_minutes` ⇒ minutes exhausted (raise the limit or wait for monthly reset).

### 2.4 Check-run annotations (the smoking gun)

A single command surfaces the exact annotation text on any run:

```bash
gh api repos/anchapin/armored-archer/check-runs/95179007068 \
  --jq '.output.text,.output.title,.output.annotation_details'
```

If `output.text` matches the *"recent account payments have failed or your spending limit needs to be increased"* string verbatim, the diagnosis is confirmed.

---

## 3. Owner Actions (admin-only — cannot be done from code)

The fix is **always** performed by an account/org owner in the GitHub UI:

1. **Open Settings → Billing & plans** on the org (`anchapin`) or enterprise that owns this repo.
2. **Fix the payment method** — replace any expired card and clear the *"Last payment failed"* flag. If payment failed because of an address/CVV mismatch, fix and resubmit.
3. **Raise or remove the spending limit** — bump the monthly Actions minutes cap high enough to clear current and near-term usage, or switch the org to a paid plan (Pay-As-You-Go).
4. **Verify** that the *"Recent account payments have failed"* banner no longer shows, and that `is_pay_as_you_go_enabled` is now `true` in the API response from §2.3.

> **Why this can't be fixed from code:** Actions billing lives behind GitHub's payment processor; no workflow, GitHub App, or API token can pay invoices or raise spending limits. Code-side workarounds (disabling required checks, bypassing branch protection, removing workflows) **do not unblock the gate** and **create real risk**; see §6.

---

## 4. Post-billing-fixes — Re-running workflows on `main`

Once billing is restored, hosted runners will start jobs again automatically for new pushes and PRs. To flush the backlog of failed `main` runs (so the dashboard shows green and `branch-protection` re-enables cleanly), re-run the six workflows named in the issue:

```bash
for wf in ci.yml docs-freshness.yml dast.yml benchmark-regression.yml deployment-observability.yml build-performance.yml; do
  gh workflow run "$wf" --ref main
done
```

Then poll until each reaches a terminal state:

```bash
gh run list --workflow=ci.yml            --limit 5 --json databaseId,conclusion,createdAt
gh run list --workflow=docs-freshness.yml --limit 5 --json databaseId,conclusion,createdAt
# …repeat for the other four
```

`branch-protection.yml` (the rule-set sync workflow) will re-run automatically when its 6-hour cron ticks, but you can also force it:

```bash
gh workflow run branch-protection.yml --ref main
```

### 4.1 Required status checks — wait, don't re-enable blindly

Once green, **re-enable required status checks in branch protection** for any checks the outage caused you to relax. Rule of thumb:

- Re-enable only the checks whose failure mode is *real* (workflow error), not the billing annotation.
- The list of candidate required checks is the `required_status_checks.contexts` array in `branch-protection.yml` config (commit/PR that adjusts it must be approved by a repo admin — see `docs/BRANCH_PROTECTION.md`).

If the first re-runs show *real* failures (e.g., a transitive dependency that now needs a `npm audit` remediation, or a service image that has become unpullable), **open a follow-up issue rather than bypassing the check**. See `docs/CI_ISSUES_AND_PLAN.md` for the issue template.

---

## 5. Local Fallback (while hosted CI is dark)

The repo has a curated local-validation path that covers the surfaces that *can* be checked offline. During the August 2026 outage, PRs #851–#854 were validated entirely with this path and merged successfully.

### 5.1 Backend

```bash
cd backend
npm install                 # honors package-lock.json
npm run lint                # ESLint over src/
npm run typecheck           # tsc --noEmit
npm test                    # ~100 suites / ~3334 tests
```

Coverage and statement-threshold checks live in `coverage.yml` and `coverage-threshold.yml`; run them with the host test runner:

```bash
npm test -- --coverage
```

### 5.2 Godot client

```bash
# from repo root
./scripts/local-godot-tests.sh            # lint + syntax + headless tests
./scripts/local-godot-tests.sh --quick    # no Godot binary required (lint only)
./scripts/local-godot-tests.sh --lint     # gdlint only
```

`--quick` is safe for CI-dark windows where installing Godot 4.6 is impractical. The full path needs `godot4` in `PATH` (or `GODOT_BINARY` exported).

### 5.3 GitHub Actions jobs via `act`

PR **#889** (`[AI-assisted] fix: CI service images pullable + parallel act run isolation (#858)`, merged 2026-08-16) made all 14 lintable / unit-testable jobs in `.github/workflows/ci.yml` runnable locally via the `act` CLI. Quickstart:

```bash
brew install act                       # macOS
# or: see docs/ACT_CI_SUMMARY.md for Linux/Windows install steps

# run the standard job subset against the local Docker runner
act -j backend-lint
act -j backend-typecheck
act -j backend-test
act -j gdscript-lint
act -j duplicate-code-detection
act -j schema-validation
act -j dependency-check
act -j godot-validate
```

Full matrix and known limitations: `docs/ACT_CI_ISSUES.md`, `docs/ACT_CI_SUMMARY.md`.

### 5.4 What `act` cannot validate

`act` runs the *job definition* locally but cannot validate:

- Hosted runner GPU / OS / disk images (the rare Godot job that needs specific runners).
- Branch protection rule enforcement.
- Scheduled workflows that depend on GitHub-only secrets (e.g., `DEPLOY_KEY`).
- Workflows that call `github-script` against org-level permissions.

For those, you must wait for hosted CI to come back. Do **not** disable the checks in branch protection as a shortcut — see §6.

---

## 6. Risk & PR Gate During the Outage

Dark CI is dangerous precisely because it is silent. During the August 2026 outage, PRs #851–#854 (Sprint 8 docs) were merged **without any hosted CI run**; local validation passed, but no runner-level integration was exercised. The risk going forward is:

- **No `branch-protection` enforcement.** Without green checks, required-status-checks become "always red" and GitHub may auto-bypass them — so a *broken* PR can merge.
- **No `npm audit` / `dependency-check` / `DAST Security Scan`.** A PR with a known-vulnerable transitive dep will not be blocked.
- **No `sonarcloud` / `codeql`.** Static analysis gates go dark.
- **No scheduled workflows** (`flaky-tests.yml`, `tech-debt-tracking.yml`, `dead-feature-flag-detection.yml`, `dead-code-detection.yml`, `mutation-testing.yml`, `coverage-threshold.yml`) — so the only feedback loop is "the agent remembered to run it locally".

### 6.1 Gate procedure for code PRs during the outage

Until hosted CI is green, **all code PRs** (anything touching `backend/`, `autoloads/`, `scenes/`, `scripts/`, `addons/`, or `data/`) must, before merge, demonstrate:

1. **Local backend green:** `cd backend && npm run lint && npm run typecheck && npm test` all exit 0.
2. **Local Godot green:** `./scripts/local-godot-tests.sh` exits 0 (full mode if Godot is available, `--quick` otherwise with an explicit note in the PR body).
3. **`act` matrix green** on at least the eight jobs listed in §5.3 — these are the closest 1:1 analogues of the hosted `ci.yml` jobs.
4. **Explicit PR-body attestation:** a line `Local validation: green (lint / typecheck / test / act: 8/8) on <date> by <agent-or-human>`.

Docs-only PRs (no production code touched) are exempt from the `act` step; they only need the backend / Godot lint paths to remain green if any of the linters they touch live under those trees (e.g., `docs/adr/*.md` are checked by `docs-freshness.yml`).

### 6.2 What to **never** do during the outage

- **Do not disable required status checks in branch protection.** This was the central failure mode that allowed unverified PRs to merge during the August 2026 outage. Keep the gates in place even when they're all red — they will turn green automatically once billing is restored.
- **Do not bypass via `gh pr merge --admin`** unless you have read §6.1 and the PR body carries the attestation.
- **Do not delete or skip workflows.** Removing the `.github/workflows/*.yml` files will not bring CI back, and will leave the repo without coverage when billing is restored.
- **Do not rotate org secrets or rotate the billing-payment method's stored credentials** without coordinating with the on-call admin — there is no way to recover them from code or docs. When rotation is warranted, follow the canonical procedure in `docs/SECRETS_ROTATION.md`.

---

## 7. Related

- Issue #855 — *CI down repo-wide: GitHub Actions billing failure — all jobs exit before starting*
- PR #851–#854 — Sprint 8 docs merged during the outage (local validation only)
- PR #889 — *CI service images pullable + parallel act run isolation* (`act` matrix is now usable)
- `docs/CI_ISSUES_AND_PLAN.md` — broader CI triage (workflow errors, runner issues, dependency conflicts)
- `docs/ACT_CI_SUMMARY.md` and `docs/ACT_CI_ISSUES.md` — `act` install / known limitations
- `docs/BRANCH_PROTECTION.md` — required-status-check policy
- `backend/scripts/validate-agents-md.ts` — AGENTS.md validator (this runbook does not require any changes there)

---

*Maintained by:* platform / infra. *Last updated:* 2026-08-17 (initial version, post-issue #855 triage).