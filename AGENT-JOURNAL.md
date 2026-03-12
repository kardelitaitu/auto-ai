- Added "Clear History" button to Electron dashboard with confirmation modal
- Added clearHistory() method to history-manager.js
- Added socket event handler in dashboard.js
- Added Clear History button and modal in App.jsx


# AGENT-JOURNAL.md

## 2026-03-11: Bar-Style Chart Update
- **Status**: Completed
- **Changes**:
  - Refactored `Sparkline` component in `MetricCard.jsx` to render as a bar chart.
  - Implemented dynamic bar width and gap calculation based on data length (fixed to 25 points).
  - Added minimum slot logic (25 bars) to prevent charts from looking "too wide" when starting with few data points.
  - Added right-alignment for data in sparse charts to maintain consistent visual density.
  - Added subtle rounding and "no background/axis" styling to match the premium glassmorphism aesthetic.
  - Removed unused `id` prop from `Sparkline` and its usage in `MetricCard`.
- **Status**: Completed

## 2026-03-11: Electron Dashboard Standalone Fixes
- **Status**: Completed
- **Changes**:
  - Fixed history path to be self-contained in `electron-dashboard/data/` instead of `api/data/`
  - Added `config.json` for dashboard configuration (server port, UI defaults, remote connection)
  - Updated `main.js` to read config and pass server URL to renderer via query params
  - Updated `preload.cjs` to expose `getConfig` IPC handler
  - Updated `App.jsx` to read server URL from query params or Electron API
  - Added remote server connection support (connect to dashboard on different machine)
  - Improved error messages in Electron when server fails to start
  - Updated `.gitignore` to include `data/` directory
  - Updated README.md with new config options and standalone usage
- **Status**: Completed

## 2026-03-11: Extended Mode Layout Fix
- **Status**: Completed
- **Changes**:
  - Fixed h-flex gaps in extended mode dashboard by updating CSS and App.jsx
  - Changed `.sessions-grid` from grid to flex-column layout (style.css)
  - Updated top metrics section to use flex instead of fixed height (App.jsx)
  - Added `flex: 1` to bottom section to fill remaining vertical space
  - Added `overflow: hidden` to prevent scroll issues
  - Updated MetricCard to use `flex: 1` instead of `height: 100%`
  - Added `flexShrink: 0` to top section and Mission Control to prevent shrinking
- **Status**: Completed

## 2026-03-11: Compact Mode Fix
- **Status**: Completed
- **Changes**:
  - Removed duplicate CPU/Memory cards in compact mode (they were already shown in columns 1-2)
  - Changed grid to 2 columns in compact mode (was always 4-column grid)
- **Status**: Completed
- **Changes**:
  - `api/core/automator.js`: Renamed unused parameter `interval` to `_interval`.
  - `api/core/orchestrator.js`: Renamed unused catch variable `e` to `_e` and added a comment to the empty catch block to satisfy `no-empty` rule.
  - `api/twitter/intent-quote.js`: Renamed unused variable `tweetId` to `_tweetId`.
- **Verification**: Verified syntax with `node -c` and confirmed zero linting errors/warnings via `npm run lint`.

## 2026-03-10: Dashboard Overhaul
- **Modular React Architecture**: Refactored monolithic `App.jsx` into atomic components in `src/components`.
- **Premium Design System**: Implemented `tokens.css` with HSL-based colors and glassmorphism styling in `style.css`.
- **Advanced Controls**: Added IPC bridge for "Always on Top" and "Compact Mode" window management.
- **UX Excellence**: Integrated Heartbeat visualization, list animations, and robust Error Boundaries.
- **Improved Performance**: Optimized rendering logic and reduced style redundancy.
- **Advanced Visualizations**: Integrated subtle 60-point sparklines into metric cards for real-time history tracking.

## 2026-03-10: Module Resolution Fix
- **Localized Dependency**: Copied `api/core/logger.js` to `api/ui/electron-dashboard/lib/logger.js` to ensure it is included in the Electron build.
- **Import Update**: Updated `dashboard.js` to use the local import, resolving the `ERR_MODULE_NOT_FOUND` error in the packaged app.

## 2026-03-10: Independent Portable Dashboard
- **Standalone Mode**: Converted Electron dashboard to ESM and added `startStandaloneServer` to `dashboard.js` to allow the `.exe` to own the port/server.
- **Build Pipeline**: Configured `electron-builder` for portable Windows builds. Generated `Auto-AI Dashboard 1.0.0.exe` in `dist-exe/`.
- **Workflow Decoupling**: Orchestrator now gracefully yields to the standalone `.exe` if it's already running, connecting via Socket.IO automatically.
- **Portability**: The dashboard can now be run before or after the main codebase without conflicts.

## 2026-03-10: Dashboard Merged into Robust Base
- **Core Restoration**: Restored `orchestrator.js` and `sessionManager.js` to their stable, robust "old" versions to ensure 100% working resource safety (timeouts, context closure).
- **Persistent Dashboard Port**: Successfully ported the forked dashboard process and Socket.IO metrics pipeline from the experimental version into the robust base.
- **Metrics Integrity**: Added `getRecentTasks` and `getTaskBreakdown` to the robust Orchestrator to satisfy the new dashboard's data requirements.
- **Cleanup**: Removed redundant `effectiveTimeout` shadowing in `executeTask` and refined `shutdown()` to handle the persistent dashboard model gracefully.

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

## 2026-03-10: Dashboard Test Data Generator
- Created `api/tests/dashboard-data-generator.js` that generates realistic test data for dashboard panels.
- Generates: sessions (online/offline/idle), queue length, Twitter actions, API metrics, browser stats, recent tasks.
- Supports configurable PORT and DURATION environment variables.

## 2026-03-10: Dashboard Task Timestamp Feature
- Added `formatTaskTimestamp()` function to App.jsx.
- Shows relative time (< 1 hour): "1m 30s ago".
- Shows absolute time (>= 1 hour): "10:30 PM (GMT+7)".
- Updated Recent Tasks panel to display timestamp alongside duration.

## 2026-03-10: Persistent Dashboard History
- **Data Persistence**: Implemented `loadHistory` and `saveHistory` in `dashboard.js` to persist task history into `api/data/dashboard-history.json`.
- **UI Refinement**: Renamed "Audit Log" to "History" and updated the `TaskList` component to use a clean, monospace format: `Session - Task - Status` (e.g., `roxy:0001 - taskname - OK`).
- **Performance**: Capped persistent history at 40 items to ensure fast loads and small file size.
- **Data Integrity**: Implemented robust field mapping (taskName/name/command) across metrics and dashboard server to fix missing task names in UI.
- **Layout Fix**: Forced row-direction and single-line layout for history items with CSS ellipsis for overflow.
- **Auto-Sync**: History is saved automatically whenever new task results arrive via task-update listener.
## 2026-03-10: Modular Independent History Implementation
- **Architecture Extraction**: Extracted history management from `dashboard.js` into a dedicated `HistoryManager` class (`api/ui/electron-dashboard/lib/history-manager.js`).
- **Data Encapsulation**: The new module handles its own filesystem operations (`load`, `save`), field normalization, and retention logic (40-item cap).
- **Real-Time Integration**: 
    - Updated `orchestrator.js` to emit immediate `task-update` events (via Socket.io and IPC) upon task completion.
    - Updated `dashboard.js` IPC listener to process these immediate updates.
- **Reliability Fix**: This decoupled architecture ensures that "missing data" issues caused by short-lived orchestrators or broadcast timing are eliminated, while making the dashboard core significantly thinner and more maintainable.
11-03-2026--15-05 > api/ui/electron-dashboard/dashboard.js > Implemented delta-tracking for metrics to fix double-counting
11-03-2026--14-45 > api/ui/electron-dashboard/dashboard.js > Persistent completedTasks logic and fixed active queue calculate
11-03-2026--14-45 > api/ui/electron-dashboard/lib/history-manager.js > Added completedTasks persistence methods
11-03-2026--14-45 > api/ui/electron-dashboard/renderer/src/App.jsx > Renamed metrics and fixed queue display
- **Data Encapsulation**: The new module handles its own filesystem operations (`load`, `save`), field normalization, and retention logic (40-item cap).
- **Real-Time Integration**: 
    - Updated `orchestrator.js` to emit immediate `task-update` events (via Socket.io and IPC) upon task completion.
    - Updated `dashboard.js` IPC listener to process these immediate updates.
- **Reliability Fix**: This decoupled architecture ensures that "missing data" issues caused by short-lived orchestrators or broadcast timing are eliminated, while making the dashboard core significantly thinner and more maintainable.
11-03-2026--15-05 > api/ui/electron11-03-2026--15:30 > dashboard.js > Fixed Twitter metric double-counting via delta-tracking and added persistence via HistoryManager.
11-03-2026--15:35 > lib/history-manager.js > Added persistent storage for Twitter actions and API metrics.sks logic and fixed active queue calculate
11-03-2026--14-45 > api/ui/electron-dashboard/lib/history-manager.js > Added completedTasks persistence methods
11-03-2026--14-45 > api/ui/electron-dashboard/renderer/src/App.jsx > Renamed metrics and fixed queue display
11-03-2026--17-37 > api/actions/like.js > Added metricsCollector import + recordSocialAction('like') on success for real-time dashboard updates
11-03-2026--17-37 > api/actions/retweet.js > Added metricsCollector import + recordSocialAction('retweet') on success for real-time dashboard updates
11-03-2026--17-37 > api/actions/follow.js > Added metricsCollector import + recordSocialAction('follow') on success for real-time dashboard updates
11-03-2026--17-37 > api/actions/bookmark.js > Added metricsCollector import + recordTwitterEngagement('bookmark') on success for real-time dashboard updates
11-03-2026--17-37 > api/actions/reply.js > Added metricsCollector import + recordTwitterEngagement('reply') on success for real-time dashboard updates
11-03-2026--17-37 > api/actions/quote.js > Added metricsCollector import + recordTwitterEngagement('quote') on success for real-time dashboard updates
11-03-2026--17-37 > tasks/api-twitterActivity.js > Removed deferred batch metricsCollector calls from finally block + removed unused metricsCollector import (prevents double-counting)
12-03-2026--00:00 > api/core/orchestrator.js > Added /* ignore */ to empty catch block for lint resolution
12-03-2026--00:00 > tasks/api-twitterActivity.js > Removed unused agentState variable and assignment for lint resolution
12-03-2026--03:26 > package.json > Improved test scripts to support single-file filtering and coverage. Removed hardcoded paths.
