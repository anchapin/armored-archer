#!/usr/bin/env python3
"""
Auto-Triage Issues Script for Armored Archer

Automatically categorizes and labels GitHub issues based on content analysis.
Used for alpha bug report triage to speed up issue processing.

Usage:
    python auto-triage-issues.py --issue-number 123
    python auto-triage-issues.py --dry-run
    python auto-triage-issues.py --verbose

Features:
    - Keyword-based categorization (8 bug categories)
    - Severity detection (Critical, High, Medium, Low)
    - Duplicate issue detection
    - Automatic label application
    - Comment suggestions for missing information
"""

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from difflib import SequenceMatcher

# Try to import GitHub, fall back to API calls if not available
try:
    from github import Github
    GITHUB_LIBRARY_AVAILABLE = True
except ImportError:
    GITHUB_LIBRARY_AVAILABLE = False

# Try to import requests for API calls
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


# --- Configuration ---

@dataclass
class CategoryConfig:
    """Configuration for a bug category."""
    name: str
    label: str
    keywords: list[str]
    secondary_keywords: list[str] = field(default_factory=list)
    color: str = "#000000"


# Category definitions
CATEGORIES = {
    "crash": CategoryConfig(
        name="Crash",
        label="bug:crash",
        keywords=["crash", "crash", "freeze", "hang", "frozen", "black screen", "white screen"],
        secondary_keywords=["restart", "quit", "close", "force close"],
        color="#DC2626"  # Red
    ),
    "blocker": CategoryConfig(
        name="Progression Blocker",
        label="bug:blocker",
        keywords=["can't continue", "cant continue", "stuck", "blocked", "softlock", "soft lock"],
        secondary_keywords=["impossible", "progression", "game over", "unbeatable"],
        color="#DC2626"  # Red
    ),
    "combat": CategoryConfig(
        name="Combat",
        label="bug:combat",
        keywords=["damage", "hit", "enemy", "attack", "weapon", "health", "hp", "dead", "death"],
        secondary_keywords=["arrow", "bow", "sword", "shield", "combat", "fight"],
        color="#EA580C"  # Orange
    ),
    "performance": CategoryConfig(
        name="Performance",
        label="bug:performance",
        keywords=["lag", "fps", "slow", "stutter", "frame drop", "framerate", "performance"],
        secondary_keywords=["optimization", "optimise", "memory", "ram", "cpu"],
        color="#EA580C"  # Orange
    ),
    "ui": CategoryConfig(
        name="UI/UX",
        label="bug:ui",
        keywords=["button", "menu", "text", "overlay", "broken ui", "interface", "hud"],
        secondary_keywords=["click", "tap", "touch", "display", "screen"],
        color="#0891B2"  # Cyan
    ),
    "audio": CategoryConfig(
        name="Audio",
        label="bug:audio",
        keywords=["sound", "music", "volume", "silent", "audio", "speaker", "headphone"],
        secondary_keywords=["noise", "crackle", "distortion", "mute"],
        color="#059669"  # Green
    ),
    "network": CategoryConfig(
        name="Network",
        label="bug:network",
        keywords=["disconnect", "timeout", "connection", "server", "online", "multiplayer"],
        secondary_keywords=["latency", "ping", "network", "wifi", "internet"],
        color="#EA580C"  # Orange
    ),
    "visual": CategoryConfig(
        name="Visual",
        label="bug:visual",
        keywords=["sprite", "animation", "glitch", "rendering", "graphic", "texture"],
        secondary_keywords=["visual", "model", "mesh", "polygon", "artifact"],
        color="#7C3AED"  # Purple
    )
}

# Severity configurations
SEVERITY_CONFIG = {
    "critical": {
        "label": "severity:critical",
        "keywords": ["crash", "freeze", "data loss", "progression blocker", "softlock", "unplayable"],
        "slack_channel": "alpha-bugs-critical",
        "response_time": "< 1 hour"
    },
    "high": {
        "label": "severity:high",
        "keywords": ["combat broken", "can't damage", "disconnect", "multiplayer broken", "save corrupted"],
        "slack_channel": "alpha-bugs-all",
        "response_time": "< 4 hours"
    },
    "medium": {
        "label": "severity:medium",
        "keywords": ["ui broken", "visual glitch", "minor bug", "annoying"],
        "slack_channel": None,  # No immediate alert
        "response_time": "< 24 hours"
    },
    "low": {
        "label": "severity:low",
        "keywords": ["typo", "cosmetic", "minor visual", "nice to have"],
        "slack_channel": None,
        "response_time": "< 1 week"
    }
}


@dataclass
class TriageResult:
    """Result of auto-triage analysis."""
    issue_number: int
    issue_title: str
    issue_body: str
    category: str | None = None
    category_confidence: float = 0.0
    severity: str = "medium"
    labels_to_add: list[str] = field(default_factory=list)
    is_duplicate: bool = False
    duplicate_of: int | None = None
    duplicate_confidence: float = 0.0
    missing_info: list[str] = field(default_factory=list)
    comment_suggestion: str | None = None
    should_alert_slack: bool = False


class AutoTriage:
    """Auto-triage system for GitHub issues."""

    def __init__(self, github_token: str | None = None, repo: str = "armored-archer", owner: str | None = None):
        """
        Initialize auto-triage system.

        Args:
            github_token: GitHub personal access token
            repo: Repository name
            owner: Repository owner (defaults to authenticated user)
        """
        self.github_token = github_token or os.getenv("GITHUB_TOKEN")
        self.repo_name = repo
        self.owner = owner
        self.github = None
        self.repository = None

        # Initialize GitHub client
        self._init_github()

    def _init_github(self):
        """Initialize GitHub client."""
        if not self.github_token:
            print("⚠️  No GitHub token provided. Running in read-only mode.")
            return

        if GITHUB_LIBRARY_AVAILABLE:
            try:
                self.github = Github(self.github_token)
                if self.owner:
                    self.repository = self.github.get_repo(f"{self.owner}/{self.repo_name}")
                else:
                    # Get authenticated user
                    user = self.github.get_user()
                    self.repository = user.get_repo(self.repo_name)
                    self.owner = user.login
                print(f"✅ Connected to GitHub repository: {self.owner}/{self.repo_name}")
            except Exception as e:
                print(f"❌ Failed to connect to GitHub: {e}")
        elif REQUESTS_AVAILABLE:
            print("INFO: Using requests library for GitHub API calls")
        else:
            print("❌ No GitHub API client available. Install PyGithub or requests.")

    def analyze_issue(self, issue_number: int, title: str, body: str) -> TriageResult:
        """
        Analyze a GitHub issue and return triage result.

        Args:
            issue_number: GitHub issue number
            title: Issue title
            body: Issue body/description

        Returns:
            TriageResult with categorization and recommendations
        """
        result = TriageResult(
            issue_number=issue_number,
            issue_title=title,
            issue_body=body
        )

        # Combine title and body for analysis
        content = f"{title} {body}".lower()

        # 1. Detect category
        result.category, result.category_confidence = self._detect_category(content)
        if result.category:
            result.labels_to_add.append(CATEGORIES[result.category].label)

        # 2. Detect severity
        result.severity = self._detect_severity(content)
        result.labels_to_add.append(SEVERITY_CONFIG[result.severity]["label"])

        # 3. Check for duplicates
        if self.repository:
            duplicate = self._check_duplicate(title, body)
            if duplicate:
                result.is_duplicate = True
                result.duplicate_of = duplicate["number"]
                result.duplicate_confidence = duplicate["confidence"]
                result.labels_to_add.append("potential-duplicate")

        # 4. Check for missing information
        result.missing_info = self._check_missing_info(body)
        if result.missing_info:
            result.comment_suggestion = self._generate_missing_info_comment(result.missing_info)

        # 5. Determine if Slack alert needed
        if result.severity in ["critical", "high"]:
            result.should_alert_slack = True
            result.labels_to_add.append("alpha")

        # Always add alpha and needs-triage labels
        if "alpha" not in result.labels_to_add:
            result.labels_to_add.insert(0, "alpha")
        if "needs-triage" not in result.labels_to_add:
            result.labels_to_add.insert(0, "needs-triage")

        return result

    def _detect_category(self, content: str) -> tuple[str | None, float]:
        """
        Detect bug category from content.

        Returns:
            Tuple of (category_name, confidence_score)
        """
        best_match = None
        best_score = 0.0

        for category_id, config in CATEGORIES.items():
            score = 0.0

            # Check primary keywords (higher weight)
            for keyword in config.keywords:
                if keyword in content:
                    score += 2.0

            # Check secondary keywords (lower weight)
            for keyword in config.secondary_keywords:
                if keyword in content:
                    score += 1.0

            if score > best_score:
                best_score = score
                best_match = category_id

        # Normalize confidence (max score = 1.0)
        confidence = min(best_score / 6.0, 1.0) if best_match else 0.0

        return best_match, confidence

    def _detect_severity(self, content: str) -> str:
        """Detect severity level from content."""
        # Check for critical keywords first
        for keyword in SEVERITY_CONFIG["critical"]["keywords"]:
            if keyword in content:
                return "critical"

        # Check for high severity
        for keyword in SEVERITY_CONFIG["high"]["keywords"]:
            if keyword in content:
                return "high"

        # Check for low severity
        for keyword in SEVERITY_CONFIG["low"]["keywords"]:
            if keyword in content:
                return "low"

        # Default to medium
        return "medium"

    def _check_duplicate(self, title: str, body: str) -> dict | None:
        """
        Check for potential duplicate issues.

        Returns:
            Dict with issue number and confidence if duplicate found, None otherwise
        """
        if not self.repository:
            return None

        try:
            # Get recent open issues (last 100)
            issues = self.repository.get_issues(state="open", sort="created", direction="desc")[:100]

            title_words = set(title.lower().split())

            for issue in issues:
                if issue.number == self._get_issue_number_from_context():
                    continue

                # Compare titles
                other_title_words = set(issue.title.lower().split())

                # Calculate similarity
                common_words = title_words & other_title_words
                similarity = len(common_words) / max(len(title_words), len(other_title_words), 1)

                # Also check SequenceMatcher for fuzzy matching
                sequence_similarity = SequenceMatcher(
                    None,
                    title.lower(),
                    issue.title.lower()
                ).ratio()

                # Use higher of the two scores
                final_similarity = max(similarity, sequence_similarity)

                if final_similarity > 0.7:  # 70% similarity threshold
                    return {
                        "number": issue.number,
                        "confidence": final_similarity,
                        "title": issue.title
                    }

            return None

        except Exception as e:
            print(f"⚠️  Error checking duplicates: {e}")
            return None

    def _get_issue_number_from_context(self) -> int:
        """Get current issue number from context (for excluding self-comparison)."""
        # This would be set when analyzing a specific issue
        return 0

    def _check_missing_info(self, body: str) -> list[str]:
        """Check for missing required information in bug report."""
        missing = []

        # Check for device info
        if not any(phrase in body.lower() for phrase in ["device:", "iphone", "ipad", "android", "samsung", "pixel"]):
            missing.append("Device information")

        # Check for game version
        if not re.search(r'v\d+\.\d+', body, re.IGNORECASE):
            missing.append("Game version")

        # Check for reproduction steps
        if not any(phrase in body.lower() for phrase in ["step", "reproduce", "1.", "2.", "3."]):
            missing.append("Reproduction steps")

        # Check for expected behavior
        if "expected" not in body.lower():
            missing.append("Expected behavior")

        return missing

    def _generate_missing_info_comment(self, missing_info: list[str]) -> str:
        """Generate a comment requesting missing information."""
        comment = "## 📋 Missing Information\n\n"
        comment += "Thanks for reporting this issue! To help us investigate, please provide:\n\n"

        for info in missing_info:
            comment += f"- [ ] {info}\n"

        comment += "\nOnce you've added this information, we can start investigating. Thanks! 🙏"

        return comment

    def apply_labels(self, issue_number: int, labels: list[str]) -> bool:
        """
        Apply labels to a GitHub issue.

        Args:
            issue_number: GitHub issue number
            labels: List of label names to apply

        Returns:
            True if successful, False otherwise
        """
        if not self.repository:
            print("⚠️  Cannot apply labels: No GitHub connection")
            return False

        try:
            issue = self.repository.get_issue(issue_number)

            # Get existing labels
            existing_labels = [label.name for label in issue.labels]

            # Add new labels (avoid duplicates)
            new_labels = list(set(existing_labels + labels))

            issue.set_labels(new_labels)
            print(f"✅ Applied labels to #{issue_number}: {', '.join(new_labels)}")
            return True

        except Exception as e:
            print(f"❌ Failed to apply labels: {e}")
            return False

    def add_comment(self, issue_number: int, comment: str) -> bool:
        """
        Add a comment to a GitHub issue.

        Args:
            issue_number: GitHub issue number
            comment: Comment text

        Returns:
            True if successful, False otherwise
        """
        if not self.repository:
            print("⚠️  Cannot add comment: No GitHub connection")
            return False

        try:
            issue = self.repository.get_issue(issue_number)
            issue.create_comment(comment)
            print(f"✅ Added comment to #{issue_number}")
            return True

        except Exception as e:
            print(f"❌ Failed to add comment: {e}")
            return False

    def send_slack_alert(self, result: TriageResult) -> bool:
        """
        Send Slack alert for critical/high severity issues.

        Args:
            result: TriageResult with issue information

        Returns:
            True if alert sent successfully, False otherwise
        """
        slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        if not slack_webhook:
            print("⚠️  No Slack webhook URL configured")
            return False

        if not result.should_alert_slack:
            return False

        channel = SEVERITY_CONFIG[result.severity].get("slack_channel")
        if not channel:
            return False

        # Build Slack message
        emoji = "🚨" if result.severity == "critical" else "⚠️"
        severity_text = result.severity.upper()

        message = {
            "channel": f"#{channel}",
            "username": "Bug Triage Bot",
            "icon_emoji": ":bug:",
            "attachments": [
                {
                    "color": "danger" if result.severity == "critical" else "warning",
                    "title": f"{emoji} {severity_text} SEVERITY BUG REPORTED",
                    "fields": [
                        {"title": "Issue", "value": f"#{result.issue_number}: {result.issue_title}", "short": False},
                        {"title": "Category", "value": result.category or "Unknown", "short": True},
                        {"title": "Severity", "value": severity_text, "short": True},
                        {"title": "Response Time", "value": SEVERITY_CONFIG[result.severity]["response_time"], "short": True}
                    ],
                    "actions": [
                        {
                            "type": "button",
                            "text": "View Issue",
                            "url": f"https://github.com/{self.owner}/{self.repo_name}/issues/{result.issue_number}"
                        },
                        {
                            "type": "button",
                            "text": "Assign to Me",
                            "url": f"https://github.com/{self.owner}/{self.repo_name}/issues/{result.issue_number}/assign"
                        }
                    ]
                }
            ]
        }

        try:
            response = requests.post(slack_webhook, json=message, timeout=10)
            if response.status_code == 200:
                print(f"✅ Slack alert sent for #{result.issue_number}")
                return True
            else:
                print(f"❌ Slack API returned status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to send Slack alert: {e}")
            return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Auto-triage GitHub issues for Armored Archer"
    )
    parser.add_argument(
        "--issue-number",
        type=int,
        help="GitHub issue number to triage"
    )
    parser.add_argument(
        "--title",
        type=str,
        help="Issue title (for testing)"
    )
    parser.add_argument(
        "--body",
        type=str,
        help="Issue body (for testing)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze without making changes"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--repo",
        type=str,
        default="armored-archer",
        help="Repository name"
    )
    parser.add_argument(
        "--owner",
        type=str,
        help="Repository owner"
    )

    args = parser.parse_args()

    # Initialize triage system
    triage = AutoTriage(
        github_token=os.getenv("GITHUB_TOKEN"),
        repo=args.repo,
        owner=args.owner
    )

    # Test mode with provided title/body
    if args.title and args.body:
        print("\n🔍 Analyzing test issue:")
        print(f"   Title: {args.title}")
        print(f"   Body: {args.body[:100]}...\n")

        result = triage.analyze_issue(
            issue_number=args.issue_number or 0,
            title=args.title,
            body=args.body
        )

        print_triage_result(result, args.verbose)

        if not args.dry_run:
            if result.labels_to_add:
                triage.apply_labels(result.issue_number, result.labels_to_add)
            if result.comment_suggestion:
                triage.add_comment(result.issue_number, result.comment_suggestion)
            if result.should_alert_slack:
                triage.send_slack_alert(result)

        return 0

    # Real issue mode
    if args.issue_number:
        if not triage.repository:
            print("❌ Cannot analyze issue: No GitHub connection")
            print("   Set GITHUB_TOKEN environment variable or provide --title and --body for testing")
            return 1

        try:
            issue = triage.repository.get_issue(args.issue_number)

            print(f"\n🔍 Analyzing issue #{args.issue_number}:")
            print(f"   Title: {issue.title}")
            print(f"   Body: {issue.body[:100]}...\n")

            result = triage.analyze_issue(
                issue_number=args.issue_number,
                title=issue.title,
                body=issue.body
            )

            print_triage_result(result, args.verbose)

            if not args.dry_run:
                if result.labels_to_add:
                    triage.apply_labels(args.issue_number, result.labels_to_add)
                if result.comment_suggestion:
                    triage.add_comment(args.issue_number, result.comment_suggestion)
                if result.should_alert_slack:
                    triage.send_slack_alert(result)

            return 0

        except Exception as e:
            print(f"❌ Failed to get issue #{args.issue_number}: {e}")
            return 1

    # No arguments - show help
    parser.print_help()
    return 0


def print_triage_result(result: TriageResult, verbose: bool = False):
    """Print triage result to console."""
    print("📊 Triage Results:")
    print(f"   Issue: #{result.issue_number}")

    if result.category:
        print(f"   Category: {CATEGORIES[result.category].name} ({result.category_confidence:.0%} confidence)")
    else:
        print("   Category: Unknown")

    print(f"   Severity: {result.severity.upper()}")
    print(f"   Labels: {', '.join(result.labels_to_add)}")

    if result.is_duplicate:
        print(f"   ⚠️  Potential duplicate of #{result.duplicate_of} ({result.duplicate_confidence:.0%} confidence)")

    if result.missing_info:
        print(f"   Missing info: {', '.join(result.missing_info)}")

    if result.should_alert_slack:
        print("   🚨 Slack alert will be sent")

    if verbose and result.comment_suggestion:
        print(f"\n💬 Suggested comment:\n{result.comment_suggestion}")


if __name__ == "__main__":
    sys.exit(main())
