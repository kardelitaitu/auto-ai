# Phase 2: Roadmap Checklist
- [ ] Add validation guards to `wait()`, `scroll()`, `delay()`, `think()`
- [ ] Fix `rateLimitMiddleware` with optional shared state
- [ ] Add `api.version` from `package.json`
- [ ] Implement retry budget in context state
- [ ] Create `api/index.d.ts` type definitions
- [ ] Replace generic `Error` with typed errors in `waitFor()`

---

# Phase 2: Hardening & Quality


> **Priority**: Medium | **Effort**: Medium | **Risk**: Low-Medium
> **Goal**: Add defensive guards, improve reliability, and introduce type safety without breaking existing consumers.

---

## 2.1 Input Validation Guards

Add runtime validation to all functions that accept numeric timing/distance parameters.

### `interactions/wait.js`
```js
export async function wait(ms) {
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) {
        throw new ValidationError(`wait() requires a positive number, got: ${ms}`);
    }
    // ... existing logic
}
```

### `interactions/scroll.js`
- `scroll(distance)` — validate `distance` is a finite number
- `read(target, options)` — validate `options.pauses` ≥ 0

### `behaviors/timing.js`
- `delay(ms)` — validate `ms` is a positive number
- `think(options)` — validate `min`/`max` are positive and `min ≤ max`

---

## 2.2 Fix Rate Limiter Scope

**Problem**: `rateLimitMiddleware()` creates per-call counters, so multiple pipelines each get their own limit.

**Solution**: Add an optional shared state parameter:

```js
// Shared state (singleton)
const globalRateLimitState = { actionCount: 0, windowStart: Date.now() };

export function rateLimitMiddleware(options = {}) {
    const { maxPerSecond = 10, state = null } = options;
    const _state = state || { actionCount: 0, windowStart: Date.now() };
    // ... use _state instead of closure variables
}
```

This lets consumers opt-in to global rate limiting:
```js
const shared = { actionCount: 0, windowStart: Date.now() };
pipeline1 = createPipeline(rateLimitMiddleware({ state: shared }));
pipeline2 = createPipeline(rateLimitMiddleware({ state: shared }));
```

---

## 2.3 Add `api.version`

**File**: `api/index.js`

```js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

export const api = {
    version: pkg.version,
    // ... rest of exports
};
```

---

## 2.4 Add Retry Budget

**Problem**: `retryMiddleware` retries up to `maxRetries` per action, but if multiple actions fail in sequence, the total retry count can snowball.

**Solution**: Track retries per session via context state:

```js
// In context-state.js — add to default state
retryBudget: { used: 0, max: 50 }

// In retryMiddleware
if (getStateSection('retryBudget').used >= getStateSection('retryBudget').max) {
    throw new ActionError('Session retry budget exhausted', 'RETRY_BUDGET_EXCEEDED');
}
```

---

## 2.5 TypeScript Type Definitions

Create `api/index.d.ts` with type declarations for the public API surface. This gives consumers IDE autocomplete without requiring a full TypeScript migration.

**Key types to declare**:
- `ApiOptions`, `ClickOptions`, `TypeOptions`, `ScrollOptions` (already documented in JSDoc)
- `api` object shape with method signatures
- `GhostCursor` class
- All error classes
- `ConfigurationManager` class
- `PersonaConfig` type from persona definitions

---

## 2.6 Strengthen `waitFor()` Error Messages

**File**: `interactions/wait.js`

Currently throws generic `Error`. Should throw typed errors:

```js
// Before
throw new Error(`Timeout waiting for predicate after ${timeout}ms`);

// After
throw new ElementTimeoutError('predicate', timeout);
```

---

## Checklist

the checklist is on top of the file
