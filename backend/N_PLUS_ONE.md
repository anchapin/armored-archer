# N+1 Query Detection

This workflow runs N+1 query detection on the backend codebase to identify potential database performance issues.

## Why N+1 Detection Matters

N+1 queries occur when code makes multiple database queries in loops instead of batch operations. This causes severe performance degradation, especially with many players.

## Detection Method

The backend includes a custom N+1 detection script that:
1. Analyzes TypeScript source files for database calls inside loops
2. Detects patterns like `forEach`, `map`, `filter` containing database queries
3. Flags sequential queries that could be batched

## Running Locally

```bash
cd backend
npm run detect-n-plus-one
npm run detect-n-plus-one:ci  # CI mode - fails if issues found
```

## What Gets Detected

- Database queries inside loops (`for`, `while`, `forEach`, `map`)
- Sequential queries that could be batched
- Missing batch operations

## False Positives

Some patterns may be intentional (small datasets, cached results). Review flagged code to determine if optimization is needed.
