# Plan 0003: CI/CD Pipeline Enhancements

## Objective
Improve CI/CD pipeline with caching, test timing alerts, and better error reporting.

## Current State
- .github/workflows/ci.yml exists
- ✅ Runs on ubuntu-latest with Node.js 24
- ✅ pnpm/action-setup@v4 installed
- ✅ oven-sh/setup-bun@v2 installed
- ✅ Runs lint, unit, integration, edge tests
- ✅ Basic success/failure notifications
- ✅ Build check job

## Already Implemented (This Session)
- ✅ Updated Node.js from 20 to 24
- ✅ Updated actions to v5 (checkout@v5, setup-node@v5)
- ✅ Added bun installation via oven-sh/setup-bun@v2
- ✅ Fixed pnpm version mismatch
- ✅ Added edge-cases test path fix
- ✅ All test files now tracked in git

## Improvements to Implement

### Priority 1: Parallel Test Jobs
Split sequential tests into parallel jobs:
```yaml
test-lint:
  runs-on: ubuntu-latest
  steps: [run lint]

test-unit:
  runs-on: ubuntu-latest
  steps: [run unit tests]

test-integration:
  runs-on: ubuntu-latest
  steps: [run integration tests]

test-edge:
  runs-on: ubuntu-latest
  steps: [run edge case tests]
```
**Expected gain:** 50-70% faster (tests run concurrently)

### Priority 2: Artifact Retention
Add test results as artifacts for debugging:
```yaml
- name: Upload test results
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: |
      api/coverage/
      test-logs/
```
**Expected:** Debug failed runs easier

### Priority 3: Test Timing
- Use vitest JSON reporter to capture timing
- Add timing output to summary
- Alert if tests exceed threshold (e5 minutes)

### Priority 4: Caching Enhancements
- Already has pnpm store caching
- Consider adding bun cache

## Implementation Plan

### Step 1: Refactor to Parallel Jobs
- [x] Split lint-and-test into separate jobs
- [x] Run lint, unit, integration, edge in parallel
- [x] Build job runs after all tests pass

### Step 2: Add Artifacts
- [ ] Upload coverage on failure
- [ ] Upload test logs on failure

### Step 3: Timing & Summary
- [ ] Add timing to test commands
- [ ] Create workflow summary

## Files to Modify
- .github/workflows/ci.yml

## Success Criteria
- [ ] CI completes faster with parallel jobs
- [ ] Test timing visible in logs
- [ ] Artifacts available for failed runs

## Estimated Effort
- Medium (~1 hour)
