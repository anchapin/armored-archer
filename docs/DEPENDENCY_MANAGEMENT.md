# Dependency Management

This document outlines the dependency management strategy for the Armored Archer project to ensure reproducible builds and pinned dependencies.

## Overview

Armored Archer consists of two main components with different dependency management approaches:

1. **Backend (Node.js/TypeScript)**: Located in `/backend/`
2. **Game Client (Godot/GDScript)**: Located in project root

## Backend Dependencies

### Technology

- **Runtime**: Node.js 18+
- **Package Manager**: npm
- **Lockfile**: `package-lock.json` (lockfileVersion 3)

### Managing Dependencies

All backend dependencies are defined in `backend/package.json` and locked via `backend/package-lock.json`.

**Adding a new dependency:**

```bash
cd backend
npm install <package-name> --save      # Production dependency
npm install <package-name> --save-dev   # Development dependency
```

This automatically updates both `package.json` and `package-lock.json`.

**Installing dependencies from lockfile:**

```bash
cd backend
npm install
```

This uses the exact versions from `package-lock.json` for reproducible builds.

**Updating dependencies:**

```bash
# Update to latest minor version within range
npm update

# Update to latest version (may break compatibility)
npm install <package-name>@latest
```

### Verification

To verify the lockfile is in sync with package.json:

```bash
cd backend
npm install --package-lock-only
npm audit
```

## Game Client Dependencies

### Technology

- **Engine**: Godot 4.x
- **Scripting**: GDScript
- **Plugins/Addons**: Located in `/addons/`

### Managing Dependencies

The Godot game client uses:

1. **Built-in Godot packages**: No external package manager needed
2. **Addons**: Located in `/addons/` directory (e.g., Analytics Manager)
3. **External Assets**: Downloaded and stored in `/assets/` or `/addons/`

For addons:
- Addons are stored directly in the repository under `/addons/`
- Each addon has its own `plugin.cfg` file for Godot to recognize it
- To update an addon, replace the files in the addon directory

## Best Practices for Reproducible Builds

### Backend

1. **Always commit `package-lock.json`** alongside `package.json`
2. **Use `npm ci`** instead of `npm install` in CI/CD pipelines for faster, cleaner installs
3. **Pin exact versions** in `package.json` if you need absolute control (use `version` instead of `^version`)
4. **Audit dependencies** regularly: `npm audit fix`

### Godot Client

1. **Version control addons** by committing the entire addon folder
2. **Document external dependencies** (assets, tools) in this file or relevant documentation
3. **Use Godot's export templates** from a consistent version

## Verification Commands

Run these commands to verify dependency setup:

```bash
# Backend - verify lockfile integrity
cd backend
npm install --package-lock-only
npm audit

# Check for outdated packages
npm outdated
```

## Unused Dependency Detection

### Tool: depcheck

We use [depcheck](https://github.com/depcheck/depcheck) to detect unused dependencies in the backend project.

### Running Detection

```bash
# Run depcheck to find unused dependencies
cd backend
npm run depcheck
```

### CI/CD Integration

Unused dependency detection runs automatically in the CI/CD pipeline (see `.github/workflows/ci.yml` - job: `dependency-check`). This job runs on every push to `main` and `develop` branches, and on all pull requests.

### Review and Removal Process

When depcheck reports unused dependencies:

1. **Review the findings**: Not all reported unused dependencies should be removed. Some may be:
   - Used dynamically (e.g., in configuration files)
   - Peer dependencies of other packages
   - Used in build scripts or tooling
   - Intentionally installed for future use

2. **Verify usage**: Before removing, verify if the dependency is actually used:
   - Check for dynamic imports: `grep -r "import.*package-name" src/`
   - Check for require statements: `grep -r "require.*package-name" src/`
   - Check build scripts: `grep "package-name" package.json`
   - Check configuration files

3. **Remove safely**: If confirmed unused:
   ```bash
   cd backend
   npm uninstall <package-name>
   ```

4. **Test thoroughly**: After removal, run the test suite to ensure nothing broke:
   ```bash
   npm test
   npm run build
   ```

### Known Exceptions

Some packages may be reported as unused but are intentionally kept:

- **@types/jest**: Required for Jest types, used via ts-jest preset
- **husky**: Git hooks framework (configured in .husky/)
- **lint-staged**: Runs pre-commit hooks on staged files
- **webpack, webpack-bundle-analyzer, webpack-cli**: Bundle analysis tooling

To ignore specific packages in depcheck, create a `.depcheckrc` configuration file:

```json
{
  "ignores": [
    "@types/jest",
    "husky",
    "lint-staged",
    "webpack*"
  ]
}
```

## Dependency Count Tracking

### Monitoring

Track dependency counts to monitor project health over time:

```bash
# Count total dependencies
cd backend
npm ls --depth=0 | wc -l

# Count production dependencies
npm ls --depth=0 --prod | wc -l

# Count development dependencies
npm ls --depth=0 --dev | wc -l
```

### Metrics in CI

The dependency count can be tracked as a metric by adding a script to output the counts. This helps identify when dependencies are growing significantly.

## References

- [npm package-lock.json documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)
- [npm ci documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Godot Addons Documentation](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html)
- [depcheck documentation](https://github.com/depcheck/depcheck)
