# Armored Archer - Nakama Go Backend Migration

## Vision

Migrate the Nakama backend from TypeScript to Go to eliminate ES5 compatibility issues, improve long-term maintainability, and align with Nakama's primary supported language.

## Why Go?

- **Nakama First-Class Support**: Go is Nakama's native language with full API support
- **No Runtime Battles**: Eliminate polyfill debt, ES5 compatibility issues, and runtime errors
- **Better Performance**: Compiled Go vs interpreted JavaScript
- **Compile-Time Safety**: Catch errors before deployment
- **AI Can Write It**: Language expertise is irrelevant with AI coding agents
- **Right Timing**: Pre-alpha, no users to disrupt, manageable codebase size

## Current State

| Metric | Value |
|--------|-------|
| TypeScript Files | 102 files |
| Lines of Code | ~25,600 lines |
| Modules | 20+ game logic modules |
| Integration Tests | 10 test suites |
| Async/Await Usage | 311 occurrences |
| ES5 Method Usage | ~40 uses of .map(), .join(), etc. |

## Target State

| Metric | Target |
|--------|--------|
| Go Files | ~100 files |
| Lines of Code | ~30,000 lines (Go is more verbose) |
| Modules | Same 20+ modules, Go-idiomatic |
| Integration Tests | 10 test suites, Go testing |
| Concurrency | Goroutines + channels where appropriate |
| Runtime Issues | Zero ES5 polyfill battles |

## Scope

### In Scope (v1.0)

- [ ] All existing TypeScript RPC handlers converted to Go
- [ ] All game logic modules converted to Go
- [ ] All database helpers and storage operations
- [ ] All configuration and environment handling
- [ ] All logging and observability code
- [ ] All integration tests converted to Go testing
- [ ] Docker configuration updated for Go build
- [ ] CI/CD pipelines updated for Go
- [ ] Documentation updated

### Out of Scope (v1.0)

- [ ] New features or functionality
- [ ] API changes or breaking changes
- [ ] Database schema changes
- [ ] Godot client changes
- [ ] Performance optimization (post-migration)
- [ ] Architectural refactoring (preserve existing patterns)

### Future Considerations (v2.0+)

- [ ] Go-specific optimizations (goroutines, channels)
- [ ] Performance improvements
- [ ] Code structure refactoring to be more Go-idiomatic
- [ ] Additional Nakama Go features not available in JS
- [ ] Microservices extraction if needed

## Success Criteria

1. **Functional Parity**: All 10 integration test suites pass
2. **Zero Regressions**: All existing RPC endpoints work identically
3. **Build Success**: Go build completes without errors
4. **Runtime Success**: Nakama loads Go modules without errors
5. **Performance**: Equal or better response times
6. **Documentation**: All docs updated with Go examples

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Go runtime API differences | Medium | High | Test each module in Nakama after conversion |
| Lost business logic in translation | Low | High | Side-by-side testing with TypeScript |
| Dependency mismatches | Medium | Medium | Audit npm → Go module equivalents early |
| Team learning curve | Low | Medium | AI writes code, human reviews |
| Timeline creep | Medium | Medium | Strict scope, phase gates |

## Timeline Estimate

| Phase | Duration | AI Writes | Human Reviews |
|-------|----------|-----------|---------------|
| Setup & Foundation | 2-3 days | 80% | 20% |
| Core Modules | 7-10 days | 70% | 30% |
| Game Logic | 7-10 days | 70% | 30% |
| Testing & Validation | 5-7 days | 50% | 50% |
| **Total** | **3-4 weeks** | **70%** | **30%** |

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-15 | Migrate to Go | AI agents write code, pre-alpha timing, Nakama first-class support |
| 2026-03-15 | Preserve existing patterns | Minimize risk, validate migration works before refactoring |
