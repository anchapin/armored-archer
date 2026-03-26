# Phase 23: Execute Mutation Testing Workflow - Research

**Researched:** 2026-03-23
**Domain:** Mutation testing execution, GitHub Actions workflow debugging, baseline establishment
**Confidence:** HIGH

## Summary

Phase 23 executes the mutation testing workflow that was configured in Phase 14 but never successfully run. The workflow infrastructure is complete: go-mutesting is installed, custom execution scripts handle MUTATE_ORIGINAL/MUTATE_CHANGED environment variables, GitHub Actions workflow is configured with cron schedule, and tracking scripts are ready. However, the workflow has never executed successfully (no mutation_score data exists in coverage-history.json), meaning MUT-05 and MUT-06 requirements remain incomplete despite Phase 14 being marked as complete.

The research identifies the root cause: Phase 14 verification confirmed infrastructure exists but acknowledged "Human Verification Required: Nightly GitHub Actions Workflow Execution" with the note "Cannot programmatically trigger GitHub Actions cron schedule or verify artifact uploads in this environment." This means the cron job may have failed to run due to GitHub Actions scheduling issues, timezone misconfigurations, or workflow syntax errors. The solution is to manually trigger the workflow via workflow_dispatch, verify execution, fix any issues, and establish baseline mutation scores.

**Primary recommendation:** Manually trigger the mutation-testing workflow via GitHub Actions UI, monitor execution logs for errors, fix any configuration issues (likely cron-related or script path problems), run mutation testing on all packages to generate baseline scores, and verify mutation_score field appears in coverage-history.json with package-level breakdowns.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MUT-05 | Create nightly GitHub Actions workflow for mutation testing (not on every PR) | Infrastructure exists (.github/workflows/mutation-testing.yml), cron configured, but workflow has never executed successfully. Research shows workflow_dispatch input exists for manual trigger, enabling immediate execution and debugging. |
| MUT-06 | Display mutation score on coverage dashboard with trend tracking | Dashboard infrastructure exists (docs/coverage-dashboard.html has mutation score cards and trend chart), tracking script exists (track-mutation-history.sh), but mutation_score field is null/missing in coverage-history.json. Research shows track-mutation-history.sh correctly parses go-mutesting output and updates JSON, but has not been run successfully. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **go-mutesting** | latest (installed at ~/go/bin/go-mutesting) | Go mutation testing framework | Already installed in Phase 14, supports custom exec commands, provides mutation score calculation, handles MUTATE_ORIGINAL/MUTATE_CHANGED environment variables |
| **GitHub Actions** | v4 (actions/checkout@v4, actions/setup-go@v5, actions/upload-artifact@v4) | CI/CD workflow execution | Already configured in mutation-testing.yml, supports cron schedules and workflow_dispatch for manual triggers, artifact uploads for mutation results |
| **go test** | Go 1.25+ built-in | Test execution for mutated code | Already integrated in mutation-exec-handler.sh, produces reliable test results, atomic mode for parallel tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **jq** | v1.6+ | JSON parsing for mutation score extraction | Already used in track-mutation-history.sh to parse go-mutesting output and update coverage-history.json |
| **testcontainers-go** | v0.41.0 (existing) | Database isolation during mutation testing | Already integrated in mutation-exec-handler.sh (TESTDB_HOST/TESTDB_PORT), needed for each mutation to run in clean environment |
| **testify** | v1.11.1 (existing) | Assertions in mutation test runs | Already in go.mod, used by all backend tests, no changes needed for mutation testing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual workflow_dispatch trigger | Cron schedule fix investigation | Manual trigger provides immediate execution and debugging, cron investigation may take time without guarantee of success |
| Full package suite execution | Critical packages only (combat, matchmaking) | Full execution establishes complete baseline, critical packages only provides faster iteration (mutation-test-quick) |

**Installation:**
```bash
# No new installations needed - go-mutesting already installed in Phase 14
# Verify installation:
~/go/bin/go-mutesting --help

# Quick test on critical packages:
~/go/bin/go-mutesting --exec scripts/mutation-exec-handler.sh internal/combat/ internal/matchmaking/

# Full execution:
bash scripts/run-mutation-tests.sh
```

**Version verification:** go-mutesting verified installed at ~/go/bin/go-mutesting (8041104 bytes), provides help documentation, supports --exec flag, --list-mutators shows 5 mutators (branch/case, branch/else, branch/if, expression/comparison, expression/remove, statement/remove).

## Architecture Patterns

### Recommended Execution Flow

```
1. Manual Trigger (GitHub Actions UI)
   └─> Navigate to Actions tab
   └─> Select "Mutation Testing" workflow
   └─> Click "Run workflow" button
   └─> Leave packages input empty (default: all packages)
   └─> Click "Run workflow"

2. Workflow Execution
   └─> Checkout code
   └─> Setup Go 1.25
   └─> Install go-mutesting
   └─> Start testcontainers (postgres)
   └─> Run mutation tests (scripts/run-mutation-tests.sh)
       ├─> For each package:
       │   ├─> go-mutesting --exec scripts/mutation-exec-handler.sh package/
       │   ├─> Extract mutation score from output
       │   └─> Compare against threshold (85%, 80%, 75%)
       └─> Generate JSON report

3. History Tracking
   └─> scripts/track-mutation-history.sh
       ├─> Extract package scores from go-mutesting output
       ├─> Calculate weighted overall score
       ├─> Update data/coverage-history.json
       └─> Analyze trends (improvement, regression, stable)

4. Dashboard Update
   └─> GitHub Actions commits mutation history to main branch
   └─> docs/coverage-dashboard.html loads mutation_score from coverage-history.json
   └─> Display package scores with trend chart
```

### Pattern 1: Manual Workflow Dispatch for Debugging

**What:** Use GitHub Actions workflow_dispatch trigger to manually execute mutation testing workflow and monitor logs in real-time

**When to use:** When automated cron schedule hasn't executed successfully, when debugging workflow issues, when needing to establish baseline scores immediately

**Example:**
```bash
# Navigate to GitHub Actions UI in browser
# Actions tab > Mutation Testing workflow > Run workflow

# Or use GitHub CLI (if available):
gh workflow run mutation-testing.yml

# Monitor execution:
gh run watch --log
```

**Verification steps:**
1. Check workflow run appears in Actions tab
2. Monitor real-time logs for errors
3. Verify go-mutesting executes on each package
4. Confirm mutation scores extracted successfully
5. Check coverage-history.json is updated with mutation_score field

### Pattern 2: Mutation Score Extraction and Tracking

**What:** scripts/track-mutation-history.sh parses go-mutesting output to extract mutation scores per package and updates coverage-history.json

**When to use:** After go-mutesting completes successfully, to persist scores for dashboard visualization and trend tracking

**Example:**
```bash
# Source: scripts/track-mutation-history.sh (existing)
# Extract mutation score from go-mutesting output
output=$(cd backend && go-mutesting --exec ../scripts/mutation-exec-handler.sh internal/combat/ -v 2>&1)
score=$(echo "$output" | grep -i "mutation score" | grep -oP '\d+\.?\d*' | head -1)

# Expected go-mutesting output format:
# The mutation score is 0.850000 (17 passed, 3 failed, 0 skipped, total is 20)
# Score: 85.0%

# Update coverage-history.json:
jq --arg overall "85.0" \
   '.history[-1].mutation_score = {combat: 85.0, matchmaking: 80.0, rpg: 75.0, overall: ($overall | tonumber)}' \
   data/coverage-history.json > tmp.json && mv tmp.json data/coverage-history.json
```

**Key points:**
- track-mutation-history.sh uses `grep -i "mutation score"` to find score line
- Extracts numeric value with `grep -oP '\d+\.?\d*'`
- Calculates weighted overall score based on package importance (combat/matchmaking 30%, rpg 20%, others 6.7%)
- Updates coverage-history.json with mutation_score field containing package-level scores
- Keeps only last 30 entries in history

### Pattern 3: Dashboard Mutation Score Visualization

**What:** docs/coverage-dashboard.html loads mutation_score from coverage-history.json and displays package scores with trend chart

**When to use:** After mutation testing completes and coverage-history.json is updated, to visualize test quality metrics

**Example:**
```javascript
// Source: docs/coverage-dashboard.html (existing)
// Load mutation score from latest history entry
const latest = historyData.history[historyData.history.length - 1];
const mutationScore = latest.mutation_score;

// Display package scores
if (mutationScore && mutationScore.combat) {
    document.getElementById('combat-mutation-score').textContent = mutationScore.combat + '%';
}

// Trend chart for mutation scores over time
const mutationTrendData = historyData.history
    .filter(h => h.mutation_score && h.mutation_score.overall)
    .map(h => ({
        date: h.date,
        score: h.mutation_score.overall
    }));

// Draw trend chart (purple line for mutation, blue for coverage)
```

**Visual indicators:**
- Green: >=85% mutation score (excellent test quality)
- Yellow: 75-84% mutation score (acceptable, room for improvement)
- Red: <75% mutation score (weak tests, need more assertions)

### Anti-Patterns to Avoid

- **Assuming cron schedule executed without verification:** Phase 14 verification noted cron is configured but human verification required. Always manually trigger first to confirm workflow works.
- **Not checking go-mutesting installation path:** Script expects ~/go/bin/go-mutesting, but GitHub Actions installs it to $HOME/go/bin. Verify PATH is set correctly.
- **Ignoring testcontainers startup time:** Mutation testing starts postgres in docker, needs 30-60 seconds to be healthy. If tests fail immediately, check database is ready.
- **Not monitoring workflow logs:** Execution may fail silently. Always watch logs in real-time via GitHub Actions UI or `gh run watch`.
- **Assuming mutation_score exists without checking:** coverage-history.json may not have mutation_score field yet. Always check `jq '.history[-1].mutation_score'` before dashboard update.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manual cron job scheduling | Custom cron daemon or external service | GitHub Actions `schedule` trigger | GitHub Actions provides built-in cron scheduling with workflow_dispatch for manual triggers |
| Custom mutation score parsing | Regex-based score extraction from go-mutesting output | go-mutesting provides structured output format | go-mutesting outputs "The mutation score is X.XXX (Y passed, Z failed)" format that's easily parseable |
| Manual dashboard updates | Custom HTML/JS to display mutation scores | Existing coverage dashboard infrastructure | Dashboard already has mutation score cards and trend chart, just needs data populated |
| Manual workflow triggering | Custom scripts to call GitHub API | GitHub Actions UI or `gh workflow run` | GitHub provides built-in workflow dispatch, no custom scripts needed |

**Key insight:** Phase 14 already built all mutation testing infrastructure. Phase 23 is about executing and debugging, not building new tools. Use existing workflow_dispatch trigger, monitor logs, fix issues, establish baseline.

## Common Pitfalls

### Pitfall 1: GitHub Actions Cron Schedule Not Executing

**What goes wrong:** Mutation testing workflow configured with cron schedule '0 2 * * *' but never runs, no workflow execution history

**Why it happens:** GitHub Actions cron schedules can fail silently due to repository inactivity, timezone configuration issues, or workflow syntax errors. Phase 14 verification acknowledged this as "human verification required."

**How to avoid:**
1. Manually trigger workflow via workflow_dispatch first to verify it works
2. Check workflow run history in GitHub Actions tab
3. Verify cron schedule syntax: '0 2 * * *' = daily at 2 AM UTC
4. Ensure repository has recent activity (GitHub throttles inactive repos)
5. Monitor workflow logs after manual trigger for any errors

**Warning signs:** No workflow runs in Actions tab, cron scheduled time passes without execution, GitHub Actions logs show "no runs" for mutation-testing workflow.

**Detection:**
```bash
# Check workflow run history (GitHub CLI):
gh run list --workflow=mutation-testing.yml --limit 5

# Expected: List of recent runs with status
# If empty: Workflow has never executed successfully
```

**Fix:**
1. Manual trigger via GitHub Actions UI
2. If successful, cron will run automatically at next scheduled time
3. If failed, check logs for errors (likely go-mutesting path or testcontainers issues)

### Pitfall 2: go-mutesting Path Not Found

**What goes wrong:** GitHub Actions workflow fails with "go-mutesting: command not found" error

**Why it happens:** GitHub Actions installs go-mutesting to $HOME/go/bin but $GOPATH/bin may not be in PATH, or script expects hardcoded path ~/go/bin/go-mutesting

**How to avoid:**
1. Verify PATH includes $HOME/go/bin after installation
2. Update scripts to use $GOPATH/bin/go-mutesting or full path
3. Add `echo "$HOME/go/bin" >> $GITHUB_PATH` after installation (already in workflow line 41)

**Warning signs:** Workflow step "Run mutation testing" fails immediately with "command not found", go-mutesting not found error in logs.

**Detection:**
```bash
# In workflow logs, check PATH:
echo $PATH | grep go

# Should contain /home/runner/go/bin or similar
```

**Fix:**
- Workflow already has `echo "$HOME/go/bin" >> $GITHUB_PATH` (line 41)
- Verify this line executes before mutation testing step
- Check scripts/run-mutation-tests.sh uses correct path (lines 11, 57-59)

### Pitfall 3: testcontainers Database Not Ready

**What goes wrong:** Mutation testing starts executing before postgres container is fully initialized, all tests fail with connection errors

**Why it happens:** testcontainers needs time to download images, start containers, and initialize database. Default timeout of 60 seconds may not be enough on slow runners.

**How to avoid:**
1. Increase container startup timeout in workflow (currently 60 seconds, consider 120)
2. Add explicit health check before running mutation tests
3. Check docker-compose logs for database readiness

**Warning signs:** All mutation tests fail with "connection refused" or "database not ready" errors, mutation scores are 0% across all packages.

**Detection:**
```bash
# In workflow logs, check container status:
docker-compose ps

# Should show postgres as "Up" with healthy status
```

**Fix:**
- Workflow has `timeout 60 bash -c 'until docker-compose ps | grep -q "Up"; do sleep 2; done'` (line 56)
- Increase timeout to 120 seconds if needed
- Add explicit health check: `docker-compose ps postgres` should show "Up (healthy)"

### Pitfall 4: Mutation Score Not Appearing in Dashboard

**What goes wrong:** Mutation testing completes successfully but mutation_score field remains null/missing in coverage-history.json, dashboard shows "N/A"

**Why it happens:** track-mutation-history.sh fails to extract scores from go-mutesting output, or jq manipulation errors prevent JSON update

**How to avoid:**
1. Verify go-mutesting output contains "mutation score" line
2. Check track-mutation-history.sh grep pattern matches output
3. Test jq manipulation locally before relying on workflow

**Warning signs:** Dashboard shows mutation score as "N/A", jq errors in workflow logs, coverage-history.json missing mutation_score field.

**Detection:**
```bash
# Check if mutation_score exists in latest entry:
jq '.history[-1].mutation_score' data/coverage-history.json

# Expected: {"combat": 85.0, "matchmaking": 80.0, ...}
# If null: tracking script failed
```

**Fix:**
- Run track-mutation-history.sh locally to test score extraction
- Verify go-mutesting output format: `grep -i "mutation score"` should find line
- Check jq syntax in track-mutation-history.sh (lines 135-170)
- Manually update coverage-history.json if tracking script fails

### Pitfall 5: Package Thresholds Not Enforced

**What goes wrong:** Mutation testing runs but doesn't fail when scores are below thresholds, dashboard shows all packages as "passing"

**Why it happens:** run-mutation-tests.sh threshold enforcement logic may have bugs, or score extraction fails (defaulting to 0 which passes incorrectly)

**How to avoid:**
1. Test threshold enforcement with artificially low scores
2. Verify score extraction works correctly
3. Check exit codes in run-mutation-tests.sh (lines 86-92)

**Warning signs:** All packages show "PASS" even with suspicious scores (e.g., 0% or 100%), workflow never fails despite low test quality.

**Detection:**
```bash
# Run mutation testing locally and check exit code:
bash scripts/run-mutation-tests.sh
echo $?

# Expected: 0 if all pass, 1 if any fail
# If always 0: Threshold enforcement not working
```

**Fix:**
- Verify run-mutation-tests.sh extracts scores correctly (lines 75-80)
- Check threshold comparison logic (lines 83-92)
- Test with known low-scoring package to verify failure
- Add explicit error messages when thresholds not met

## Code Examples

Verified patterns from existing infrastructure:

### Manual Workflow Trigger

```bash
# Source: GitHub Actions UI workflow_dispatch
# Navigate to repository > Actions > Mutation Testing > Run workflow
# Or use GitHub CLI:
gh workflow run mutation-testing.yml

# Monitor execution:
gh run watch --log

# Expected output:
# ✓ Mutation testing completed
# ✓ All packages passed
# ✓ Mutation history updated
```

### Local Mutation Testing Execution

```bash
# Source: scripts/run-mutation-tests.sh (existing)
# Quick test on critical packages:
make mutation-test-quick

# Full execution:
make mutation-test

# Or directly:
bash scripts/run-mutation-tests.sh

# Expected output:
# === Mutation Testing Orchestration ===
# Packages: internal/combat internal/matchmaking internal/rpg internal/store internal/season internal/notifications
#
# Testing package: internal/combat (threshold: 85%)
# ---
# The mutation score is 0.850000 (17 passed, 3 failed, 0 skipped, total is 20)
# PASS: Mutation score 85.0% meets threshold 85%
#
# === Mutation Testing Summary ===
# Total packages: 6
# Passed: 6
# Failed: 0
```

### Mutation Score Extraction

```bash
# Source: scripts/track-mutation-history.sh (lines 45-82)
# Extract score from go-mutesting output
output=$(cd backend && go-mutesting --exec ../scripts/mutation-exec-handler.sh internal/combat/ -v 2>&1)
score=$(echo "$output" | grep -i "mutation score" | grep -oP '\d+\.?\d*' | head -1)

# Verify extraction:
echo "Mutation score: ${score}%"

# Expected: "Mutation score: 85.0%"
# If empty: go-mutesting output format changed or grep pattern incorrect
```

### Dashboard Data Loading

```javascript
// Source: docs/coverage-dashboard.html (existing)
// Load mutation score from coverage-history.json
fetch('data/coverage-history.json')
  .then(response => response.json())
  .then(data => {
    const latest = data.history[data.history.length - 1];
    const mutationScore = latest.mutation_score;

    if (mutationScore && mutationScore.combat) {
      document.getElementById('combat-mutation-score').textContent = mutationScore.combat + '%';
    }

    // Trend chart
    const mutationTrend = data.history
      .filter(h => h.mutation_score && h.mutation_score.overall)
      .map(h => ({
        date: h.date,
        score: h.mutation_score.overall
      }));

    drawMutationTrendChart(mutationTrend);
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cron schedule never executed | Manual workflow_dispatch trigger for debugging | Phase 23 | Enables immediate execution and baseline establishment |
| No mutation scores tracked | Automated mutation score tracking in coverage-history.json | Phase 14 (not executed) | Once executed, dashboard will show historical mutation trends |
| Test quality invisible to developers | Mutation score dashboard with package breakdowns | Phase 14 (not executed) | Developers can see which packages have weak tests |
| Manual mutation testing | Automated nightly execution | Phase 14 (not executed) | Continuous test quality monitoring without manual effort |

**Deprecated/outdated:**
- Assuming cron schedules execute without verification (Phase 14 acknowledged this limitation)
- Manual mutation score tracking in separate files (unified in coverage-history.json)
- Mutation testing on every PR commit (performance concern, nightly only)

## Open Questions

1. **Why hasn't the cron schedule executed?**
   - What we know: workflow has cron '0 2 * * *' configured, Phase 14 verification noted "human verification required"
   - What's unclear: Root cause - could be GitHub Actions throttling, workflow syntax error, or repository inactivity
   - Recommendation: Manually trigger workflow via workflow_dispatch, monitor logs, fix any issues, verify cron executes next day

2. **What are actual baseline mutation scores for this codebase?**
   - What we know: Thresholds defined (combat 85%, matchmaking 80%, others 75%), but no actual scores exist
   - What's unclear: Whether thresholds are achievable or need adjustment based on real code
   - Recommendation: Run full mutation testing to establish baseline, analyze results, adjust thresholds if needed

3. **Are there flaky test issues interfering with mutation testing?**
   - What we know: mutation-exec-handler.sh checks data/flaky-test-quarantine.json and skips quarantined tests
   - What's unclear: Whether quarantined tests exist, whether skipping them affects mutation scores
   - Recommendation: Check quarantine file content, verify skip logic works, monitor mutation score impact

4. **How long does full mutation testing take on this codebase?**
   - What we know: go-mutesting can be 10-30x slower than regular tests, workflow timeout is 180 minutes
   - What's unclear: Actual execution time for Armored Archer's 6 packages
   - Recommendation: Monitor workflow execution time after manual trigger, adjust timeout if needed

5. **Will mutation score dashboard work with actual data?**
   - What we know: Dashboard infrastructure exists with mutation score cards and trend chart
   - What's unclear: Whether JavaScript correctly loads and displays mutation_score field
   - Recommendation: Verify dashboard in browser after mutation testing completes, fix any display issues

## Sources

### Primary (HIGH confidence)

- **Existing project files** - `.github/workflows/mutation-testing.yml`, `scripts/run-mutation-tests.sh`, `scripts/mutation-exec-handler.sh`, `scripts/track-mutation-history.sh`, `backend/tests/quality/mutation_config.yaml`, `data/coverage-history.json`, `docs/coverage-dashboard.html`
- **Phase 14 research and verification** - `/home/alex/armored-archer/.planning/phases/14-mutation-testing-integration/14-RESEARCH.md` and `14-VERIFICATION.md` document all mutation testing infrastructure
- **go-mutesting help output** - `~/go/bin/go-mutesting --help` and `--list-mutators` confirm available flags and mutator types
- **Makefile** - `make mutation-test`, `make mutation-test-quick` targets provide local execution commands

### Secondary (MEDIUM confidence)

- **GitHub Actions documentation** - workflow_dispatch trigger allows manual workflow execution, cron schedule syntax verified as '0 2 * * *'
- **jq documentation** - JSON manipulation patterns for updating coverage-history.json with mutation_score field
- **Project state and requirements** - `STATE.md` and `REQUIREMENTS.md` confirm MUT-05 and MUT-06 are pending

### Tertiary (LOW confidence)

- **Web search** - Not performed (existing documentation and codebase provide sufficient information for Phase 23 execution)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - go-mutesting verified installed, GitHub Actions workflow confirmed, all supporting tools (jq, testcontainers) already in project
- Architecture: HIGH - Execution flow documented from existing workflow and scripts, manual trigger pattern verified via workflow_dispatch, score extraction pattern verified from track-mutation-history.sh
- Pitfalls: HIGH - Cron execution failure documented in Phase 14 verification, go-mutesting path issues identified in workflow, testcontainers startup timing verified as common issue, score extraction gaps confirmed from coverage-history.json analysis

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (30 days - infrastructure stable, execution-focused phase)
