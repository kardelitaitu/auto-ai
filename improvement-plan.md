# ai-twitterActivity.js Reliability Improvement Plan

## Goals
- Eradicate silent hangs and deadlocks during tweet diving & scanning phases.
- Make DOM extraction resilient to Twitter/X UI updates and lazy-loading.
- Ensure 100% clean lock releases for the `operationLock` state machine.
- Provide clear error propagation from Action Modules back up to the Orchestrator.

## Scope
- `tasks/ai-twitterActivity.js` (Session loop & orchestration)
- `utils/ai-twitterAgent.js` (Agent state machine, DOM interaction, logging)
- `utils/async-queue.js` (DiveQueue concurrency)
- `utils/actions/*` (Individual engagement actions)

## Key Risks and Bottlenecks
- **Unbounded Scanning Phase**: Phase 1 of `diveTweet()` (finding tweets, scrolling, extracting text) runs outside the `DiveQueue` timeout. If `page.waitForURL` or locator counts hang, the loop stalls indefinitely.
- **Fragile Boolean Locks**: The `operationLock` is a simple boolean. If an unhandled exception bypasses the `finally` block or occurs in an un-awaited background promise, the agent deadlocks, busy-waiting forever in `startDive()`.
- **Race conditions in DOM Extraction**: Tweet text extraction uses fixed timeouts (`page.waitForTimeout(1000)`) instead of waiting for React state hydration, resulting in empty context queries.
- **Scattered Timeout Logic**: There's a mix of `setTimeout`, `Promise.race`, and Playwright timeouts. They need to be standardized.

---

## Optimization Plan

### 1) Robust State & Lock Management
- **Auto-Expiring Locks**: Replace the `while (this.operationLock)` busy-wait with an event-driven `Mutex` or an auto-expiring lock (e.g., maximum 3-minute lease) to guarantee deadlocks auto-resolve.
- **Wrap Entire Dive in Timeout**: Move the timeout boundary from just the "AI execution" phase to encompass the *entire* `diveTweet` sequence, including DOM scanning and navigation.

### 2) Resilient DOM & Context Extraction
- **Centralized Selectors**: Abstract Twitter DOM selectors into a separate config/constant map, allowing easy updates if Twitter changes class names or test IDs.
- **Smart Hydration Waits**: Replace `page.waitForTimeout` with robust predicates (e.g., waiting for specific inner bounds or text to be non-empty) to ensure tweet text is actually fully loaded before `contextEngine` extracts it.

### 3) Hardened Error & Navigation Recovery
- **Safe Navigation Wrappers**: Ensure that `_safeNavigateHome()` and other Playwright `.goto()` / `.waitForURL()` calls are wrapped in robust Circuit Breakers. If Twitter throttles the page, the agent should instantly recover rather than stalling the session.
- **Action Rollbacks**: If `ActionRunner` executes an action but it partially fails (e.g., clicked reply but couldn't type), ensure the fallback safely closes any stray modals/composers (`PopupCloser` integration enhancement).

### 4) Enhanced Telemetry & Queue Visibility
- **Granular Error Types**: Standardize error strings (e.g., `ERR_DOM_TIMEOUT`, `ERR_AI_RATE_LIMIT`) so the Orchestrator knows whether to skip a tweet, refresh the page, or kill the browser profile entirely.
- **Queue Health Checks**: Auto-flush `DiveQueue` if the worker tab crashes or the Playwright context disconnects unexpectedly.

---

## Task Breakdown

- **Task A: Lock & Timeout Unification**
  - Refactor `AITwitterAgent.operationLock` to a robust Async Mutex.
  - Wrap `diveTweet` Phase 1 (Scanning) in a standard `Promise.race` sequence.
- **Task B: DOM Abstraction & Extraction Resilience**
  - Implement smart `waitForTextLoad` instead of raw delays in `_readExpandedTweet` & `_diveTweetWithAI`.
- **Task C: Navigation Circuit Breakers**
  - Harden `_safeNavigateHome`, `smartClick`, and `page.waitForURL` fallback loops.
- **Task D: Action Feedback Loop**
  - Improve `ActionRunner` state propagation and error code returns to `ai-twitterActivity.js`.

## Verification Plan

### Automated Tests
- Review Vitest integration tests in `tests/integration/` for `ai-twitterAgent.test.js` (if any exist) or create mocks for Playwright `Page` to simulate `waitForURL` timeouts and verify the Mutex unlocks properly.
- Command: `npm run test:unit -- tests/unit/async-queue.test.js` and `npm run test:unit -- tests/unit/ai-twitterAgent.test.js`

### Manual Verification
- Run a multi-profile debug session where we artificially inject network drops directly into Playwright intercepts, confirming the fallback modes trigger successfully without freezing.
- Command: `node main.js ai-twitterActivity profileId=test1 debug=true`
