/**
 * Dangerfile for automated PR review
 * 
 * This file runs automated checks on PRs and posts review comments.
 * See: https://danger.systems/js/
 */

import { danger, fail, warn, message } from "danger";

// PR title and body
const pr = danger.github.pr;
const hasValidTitle = pr.title.length > 5;
const hasDescription = pr.body && pr.body.length > 20;

// Check for required PR description
if (!hasDescription) {
  warn("PR description is missing or too short. Please add more details.");
}

// Check for AI-assisted PR requirements
const isAiAssisted = pr.title.includes("[AI-assisted]");
if (isAiAssisted) {
  message("This is an AI-assisted PR. Ensure human review is completed before merging.");
  
  // Check for test files in AI PRs
  const hasTests = danger.git.modified_files.some(f => 
    f.includes(".test.") || f.includes("_test.") || f.includes("spec/")
  );
  if (!hasTests) {
    warn("AI-assisted PR should include test files.");
  }
}

// Check for security-sensitive changes
const securityPatterns = [
  "password", "secret", "token", "auth", "credential", "api_key"
];
const hasSecurityChanges = danger.git.modified_files.some(f => 
  securityPatterns.some(p => f.toLowerCase().includes(p))
);

if (hasSecurityChanges) {
  warn("This PR contains security-sensitive changes. Ensure proper review.");
}

// Check for documentation
const hasDocs = danger.git.modified_files.some(f => 
  f.endsWith(".md") || f.includes("docs/")
);
if (!hasDocs && !isAiAssisted) {
  message("Consider adding documentation for new features.");
}

// Check for breaking changes
const hasBreaking = danger.github.pr.body?.includes("breaking");
if (hasBreaking) {
  warn("This PR contains breaking changes. Update CHANGELOG.md.");
}

export default {};
