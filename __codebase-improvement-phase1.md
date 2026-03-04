# Phase 1: Roadmap Checklist
- [ ] Consolidate `CircuitBreaker` (keep `core/`, re-export from `utils/`)
- [ ] Consolidate `GhostCursor` (merge extras into `utils/`, delete `behaviors/`)
- [ ] Consolidate `math`/`mathUtils` (keep `math.js`, re-export from `mathUtils.js`)
- [ ] Merge `orchestrator-v2.js` into `orchestrator.js` (remove `-v2` suffix)
- [ ] Merge `sessionManager-v2.js` into `sessionManager.js` (remove `-v2` suffix)
- [ ] Delete `decision.js.backup`
- [ ] Extract `DEFAULTS` constant in `config.js`
- [ ] Move/delete `_test-command-line`

---

# Phase 1: Cleanup & Consolidation


> **Priority**: High | **Effort**: Low | **Risk**: Low
> **Goal**: Eliminate dead code, duplicate modules, and maintenance hazards without changing any behavior.

---

## 1.1 Consolidate Duplicate Modules

### `CircuitBreaker` (Engine Merge)
**Current Issue**: `core/circuit-breaker.js` is an execution wrapper; `utils/circuit-breaker.js` is a manual state gate.
- **Goal**: Use `core/` as the single engine while preserving the `utils` API for legacy callers.
- **Action**:
    1.  Add `check()`, `recordSuccess()`, and `recordFailure()` methods to `core/circuit-breaker.js` class.
    2.  Update `core/circuit-breaker.js` to store state based on a `model::apiKey` key string (matching `utils` key logic).
    3.  Replace `utils/circuit-breaker.js` with a wrapper that instantiates/references the core breaker:
        ```js
        import CoreBreaker from '../core/circuit-breaker.js';
        const instance = new CoreBreaker();
        export const CircuitBreaker = {
            check: (m, k) => instance.getBreaker(`${m}::${k || 'default'}`),
            // ... map other methods
        };
        ```

### `GhostCursor` (Logic Extraction)
**Current Issue**: `behaviors/` version has Twitter engagement logic; `utils/` version is the physics engine and breaks circular deps.
- **Goal**: Merge all physics and domain logic into `utils/ghostCursor.js`.
- **Action**:
    1.  **Extract Constants**: Create `api/constants/engagement.js` and move `TWITTER_CLICK_PROFILES` there.
    2.  **Merge Logic**: Move `twitterClick()`, `moveWithHesitation()`, and `hoverWithDrift()` into `utils/ghostCursor.js`.
    3.  **Delete**: Remove `behaviors/ghostCursor.js`.
    4.  **Crucial**: Ensure `utils/ghostCursor.js` does **not** import from `api/index.js` (use direct imports for `visible`, `logger`, etc.) to prevent circular dependency loops.

### `math` / `mathUtils` (Direct Re-export)
- **Keep**: `utils/math.js`.
- **Action**: Replace `utils/mathUtils.js` with:
    ```js
    export { mathUtils } from './math.js';
    ```

---

## 1.2 Merge V2 Modules (Remove Suffixes)

Instead of keeping the `-v2` suffix and deleting shims, we will move the modern implementation into the original filenames to keep the API clean.

| File | Action |
|---|---|
| `core/orchestrator-v2.js` | **Merge into** `orchestrator.js`. Update all internal imports of `-v2` to the clean name, then delete `-v2`. |
| `core/sessionManager-v2.js` | **Merge into** `sessionManager.js`. Update all internal imports of `-v2` to the clean name, then delete `-v2`. |

> **Process**:
> 1. Copy content of `-v2.js` to the non-v2 file.
> 2. Search & Replace `orchestrator-v2` → `orchestrator` and `sessionManager-v2` → `sessionManager` across the entire codebase.
> 3. Delete the `-v2.js` files.

---

## 1.3 Remove Backup Artifacts

- **Delete**: `agent/ai-reply-engine-dir/decision.js.backup`
- **Delete**: `agent/ai-reply-engine-dir/` directory if empty after removal
- **Rationale**: Git history preserves all previous versions — backup files in source tree create confusion

---

## 1.4 Fix Config Defaults Duplication

**File**: `core/config.js`

- Extract the duplicated defaults (lines 30–56 and 118–141) into a single `DEFAULTS` constant
- Refactor both `init()` and `_getDefaults()` to reference it:

```js
const DEFAULTS = {
    agent: {
        llm: {
            baseUrl: 'http://localhost:11434',
            model: 'qwen2.5:7b',
            temperature: 0.7,
            maxTokens: 2048,
            contextLength: 4096,
            timeoutMs: 120000,
            useVision: true,
            serverType: 'ollama',
            bypassHealthCheck: false,
        },
        runner: {
            maxSteps: 20,
            stepDelay: 2000,
            adaptiveDelay: true,
        },
    },
    timeouts: {
        navigation: 30000,
        element: 10000,
    },
};
```

---

## 1.5 Clean Up Scratch Files

- **Move**: `api/_test-command-line` → `tests/` or delete if no longer used
- **Rationale**: Test/scratch files should not live alongside production source

---

## Checklist

the checklist is on top of the file
