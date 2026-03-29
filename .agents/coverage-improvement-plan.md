# Coverage Improvement Plan

**Goal:** Increase coverage from ~43% to ~55% by removing unnecessary mocks

## Phase 1: Remove Logger Mocks (Low Effort, +5-10% coverage)

### Problem
~90% of test files mock `core/logger.js` just to suppress output:
```javascript
vi.mock("../../core/logger.js", () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));
```

This prevents the real logger code from executing, showing 0% coverage.

### Solution
Create a logger that's silent by default during tests without mocking.

**Step 1:** Update `api/core/logger.js` to respect an environment variable:
```javascript
const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST;
const silentMode = process.env.VITEST_SILENT === 'true' || process.env.LOG_SILENT === 'true';
```

**Step 2:** Update `api/tests/vitest.setup.js` to set silent mode:
```javascript
process.env.LOG_SILENT = 'true';
```

**Step 3:** Remove `vi.mock` calls for logger from test files

### Files to Update
- `api/core/logger.js` - Add silent mode support
- `api/tests/vitest.setup.js` - Set LOG_SILENT=true
- ~50-60 test files - Remove logger mock

---

## Phase 2: Seeded Random for math.js (Medium Effort, +2-5% coverage)

### Problem
Tests mock `utils/math.js` to make random functions deterministic:
```javascript
vi.mock("../../utils/math.js", () => ({
    roll: vi.fn(() => 0.5),
    randomInRange: vi.fn(() => 50),
}));
```

### Solution
Add seed support to math.js for deterministic random.

**Step 1:** Update `api/utils/math.js`:
```javascript
let _seed = null;

export function setSeed(seed) {
    _seed = seed;
}

export function resetSeed() {
    _seed = null;
}

// Seeded PRNG (mulberry32)
function seededRandom() {
    if (_seed === null) return Math.random();
    let t = _seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

export function roll() {
    return seededRandom();
}

export function randomInRange(min, max) {
    return min + seededRandom() * (max - min);
}
```

**Step 2:** Update vitest.setup.js:
```javascript
import { setSeed, resetSeed } from '../utils/math.js';

beforeEach(() => {
    setSeed(12345); // Fixed seed for determinism
});

afterEach(() => {
    resetSeed();
});
```

### Files to Update
- `api/utils/math.js` - Add seed support
- `api/tests/vitest.setup.js` - Add seed hooks
- ~10-15 test files - Remove math mock

---

## Expected Results

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Tests with coverage | 43% | ~50% | ~55% |
| Avg Stmts | 89% | ~92% | ~94% |
| Avg Lines | 89% | ~92% | ~94% |

---

## Implementation Order

1. ✅ Create this plan
2. ⏳ Update logger.js with silent mode
3. ⏳ Update vitest.setup.js
4. ⏳ Remove logger mocks from first 20 test files
5. ⏳ Test coverage improvement
6. ⏳ Remove logger mocks from remaining files
7. ⏳ Update math.js with seed support
8. ⏳ Remove math mocks from tests
9. ⏳ Final coverage verification
