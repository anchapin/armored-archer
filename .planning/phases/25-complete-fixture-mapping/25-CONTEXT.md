# Phase 25: Complete Fixture Mapping - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add package-to-fixture mapping in gap-analysis.sh to automatically suggest fixtures for packages with coverage gaps. This helps developers quickly identify which test factories to use when writing new tests.
</domain>

<decisions>
## Implementation Decisions

### Core Focus
- Map rpg package to NewPlayerBuilder()
- Map gear package to NewGearBuilder() 
- Map other packages to test helpers or mark N/A
- Update gaps.json output structure to include fixture suggestions

</decisions>

<code_context>
## Existing Code Insights

### Gap Analysis Script
- Location: `backend/scripts/gap-analysis.sh`
- Current: Identifies zero-coverage functions, generates gaps.json
- Missing: Fixture mapping logic

### Fixtures Available
- Location: `backend/tests/testhelpers/fixtures_builder.go`
- NewPlayerBuilder() - for rpg package tests
- NewGearBuilder() - for gear/inventory package tests
- Other test helpers - for various packages

### Integration Points
- gaps.json structure - needs suggested_fixtures array
- CI/CD workflow - reads gaps.json
- Coverage reports - uses fixture suggestions

</code_context>

<specifics>
## Specific Ideas

From ROADMAP.md Phase 25 details:
- Add package-to-fixture mapping function to gap-analysis.sh
- Link rpg to NewPlayerBuilder()
- Link gear to NewGearBuilder()
- Mark feedback, notifications, observability, utils as N/A
- Populate suggested_fixtures in gaps.json

</specifics>

<deferred>
## Deferred Ideas

None — this is straightforward fixture mapping.
</deferred>
