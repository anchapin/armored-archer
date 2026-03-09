# Branch Protection Rules

This document describes the branch protection rules configured for this repository per Issue #313.

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

This repository was made public to enable branch protection features.
Branch protection is now fully configured and active.
