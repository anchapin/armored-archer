# Getting Started with Go Backend Migration

**Ready to start?** Follow this guide to begin Phase 1.

---

## Pre-Flight Checklist

Before starting Phase 1, verify:

- [ ] Go 1.21+ installed (`go version`)
- [ ] Nakama backend services running (`docker compose ps`)
- [ ] TypeScript code working (baseline for comparison)
- [ ] This planning directory created (`.planning/`)

---

## Start Phase 1

### Option 1: Execute Full Phase (Recommended)

```bash
# From project root
/gsd:execute-phase 1
```

This will:
1. Read Phase 1 plans
2. Execute Plan 1.1 (Go Project Initialization)
3. Execute Plan 1.2 (Nakama Go Module Configuration)
4. Execute Plan 1.3 (Configuration Migration)
5. Stop at human verification checkpoint

**Duration**: ~3 days
**AI Writes**: ~80%
**Human Reviews**: ~20%

---

### Option 2: Execute Individual Plans

If you prefer more control:

```bash
# Plan 1.1: Go Project Setup
/gsd:quick "Initialize Go module with Nakama SDK"

# Plan 1.2: Nakama Module Entry Point
/gsd:quick "Create Nakama Go module entry point in cmd/server/main.go"

# Plan 1.3: Configuration Migration
/gsd:quick "Migrate config/index.ts to Go with envconfig"
```

---

## What to Expect

### Day 1: Project Setup

**AI will**:
- Initialize Go module
- Create directory structure
- Add Nakama SDK dependency
- Create Makefile targets

**You review**:
- Directory structure makes sense
- Dependencies are correct
- Build commands work

**Checkpoint**: Verify `go build` succeeds

---

### Day 2: Nakama Module

**AI will**:
- Create `InitModule` entry point
- Update docker-compose.yml for Go
- Create build script for Go plugin
- Test Nakama loads module

**You review**:
- InitModule signature correct
- Docker volumes configured
- Nakama logs show Go module loading

**Checkpoint**: Verify Nakama starts without errors

---

### Day 3: Configuration

**AI will**:
- Create Go config structs
- Migrate environment variable loading
- Add config validation
- Update InitModule to load config

**You review**:
- Config struct matches TypeScript
- Validation logic preserved
- Environment variables work

**Checkpoint**: Verify config loads correctly

---

## After Phase 1

### Success Criteria

- [ ] Go module compiles
- [ ] Nakama loads Go module
- [ ] Config loading works
- [ ] No startup errors

### If Successful

Proceed to Phase 2:

```bash
/gsd:execute-phase 2
```

### If Issues

Debug with:

```bash
/gsd:debug "Nakama fails to load Go module"
```

Or fall back to TypeScript+polyfills if Go proves unworkable.

---

## Tips for Success

### For AI Coding

1. **Be specific**: "Create Go struct for Config matching TypeScript interface"
2. **Provide context**: "Here's the TypeScript code to migrate: [paste]"
3. **Review incrementally**: Check each file before moving on
4. **Test early**: Run `go build` after each significant change

### For Human Review

1. **Focus on logic**: AI handles syntax, you verify business logic
2. **Compare side-by-side**: Keep TypeScript open for reference
3. **Test in Nakama**: Don't trust builds, test runtime behavior
4. **Document differences**: Note any Go SDK API differences

### For Checkpoints

1. **Actually test**: Don't just approve, run the verification steps
2. **Log issues**: If something fails, debug before proceeding
3. **Update STATE.md**: Record lessons learned after each phase

---

## Common Issues & Solutions

### Issue: Go module won't compile

**Solution**:
```bash
go mod tidy
go build -v ./...
# Check for missing imports or type errors
```

### Issue: Nakama won't load Go module

**Solution**:
```bash
# Verify build mode is plugin
CGO_ENABLED=0 GOOS=linux go build -buildmode=plugin -o build/server.so ./cmd/server

# Check Nakama logs
docker compose logs nakama | grep -i "go\|error"
```

### Issue: Config not loading

**Solution**:
```bash
# Verify environment variables
docker compose exec nakama env | grep -i "nakama\|database\|session"

# Check config struct tags match env var names
```

### Issue: TypeScript comparison fails

**Solution**:
```bash
# Run TypeScript version
docker compose logs nakama | grep "TypeScript output"

# Run Go version
docker compose logs nakama | grep "Go output"

# Compare and fix discrepancies
```

---

## Next Steps

After Phase 1 completes:

1. Review Phase 1 summary in `.planning/phases/01-foundation/01-01-SUMMARY.md`
2. Update `STATE.md` with lessons learned
3. Proceed to Phase 2: Database Layer

---

## Questions?

- **Project Vision**: See `.planning/PROJECT.md`
- **Full Roadmap**: See `.planning/ROADMAP.md`
- **Current State**: See `.planning/STATE.md`
- **All Milestones**: See `.planning/MILESTONES.md`

**Ready?** Run `/gsd:execute-phase 1` to begin!
