# Visual Regression Screenshots

This directory contains baseline screenshots for visual regression testing of UI components.

## Directory Structure

```
test/screenshots/
├── baseline/           # Committed baseline screenshots
│   ├── base_button_light_mobile.png
│   ├── base_button_dark_mobile.png
│   └── ...
└── current/            # Generated during test runs (not committed)
    ├── base_button_light_mobile.png
    └── ...
```

## Naming Convention

Baseline screenshots follow this naming pattern:

```
{component}_{theme}_{viewport}.png
```

- **component**: Name of the UI component (e.g., `base_button`, `base_panel`)
- **theme**: Theme variant (`light` or `dark`)
- **viewport**: Viewport size (`mobile`, `tablet`, or `desktop`)

### Examples

- `base_button_light_mobile.png` - Base button in light theme on mobile viewport
- `base_panel_dark_tablet.png` - Base panel in dark theme on tablet viewport
- `theme_toggle_light_desktop.png` - Theme toggle in light theme on desktop viewport

## Viewport Sizes

| Viewport  | Resolution | Use Case               |
|-----------|------------|------------------------|
| mobile    | 375x667    | Mobile phones          |
| tablet    | 768x1024   | Tablets                |
| desktop   | 1920x1080  | Desktop monitors       |

## Updating Baselines

When you make intentional visual changes to UI components, you'll need to update the baseline screenshots:

### Option 1: Automatic Baseline Creation

On first run, if a baseline doesn't exist, the test will automatically create it from the current screenshot.

### Option 2: Manual Baseline Update

1. Run the visual regression tests locally:
   ```bash
   godot4 --headless --script res://test/suites/visual/test_visual_regression.gd
   ```

2. Review the generated screenshots in `user://test/screenshots/current/`

3. Copy approved screenshots to baseline:
   ```bash
   cp user://test/screenshots/current/base_button_light_mobile.png test/screenshots/baseline/
   ```

4. Commit the new baselines:
   ```bash
   git add test/screenshots/baseline/
   git commit -m "chore: update visual baselines for [component]"
   ```

## Reviewing Diff Images

When tests fail, the comparison script generates diff images highlighting pixel differences:

1. Download the `visual-regression-screenshots` artifact from CI
2. Open diff images to see what changed
3. Determine if the change is intentional or a regression

## Troubleshooting

### Baselines Not Found

If baselines are missing, tests will auto-create them on first run. Commit these new baselines to git.

### False Positives

If tests fail due to anti-aliasing or rendering differences:

1. Review the diff images
2. If the difference is acceptable, update the baseline
3. If the difference is a real regression, fix the UI component

### Platform-Specific Rendering

Visual tests use Godot's headless mode for consistent rendering across CI platforms. Local tests may show slight differences due to:
- GPU drivers
- Font rendering
- Anti-aliasing algorithms

For consistent results, run tests in headless mode:
```bash
godot4 --headless --script res://test/suites/visual/test_visual_regression.gd
```

## Continuous Integration

Visual regression tests run automatically on:

- Pull requests that modify UI components
- Pull requests that modify design tokens
- Pushes to `main` or `develop` branches
- Manual workflow dispatch

### Branch Protection

Configure branch protection to require the `visual-regression` status check before merging:

1. Go to repository Settings → Branches
2. Add or edit rule for `main` branch
3. Enable "Require status checks to pass before merging"
4. Add `visual-regression` to required checks
5. Save changes

See `docs/branch-protection-setup.md` for detailed instructions.

## Component Coverage

### Critical Components (Block PR)

- `base_button` - Interactive buttons
- `base_panel` - Panel containers
- `base_progress_bar` - Progress indicators
- `theme_toggle` - Theme switcher

### Nice-to-Have Components (Warning Only)

- `base_label` - Text labels
- `base_icon` - Icon components
- `base_container` - Layout containers
- `loading_indicator` - Loading states

## Test Configuration

- **Tolerance**: 1% pixel difference
- **Fuzz**: 1% (allows for minor anti-aliasing differences)
- **Metric**: RMSE (Root Mean Square Error)
- **Themes**: Light, Dark
- **Viewports**: Mobile, Tablet, Desktop

For more details, see the test implementation in:
- `test/suites/visual/test_visual_regression.gd`
- `test/suites/visual/test_theme_consistency.gd`
