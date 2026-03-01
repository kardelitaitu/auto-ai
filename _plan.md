# API Independence Refactoring Plan

## Goal
Consolidate all essential logic into the `api` module so that root `utils` and `core` folders can be removed. The system must remain fully functional for `main.js` and the primary tasks.

## Target Scope
- **Command**: `node main.js`
- **Tasks**: `api-twitteractivity`, `pageview`, `cookiebot`

## 1. Directory Structure Prep
Expand `api/` to include:
- `api/core/` (Migrated from root `core/`)
- `api/utils/` (Migrated from root `utils/` utilities)
- `api/twitter/` (Migrated Twitter logic)
- `api/agent/` (AI engines)
- `api/behaviors/` (Humanization and interaction)
- `api/connectors/` (Browser connectors)

## 2. File Migrations

| Original File | Target Location | Notes |
|---------------|-----------------|-------|
| `core/orchestrator.js` | `api/core/orchestrator.js` | |
| `core/sessionManager.js` | `api/core/sessionManager.js` | |
| `core/discovery.js` | `api/core/discovery.js` | Update `discoveryDir` path |
| `core/automator.js` | `api/core/automator.js` | |
| `core/agent-connector.js` | `api/core/agent-connector.js` | |
| `core/circuit-breaker.js` | `api/core/health-circuit-breaker.js` | Rename to avoid collision |
| `utils/logger.js` | `api/utils/logger.js` | Unified system logger |
| `utils/configLoader.js` | `api/utils/configLoader.js` | |
| `utils/ai-twitterAgent.js` | `api/twitter/ai-twitterAgent.js` | |
| `utils/twitterAgent.js` | `api/twitter/twitterAgent.js` | |
| `utils/profileManager.js` | `api/utils/profileManager.js` | |
| `utils/humanization/` | `api/behaviors/humanization/` | |
| `utils/actions/` | `api/actions/` | Merge with existing api actions |

## 3. Collision Resolution
- **Logger**: Refactor existing `api/core/logger.js` to use `api/utils/logger.js`.
- **Config**: Consolidate `api/utils/config.js` with the full `configLoader.js`.
- **Math**: Merge `utils/mathUtils.js` into `api/utils/math.js`.

## 4. Import Updates
- Update all `../../utils/` and `../../core/` imports within `api/`.
- Update `main.js` to import Orchestrator from `./api/core/orchestrator.js`.
- Update tasks to use `api/` internal paths.

## 5. Verification
1. `node -c` for syntax checks on every moved file.
2. `npm test` to run unit and integration tests.
3. `node main.js` manual observation.
4. Delete root `utils/` and `core/` once verified.
