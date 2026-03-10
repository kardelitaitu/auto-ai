- Fixed AsyncQueue microtask race condition causing taskPromise to hang (pi/utils/async-queue.js)\n- Optimized Orchestrator by removing sleep cycles and delays (pi/core/orchestrator.js)\n- Removed expensive Regex calls from Logger (pi/core/logger.js)\n- Updated unit tests (pi/tests/unit/async-queue.test.js)\n\n# AGENT-JOURNAL.md
## 2025-03-09: Stuck Browser Analysis
- **Zombie Tasks Identified**: Discovered that `Promise.race()` timeouts in `orchestrator.js` and `cookiebot.js` do not cancel underlying async operations, leading to "zombie" tasks that keep workers busy.
- **Cleanup Deadlock**: Found that `await page.close()` in `finally` blocks can hang infinitely if the browser or protocol is deadlocked, blocking the worker from ever being released.
- **Timeout Layering**: Identified a mismatch between `cookiebot` (4m) and `orchestrator` (10m) timeouts that masks the initial hang.
- **Stuck Worker Detection**: Verified that `SessionManager`'s stuck detection is purely memory-based and does not terminate hanging promises or CDP connections.

## 2026-03-09: Persistent Dashboard Metrics Implementation
- **Singleton Architecture**: Orchestrator now checks for an existing dashboard server on port 3001 and connects via Socket.io instead of forcing a new fork.
- **Detached Lifecycle**: Forked dashboard processes are now detached (`unref`), allowing them to survive Orchestrator shutdowns.
- **Cumulative Uptime**: Dashboard server now tracks `engineUptimeMs` cumulatively, resetting ONLY when the dashboard process itself starts.
- **State Persistence**: On Orchestrator disconnect, the dashboard clears session/queue lists but retains the cumulative counters.

## 2026-03-09: Dashboard UPTIME & QUEUE Fixes
- **Uptime Corrected**: Fixed `App.jsx` to divide `system.uptime` by 1000, ensuring it displays in seconds rather than milliseconds.
- **Queue Percent Restored**: Added `maxQueueSize` to `Orchestrator.js` queue metrics, allowing the dashboard to calculate and display the queue percentage correctly.

## 2026-03-09: IPC Method Fix
- **Undefined Methods Resolved**: Added `getRecentTasks` and `getTaskBreakdown` to the `Orchestrator` class to fix the `this.getRecentTasks is not a function` error during IPC metrics pushing.

## 2026-03-09: Automated UI Dashboard Startup
- **Shorted Script**: Created `.start-darshboard.bat` in the root directory to automate the build-then-launch procedure (Phase 5 follow-up).

## 2026-03-09: Phase 5 UI Dashboard IPC Decoupling
- **Process Isolation**: Extracted `dashboard.js` (Express + Socket.io) into an independent child process (`child_process.fork()`). This eliminates the Event Loop Tax in the main Orchestrator process caused by WebSocket broadcast serialization.
- **IPC Data Pipeline**: Implemented a lightweight IPC channel `this.dashboardProcess.send()` inside the Orchestrator, pushing a serialized `{ type: 'metrics_tick', payload }` every 2 seconds.
- **Frontend Payload Hardening**: Hardcoded accurate structured defaults (e.g., `system.cpu.usage`) inside the `DashboardServer` constructor to prevent the React UI `App.jsx` from crashing when mapping fields before the first async metrics tick arrives.
- **Test Integrity**: Verified via Vitest unit tests verifying correct fork mapping and default property initialization schemas. Zero regressions.

## 2026-03-09: Phase 4 API Extreme Throughput Optimizations
- **Asynchronous Log Streams**: Replaced the synchronous `LOG_BUFFER` array map with native non-blocking `WriteStream` bindings in `logger.js`. This entirely prevents the 1-second Garbage Collection micro-stutters during heavy logging.
- **Log File Rotation**: Added automated file rotation to cap `logs.txt` and `logs.json` at 10MB each, automatically renaming and purging old files (max 5) to prevent infinite disk bloat.
- **Task Staggering Removed**: Formally verified the removal of `taskStaggerDelayMs` in `orchestrator.js`, allowing burst tasks to immediately dispatch without artificial 2-second sleep waitlists.
- **Removed CDP Ping Overhead**: Formally verified the removal of the redundant `page.evaluate` readiness ping before every task execution, leaning completely into native Playwright timeout error boundaries for instantaneous runner kickoff.
- **Test Integrity**: Validated via full Vitest suite (4800+ specs). No stream race conditions detected.

## 2026-03-08: API Responsiveness & Stability Optimizations
- **Eliminated Page Pool Leaks**: Removed `pagePool` from `SessionManager` entirely. Playwright pages are created explicitly and reliably closed via `page.close()` upon release, halting memory leaks and listener stacking on aggressively recycled pages.
- **Task Module Caching**: Implemented a `taskModuleCache` map inside `Orchestrator._importTaskModule()` to bypass heavy disk I/O resolutions for repetitive 10-minute runners.
- **Nuked Proactive Polling**: Removed `setInterval` background loops in `Automator.startHealthChecks()`. Switched to an event-driven model via native disconnected browser events.
- **Test Integrity**: Validated all changes and updated test files (`sessionManager.test.js`, `orchestrator.test.js`, `automator.test.js`). Verified over 4850 assertions via Vitest.

## 2026-03-08: Analyze and Fix ixBrowser Close Script
- **Analyzed `browser-close.bat`**: Investigated why the script occasionally hangs. 
- **Fix Applied**: 
  - Added `-TimeoutSec 5` to API calls so the script doesn't hang indefinitely on a dead port.
  - Refactored the core logic so the script infinitely loops over **both** attempting to close the profile via the API and forcefully killing `chrome.exe`. It will only exit when `tasklist` confirms 100% that no `chrome.exe` processes remain.

## 2026-03-07: AI Prompt Refactor & Constraint Relaxation

- **Prompt Centralization**: Moved `QUOTE_SYSTEM_PROMPT` into `api/twitter/twitter-reply-prompt.js` from `ai-quote-engine.js` for centralized prompt management.
- **Improved Context Parsing**: Increased the extraction length for contextual replies from 80 characters to 150 characters inside `buildEnhancedPrompt` and `buildReplyPrompt`, giving the LLM more background context.
- **Natural Constraints**: Softened character/word limits across all reply strategies (e.g., "Keep it to 1 very short sentence" instead of "MAX 6 WORDS") and added explicit instructions against "AI-cliche" language to ensure generation is more human-like.
- **Test Integrity**: Updated `ai-quote-engine.test.js` and `twitter-reply-prompt.test.js` to validate the new constraint text lengths. Also fixed a broken test in `twitter-intent.test.js` caught during regression testing caused by prior parameter changes to Twitter intents.

## 2026-03-07: Fix Twitter Quote Intent

- **Bug**: The quote intent was not correctly populating the tweet URL in the composer because it used a non-standard `quoted_tweet_id` parameter.
- **Fix**: Updated `api/twitter/intent-quote.js` to use standard `url` and `text` parameters for Web Intents.
- **Verification**: Verified with `tasks/twitter-intents-test.js`. The intent URL is now correctly constructed, and the composer button is successfully detected and clicked.

## 2026-03-07: Rollback of Log Context Changes

- **Rollback completed**: Reverted centralized log context propagation in `orchestrator.js` due to connectivity issues.
- **Task wrappers restored**: Manually restored `api.withPage` in `pageview.js`, `cookiebot.js`, and `api-twitteractivity.js`.
- **Repair**: Fixed syntax errors in `cookiebot.js` that were breaking execution. Verified all files with `node -c`.

## 2026-03-07: Standardizing Log Context Propagation
- **Status**: Completed
- **Changes**:
  - Modified `api/core/orchestrator.js` to automatically pass `sessionId` and `taskName` to `api.withPage`.
  - Updated `tasks/pageview.js`, `tasks/cookiebot.js`, and `tasks/api-twitterActivity.js` (and `twitter-intents-test.js`) to rely on centralized log context.
  - Verified that logs now correctly display `[profileId][taskName]` instead of fallback session IDs.

## Gemini CLI Agent Session: 2026-03-07 (Twitter Intent Helpers)

### Objective:
Create a helper function for Twitter intent URLs to be used as a utility throughout the API.

### Accomplishments:
- Created four intent helpers in `api/twitter/`:
  - `intent-like.js`
  - `intent-quote.js`
  - `intent-retweet.js`
  - `intent-follow.js`
- Integrated helpers into the unified `api` object in `api/index.js`.
- Implemented robust error handling with `try-catch` blocks in all helpers.
- Added a 20s execution timeout for each helper to prevent hanging.
- Ensured all helpers return to the original page after completing their action.
- Created `tasks/twitter-intents-test.js` to verify all helpers in a real browser environment.
## 2026-03-07: Implement Twitter Intent Post & Standardize Return Logic

- **Feature**: Added `api.twitter.intent.post(text)` to allow composing new tweets via Web Intent.
- **Fix**: Standardized the `finally` block logic across all 5 Twitter intent helpers (`follow`, `like`, `post`, `quote`, `retweet`).
  - Moved `navigated = true` to before `goto()` to ensure `back()` is called even if navigation fails after start.
  - Ensured consistent `logger.info('Returning to previous page')` and `await back().catch(() => { })`.
- **Verification**: All 5 intents successfully verified with `tasks/twitter-intents-test.js`.
