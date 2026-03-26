# Phase 13: User Setup Required

**Generated:** 2026-03-22
**Phase:** 13-godot-coverage-tools
**Status:** Incomplete

Complete these items for HTML report generation to function. Claude automated everything possible; these items require human action to install Python dependencies.

## Environment Variables

No environment variables required for this phase.

## Account Setup

No account setup required.

## Dashboard Configuration

No dashboard configuration required.

## Local Development

### Python Dependency Installation

- [ ] **Install Jinja2 library**
  - Location: Run in terminal
  - Command: `pip install jinja2`
  - Notes: Required for HTML report generation in parse_godot_coverage.py

## Verification

After completing setup:

```bash
# Verify Jinja2 is installed
pip show jinja2
```

Expected results:
- `pip show jinja2` returns package information (version 3.x.x)
- Jinja2 can be imported in Python scripts without ImportError

---

**Once all items complete:** Mark status as "Complete" at top of file.
