# API Independence Refactoring Plan (Exhaustive)

## Goal
Consolidate all essential logic into the `api` module so that root `utils` and `core` folders can be removed. The system must remain fully functional for `main.js` and the primary tasks.

## Target Scope
- **Command**: `node main.js`
- **Tasks**: `api-twitteractivity`, `pageview`, `cookiebot`
**CRITICAL**: Any file in `core/` or `utils/` NOT listed below is not used by the target scope and will be DELETED when the folders are removed.

## 1. File Migrations (The Exhaustive List)

Based on a recursive AST import trace, exactly 12 files from `core` and 71 files from `utils` are required.

### Core Migrations (`api/core/`)
- `core/agent-connector.js`
- `core/automator.js`
- `core/circuit-breaker.js` -> `api/core/health-circuit-breaker.js` (Rename)
- `core/cloud-client.js`
- `core/discovery.js`
- `core/local-client.js`
- `core/ollama-client.js`
- `core/orchestrator.js`
- `core/request-queue.js`
- `core/sessionManager.js`
- `core/vision-interpreter.js`
- `core/vllm-client.js`

### Utils Migrations (`api/utils/`)
*General Utilities:*
`api-key-timeout-tracker.js`, `apiHandler.js`, `async-queue.js`, `banner.js`, `circuit-breaker.js`, `config-cache.js`, `config-service.js`, `config-validator.js`, `configLoader.js` (resolve collision), `dockerLLM.js`, `engagement-limits.js`, `entropyController.js`, `envLoader.js`, `environment-config.js`, `errors.js`, `free-api-router.js`, `free-openrouter-helper.js`, `local-ollama-manager.js`, `logger.js` (resolve collision), `logging-config.js`, `mathUtils.js` (merge), `metrics.js`, `model-perf-tracker.js`, `multi-api.js`, `popup-closer.js`, `profileManager.js`, `proxy-agent.js`, `rate-limit-tracker.js`, `request-dedupe.js`, `retry.js`, `sentiment-analyzers.js`, `sentiment-data.js`, `sentiment-guard.js`, `sentiment-service.js`, `task-config-loader.js`, `urlReferrer.js`, `validator.js`

### Agent & Twitter Migrations (`api/agent/` & `api/twitter/`)
- *Agent Engines*: `ai-context-engine.js`, `ai-quote-engine.js`, `ai-reply-engine.js`, `ai-reply-engine/index.js`
- *Twitter Logic*: `ai-twitterAgent.js`, `twitterAgent.js`, `twitter-reply-prompt.js`, `session-phases.js`
- *Twitter Handlers*: `twitter-agent/BaseHandler.js`, `twitter-agent/EngagementHandler.js`, `twitter-agent/NavigationHandler.js`, `twitter-agent/SessionHandler.js`

### Actions (`api/actions/`)
- Migrate `utils/actions/*` (includes bookmark, follow, go-home, like, quote, reply, retweet, index.js).

### Behaviors (`api/behaviors/`)
- `human-interaction.js`, `human-timing.js`, `micro-interactions.js`, `motor-control.js`, `ghostCursor.js`, `scroll-helper.js`
- `humanization/*` (action, content, engine, error, index, multitask, scroll, session, timing)

## 2. Collision Resolution
- **Logger**: Refactor existing `api/core/logger.js` to wrap `api/utils/logger.js` so it keeps the `AsyncLocalStorage` context.
- **Config**: Integrate `api/utils/config.js` with the comprehensive `configLoader.js`.
- **Math**: Merge `utils/mathUtils.js` directly into `api/utils/math.js`.

## 3. Import Updates (The Heavy Lift)
- Find and replace all `require` and `import` paths in the 83 migrated files to point to their new relative locations within `api/`.
- Update `main.js` and the 3 tasks to use the new `api/` entry points.

## 4. Verification
1. `node -c` for syntax checks on every moved file.
2. `npm test` to run unit and integration tests.
3. `node main.js` manual observation.
4. Delete root `utils/` and `core/` once verified.
