extends RefCounted

## Single source of truth for the offline PvE demo's RNG seed (issue #1861).
##
## The offline demo runner (`scripts/run-offline-demo.sh`) drives the headless
## stage harness (`test/smoke/smoke_stage.gd`). The harness resolves the seed
## through this script and seeds the global RNG before the stage starts, so two
## runs with the same seed replay identically.
##
## The pinned default lives here and only here. A debugging override travels
## from the runner's `--seed` flag / `OFFLINE_DEMO_SEED` environment variable
## to the harness as `--seed=<n>`; it never replaces the constant below.
##
## Workflow: see `docs/dev-offline-demo-seeded-replay.md`.

## Pinned default seed for the offline demo replay.
const DEFAULT_SEED: int = 1861

## Seed value meaning "no override was supplied".
const NO_OVERRIDE: int = -1

## Resolves the effective seed: the override when it is a valid (>= 0) value,
## otherwise the pinned default.
static func resolve(requested: int) -> int:
	if requested < 0:
		return DEFAULT_SEED
	return requested

## Seeds the global RNG with the effective seed and returns it.
static func apply(requested: int) -> int:
	var resolved: int = resolve(requested)
	seed(resolved)
	return resolved
