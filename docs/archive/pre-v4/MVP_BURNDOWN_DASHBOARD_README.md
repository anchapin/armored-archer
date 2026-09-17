# MVP Burndown Dashboard

A lightweight, self-contained dashboard for tracking MVP blockers across sprints and phases for the Armored Archer project.

## Features

- **Real-time GitHub Integration**: Automatically fetches blocker issues from GitHub
- **Burndown Chart**: Visualizes open/closed blockers over time
- **Sprint Breakdown**: Groups blockers by sprint with progress tracking
- **Historical Data**: Stores up to 90 days of progress in localStorage
- **Auto-refresh**: Updates every 5 minutes
- **Responsive Design**: Works on desktop and mobile
- **No Backend Required**: Pure HTML/JS with GitHub API
- **Demo Mode**: Test the dashboard with mock data without a GitHub connection

## Quick Start

### Demo Mode (Recommended First Step)

To explore the dashboard without setting up GitHub access:

1. Open the dashboard in your browser
2. Enable **Demo Mode** toggle at the top
3. The dashboard will load with sample data showing Sprint 0-8 blockers

### Option 1: Open Directly

Simply open the dashboard in your browser:

```bash
# From the project root
open docs/mvp-burndown-dashboard.html
```

Or navigate to the file and double-click it.

### Option 2: Serve Locally

For better development experience, use a local server:

```bash
# Using Python 3
cd docs
python3 -m http.server 8080

# Then visit: http://localhost:8080/mvp-burndown-dashboard.html

# Using Node.js (if you have http-server installed)
npx http-server docs -p 8080
```

### Option 3: GitHub Pages

Deploy to GitHub Pages for team access:

1. The dashboard is already in the `docs/` directory
2. Enable GitHub Pages in repo settings to serve from `docs/`
3. Access at `https://<username>.github.io/armored-archer/mvp-burndown-dashboard.html`

## Configuration

### Default Settings

The dashboard defaults to:
- **Repository**: `anchapin/armored-archer`
- **Blocker Labels**: `blocker,P0,P1,critical`

### Custom Configuration

Edit the input fields directly on the dashboard to:
- Change repository (format: `owner/repo`)
- Adjust label filters (comma-separated)

### GitHub API Rate Limit

The dashboard uses GitHub's public API (60 requests/hour). If you hit rate limits:

1. Create a personal access token: https://github.com/settings/tokens
2. Add it to the URL: `?token=YOUR_TOKEN` (token is stored in localStorage)
3. Or fork and modify the script to use authentication headers

### Private Repositories

If your repository is private, the dashboard will show an error. Options:

1. **Use Demo Mode**: Enable the demo mode toggle to explore the dashboard with mock data
2. **Make Repository Public**: Temporarily make it public for dashboard access
3. **Fork to Public Account**: Fork the repo to a public GitHub account
4. **Custom Implementation**: Modify the dashboard to use GitHub authentication

## Dashboard Sections

### Summary Cards

- **Total Blockers**: All blocker issues matching filter criteria
- **Open Blockers**: Currently open blockers
- **Closed Blockers**: Resolved blockers
- **Completion**: Percentage of blockers closed

Trend indicators show change vs previous day.

### Burndown Chart

Shows the trend of open vs closed blockers over time:
- Red line: Open blockers (should trend down)
- Green line: Closed blockers (should trend up)

### Sprint Breakdown

Each sprint card shows:
- Sprint name (parsed from issue title: `[Sprint X]`)
- Total items count
- Progress bar with completion percentage
- List of individual issues with status

## Label Convention

For proper sprint grouping, use this format in issue titles:

```
[Sprint X] Issue title here
```

Where `X` is the sprint number (0, 1, 2, etc.).

Examples:
- `[Sprint 0] Create lightweight release burndown dashboard`
- `[Sprint 8] Fix all P0 and P1 trust-system blockers`

## Data Storage

- Historical data is stored in browser's localStorage
- Persists across sessions
- Limited to last 90 days
- To clear data: Clear browser localStorage for the dashboard

## Troubleshooting

### "Error loading data" or API errors
- Repository may be private - use **Demo Mode** to test the dashboard
- Check your network connection
- Verify the repository name is correct (format: `owner/repo`)

### "GitHub API error: 403"
- You've hit the rate limit. Wait 60 minutes or add a GitHub token.
- Consider using **Demo Mode** for testing without API calls

### "GitHub API error: 404"
- Repository doesn't exist or is private
- Enable **Demo Mode** to see how the dashboard works
- Make the repository public or fork to a public account

### "No issues found"
- Check that the repository is correct
- Verify issues have the specified labels
- Ensure issues are not hidden by filters
- Try adjusting the label filter

### Chart not updating
- Check browser console for errors
- Verify network connectivity
- Try clicking "Refresh Data"
- Clear browser localStorage and reload

### Demo mode not working
- Refresh the page
- Check browser console for JavaScript errors
- Ensure JavaScript is enabled in your browser

### Sprint grouping not working
- Ensure issues use `[Sprint X]` format in title
- Check case sensitivity (capital "Sprint")
- No space after "Sprint" and before the number

## Team Usage

### Daily Standup

1. Open dashboard before standup
2. Note current blocker count
3. Discuss any new blockers
4. Review sprint progress

### Sprint Planning

1. Check remaining blockers in current sprint
2. Review blocker trend (is it going down?)
3. Plan next sprint based on open items

### Release Readiness

1. Ensure open blockers = 0 for all sprints
2. Review burndown chart for completion trend
3. Verify all critical blockers resolved

## Customization

To customize the dashboard:

1. Open `mvp-burndown-dashboard.html` in a text editor
2. Modify default values in the JavaScript:
   - `repoInput` default value
   - `labelsInput` default value
   - Chart colors and styles
   - Sprint colors

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design supported

## Security Notes

- No sensitive data is transmitted except GitHub API calls
- Tokens are stored in browser localStorage (use only for personal tokens)
- Dashboard runs entirely in the browser (no backend)

## License

Same as the Armored Archer project.

---

**Maintained by**: Armored Archer Team
**Last Updated**: 2026-04-15
