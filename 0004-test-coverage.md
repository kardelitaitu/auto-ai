# Plan 0004: Test Coverage Improvement

## Objective
Identify and improve test coverage for low-coverage files in api/ directory.

## Current State
- Test suite: ~7800+ tests
- Coverage thresholds: Lines 75%, Branches 70%, Functions 80%, Statements 70%
- Unknown: Current coverage percentages per file

## Implementation Strategy

### Phase 1: Baseline Analysis
Run coverage report to identify low-coverage files:
```bash
pnpm run test:coverage
```

### Phase 2: Prioritization
Rank files by:
1. Business criticality
2. Current coverage %
3. Complexity

### Phase 3: Targeted Testing
Add tests for low-coverage files:
- Identify uncovered functions
- Write unit tests
- Mock dependencies

## Target Areas (Hypothetical - to verify)
Based on previous sessions, potential low-coverage areas:
- api/twitter/ - Twitter-specific modules
- api/agent/ - AI agent modules
- api/utils/ - Utility functions
- api/core/ - Core orchestrator

## Common Patterns to Test
- Error handling paths
- Edge cases
- Boundary conditions
- Retry logic

## Files to Create/Modify
- New: api/tests/unit/[module].test.js
- Modify: Existing test files

## Success Criteria
- Overall coverage meets thresholds
- Critical modules >80% coverage
- No regression in existing tests

## Estimated Effort
- Medium (ongoing)
- ~2-4 hours per module

## Dependencies
- Test runner (vitest)
- Coverage tool (vitest coverage)
