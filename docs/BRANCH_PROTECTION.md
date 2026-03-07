# Branch Protection Configuration

This document describes the branch protection strategy for the `main` branch in this repository.

## Current Configuration

Due to GitHub's feature availability, this repository uses a GitHub Actions-based approach to branch protection:

### Implemented Protections

1. **Direct Push Prevention**
   - Workflow: `.github/workflows/branch-protection.yml`
   - Blocks direct pushes to `main` branch
   - Forces all changes through pull requests

2. **Pull Request Requirements**
   - All changes to `main` must go through PRs
   - CI checks must pass before merge
   - CODEOWNERS review is enforced via CODEOWNERS file

3. **CI Checks**
   - Required status checks (must pass before merge):
     - `ci.yml` - Main CI workflow
     - `codeql.yml` - CodeQL security analysis
     - `test.yml` - Test suite

## Native Branch Protection (GitHub Pro)

For full branch protection features, GitHub Pro is required for private repositories. Native branch protection offers:

- Require pull request reviews before merging
- Require status checks to pass before merging
- Require conversation resolution before merging
- Require signed commits
- Require administrators to follow rules
- Automatically require review from code owners

### To Enable Native Branch Protection

1. Upgrade to GitHub Pro (https://github.com/pricing)
2. Navigate to: Repository Settings → Branches → Add rule
3. Configure desired protection rules for `main` branch

### API Configuration (for reference)

If you have GitHub Pro, you can configure branch protection via API:

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["ci.yml","codeql.yml","test.yml"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}'
```

## Workflow-Based Protection

The current implementation in `.github/workflows/branch-protection.yml` provides:

1. **Push to main**: Fails with error message directing users to create PRs
2. **Pull requests**: Trigger workflow that validates PR structure
3. **CI integration**: Other workflows (ci.yml, test.yml) must pass

This is a workaround since native branch protection requires GitHub Pro for private repositories.
