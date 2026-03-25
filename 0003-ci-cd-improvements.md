# Plan 0003: CI/CD Pipeline Enhancements

## Objective
Improve CI/CD pipeline with caching, test timing alerts, and better error reporting.

## Current State
- .github/workflows/ci.yml exists
- Already has pnpm caching (cache: 'pnpm')
- Runs lint, unit, integration, edge tests
- Basic success/failure notifications

## Improvements to Implement

### 1. Node Modules Caching
Current: pnpm cache in setup-node
Missing: Full node_modules cache for faster installs
```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
```

### 2. Test Timing Alerts
Add timing data to test output:
- Track each test suite duration
- Alert if tests exceed threshold (e.g., 5 minutes)
- Compare with previous run

### 3. Parallel Test Jobs
Instead of sequential, run in parallel:
```yaml
test-unit:
  runs-on: ubuntu-latest
  steps: [run unit tests]

test-integration:
  runs-on: ubuntu-latest
  steps: [run integration tests]
```

### 4. Artifact Retention
Add test results as artifacts for debugging:
- Test output logs
- Coverage reports

### 5. Notification Improvements
- Slack/Discord integration (optional)
- Detailed failure summaries
- Link to failing test

## Implementation Plan
1. Enhance ci.yml with parallel jobs
2. Add timing output to test commands
3. Add artifact upload step
4. Improve notification messages
5. Test locally with act (optional)

## Files to Modify
- .github/workflows/ci.yml

## Success Criteria
- CI completes faster with parallel jobs
- Test timing visible in logs
- Artifacts available for failed runs

## Estimated Effort
- Medium (~1 hour)

## Dependencies
- GitHub Actions knowledge
- Repository settings for artifacts
