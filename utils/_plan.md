# Refactoring Plan: Independent API & Utils Removal

## Goal
The goal is to make the `api` module completely independent by migrating all necessary utilities and high-level logic from the root `utils` folder into the `api` directory structure. This will eventually allow for the removal of the root `utils` folder.

## Proposed Changes

### 1. API Structure Expansion
We will expand the `api` directory to accommodate the migrated modules:
- `api/utils/`: General infrastructure (logger, config, math, etc.)
- `api/behaviors/humanization/`: Human-like interaction logic
- `api/twitter/`: Twitter-specific agents, actions, and engines

### 2. File Migrations

#### General Utilities -> `api/utils/`
- [ ] `utils/logger.js`, `utils/logging-config.js` -> `api/utils/`
- [ ] `utils/banner.js` -> `api/utils/`
- [ ] `utils/configLoader.js`, `utils/config-manager.js`, etc. -> `api/utils/`
- [ ] `utils/dockerLLM.js` -> `api/utils/`
- [ ] `utils/mathUtils.js` -> Merge with `api/utils/math.js`
- [ ] `utils/fingerprintManager.js` -> `api/utils/fingerprint.js` (Merge/Update)
- [ ] `utils/retry.js`, `utils/circuit-breaker.js`, `utils/async-queue.js` -> `api/utils/`
- [ ] `utils/sentiment-*` -> `api/utils/sentiment/`
- [ ] `utils/profileManager.js`, `utils/generateProfiles.js` -> `api/utils/profiles/`

#### Humanization -> `api/behaviors/humanization/`
- [ ] Root `utils/humanization/` directory content moves to `api/behaviors/humanization/`
- [ ] `utils/human-interaction.js`, `utils/human-timing.js` -> `api/behaviors/humanization/`
- [ ] `utils/mistake-engine.js`, `utils/entropyController.js` -> `api/behaviors/humanization/`

#### Twitter Specifics -> `api/twitter/`
- [ ] `utils/twitter-agent/` directory -> `api/twitter/`
- [ ] `utils/actions/` directory -> `api/twitter/actions/`
- [ ] `utils/ai-reply-engine/` directory -> `api/twitter/reply-engine/`
- [ ] `utils/twitterAgent.js`, `utils/ai-twitterAgent.js` -> `api/agents/twitter/` (Wait, maybe `api/twitter/agent.js`?)
- [ ] `utils/twitter-interaction-methods.js`, `utils/twitter-reply-prompt.js` -> `api/twitter/`

### 3. Import Updates
- [ ] Update all migrated files to use relative imports within `api/`.
- [ ] Update `main.js` to import logger, config, etc. from `api/utils/`.
- [ ] Update `core/orchestrator.js` and all files in `tasks/` to use the new `api` structure.

## Verification Plan

### Automated Tests
- Run unit tests: `npm run test:unit`
- Run integration tests: `npm run test:integration`
- Specifically monitor: `tests/unit/ai-twitterAgent.test.js` and `tests/integration/unified-api.test.js`

### Manual Verification
- Run `node main.js` to verify browser discovery and task initialization.
- Observe a short run of a Twitter task (e.g., `like`) to ensure ghost cursor and humanized timing are still functioning.

> [!IMPORTANT]
> This is a destructive refactor of the code organization. We must ensure `AGENT-JOURNAL.md` is updated and all imports are checked systematically.
