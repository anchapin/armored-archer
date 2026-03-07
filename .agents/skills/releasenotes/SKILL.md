---
keywords:
  - release
  - notes
  - automation
  - changelog
  - conventional-commits
  - git
description: Guidelines for automated release notes generation from git history
---

# Release Notes Automation Skill

This skill provides guidance for using the automated release notes generation system in Armored Archer.

## Overview

The project includes an automated release notes system that:
- Parses git commit messages using conventional commits format
- Groups changes by type (features, bug fixes, documentation, etc.)
- Generates well-formatted release notes
- Integrates with GitHub Actions for automatic generation on releases

## Components

### 1. Release Notes Generator Script

Located at: `scripts/generate_release_notes.py`

This Python script analyzes git history and generates release notes from conventional commits.

**Usage:**

```bash
# Generate from last tag to HEAD
python scripts/generate_release_notes.py

# Generate from a specific tag to HEAD
python scripts/generate_release_notes.py v1.0.0

# Generate between two tags
python scripts/generate_release_notes.py v0.9.0 v1.0.0

# Save to file
python scripts/generate_release_notes.py v1.0.0 -o release_notes.md
```

### 2. GitHub Actions Workflow

Located at: `.github/workflows/release-notes.yml`

The workflow:
- Triggers on GitHub releases (published)
- Can be manually triggered with workflow_dispatch
- Accepts optional `from_tag` and `to_tag` inputs
- Generates and uploads release notes
- Creates GitHub Release automatically

**Manual Trigger:**

```bash
gh workflow run release-notes.yml -f from_tag=v0.9.0 -f to_tag=v1.0.0
```

## Conventional Commits Format

The release notes generator parses commits using the conventional commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Supported Commit Types

| Type | Description | Section in Release Notes |
|------|-------------|------------------------|
| `feat` | New features | Features |
| `bug` | Bug fixes | Bug Fixes |
| `fix` | Bug fixes | Bug Fixes |
| `docs` | Documentation changes | Documentation |
| `style` | Code style changes (formatting) | Styles |
| `refactor` | Code refactoring | Code Refactoring |
| `perf` | Performance improvements | Performance Improvements |
| `test` | Test changes | Tests |
| `build` | Build system changes | Builds |
| `ci` | CI/CD changes | CI/CD |
| `chore` | Maintenance tasks | Chores |
| `revert` | Reverted commits | Reverts |

### Examples

**Feature commit:**
```
feat(multiplayer): Add matchmaking for ranked matches
```

**Bug fix:**
```
fix(combat): Resolve arrow collision issue with enemies (#123)
```

**With scope and PR reference:**
```
feat(leaderboard): Add seasonal leaderboard reset ( closes #45 )
```

## PR Integration

The generator automatically extracts PR numbers from:
- Commit message: `feat: Add feature (#123)`
- Commit body: `feat: Add feature\n\nCloses #123`

PRs are linked in the generated release notes.

## Repository Configuration

The release notes generator is configured to work with the repository:
- **Owner:** anchapin
- **Repository:** armored-archer
- **PR Links:** Generated notes link to `https://github.com/anchapin/armored-archer/pull/{pr_number}`

## Troubleshooting

### No commits appearing in release notes

1. Verify commits follow conventional commits format
2. Check that tags exist: `git tag -l`
3. Verify the tag range is correct: `git log v0.9.0..v1.0.0`

### Wrong PR links

The script uses a hardcoded repository path. If working on a fork, you may need to modify the `pr_link` generation in `generate_release_notes.py`.

### GitHub Actions not triggering

Ensure the workflow has:
- `contents: write` permissions for creating releases
- Proper trigger conditions in the workflow file
