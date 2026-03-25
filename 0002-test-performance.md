# Plan 0002: Test Performance Optimization

## Objective
Further optimize test execution time beyond current vitest-individual.ps1 implementation.

## Current State
- vitest-individual.ps1 already optimized with:
  - 16 parallel jobs
  - 16 buffer size
  - Batch execution
  - Failure tracking
- Current runtime: ~57 seconds for full suite

## Potential Improvements

### Option A: Increase Parallel Factor
- Current: 16
- Proposed: 24 or 32
- Risk: Higher memory usage, potential system strain

### Option B: Add Caching
- Add vitest cache configuration
- Enable `--cache` flag in test scripts
- Expected improvement: 10-20%

### Option C: Split Test Suites
- Separate slow tests from fast tests
- Run fast tests in parallel with slow
- Add priority queue in PowerShell script

### Option D: Optimize Test Files
- Identify and optimize slow-running tests (>3s)
- Mock expensive operations
- Reduce unnecessary awaits

## Implementation Plan
1. Run coverage report to baseline current performance
2. Test with increased parallel factor (24)
3. Add vitest caching to config
4. Benchmark improvements
5. Document optimal settings

## Files to Modify
- vitest-individual.ps1 (parallel factor)
- config/vitest.config.js (cache settings)
- package.json (add cache flags)

## Success Criteria
- Test suite completes faster than baseline
- No test failures introduced
- Memory usage stays reasonable (<2GB)

## Estimated Effort
- Low (~30 minutes)

## Dependencies
- None
