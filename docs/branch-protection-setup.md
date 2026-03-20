# Branch Protection for Visual Regression Checks

## Purpose

This guide explains how to configure GitHub branch protection rules to require visual regression tests to pass before code can be merged to the `main` branch. This ensures that visual regressions in UI components are caught and reviewed before deployment.

## Why Branch Protection?

- **Prevents visual regressions** from reaching production
- **Ensures code quality** by requiring automated visual tests to pass
- **Enforces review process** for intentional visual changes
- **Maintains design consistency** across the codebase

## Configuration Steps

### 1. Navigate to Repository Settings

1. Go to your GitHub repository
2. Click the **Settings** tab at the top
3. Select **Branches** from the left sidebar

### 2. Add or Edit Branch Rule

1. Find the **Branch protection rules** section
2. Click **Add rule** (or edit existing rule for `main` branch)
3. In **Branch name pattern**, enter: `main`

### 3. Configure Status Checks

1. Enable the checkbox: **Require status checks to pass before merging**
2. Search for: `visual-regression`
3. Select the **visual-regression** status check
4. (Optional) Enable **Require branches to be up to date before merging**

### 4. Additional Protections (Recommended)

1. **Require pull request reviews before merging**
   - Set required approvers to 1
   - Enable **Dismiss stale PR approvals when new commits are pushed**

2. **Require conversation resolution before merging**
   - Ensures all PR comments are resolved

3. **Limit who can push to matching branches**
   - Restrict pushes to require PR approval
   - Prevent force pushes

4. **Allow force pushes** (optional)
   - Generally disabled for main branch
   - Can be enabled for emergency fixes with caution

### 5. Save the Rule

1. Click **Create** (or **Save changes**) at the bottom
2. Confirm the rule is active

## Verification

### Check 1: Verify Rule is Active

1. Go to **Settings → Branches**
2. Confirm you see the `main` branch rule with:
   - ✅ Require status checks to pass before merging
   - ✅ visual-regression listed

### Check 2: Test with a Pull Request

1. Create a new branch: `git checkout -b test-visual-regression`
2. Make a trivial UI change (e.g., modify button color)
3. Commit and push: `git push origin test-visual-regression`
4. Create a pull request to `main`
5. Verify the PR shows:
   - ⏳ **visual-regression** check in the status checks section
   - 🚫 **Cannot merge** message if checks haven't passed
   - ✅ **All checks have passed** message when tests succeed

### Check 3: Verify Check Behavior

After creating a PR, the **visual-regression** check should:
- Appear in the PR's status checks section
- Show as ⏳ **Pending** while tests run
- Show as ✅ **Passed** when all tests succeed
- Show as ❌ **Failed** when critical component tests fail
- Show as ⚠️ **Passed with warnings** when only nice-to-have components fail

## Workflow Status Checks

The visual regression workflow provides the following status checks:

| Check Name           | Description                                          | Blocks PR? |
|----------------------|------------------------------------------------------|------------|
| `visual-regression`  | Visual regression tests for UI components            | Yes        |
| `theme-consistency`  | Theme switching and contrast ratio tests             | Yes        |
| `summary`            | Overall test summary (passes if all checks pass)     | Yes        |

## Troubleshooting

### Issue: Status Check Not Appearing

**Symptom**: The `visual-regression` check doesn't show up in PR status checks.

**Solutions**:

1. **Workflow hasn't run yet**
   - Push a commit that triggers the workflow (modify `scenes/ui/**` files)
   - Wait for the workflow to complete
   - Refresh the PR page

2. **Workflow permissions not configured**
   - Go to **Settings → Actions → General**
   - Under **Workflow permissions**, select **Read and write permissions**
   - Save changes

3. **Branch rule not saved**
   - Revisit **Settings → Branches**
   - Verify the `main` branch rule exists
   - Confirm `visual-regression` is in the required checks list

### Issue: Workflow Fails to Run

**Symptom**: The workflow shows ❌ **Failed** immediately.

**Solutions**:

1. **Check workflow syntax**
   - Go to **Actions** tab
   - Click on the failed workflow run
   - Review error logs for syntax errors

2. **Verify Godot action**
   - Ensure `notifiarr/godot-action@v0.2.2` is accessible
   - Check if Godot 4.6 is available

3. **Check ImageMagick installation**
   - Verify the `apt-get install` command succeeds
   - Check if `compare` command is available

### Issue: Tests Pass But PR is Blocked

**Symptom**: All tests show ✅ **Passed** but PR still cannot merge.

**Solutions**:

1. **Check other required status checks**
   - Review all required checks in branch protection rules
   - Ensure ALL required checks have passed

2. **Verify branch protection settings**
   - Confirm `Require branches to be up to date before merging` is satisfied
   - Update PR branch if main has new commits: `git merge main`

3. **Check for review requirements**
   - Ensure required number of approvals is met
   - Resolve all PR review comments

### Issue: Intentional Visual Changes Fail Tests

**Symptom**: You made an intentional UI change, but tests fail.

**Solutions**:

1. **Update baseline screenshots**
   - Run tests locally: `godot4 --headless --script res://test/suites/visual/test_visual_regression.gd`
   - Copy new screenshots to baseline: `cp user://test/screenshots/current/* test/screenshots/baseline/`
   - Commit and push: `git add test/screenshots/baseline/ && git commit -m "chore: update visual baselines"`

2. **Review with team**
   - If change is significant, discuss in PR comments
   - Get team approval before updating baselines
   - Document the reason for visual change

## Best Practices

### 1. Review Failed Tests

When visual tests fail:
- Download screenshot artifacts from CI
- Compare baseline vs current screenshots
- Review diff images to understand what changed
- Determine if it's a regression or intentional change

### 2. Update Baselines Responsibly

Only update baselines when:
- Change is intentional and approved
- Design system update affects multiple components
- Theme colors are modified across the board

### 3. Document Visual Changes

When updating baselines:
- Commit message should explain the visual change
- PR description should include before/after screenshots
- Reference design tickets or UX decisions

### 4. Monitor Test Flakiness

If tests are flaky (inconsistent results):
- Check for anti-aliasing or font rendering issues
- Consider increasing tolerance threshold (currently 1%)
- Review platform-specific rendering differences

### 5. Keep Baselines Current

Regular maintenance:
- Review baselines after major Godot updates
- Update baselines after design system changes
- Remove obsolete component baselines

## Advanced Configuration

### Custom Thresholds

To adjust the pixel difference tolerance:

1. Edit `test/suites/visual/test_visual_regression.gd`
2. Modify `const TOLERANCE = 0.01` (1%)
3. Update `scripts/compare-screenshots.py` default threshold
4. Test and commit changes

### Additional Viewport Sizes

To add new viewport sizes:

1. Add constant in `test_visual_regression.gd`:
   ```gdscript
   const VIEWPORT_WIDE = Vector2i(2560, 1440)
   ```

2. Add viewport name in `_get_viewport_name()` function

3. Update this documentation

### Exclude Specific Files

To prevent workflow from running on certain files:

1. Edit `.github/workflows/visual-regression.yml`
2. Add `paths-ignore` to the trigger:
   ```yaml
   on:
     pull_request:
       paths:
         - 'scenes/ui/**'
       paths-ignore:
         - 'scenes/ui/docs/**'
   ```

## Related Documentation

- **Visual Regression Tests**: `test/suites/visual/test_visual_regression.gd`
- **Theme Consistency Tests**: `test/suites/visual/test_theme_consistency.gd`
- **CI Workflow**: `.github/workflows/visual-regression.yml`
- **Screenshot Guide**: `test/screenshots/README.md`
- **Design Tokens**: `autoloads/design_tokens.gd`

## Support

If you encounter issues not covered in this guide:

1. Check GitHub Actions logs for detailed error messages
2. Review workflow syntax in `.github/workflows/visual-regression.yml`
3. Verify test implementation in `test/suites/visual/`
4. Consult Godot and GUT documentation for testing best practices

---

**Last Updated**: 2026-03-20
**Workflow Version**: 1.0
**Maintained By**: Development Team
