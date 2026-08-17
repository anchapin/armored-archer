# Database Migrations Runbook

> **Issue:** [#891 — Local DB volume missing game schema, migrations 000–007 never applied](https://github.com/armored-archer/armored-archer/issues/891)
>
> **Mandatory:** Any operation that **mutates schema** requires a second engineer to review the migration log. See [§ Human supervision](#human-supervision--hard-requirement).
>
> **Scope:** Local development stack only (`make services-start` → `armored_archer_db` + `armored_archer_server` containers). Production / alpha / beta environments use a different change-management process.

This runbook explains how to detect missing game migrations on the local stack and how to apply them safely. It is paired with a read-only verification script: [`backend/scripts/check-game-schema.sh`](../../backend/scripts/check-game-schema.sh) (run via `make check-game-schema`).

---

## Table of contents

1. [Background](#background)
2. [Pre-flight checklist](#pre-flight-checklist)
3. [Step-by-step: apply game migrations](#step-by-step-apply-game-migrations)
4. [Verification](#verification)
5. [Rollback / forward-only warning](#rollback--forward-only-warning)
6. [Human supervision — hard requirement](#human-supervision--hard-requirement)
7. [Troubleshooting](#troubleshooting)

---

## Background

The local Postgres volume (`backend_data`) was originally created before the game schema existed. It contains the **16 core Nakama tables** (users, leaderboard, storage, wallet_ledger, …) but **none of the game tables** from `backend/data/*.sql`:

| Migration | Tables introduced |
| --- | --- |
| `000_create_nakama_users_table.sql` | (Nakama core baseline) |
| `001_create_player_stats.sql` | `player_stats` |
| `002_create_catalog.sql` | `catalog` |
| `003_create_inventory.sql` | `inventory` |
| `004_create_loadout.sql` | `loadout` |
| `005_create_stage_completion.sql` | `stage_completion` |
| `006_create_notifications.sql` | `notifications`, … |
| `007_create_boss_defeat_tracking.sql` | `boss_defeat_tracking`, … |

The integration test suite assumes these tables exist. Until #891 is resolved, any local integration test runs against a DB that has none of them.

---

## Pre-flight checklist

Before touching the database:

- [ ] Stack is up and healthy: `make services-health` shows **both** Nakama and Postgres as `Healthy`.
- [ ] You have read this runbook end-to-end (including the [Human supervision](#human-supervision--hard-requirement) section).
- [ ] A **second engineer** has been pinged and is available to review the migration log when you run it (see §6).
- [ ] `backend/.env` exists and has the correct `POSTGRES_*` values. (`POSTGRES_PASSWORD` must match what was used to create the `backend_data` volume — if they disagree, see [Troubleshooting](#troubleshooting).)
- [ ] You are running on a **local stack**. Do **not** apply migrations against `alpha` or `beta` environments from this runbook.

```text
# Quick pre-flight (run from repo root)
make services-health
ls backend/.env          # must exist
docker ps --filter name=armored --format '{{.Names}}\t{{.Status}}'
```

---

## Step-by-step: apply game migrations

> **Read §6 before running any command.** Migrations are forward-only.

1. **Confirm the gap** (read-only):

   ```bash
   make check-game-schema
   ```

   Expected output before fixing:

   ```text
   Required tables: 4
   Present:         0
   Missing:         4
   FAIL — the following required game tables are missing:
     - player_stats
     - catalog
     - inventory
     - loadout
   ```

2. **Pick the apply method** — both call the same `nakama migrate up` under the hood. The Makefile target now reads the password from `backend/.env` (post-#896 fix); the raw `docker exec` form is shown for transparency.

   ```bash
   # Preferred (uses backend/.env, no hardcoded secrets):
   make backend-migrate

   # Or, equivalent manual invocation:
   docker exec -e POSTGRES_USER \
               -e POSTGRES_PASSWORD \
               -e POSTGRES_DB \
               armored_archer_server \
     /nakama/nakama migrate up \
       --database.address "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
   ```

   > **Container DSN note:** the `armored_archer_server` container reaches Postgres at hostname `postgres` (the docker-compose service name), **not** `localhost`. `make backend-migrate` already handles this internally.

3. **Capture the migration log** so the reviewer can inspect it. Tail the Nakama container:

   ```bash
   docker logs armored_archer_server --tail 200 > /tmp/migration-$(date +%Y%m%d-%H%M%S).log
   ```

4. **Notify the reviewer** — paste the log (or its path) and wait for an ack before continuing.

---

## Verification

After the reviewer signs off, confirm the schema is now in place.

### Automated check (preferred)

```bash
make check-game-schema
```

Expected output after fixing:

```text
== 2/2  Checking required game tables ==
  ✓ player_stats
  ✓ catalog
  ✓ inventory
  ✓ loadout

== Summary ==
Required tables: 4
Present:         4
Missing:         0
PASS — all required game tables are present in nakama.
```

### Manual checks via `psql`

The `psql` CLI is available inside the Postgres container. The local stack's Postgres is exposed on host port `5433`.

```bash
# Show every table in the public schema
docker exec armored_archer_db psql -U postgres -d nakama -c '\dt'

# Confirm the four required tables exist (one row each)
docker exec armored_archer_db psql -U postgres -d nakama -At \
  -c "SELECT tablename FROM pg_tables WHERE schemaname='public'
        AND tablename IN ('player_stats','catalog','inventory','loadout')
        ORDER BY tablename;"

# Show which migrations Nakama has applied
docker exec armored_archer_db psql -U postgres -d nakama -c \
  "SELECT version, name FROM migration_info ORDER BY version;"
```

All four tables should appear, and `migration_info` should list every `backend/data/*.sql` file in order.

---

## Rollback / forward-only warning

The Nakama migration system used here is **forward-only**. There is no automatic rollback: `nakama migrate down` is not used for the game migrations.

If an applied migration was wrong:

1. Do **not** try to reverse it via SQL.
2. Add a new migration that fixes the schema (e.g. `016_fix_inventory_typo.sql`) and have it reviewed like any other schema change.
3. If the data is corrupt and a fix is impossible, the only safe option is to recreate the volume: `make services-clean && make services-start` — this **destroys all local data**.

---

## Human supervision — hard requirement

> **Per [`AGENTS.md` § AI Agent-Assisted Development](../../AGENTS.md):**
> *"database migrations plus security-critical code always require human supervision."*

Concretely:

1. **No auto-apply.** Nothing in this repo is permitted to run migrations automatically on container startup or as a side effect of `make backend-start`. The Docker Compose entrypoint runs `migrate up` *for the Nakama baseline* during stack bring-up, but **game migrations** must be triggered by a human, on demand, after the second-engineer review.
2. **Two-engineer rule.** Before invoking `make backend-migrate`, paste the planned invocation (including the resulting DSN) into the project's engineering channel and wait for a thumbs-up from at least one reviewer who is not the operator.
3. **Log review.** The reviewer must read the full migration log (`docker logs armored_archer_server --tail 200` at minimum) and confirm no errors / warnings before the operator moves on to [§ Verification](#verification).
4. **Roll-forward, never roll-back.** See the previous section.

If you discover a way to make this runbook auto-applied (e.g. an entrypoint change, a pre-push hook, a CI step), **stop**. That change requires the same human-supervision process, not a side-door in CI.

---

## Troubleshooting

### `make backend-migrate` fails with "password authentication failed"

- `backend/.env` `POSTGRES_PASSWORD` no longer matches the password baked into the `backend_data` volume (this happens after a `.env` rotation that wasn't applied inside the container). Fix:

  ```bash
  docker exec -it armored_archer_db psql -U postgres \
    -c "ALTER USER postgres WITH PASSWORD '<value-from-backend/.env>';"
  ```

- The Makefile target now sources `backend/.env` directly (post-#896 fix). If you still see a hardcoded password in the target, your worktree is stale — `git pull` and rerun.

### `make check-game-schema` says "Docker container 'armored_archer_db' not running"

- Bring the stack up: `make services-start`. The script will not auto-start services (that would violate the read-only contract).

### `make check-game-schema` says "No 'psql' binary and no 'armored_archer_db' container"

- Either install `psql` locally or start the stack. The script does **not** install either for you (intentional — it must not change your environment).

### Tables exist but the migration log shows errors

- Inspect `docker logs armored_archer_server --tail 200`. Common cause: a previous migration partially applied. Do **not** re-run `migrate up` blindly — escalate to the reviewer. The forward-only section above applies.

---

## Related

- [Issue #891 — Local DB volume missing game schema](https://github.com/armored-archer/armored-archer/issues/891)
- [Issue #896 — Makefile `backend-migrate` hardcoded password](https://github.com/armored-archer/armored-archer/issues/896) (dependency — fixed in the same PR)
- [`AGENTS.md` § Database (PostgreSQL)](../../AGENTS.md)
- [`backend/DATABASE_SCHEMA.md`](../../backend/DATABASE_SCHEMA.md)
- `docs/RUNBOOKS.md` § Database Operations (broader runbook index)
