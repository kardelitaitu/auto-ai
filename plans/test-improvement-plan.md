# Test Suite Improvement Plan

## 📊 Current State Analysis

### Test Statistics
| Metric | Current State | Target |
|--------|---------------|--------|
| **Total Test Files** | ~120+ files | Organized & consolidated |
| **Unit Tests** | ~100 files | Quality over quantity |
| **Integration Tests** | ~20 files | Expand coverage |
| **Manual Tests** | ~15 files | Automate or remove |
| **Coverage Threshold** | 70-80% | 85%+ |

### Current Issues Identified

#### 1. **Placeholder Tests**
- [`api/tests/unit/simple.test.js`](api/tests/unit/simple.test.js:1) - Just tests `1+1=2`
- Several tests only verify method existence, not behavior

#### 2. **Excessive Mocking**
- Every test file重复定义 mocks instead of using shared fixtures
- Heavy mocking hides real integration bugs
- Mock paths inconsistent (`@api/` vs relative `../../`)

#### 3. **Shallow Test Coverage**
```javascript
// Example from confidenceScorer.test.js - only checks existence
it('should have score method', () => {
    expect(typeof confidenceScorer.score).toBe('function');
});
```
- No actual behavior testing
- No edge cases covered
- No error scenarios tested

#### 4. **Manual Tests Not Automated**
- `test-dive-lock.manual.js`
- `test-models.manual.js`
- `test-multiline-tweet.manual.js`
- `test-cloud-api.manual.js`
- etc.

#### 5. **Inconsistent Test Patterns**
- Some use `@api/` aliases, others use relative paths
- Mixed mock strategies across files
- No standardized test structure

#### 6. **Missing Critical Tests**
- No E2E tests for full workflow
- Limited error recovery tests
- No performance/load tests
- Missing concurrency tests

---

## 🎯 Improvement Plan

### Phase 1: Foundation (Priority: HIGH)

#### 1.1 Create Shared Test Utilities
**File: `api/tests/utils/test-helpers.js`**
```javascript
// Centralized mock factories
export const createMockPage = (overrides = {}) => ({...});
export const createMockLogger = () => ({...});
export const createMockOrchestrator = () => ({...});

// Common assertions
export const expectSuccess = (result) => {...};
export const expectError = (result, code) => {...};

// Test data generators
export const generateTask = (overrides) => {...};
export const generateSession = (overrides) => {...};
```

#### 1.2 Standardize Mock Modules
**File: `api/tests/mocks/index.js`**
```javascript
export { mockLogger, mockConfig, mockSession } from '../fixtures/mocks.js';
export { mockPage } from './page.js';
export { mockAgent } from './agent.js';
export { mockLLMResponse } from './llm.js';
```

#### 1.3 Update Vitest Setup
**Enhance `api/tests/vitest.setup.js`**
- Add global test utilities
- Configure custom matchers
- Setup coverage exclusions properly

---

### Phase 2: Test Quality (Priority: HIGH)

#### 2.1 Remove Placeholder Tests
- Delete [`simple.test.js`](api/tests/unit/simple.test.js:1)
- Replace with meaningful smoke tests

#### 2.2 Enhance Critical Module Tests

**Priority Modules for Deep Testing:**

| Module | Current Coverage | Target | Key Tests Needed |
|--------|------------------|--------|------------------|
| `orchestrator.js` | Basic | Comprehensive | Task queue, timeouts, retry logic, concurrency |
| `actionEngine.js` | Basic | Deep | All action types, error recovery, humanization |
| `llmClient.js` | Minimal | Full | Routing logic, fallbacks, rate limiting |
| `sessionManager.js` | Basic | Deep | Session lifecycle, worker management |
| `humanizer-engine.js` | Minimal | Full | Path generation, timing, jitter |

#### 2.3 Add Behavior Tests
```javascript
// Example: actionEngine behavior test
describe('actionEngine - click behavior', () => {
    it('should retry on transient failure', async () => {
        // Setup: page.click fails once, then succeeds
        // Assert: click called twice, result is success
    });
    
    it('should apply humanization delay', async () => {
        // Setup: mock timing functions
        // Assert: delays applied between actions
    });
    
    it('should handle element not found', async () => {
        // Setup: locator returns empty
        // Assert: proper error with recovery suggestion
    });
});
```

---

### Phase 3: Coverage Expansion (Priority: MEDIUM)

#### 3.1 Automate Manual Tests
Convert `.manual.js` files to proper automated tests:

| Manual Test | Automation Strategy |
|-------------|---------------------|
| `test-dive-lock.manual.js` | Mock browser state transitions |
| `test-models.manual.js` | Parameterized tests for each model |
| `test-multiline-tweet.manual.js` | String parsing unit tests |
| `test-cloud-api.manual.js` | Mock HTTP responses |

#### 3.2 Add Integration Test Scenarios

**New Integration Tests:**
```javascript
// api/tests/integration/task-execution-flow.test.js
describe('Full Task Execution Flow', () => {
    it('should execute task across browser session lifecycle');
    it('should handle browser disconnection gracefully');
    it('should route tasks to appropriate LLM');
    it('should recover from LLM failures');
});

// api/tests/integration/concurrent-sessions.test.js
describe('Concurrent Session Management', () => {
    it('should handle 10+ concurrent browser sessions');
    it('should isolate session state properly');
    it('should balance load across sessions');
});
```

#### 3.3 Add Edge Case Tests

**New Edge Case Tests:**
```javascript
// api/tests/edge-cases/error-recovery.test.js
describe('Error Recovery Scenarios', () => {
    it('should recover from network timeout');
    it('should handle CAPTCHA detection');
    it('should retry on rate limit');
    it('should handle page crash');
});

// api/tests/edge-cases/resource-exhaustion.test.js
describe('Resource Exhaustion', () => {
    it('should handle memory pressure');
    it('should queue tasks when at capacity');
    it('should cleanup stale sessions');
});
```

---

### Phase 4: Test Infrastructure (Priority: MEDIUM)

#### 4.1 Add Test Reporters
**Update `config/vitest.config.js`:**
```javascript
reporters: [
    'default',
    ['html', { outputFile: 'coverage/report.html' }],
    ['json', { outputFile: 'coverage/report.json' }],
    ['junit', { outputFile: 'coverage/junit.xml' }]
]
```

#### 4.2 Add Performance Tests
```javascript
// api/tests/performance/action-benchmark.test.js
describe('Action Performance', () => {
    it('should execute click within 500ms', async () => {
        const start = performance.now();
        await api.click('.button');
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(500);
    });
});
```

#### 4.3 Add Snapshot Tests
For critical UI state comparisons:
```javascript
it('should match visual diff snapshot', async () => {
    const before = await page.screenshot();
    await api.click('.toggle');
    const after = await page.screenshot();
    expect(visualDiff(before, after)).toMatchSnapshot();
});
```

---

### Phase 5: Documentation & Maintenance (Priority: LOW)

#### 5.1 Update Test Documentation
**Enhance `api/tests/README.md`:**
- Testing conventions guide
- Mock usage guidelines
- How to write new tests
- Debugging test failures

#### 5.2 Add Test Templates
**Create `api/tests/templates/`:**
```
templates/
├── unit-test.template.js      # Standard unit test structure
├── integration-test.template.js
├── mock-module.template.js    # Mock module template
└── fixture.template.js        # Test fixture template
```

#### 5.3 CI/CD Integration
```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: pnpm run test:coverage
  
- name: Upload Coverage
  uses: codecov/codecov-action
  
- name: Fail on Coverage Drop
  run: |
    if [ "$COVERAGE" -lt 85 ]; then
      echo "Coverage below threshold"
      exit 1
    fi
```

---

## 📋 Implementation Checklist

### Immediate Actions (Week 1)
- [ ] Create shared test utilities (`test-helpers.js`)
- [ ] Consolidate mock definitions
- [ ] Remove `simple.test.js` placeholder
- [ ] Add 10+ behavior tests for `actionEngine.js`

### Short-term (Week 2-3)
- [ ] Automate 5+ manual test files
- [ ] Add integration tests for task execution flow
- [ ] Enhance orchestrator test coverage
- [ ] Add error recovery test scenarios

### Medium-term (Week 4-6)
- [ ] Achieve 85% coverage threshold
- [ ] Add performance benchmarks
- [ ] Create test templates
- [ ] Update documentation

### Long-term (Ongoing)
- [ ] Add E2E test suite
- [ ] Implement visual regression tests
- [ ] Add load testing for concurrent sessions
- [ ] Set up coverage monitoring in CI

---

## 📈 Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| **Code Coverage** | ~65% | 85%+ |
| **Test Reliability** | Flaky (heavy mocks) | Stable (real behavior) |
| **Mock Duplication** | High | Consolidated |
| **Manual Tests** | 15+ files | 0 (all automated) |
| **Test Execution Time** | Variable | Optimized |
| **Bug Detection** | Post-release | Pre-release |

---

## 🔧 Quick Wins

1. **Delete `simple.test.js`** - Removes noise
2. **Create `test-helpers.js`** - Reduces duplication by 50%+
3. **Add `beforeEach` cleanup** - Prevents test pollution
4. **Use `@tests` alias consistently** - Improves maintainability

---

## 📚 References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://vitest.dev/guide/best-practices.html)
- [Current Test README](api/tests/README.md)
- [Vitest Config](config/vitest.config.js)
