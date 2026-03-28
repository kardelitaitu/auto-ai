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
pnpm commit "message"              # Commit only (no push)
pnpm commit "message" --push       # Commit + push
pnpm commit --no-verify "message" # Skip lint-staged
pnpm amend "updated message"       # Amend only (no push)
pnpm amend "updated message" --push # Amend + force push
pnpm amend --no-verify             # Skip lint-staged
```

> `pnpm commit` auto-generates a date-based message when you omit one, and both helpers run `pnpm exec lint-staged` by default. Push is no longer automatic - use `--push` to push after committing.

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
- **Always update `AGENT-JOURNAL.md`** after making changes. Use this format:

    ```
    DD-MM-YYYY--HH:MM > File(s) > Description of changes
    ```

    - Entry goes at the TOP (before existing entries)
    - Use past tense for completed work
    - Be concise but specific about what was changed
    - For larger releases, also update `patchnotes.md`

- **Never run `git push` unless explicitly asked by the user.** Always commit only by default.
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

### Test Mocking Standards

Always use **top-level `vi.mock()`** instead of `vi.unmock()` or dynamic mocking inside tests. This prevents flaky CI failures due to module caching.

**DO:**

```javascript
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Top-level mocks - runs before any imports
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return { ...actual };
});

vi.mock('child_process', async () => {
    const actual = await vi.importActual('child_process');
    return { ...actual };
});

describe('My Integration Test', () => {
    beforeAll(async () => {
        vi.resetModules();
        // Import after resetModules
    });
});
```

**DON'T:**

```javascript
// This causes flaky CI failures
beforeAll(async () => {
    vi.unmock('fs'); // ❌ Unreliable
    vi.resetModules();
});
```

Key points:

- Place `vi.mock()` at the **top of the file**, before any imports
- Use `vi.importActual()` to get real module behavior when needed
- Call `vi.resetModules()` in `beforeAll` before importing the module under test
- Add `beforeEach` hooks to ensure state is fresh for each test if needed

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

| Entry                                                                                                                 | Evidence                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Git workflow helpers (`pnpm commit`, `pnpm amend`, `pnpm exec lint-staged`, commit-only default)                      | `package.json`, `scripts/git-commit.js`, `scripts/git-amend.js`, commit `035664c`         |
| Parallel Vitest audit runner (`.\vitest-individual.ps1`)                                                              | `vitest-individual.ps1`, commits `9e8e4a8` and `a9a1919`                                  |
| CI test matrix (`pnpm run lint`, `pnpm run test:bun:unit`, `pnpm run test:bun:integration`, `pnpm run test:bun:edge`) | `.github/workflows/ci.yml`, commits `938dd2f`, `37d7e58`, `fc172bc`, `1d6fd25`, `5d4544a` |
| Test mocking standards (top-level vi.mock)                                                                            | `AGENTS.md`, commit `87abc3b`                                                             |

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED

Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED

Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:

- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED

Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:

- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)

Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:

- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)

If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)

Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command       | Action                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| `ctx stats`   | Call the `stats` MCP tool and display the full output verbatim                    |
| `ctx doctor`  | Call the `doctor` MCP tool, run the returned shell command, display as checklist  |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
