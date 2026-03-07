#!/usr/bin/env python3
"""
Release Notes Generator

Generates release notes from git history using conventional commits format.
Supports parsing commits with types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

Usage:
    python scripts/generate_release_notes.py [version_tag]

Examples:
    python scripts/generate_release_notes.py             # Generate from last tag to HEAD
    python scripts/generate_release_notes.py v1.0.0      # Generate from v1.0.0 to HEAD
    python scripts/generate_release_notes.py v0.9.0 v1.0.0  # Generate between two tags
"""

import argparse
import re
import subprocess
from datetime import datetime

# Conventional commit types with descriptions
COMMIT_TYPES = {
    "feat": ("Features", "A new feature"),
    "fix": ("Bug Fixes", "A bug fix"),
    "docs": ("Documentation", "Documentation only changes"),
    "style": ("Styles", "Changes that do not affect the meaning of the code"),
    "refactor": ("Code Refactoring", "A code change that neither fixes a bug nor adds a feature"),
    "perf": ("Performance Improvements", "A code change that improves performance"),
    "test": ("Tests", "Adding missing tests or correcting existing tests"),
    "build": ("Builds", "Changes that affect the build system or external dependencies"),
    "ci": ("CI/CD", "Changes to our CI configuration files and scripts"),
    "chore": ("Chores", "Other changes that don't modify src or test files"),
    "revert": ("Reverts", "Reverts a previous commit"),
}


def run_git_command(args: list[str]) -> str:
    """Run a git command and return the output."""
    result = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()


def get_tags() -> list[str]:
    """Get all tags sorted by version."""
    try:
        output = run_git_command(["tag", "-l", "--sort=-version:refname"])
        return output.split("\n") if output else []
    except subprocess.CalledProcessError:
        return []


def get_commits_since(from_ref: str | None = None, to_ref: str = "HEAD") -> list[dict]:
    """Get commits from from_ref to to_ref."""
    if from_ref:
        range_ref = f"{from_ref}..{to_ref}"
    else:
        # Get commits since the last tag
        tags = get_tags()
        if tags:
            range_ref = f"{tags[0]}..{to_ref}"
        else:
            range_ref = to_ref

    try:
        # Get commit messages with their hashes
        output = run_git_command([
            "log", range_ref,
            "--format=%H|%s|%b",
            "--reverse"
        ])

        if not output:
            return []

        commits = []
        for line in output.split("\n"):
            if not line.strip():
                continue
            parts = line.split("|")
            commit_hash = parts[0][:7]
            message = parts[1] if len(parts) > 1 else ""
            body = parts[2] if len(parts) > 2 else ""

            if not message:
                continue

            # Parse conventional commit format
            match = re.match(r'^(\w+)(?:\(([^)]+)\))?:\s+(.+)$', message)
            if match:
                commit_type = match.group(1)
                scope = match.group(2)
                subject = match.group(3)

                # Check for PR number in body or message
                pr_match = re.search(r'\(#(\d+)\)', message) or re.search(r'#(\d+)', body)
                pr_number = pr_match.group(1) if pr_match else None

                commits.append({
                    "hash": commit_hash,
                    "type": commit_type,
                    "scope": scope,
                    "subject": subject,
                    "pr_number": pr_number,
                    "message": message,
                    "body": body
                })

        return commits
    except subprocess.CalledProcessError as e:
        print(f"Error getting commits: {e}")
        return []


def group_commits_by_type(commits: list[dict]) -> dict:
    """Group commits by their type."""
    grouped = {commit_type: [] for commit_type in COMMIT_TYPES}

    for commit in commits:
        commit_type = commit.get("type", "chore")
        if commit_type in grouped:
            grouped[commit_type].append(commit)
        else:
            grouped["chore"].append(commit)

    return grouped


def generate_release_notes(version: str, from_ref: str | None = None, to_ref: str = "HEAD") -> str:
    """Generate release notes for a version."""
    commits = get_commits_since(from_ref, to_ref)

    if not commits:
        return f"# Release Notes for {version}\n\nNo changes since last release.\n"

    grouped = group_commits_by_type(commits)

    # Get today's date
    date = datetime.now().strftime("%Y-%m-%d")

    # Build release notes
    notes = [f"# Release Notes for {version} ({date})\n"]

    has_changes = False
    for commit_type, (title, _) in COMMIT_TYPES.items():
        type_commits = grouped.get(commit_type, [])
        if type_commits:
            has_changes = True
            notes.append(f"## {title}\n")
            for commit in type_commits:
                scope = f"({commit['scope']}) " if commit.get('scope') else ""
                pr_link = f" ([#{commit['pr_number']}](https://github.com/anchapin/armored-archer/pull/{commit['pr_number']}))" if commit.get('pr_number') else ""
                notes.append(f"- {scope}{commit['subject']}{pr_link}\n")
            notes.append("\n")

    if not has_changes:
        notes.append("No significant changes.\n")

    # Add footer
    notes.append("---\n")
    notes.append("*Generated by automated release notes script*\n")

    return "".join(notes)


def main():
    parser = argparse.ArgumentParser(
        description="Generate release notes from git history"
    )
    parser.add_argument(
        "version",
        nargs="?",
        default="Unreleased",
        help="Version tag (default: Unreleased)"
    )
    parser.add_argument(
        "from_ref",
        nargs="?",
        default=None,
        help="Starting ref (tag or branch)"
    )
    parser.add_argument(
        "to_ref",
        nargs="?",
        default="HEAD",
        help="Ending ref (default: HEAD)"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output file (default: stdout)"
    )

    args = parser.parse_args()

    version = args.version
    from_ref = args.from_ref

    # Auto-detect from_ref if not provided
    if from_ref is None and version != "Unreleased":
        from_ref = version

    notes = generate_release_notes(version, from_ref, args.to_ref)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(notes)
        print(f"Release notes written to {args.output}")
    else:
        print(notes)


if __name__ == "__main__":
    main()
