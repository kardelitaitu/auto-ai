# Plan 0002: Test Performance Optimization

## Objective
Further optimize test execution time beyond current vitest-individual.ps1 implementation.

## Current State Analysis

### vitest-individual.ps1 (PowerShell)
- **Parallel Factor:** 16 (max parallel jobs, buffer size)
- **Target:** api/tests/**/*.test.js
- **Features:** Batch execution, failure tracking, disk I/O buffering

### config/vitest.config.js
- **Cache:** Already enabled (`cache: true` on line 56)
- **Pool:** threads with `maxThreads` = CPU count - 2
- **Min Threads:** 12
- **File Parallelism:** true
- **Timeout:** 10s per test
- **Environment:** node

### package.json Test Scripts
- Standard: `npx vitest run`
- Bun: `bun run vitest run` (20-40% faster)
- Coverage: Uses `--max-old-space-size=32768`
- Watch modes available

## What Already Works
1. ✅ Vitest cache is enabled
2. ✅ Thread pool auto-scales to CPU count
3. ✅ File parallelism enabled
4. ✅ Bun test runner (faster than Node)
5. ✅ PowerShell parallelization (16 jobs)

## Potential Improvements

### Option A: Increase PowerShell Parallel Factor
- **Current:** 16
- **Proposed:** 24 or 32
- **Risk:** Higher memory usage
- **Expected gain:** 20-30% faster on high-core machines

### Option B: Add Test Cache to Scripts
- **Current:** Cache enabled in config but not explicitly used in scripts
- **Add:** `--cache` flag to test commands explicitly
- **Expected gain:** 10-20% on subsequent runs

### Option C: Increase Vitest Min Threads
- **Current:** 12
- **Proposed:** Dynamic based on CPU (e.g., `Math.max(8, cpuCount - 2)`)
- **Expected gain:** Better CPU utilization

### Option D: Reduce Test Timeout for Fast Fail
- **Current:** 10s timeout
- **Proposed:** 5s for unit tests (they should be fast)
- **Expected gain:** Faster failure detection

### Option E: Optimize Slow Tests
- Identify tests >3s
- Mock expensive operations
- Reduce unnecessary awaits

## Implementation Plan

### Step 1: Baseline Benchmark
```bash
# Run current performance
pnpm test:bun:all
# Note the time
```

### Step 2: Increase Parallel Factor (if CPU allows)
- Change `$ParallelFactor = 16` to `24` in vitest-individual.ps1

### Step 3: Optimize Vitest Config
- Increase `minThreads` to dynamic value
- Add `--cache` to npm scripts explicitly

### Step 4: Test & Benchmark
- Run both Node and Bun tests
- Compare with baseline

## Files to Modify
| File | Change | Priority |
|------|--------|----------|
| vitest-individual.ps1 | Increase ParallelFactor to 24 | High |
| config/vitest.config.js | Dynamic minThreads | Medium |
| package.json | Add explicit --cache flags | Low |

## Success Criteria
- ✅ Test suite completes faster than baseline (~57s)
- ✅ No test failures introduced
- ✅ Memory usage stays reasonable (<2GB)
- ✅ Bun tests remain fastest option

## Estimated Effort
- Low (~30 minutes)

## Dependencies
- None (all tools already available)
