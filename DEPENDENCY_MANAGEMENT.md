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

## References

- [npm package-lock.json documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)
- [npm ci documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Godot Addons Documentation](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html)
