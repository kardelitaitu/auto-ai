### ✅ version 0.7.7

(06 March 2026) VS Code Testing Enhancements

- **Vitest Coverage Debugging**: Added "Vitest Coverage" configuration to `.vscode/launch.json` for integrated coverage analysis.
- **Per-File Diagnostic Testing**: Added "Vitest (Current File)" configuration to allow developers to run and debug the currently active test file instantly.

### ✅ version 0.7.6

(06 March 2026) Configuration Centralization & Test Repair

- **Centralized Configuration**: Moved `eslint.config.js`, `.prettierrc`, and `vitest.config.js` to `config/` directory. Updated relative paths in configs and `package.json` scripts to maintain system functionality.
- **Fixed AI Quote Engine Test**: Resolved a non-deterministic `AssertionError` in `ai-quote-engine.test.js` by correcting an incorrect mock path for `HumanInteraction` (`../../utils/human-interaction.js` → `../../behaviors/human-interaction.js`).
- **Verified Stability**: Confirmed that all 61 tests in `ai-quote-engine.test.js` now pass deterministically.

### ✅ version 0.7.5

(05 March 2026) Logging Context & Format Refinement

- **Consistent Log Tags**: Implemented `[sessionId][taskName][scriptName]` format across the entire API.
- **Improved Context Propagation**: Refactored `withPage` to correctly prioritize provided session IDs and task names, ensuring accurate logging even in nested automation calls (e.g., `api.click`).
- **Cleaned Task Logs**: Removed redundant hardcoded prefixes from `followback.js`, leveraging the new contextual logging system for cleaner and more professional output.
- **Session ID Prioritization**: Guaranteed that `browserInfo` derived IDs (like `roxy:0001`) are used as the primary `sessionId` in logs.

### ✅ version 0.7.4

(05 March 2026) Targeted Test Coverage Expansion (Phase 2)

- **Refined Follow-Back Task**:
    - Improved `tasks/followback.js` with more robust profile and follower detection.
    - Standardized timeouts to `api.wait` for consistent humanization.
    - Added logic to explicitly skip "Following" or "Pending" states to prevent accidental unfollows.
    - Added `maxFollows` parameter support (default 1) via command-line shorthand (e.g., `followback=5`).
    - Refined button detection to prioritize "Follow back" text and `aria-label` for better accuracy.
    - Added username logging for follow-back actions.
    - Improved `tasks/followback.js` selector to be more inclusive and smarter about tab navigation.
    - Refactored `api/core/logger.js` to provide human-readable text in `logs.txt` and structured JSON in `logs.json`.
    - Restored system logging in `tasks/followback.js` by replacing direct `console` calls with `createLogger`.
    - Fixed shorthand validation error (e.g., `followback=1`) by updating `main.js` to handle numeric shorthand values via a generic `value` field.
- **Significant Coverage Gains**:
    - `api/behaviors/humanization/content.js`: **90.48%** (from 25.39%)
    - `api/connectors/discovery/localBrave.js`: **95.35%** (from 44.18%)
    - `api/interactions/scroll.js`: **58.70%** (from 42.51%)
    - `api/core/sessionManager.js`: **48.59%** (from 38.24%)
- **New Test Files**:
    - `api/tests/unit/content-skimmer.test.js` (8 tests)
    - `api/tests/unit/localBrave.test.js` (5 tests)
- **Enhanced Test Files**:
    - `api/tests/unit/api/scroll.test.js` (Expanded to 23 tests)
    - `api/tests/unit/sessionManager.test.js` (Expanded to 9 tests, including DB recovery)
- **Refactored for Testability**: Exported `SimpleSemaphore` from `sessionManager.js`.

### ✅ version 0.7.3

(05 March 2026) Test Coverage Expansion & Config Merging Fix

- **100% Line Coverage**: Achieved perfect line coverage for three critical modules:
    - `api/behaviors/scroll-helper.js` (Created `scroll-helper.test.js`)
    - `api/core/config.js` (Created `core-config.test.js`)
    - `api/core/errors.js` (Created `core-errors.test.js`)
- **Fixed Config Merging Bug**: Corrected the `ConfigurationManager.init()` method to properly merge nested `agent` and `timeouts` properties. Previously, raw input would overwrite the entire nested object instead of merging with defaults.
- **Exported ConfigurationManager**: Surface the class in `api/core/config.js` to enable deep unit testing of initialization logic.

### ✅ version 0.7.2

(05 March 2026) Core API Test Suite Stabilization

- **Fixed Core API Tests**: Achieved 100% pass rate (180 tests) for the 8 primary API core modules.
- **Alias Migration**: Finished standardizing all static and dynamic imports in test files to the `@api` absolute alias.
- **Pipeline Retry Fix**: Corrected a bug in `actions.js` where the `recovery` option was ignored by the middleware pipeline, causing extra retry attempts in `actions.test.js`.
- **Dynamic Import Resolution**: Fixed "Module Not Found" errors in `cursor` and `attention` tests by updating dynamic imports to use the correct alias logic.

### ✅ version 0.7.1

(04 March 2026) API Import Path Repairs

- **REPAIRED API IMPORTS**: Fixed broken relative import paths in 7 unit test files:
    - `plugins.test.js`, `queries.test.js`, `recover_behavior.test.js`, `recover.test.js`, `scroll.test.js`, `sensors.test.js`, `timing.test.js`
    - Migrated paths from brittle `../../../api/` structures to robust `@api` aliases
    - Fixed mock paths to ensure consistent module resolution in Vitest
- **Verified Stability**: All 106 tests across the affected files are confirmed passing.

### ✅ version 0.7.0

(04 March 2026) Phase 1 Cleanup & Consolidation

- **CircuitBreaker Consolidation**: `utils/circuit-breaker.js` now re-exports from `core/circuit-breaker.js`
    - Added check(), recordSuccess(), recordFailure(), getState(), getAllStates(), getStats() methods to core version
- **GhostCursor Consolidation**: Deleted `behaviors/ghostCursor.js`
    - Created `api/constants/engagement.js` with TWITTER_CLICK_PROFILES constant
    - Added twitterClick() convenience method to `utils/ghostCursor.js`
    - Updated `api/twitter/twitterAgent.js` to import from `utils/ghostCursor.js`
- **Math Consolidation**: `utils/mathUtils.js` now re-exports from `utils/math.js`
- **V2 Module Merge**: Removed -v2 suffix from orchestrator and sessionManager
    - `orchestrator-v2.js` content merged into `orchestrator.js`
    - `sessionManager-v2.js` content merged into `sessionManager.js`
    - Updated `main-v2.js` to import from merged modules
    - Deleted `orchestrator-v2.js` and `sessionManager-v2.js`
- **Config Defaults Fix**: Extracted DEFAULTS constant in `core/config.js` to eliminate duplication
- **Cleanup**: Deleted `agent/ai-reply-engine-dir/decision.js.backup` and `api/_test-command-line`

### ✅ version 0.6.1

(02 March 2026) API Documentation

- **New Documentation**: Created comprehensive markdown documentation in `api/docs/`:
    - `README.md` - Main index with quick start, core concepts, examples
    - `core.md` - Context, Config, Errors, Events, Hooks, Middleware, Plugins
    - `interactions.md` - Actions, Scroll, Cursor, Navigation, Wait, Queries, Banners
    - `behaviors.md` - Persona, Timing, Attention, Idle, Recovery, Warmup
    - `agent.md` - Observer, Executor, Finder, Vision, Runner, LLM Client
    - `utils.md` - File I/O, Memory, Patch, Retry, Config, Math, Timing
    - `actions.md` - Twitter: Like, Retweet, Follow, Quote, Reply, Bookmark, AI Actions

### ✅ version 0.6.0

(02 March 2026) Robust Orchestrator V2 (Now Default) & Session ID Formatting

- **V2 is now the default**: `orchestrator.js` and `sessionManager.js` now re-export from V2 versions
    - Existing `main.js` now uses V2 automatically
    - `main-v2.js` kept for explicit CLI timeout flags
- **Orchestrator V2**: Created new robust orchestrator (`api/core/orchestrator-v2.js`) with:
    - Task timeout (default 10 min per task)
    - Group timeout (default 10 min per "then" block)
    - AbortSignal propagation to cancel stuck tasks
    - Force cleanup on timeout - releases worker, moves to next task
    - Returns completion status: { completed, timedOut, duration }
- **SessionManager V2**: Created new session manager (`api/core/sessionManager-v2.js`) with:
    - Simplified semaphore with deadlock detection
    - Worker health monitoring - auto-release stuck workers
    - forceReleaseWorker(sessionId, workerId) - emergency API
    - getWorkerHealth() - returns stuck workers list
- **Main V2 Entry Point**: Created `main-v2.js` (opt-in):
    - Usage: `node main-v2.js pageview=cookiebot then api-twitteractivity`
    - Flags: --task-timeout=600000 --group-timeout=600000 --force-shutdown
- **Fixed Health Check**: Changed network health check in `api/core/automator.js` from spawning new Chromium to lightweight HTTP fetch (no more resource exhaustion)
- **Session ID Formatting**: Updated session display format in orchestrator.js and orchestrator-v2.js:
    - Local browsers: [brave:8857], [chrome:9123]
    - Antidetect: [roxy:0001], [ix:123], [more:ABC]
    - Short names: chrome, brave, edge, vivaldi, roxy, ix, more, und
- **Unit Tests**: Created `tests/unit/orchestrator-v2.test.js` with 17 logic tests

### ✅ version 0.5.3

(02 March 2026) Humanization Stability & Math Utility Fixes

- **Fixed `randomInRange` Error**: Resolved the `Cannot read properties of undefined (reading 'randomInRange')` error by correcting the dynamic import logic in `api/behaviors/scroll-helper.js`.
- **Unified Math Utilities**: Consolidated all `api/behaviors/humanization/` modules to import `mathUtils` from `api/utils/math.js` for centralized management.
- **Corrected API Signatures**: Updated all `scrollRandom()` calls across the codebase to remove the redundant `page` parameter, ensuring alignment with the unified API.
- **Final Session Verification**: Confirmed that the `api-twitteractivity` task now runs successfully through full session cycles (navigation, reading, engagement).

### ✅ version 0.5.2

(01 March 2026) API Module Independence & Consolidation

- **Consolidated API Structure**: Successfully moved core logic from root `utils/` and `core/` folders into the `api/` directory, making the `@/api` module completely independent.
- **Import Resolution**: Corrected hundreds of relative import paths across `api/agent`, `api/actions`, `api/behaviors`, `api/utils`, and `tasks/`.
- **Fixed missing exports**: Restored `quoteWithAI` and `replyWithAI` functional wrappers in `api/index.js` by pointing them to corrected `api/actions/` implementations.
- **Module Maintenance**: Renamed `api/core/health-circuit-breaker.js` to `api/core/circuit-breaker.js` to resolve `ERR_MODULE_NOT_FOUND` in `AgentConnector`.
- **Cleanup**: Deleted legacy root `utils/` and `core/` directories after verifying successful initialization with `node main.js`.

### ✅ version 0.5.1

(01 March 2026) Proxy Assignment Enhancements & CLI Support

- **Enhanced Proxy Assignment (`ixbrowser-proxies-pasang-tok.js`)**:
    - **CLI Support**: Added ability to target specific profile IDs or ranges (e.g., `node script.js 111-115`).
    - **Robust API Handling**: Implemented a 3x retry mechanism with exponential backoff for all local API calls (`profile-list`, `profile-update`).
    - **Direct Mapping**: Refined logic to ensure Profile ID `N` always receives Proxy Line `N` from `proxies.txt`.
    - **Stability Delays**: Added a 200ms cooling period between profile updates to prevent local API congestion.
- **Git Hygiene**: Updated `.gitignore` to strictly exclude `proxies.txt`, `settings.json`, and local log files.

### ✅ version 0.5.0

(01 March 2026) Engagement Limit Enforcement & Config Pipeline Fixes

- **Fixed Reply/Quote Context Bug**: `api.replyWithAI()` and `api.quoteWithAI()` now work correctly in `api-twitterActivity.js`. Root cause: both execute overrides called these functions outside an `api.withPage()` context, causing `getPage()` → `ContextNotInitializedError`. Fixed by wrapping both calls with `api.withPage(page, ...)`.
- **Fixed Engagement Limits Not Enforced**: Quote and reply could fire more than the configured max. Root cause: `AIQuoteAction.execute()` and `AIReplyAction.execute()` checked `diveQueue.canEngage()` but never called `diveQueue.recordEngagement()` on success — counter stayed at 0. Fixed by adding `recordEngagement()` after success in `ai-twitter-quote.js`, `ai-twitter-reply.js`, and both execute overrides in `api-twitterActivity.js`. Added `canEngage()` guard to overrides as well.
- **Fixed settings.json Engagement Limits Ignored**: `config.getEngagementLimits()` was reading the wrong JSON path (`twitter.activity.engagementLimits` — doesn't exist) and always fell back to hardcoded defaults. Fixed to read `twitter.engagement.maxReplies/maxRetweets/maxQuotes/maxLikes/maxFollows/maxBookmarks` and remap keys to internal format.
- **Cleaned Up Duplicate Config Keys**: Removed unused `twitter.actions.reply` and `twitter.actions.quote` entries from `settings.json` (dead duplicates; actual values are read from `twitter.reply.probability` and `twitter.quote.probability`).

### ✅ version 0.4.9

(01 March 2026) Roxybrowser API Update

- **Updated API Key**: Changed Roxybrowser API key to `c6ae203adfe0327a63ccc9174c178dec` across configuration and connectors.

### ✅ version 0.4.8

(28 February 2026) Stable Release & Video Playback Fix

- **Fixed Media Playback**: Resolved X.com video playback issues by completely removing explicit H.264 codec spoofing from `api/utils/browserPatch.js` and `utils/browserPatch.js`. Diagnostics revealed that actively denying codec capabilities broke X.com's internal player negotiations (resulting in silent stream failures). Allowing the browser to negotiate natively restores consistent playback.

### ✅ version 0.4.7

(28 February 2026) AI-Powered Reply Integration & Bug Fixes

- **Integrated AI Replies**: Surfaced `api.replyWithAI()` in the core API. Handles context gathering, AI generation, and execution via Strategy A (Reply Icon) in one line.
- **Improved Context Extraction**: Ported optimized scrolling context extraction to the reply macro for consistent interaction behavior.
- **Fixed Media Playback**: Addressed a bug where custom Chromium builds artificially reported MP4 support. (Note: Reverted in 0.4.8)

### ✅ version 0.4.6

(28 February 2026) AI-Powered Action APIs

- **Integrated AI Quotes**: Surfaced `api.quoteWithAI()` as a high-level macro in the core API. Automatically handles tweet extraction, multi-scroll context collection, AI generation, and strategy execution in a single call.
- **Natural Scrolling & Extraction**: Refined the `quote` interaction flow to perform a unified downward "Reading" pass. Replaces robotic "scroll-then-jump" behavior with a smooth, humanized movement that loads and extracts replies simultaneously.
- **Enhanced Focus Reset**: Implemented `api.scroll.focus()` based reset before engagement actions to ensure the target element is always in the optimal "Golden View."

### ✅ version 0.4.5

(28 February 2026) API Extensibility & Hardened Error Recovery

- **Centralized Configuration**: Implemented `ConfigurationManager` (`api/core/config.js`) to unify global settings, timeouts, and environmental fallbacks, accessible universally via `api.config`.
- **Dynamic Plugin Architecture**: Engineered URL-aware contextual plugins. The `PluginManager` now dynamically evaluates and toggles loaded plugins automatically upon navigation (`api.goto`) based on each plugin's `matches(url)` manifest.
- **Strict Visual Guards**: Deprecated soft fallbacks for `click`, `hover`, and `type` inside `actions.js`. Interactions now assert strict Visual-Semantic Bounds via a newly surfaced `ElementObscuredError` before passing down to Playwright mechanisms.
- **Middleware Standardization**: Nuked redundant `executeWithRecovery` loops. All core kinetic actions now route through the unified pipeline architecture in `middleware.js` utilizing linear backoff and normalized propagation.
- **Observability Telemetry**: Added `runner._dumpDiagnostics()` to the Agent. When 3 consecutive LLM errors occur, the agent will gracefully snapshot its active DOM/Accessibility tree, variables, and history directly to the `/tmp/` directory to aid reproduction of unhandled failure states.
- **Sanitized Execution**: Achieved 0 syntax warnings, eliminated unused variables, and tightened stylistic definitions across the `api/core` logic scope.
- **Prompt Testing Suite (`prompt-test.js`)**: Upgraded to natively support "thinking" models (like `deepseek-r1` and `lfm2.5-thinking`) by extracting internal reasoning out of `<think>` tags and correctly routing requests with `think: true`.
- **Reply Engine Prompt Hardening**: Upgraded `REPLY_SYSTEM_PROMPT` in `twitter-reply-prompt.js` with extremely strict persona enforcement and negative constraints (`NEVER write "Okay" or "Yes"`) directly injected into all 22 strategies to prevent small thinking models (like `deepseek-r1:1.5b`) from defaulting to overly generic responses.
- **Terminal output fixes**: Fixed UI terminal rendering logic in `prompt-test.js` where string inputs containing CR characters would overwrite output logs.
- **Prompt Testing Model Compatibility (`prompt-test.js`)**: Repaired crashes when running small non-reasoning models (like `hermes3:8b`) by conditionally appending the `think: true` flag based on model name detection. Also implemented an explicit API preload sequence that forces local Ollama instances to load models completely into memory (VRAM) right at the script's startup rather than lagging mid-stream.
- **Prompt Testing Expansion**: Added 3 new conversation threads (Gaming, Crypto, Fitness) to `prompt-test.js` to improve output variance testing. The script now also randomly selects a single thread to test on each execution instead of running them all sequentially.

### ✅ version 0.4.4

(28 February 2026) API Refactoring & Bug Fixes

- **Decoupled GhostCursor**: Extracted domain-specific click profiles to `api/profiles/click-profiles.js`, making the core cursor utility domain-agnostic.
- **Improved Observability**: Replaced silent, swallowed exceptions in patching and initialization sequences with robust warnings and event emitters.
- **Robust Semantic Hashing**: Upgraded agent loop detection in `api/agent/runner.js` to use a semantic hash that strips dynamic temporal noise (timestamps, IDs) from AX Trees.
- **Navigation Safety**: Enhanced `smartClick` recovery to respect deliberate navigation via an `expectsNavigation` flag, stopping aggressive rollback.

### ✅ version 0.4.3

(28 February 2026) Automator Reconnection & Session Stability

- **Fixed Reconnection Handler**: Implemented missing `replaceBrowserByEndpoint` in `SessionManager` to correctly handle browser reconnections in `Automator`.
- **Enhanced Error Handling**: Added `markSessionFailed` to `SessionManager` for robust terminal failure handling during task orchestration.
- **Improved Orchestrator Sync**: Ensured `Automator`'s reconnection events are properly reflected in the `SessionManager` state.

### ✅ version 0.4.2

(28 February 2026) CookieBot Reliability & Timeout Hardening

- **Smart Visit Timeout**: Implemented a 90-second total timeout per URL in `cookiebot.js`, encompassing both navigation and interaction.
- **Improved Navigation Latency**: Lowered initial navigation timeout from 60s to 30s to fail fast on slow pipes.
- **Responsiveness Guard**: Added a 5-second JS responsiveness check after navigation to detect and skip "dead" or extremely heavy pages before interaction attempts.
- **Graceful Error Recovery**: Enhanced loop logic to log and skip failed/timed-out URLs, preventing task stalls.

### ✅ version 0.4.1

(27 February 2026) Global Test Stabilization (100% Pass Rate)

- **100% Test Pass Rate**: Achieved a perfect pass rate across all 221 test files (4991+ individual tests passing).
- **AI Quote Engine Recovery**: Fixed side effects and mock inconsistencies in `ai-quote-engine.test.js`, ensuring robust validation of all quote methods.
- **Session Manager Migration**: Completed the test migration for the new SQLite-based `SessionManager`, including Semaphore-based worker allocation and persistence.
- **Agent Mobility Fix**: Fixed `AITwitterAgent.endDive` to correctly re-enable scrolling after operations, preventing agents from becoming stuck.
- **Path Resolution fix**: Corrected `PROJECT_ROOT` calculation in `api/utils/config.js` to ensure reliable loading of `settings.json`.
- **General Hygiene**: Cleaned up redundant test files and fixed numerous mock reference errors (`Error.captureStackTrace`, `api.visible`, `page.addInitScript`).

### ✅ version 0.4.0

(27 February 2026) Account Health Monitoring

- **Account Status Logging**: Implemented detection for locked and verification states in `SessionHandler.js`.
- **Dedicated Issue Log**: Added `account-issues.txt` for recording account health events (Locked, Verify, LoggedOut) with browser session IDs.
- **Improved Detection**: Expanded `checkLoginState` with 10+ new text signals for identifying problematic account states.

### ✅ version 0.3.9

(26 February 2026) Final API Stabilization & Integration Recovery

- **Integration Robustness**: Fixed `cloud-client.test.js` and `unified-api.test.js` by standardizing `page.url()` mocks across integration scenarios.
- **Sensor Simulation (Pillar 7)**: Fully implemented noisy battery, network, and orientation sensors in `api/utils/sensors.js`.
- **Self-Healing Navigation**: Completed the `recover()` behavior in `api/behaviors/recover.js`, enabling automatic URL reconciliation and `goBack` recovery.
- **Unified Mocking Strategy**: Standardized all 36+ API test files to use `pool: 'forks'` and consistent `vi.hoisted` mock structures.

(26 February 2026) Reply Fixes & Dive Locking

- **Lock Synchronization**: Overrode base engagement handlers to respect AI-driven dive locks, eliminating race conditions.
- **Enhanced Dive Control**: Extended lock duration to cover post-dive sequences and hardened reading simulation during active operations.
- **Safe Reply Fallback**: Implemented composer-state verification in the reply engine to prevent duplicate posts during fallbacks.
- **Smart Error Handling**: Improved reply success detection by monitoring composer closure even when exceptions occur.

### ✅ version 0.3.6

(25 February 2026) API Independence & Quote Repair

- **API Independence**: Decoupled `api/` from `utils/` by creating internal core utilities (`logger`, `math`, `timing`).
- **Circular Dependency Resolution**: Fixed critical `undefined.wait` errors by moving `ghostCursor.js` to `api/utils/`.
- **Async API Correction**: Added missing `await` to `api.getCurrentUrl()` and fixed `urlSync` helper logic.
- **Robust Quote Reposting**: Added strict quote preview verification to prevent accidental regular tweets.
- **Contextual Engagement**: Refined "Post" button targeting to prioritize the active composer container.
- **Extended Latency Support**: Increased verification timeouts for quote tweets to handle slow network loads.

### ✅ version 0.3.5

(24 February 2026) Scroll Modernization & Global Scaling

- **Comprehensive Scroll Modernization**: Fully migrated `AIContextEngine`, `AIQuoteEngine`, `AIReplyEngine` (context), and `twitterAgent.js` to the unified `api.scroll` system.
- **Eliminated Page Refreshes**: Replaced legacy `window.scrollTo` and `Home` key presses with natural, gradual `api.scroll` movements, resolving unexpected page resets.
- **Unified Timing**: Replaced all `page.waitForTimeout` calls in target modules with `api.wait` and `api.think` for human-consistent behavior.
- **Global Multiplier Support**: All scrolling operations now scale their distances by the `globalScrollMultiplier` defined in `settings.json`.

### ✅ version 0.3.4

(24 February 2026) Engagement Latency Optimization

- **Faster Typing Start**: Optimized `HumanInteraction.typeText` to allow skipping redundant clear/focus clicks when the composer is already ready.
- **Improved Quote/Reply Flow**: Reduced fixed wait times after 'r' key, 'Enter' key, and button clicks by ~60% across all engines.
- **Streamlined Engines**: Applied `skipClear` and `skipFocusClick` to both `AIQuoteEngine` and `AIReplyEngine`, significantly reducing the "LLM-to-Type" gap.

### ✅ version 0.3.3

(24 February 2026) Unified API Migration: Twitter Activity

- **Deep API Integration**: Refactored `AITwitterAgent` and all modular handlers (`Navigation`, `Engagement`, `Session`) to use `api.*` methods instead of raw Playwright calls.
- **Surgical API Port**: Rebuilt `api-twitterActivity.js` using the logic from `ai-twitterActivity.js` with 100% `api.*` method utilization.
- **Improved Stability**: Standardized on unified API methods (`api.goto`, `api.wait`, `api.eval`, `api.waitVisible`) for better error handling and human-like timing.
- **No Trampoline**: Eliminated trampoline navigation dependencies while maintaining direct URL spoofing with custom referrers.

### ✅ version 0.3.2

(24 February 2026) LLM Reliability Fix

- **Cloud LLM Support**: Fixed `reply-test` task to correctly respect cloud LLM settings when local providers are disabled.
- **Provider Routing**: Optimized provider check logic to include cloud in the primary enablement check.

### ✅ version 0.3.1

(24 February 2026) API Robustness & Coverage

- **100% Scroll Coverage**: Reached 100% line coverage for `api/interactions/scroll.js` with comprehensive fallback testing.
- **Enhanced Verification**: Added tests for CDP/mouse.wheel failure scenarios and internal DOM-evaluation logic.

### ✅ version 0.3.0

(23 February 2026) Ghost 3.0: Phantom Protocol

- **Layer 0 Hardening**: Implemented source-level driver masking (`patch.js`) and recursive proxy-based `navigator` spoofing.
- **Sensor Layer (Pillar 4)**: Implemented deep `navigator` spoofing (plugins, memory, hardware) and Permissions API hardening.
- **Bio-Profiles (Pillar 5)**: Introduced PID-driven Muscle Models for unique per-persona acceleration signatures.
- **Semantic Presence (Pillar 6)**: Added Visual-Semantic Guards (Obstruction detection, Layout stability) and "Flinch" reaction to moving targets.
- **Sensory Simulation (Pillar 7)**: Injected noisy battery status and device orientation mocks for enhanced environment realism.
- **Temporal Hygiene**: Implemented performance-aware impatience (Page Lag detection) and session longevity tracking.
- **Stack-Scrubbing**: (Identity Sanitizer) Functional implementation prepared but disabled by default to ensure renderer stability.

### ✅ version 0.2.0

(22 February 2026) Ghost 2.0: Invisible Interaction

- **Shadow Layer**: Advanced Driver Masking (Navigator Proxy, Enum-Order Stealth).
- **Kinetic Layer**: Fitts's Law motion physics and Physiological Jitter.
- **Brain Layer**: Saccadic Bouncing, Visual Weight Awareness, and Short-Term Memory.
- **Heartbeat**: Integrated Micro-Fidgeting for idle stealth.

### ✅ version 0.1.0

(22 February 2026) Robust & Responsive API Improvements

- 🚀 **Self-Healing Actions**: Added `executeWithRecovery` to `actions.js` for automatic retry on detached/obscured elements.
- ⚡ **Adaptive Transitions**: Optimized `api.goto` with `resolveOnSelector` and improved scroll skip-logic.
- 🛡️ **Session Resilience**: Added background heartbeats and heartbeat-aware queries to prevent silent crashes.

### ✅ version 0.0.9

(22 February 2026) Unified API Refactoring

- 🚀 **Unified API Adoption**: Refactored `cookiebot-api.js` to utilize the new modularized API infrastructure, improving maintainability and humanization consistency.
- 🛠️ **Infrastructure Consolidation**: Migrated manual scrollers and patches to `api.init`, `api.goto`, and `api.scroll.read`.

### ✅ version 0.0.8

(21 February 2026) AI Twitter Agent Coverage Fixes

- 🚀 **Coverage Test Stability**: Fixed `TypeError`s thrown by invalid Mock constructors in `ai-twitterAgent.gap.test.js`. Replaced arrow functions with regular mock functions to fully support ES6 instantiation syntax.
- 🛡️ **Zero-Failure Coverage Runs**: Validated execution of `npm run test:coverage`. Achieved a perfect exit code 0 under strict global coverage tests suite.

### ✅ version 0.0.7

(21 February 2026) Test Performance & Mutex fixes

- 🚀 **Critical Mutex Fix**: Fixed `testLock` bug in `FreeOpenRouterHelper.js` where the testing lock was never released, resolving 5-second delays in dependent tests.
- ⚡ **Fake Timers Implementation**: Applied `vi.useFakeTimers()` to `human-interaction.test.js` to eliminate multi-second Waits in interaction and verification tests.
- ⏱️ **Reduced Test Latency**: Decreased `waitForTests` timeouts in unit tests to 100ms for faster mock resolution.
- 📊 **Stability Verified**: Re-analyzed test suite durations, confirming ~3x speedup in `free-openrouter-helper.test.js` and removal of false-positive 30s delays in `config-service.test.js`.

### ✅ version 0.0.6

(21 February 2026) Twitter Agent Test Stability

- Resolved critical `TypeError: (...) is not a constructor` by refactoring arrow function mocks in `ai-twitterAgent-coverage.test.js`.
- Fixed `used` of undefined in `DiveQueue` status mock by adding missing engagement limits.
- Synchronized `keyboard.press` and `keyboard.type` mocks to return promises, ensuring safe navigation logic passes.
- Verified 14/14 unit tests and 99/99 coverage tests pass for AI Twitter Agent.

### ✅ version 0.0.5

(20 February 2026) Local Ollama Integration Optimization

- 🚀 **Thundering Herd Resolution**: Implemented Promise deduplication in `ensureOllama` and `isOllamaRunning` to prevent redundant overlapping processes during multi-tab initialization.
- ⚡ **Optimized Health Checks**: Reversed the checking order to prioritize fast HTTP readiness checks (`/api/tags`) over slow OS-level `tasklist` commands.
- ⏱️ **Cooldown Mechanisms**: Added a 30-second penalty cache for initialization failures to prevent persistent retry loops, and increased the `ollama list` wakeup fallback throttle to 30 seconds.

### ✅ version 0.0.4

(13 February 2026) Engagement & Navigation Fixes

- Fixed engagement double-counting in `ai-twitterAgent.js` (removed redundant `recordEngagement` calls).
- Optimized post-action navigation: Bot now skips reading phase and returns home immediately after successful engagement.
- 🎯 **Consolidated Action Selection**: Enforced strictly single action per dive by removing secondary rolls and hidden fallbacks.
- 🛡️ **Action Interference Resolution**: Disabled autonomous `DiveQueue` fallbacks (auto-likes/bookmarks) during failed AI dives to ensure strictly one action per task.
- 📝 **Compacted Logging**: Engagement progress and proxy testing logs are now condensed into single-line summaries for a cleaner console output.

### ✅ version 0.0.3

(13 February 2026) Network Logic Optimization

- 🚀 **Optimized Network Idle Detection** in `ai-twitterActivity.js`
    - Replaced strict 10s network idle wait with smart adaptive wait
    - When page is visually loaded (`xLoaded`), wait reduces to 4s
    - Added better logging for network status (no more "Network not fully idle" warnings for normal background activity)
- 🚀 **Optimized Session Start Latency**
    - Reduced "warm-up" delays in `HumanizationEngine` and `HumanTiming`
    - Shortened processing pauses for initial "light" scroll maneuvers
    - Targeted latency reduction of ~3-4 seconds per session start

### ✅ version 0.0.2

(25 December 2024) Smart Step-by-Step System

- ✨ **Intelligent Step Tracking** in `agent-cortex.js`
- ✨ **Automatic Step Detection**
- ✨ **Simplified Validation**
- ✨ **Auto-Termination**

### ✅ version 0.0.1

(24 December 2024) Project Initialization

- ⚠️ **Complete architectural overhaul** based on Distributed Agentic Orchestration (DAO) whitepaper
- ✨ **New Core Modules** (11 Total)
- ✅ **Retained Components**
- 📚 **Documentation & Examples**
