# AGENTS.md

Quick reference guide for agents working on this repository.

> **Detailed guides**: See `.agents/*.md` files for deeper documentation.

## Codebase Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles using Playwright's CDP (Chrome DevTools Protocol). It uses AI (local Ollama/Docker LLMs and cloud OpenRouter) for decision-making and includes human-like behavior patterns to reduce detection risk.

## Entry Points

| File            | Purpose                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| `main.js`       | Primary automation CLI entry point for tasks like `pageview`, `follow`, and `retweet` |
| `agent-main.js` | OWB / game-agent runner for strategy automation                                       |
| `api/index.js`  | Unified API export: `import { api } from './api/index.js'`                            |

## Architecture at a Glance

- `api/index.js` is the main composition layer for context isolation, interactions, behaviors, recovery, file I/O, and agent helpers.
- `api/core/context.js` and `api/core/context-state.js` keep browser sessions isolated with `AsyncLocalStorage`.
- `api/core/orchestrator.js` owns browser discovery, task queueing, dispatch, and shutdown flow.
- `api/core/sessionManager.js` manages session lifecycle, worker health, and persistent session state.
- `api/agent/` contains the autonomous browser and OWB agent stack, including perception, reasoning, and action execution.
- `api/interactions/` contains the user-action layer for clicks, typing, scrolling, navigation, waits, and game helpers.
- `api/behaviors/` implements humanization, persona, idle, and attention behaviors.
- `api/utils/` holds shared support utilities such as config loading, logging, timing, validation, screenshots, and fingerprint helpers.
- `connectors/` contains browser discovery adapters for vendors like ixBrowser, MoreLogin, Dolphin, and related profiles.
- `tasks/` contains runnable automation scripts loaded dynamically by task name.

## Quick Commands

### Development

```bash
pnpm run lint
pnpm run lint:fix
pnpm run format
```

### Testing

**Preferred (Bun via pnpm):**

```bash
pnpm run test:bun:unit
pnpm run test:bun:integration
pnpm run test:bun:edge
pnpm run test:bun:all
pnpm run test:bun:coverage
pnpm run test:bun:watch
pnpm run test:bun:verbose
```

**Alternative (Node.js via pnpm):**

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:edge-cases
pnpm run test:smoke
pnpm run test:all
pnpm run test:coverage
pnpm run test:ci
pnpm run test:watch
pnpm run test:verbose
```

> **Performance**: Bun runs tests faster than Node.js. Use the `pnpm run test:bun:*` variants for development, and the `pnpm run test:*` variants when Bun is unavailable or when Node compatibility matters.

### Running

```bash
# Automation tasks
node main.js taskName=url
node main.js pageview=example.com then twitterFollow=url

# Strategy game agent
node agent-main.js owb
node agent-main.js owb play --loops=10
node agent-main.js owb play=rush
node agent-main.js owb state-a x20
```

### Git Workflow

```bash
pnpm commit "message"
pnpm commit --no-verify "message"
pnpm commit --no-push "message"
pnpm amend
pnpm amend "updated message"
pnpm amend --no-verify
```

> `pnpm commit` auto-generates a date-based message when you omit one, and both helpers run `pnpm exec lint-staged` by default.

### Agent Modes (`agent-main.js`)

| Mode       | Description               |
| ---------- | ------------------------- |
| `play`     | Auto-play mode            |
| `rush`     | Fast attack strategy      |
| `turtle`   | Defensive strategy        |
| `economy`  | Resource-focused          |
| `balanced` | Mixed strategy            |
| `build`    | Construction focus        |
| `train`    | Unit training focus       |
| `attack`   | Aggressive combat         |
| `gather`   | Resource collection       |
| `state-*`  | Run a specific game state |

### Test Audit Runner

```powershell
.\vitest-individual.ps1
```

> Scans `api/**/*.test.js`, runs tests in parallel batches, and writes `vitest-individual.txt` for long-form audit runs.

## Working Conventions

- Use `pnpm` for all install, lint, format, and test commands.
- Keep console output prefixed with the script name when logging from code.
- Prefer `api.*` methods over raw Playwright `page.*` calls for humanized interactions.
- Use `api.withPage(...)` for session isolation and avoid leaking page state globally.
- Follow the task-module pattern documented in the deeper API docs when adding new tasks.
- Update `AGENT-JOURNAL.md` for changes and `patchnotes.md` for larger changes.
- Do not push to GitHub unless explicitly asked by the user.
- Keep branches small and focused, and prefer PR-based merges for shared work.

## Testing

- Test files live primarily under `api/tests/`.
- Use `pnpm run test:bun:*` for fast local test runs.
- Use `pnpm run test:*` when Bun is unavailable or Node compatibility is being verified.
- Vitest uses `pool: 'forks'` because AsyncLocalStorage-based session isolation depends on worker-process isolation.
- Coverage is expected for core paths, and `pnpm run test:coverage` is the standard pre-commit validation when touching core modules or tests.
- Common test patterns include:
    - mocking `api/core/logger.js` and other core dependencies with `vi.mock()`
    - exercising `api.withPage()` blocks instead of calling raw `page.*`
    - using isolated fixtures for agent and interaction modules
- CI mirrors `pnpm run lint`, `pnpm run test:bun:unit`, `pnpm run test:bun:integration`, and `pnpm run test:bun:edge` on push and pull request events.

## Task System & Configuration

- Tasks are loaded dynamically from `tasks/` by task name.
- Task modules should export a default async function: `async function(page, payload)`.
- Task payloads generally include task-specific parameters plus browser/session context.
- Supported browsers include anti-detect vendors plus local Chrome/Brave/Edge/Vivaldi profiles.
- Configuration is layered:
    - `config/settings.json` for LLM, humanization, and persona settings
    - `config/browserAPI.json` for browser vendor ports
    - `config/timeouts.json` for timeout values
    - `.env` for runtime environment variables
- Humanization features include mouse movement, keystroke dynamics, scrolling patterns, idle behavior, PID-style movement tuning, and sensor noise spoofing.

## What To Inspect First

Start with these hotspots when learning or changing behavior:

- `api/core/orchestrator.js`
- `api/core/sessionManager.js`
- `api/core/context.js`
- `api/agent/`
- `connectors/`
- `tasks/`

## Further Reading

Use these docs for the detailed version of the repo conventions:

- [`.agents/PROJECT-STRUCTURE.md`](.agents/PROJECT-STRUCTURE.md)
- [`.agents/API-ARCHITECTURE.md`](.agents/API-ARCHITECTURE.md)
- [`.agents/TESTING-GUIDE.md`](.agents/TESTING-GUIDE.md)
- [`.agents/TASK-AND-CONFIG.md`](.agents/TASK-AND-CONFIG.md)
- [`.agents/TECH-STACK.md`](.agents/TECH-STACK.md)
- [`.agents/STEALTH-PROTOCOL.md`](.agents/STEALTH-PROTOCOL.md)

## Verification Log

| Entry | Evidence |
| ----- | -------- |
| Git workflow helpers (`pnpm commit`, `pnpm amend`, `pnpm exec lint-staged`) | `package.json`, `scripts/git-commit.js`, `scripts/git-amend.js`, commit `035664c` |
| Parallel Vitest audit runner (`.\vitest-individual.ps1`) | `vitest-individual.ps1`, commits `9e8e4a8` and `a9a1919` |
| CI test matrix (`pnpm run lint`, `pnpm run test:bun:unit`, `pnpm run test:bun:integration`, `pnpm run test:bun:edge`) | `.github/workflows/ci.yml`, commits `938dd2f`, `37d7e58`, `fc172bc`, `1d6fd25`, `5d4544a` |
