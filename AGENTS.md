# AGENTS.md

Quick reference guide for agents working on this repository.

> **Detailed guides**: See `.agents/*.md` files for in-depth documentation.

## Codebase Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles using Playwright's CDP (Chrome DevTools Protocol). It leverages AI (local Ollama/Docker LLMs and cloud OpenRouter) for intelligent decision-making and includes sophisticated human-like behavior patterns to avoid detection.

---

## Entry Points

| File | Purpose |
|------|---------|
| `main.js` | CLI entry - starts Orchestrator with browser discovery |
| `agent-main.js` | Agent entry - strategy game automation (OWB) |
| `api/index.js` | Unified API export - `import { api } from './api/index.js'` |

---

## Quick Commands

### Development
```bash
npm run lint              # Check code style
npm run lint:fix          # Auto-fix lint issues
npm run format            # Format code with Prettier
```

### Testing
```bash
npm run test:unit         # Unit tests only (api/tests/unit)
npm run test:integration  # Integration tests only (api/tests/integration)
npm run test:edge-cases   # Edge case tests only (api/tests/edge-cases)
npm run test:smoke        # Smoke tests only
npm run test:all          # All test suites
npm run test:coverage     # Run tests with coverage report
npm run test:ci           # CI/CD mode with coverage
npm run test:watch        # Watch mode for development
npm run test:verbose      # Detailed test output
```

### Running
```bash
# Automation tasks
node main.js taskName=url                    # Run single task
node main.js pageview=example.com then twitterFollow=url  # Sequential task groups

# Strategy game agent
node agent-main.js owb                       # Infinite auto-play
node agent-main.js owb play --loops=10       # Finite loops
node agent-main.js owb play=rush             # With strategy preset
node agent-main.js owb state-a x20           # Run specific state 20 times
```

### Agent Modes (`agent-main.js`)
| Mode | Description |
|------|-------------|
| `play` | Auto-play mode |
| `rush` | Fast attack strategy |
| `turtle` | Defensive strategy |
| `economy` | Resource-focused |
| `balanced` | Mixed strategy |
| `build` | Construction focus |
| `train` | Unit training focus |
| `attack` | Aggressive combat |
| `gather` | Resource collection |
| `state-*` | Run specific game state |

---

## Workflow Reminder

1. **Journal**: Append changes to `AGENT-JOURNAL.md`: `dd-mm-yyy--HH-MM > filename > description`
2. **Lint**: Run `npm run lint` after code changes
3. **Test**: Run `npm run test:coverage` when modifying tests or core modules
4. **Patch Notes**: For major changes, update `patchnotes.md` with summary

---

## Configuration Files

| File | Purpose |
|------|---------|
| `config/settings.json` | Main settings (LLM, humanization, personas) |
| `config/eslint.config.js` | ESLint configuration |
| `config/vitest.config.js` | Vitest test configuration |
| `config/vitest.smoke.config.js` | Smoke test configuration |
| `config/.prettierrc` | Prettier formatting configuration |
| `config/browserAPI.json` | Browser vendor API ports |
| `config/timeouts.json` | Timeout values |

---

## Code Style Conventions

- All console.log statements must start with `[Scriptname]` (e.g., `[orchestrator.js] Starting browser discovery`)
- Browser automation tasks must use `browser.wsEndpoint()` for logging browser context
- Error handling uses try/catch with specific error messages including task names and session IDs
- Dynamic imports for task modules: `import(\`../tasks/${task.taskName}.js\`)`
- Tasks export a default async function: `async function(page, payload)`
- Always use `api.*` methods instead of raw `page.*` calls for humanized interactions

---

## Critical Patterns

### API Context Isolation (Required)

```javascript
// CORRECT - use withPage for all API operations
await api.withPage(page, async () => {
    await api.init(page, { persona: 'casual' });
    await api.goto('https://example.com');
    await api.click('.btn');
});

// AVOID - deprecated, potential context leakage
api.setPage(page);
await api.click('.btn');
```

### Task Module Structure

```javascript
// tasks/myTask.js
export default async function(page, payload) {
    await api.withPage(page, async () => {
        await api.init(page);
        await api.goto(payload.targetUrl);
        // ... task logic
    });
}
```

### Error Handling

```javascript
// Prefer api.recover() and executeWithRecovery
await api.recover(async () => {
    await api.click('.dynamic-element');
});

// Use custom errors for specific cases
import { SessionDisconnectedError } from './api/core/errors.js';
```

---

## API Quick Reference

| Category | Methods |
|----------|---------|
| **Context** | `api.withPage()`, `api.init()`, `api.getPage()` |
| **Actions** | `api.click()`, `api.type()`, `api.hover()`, `api.drag()` |
| **Navigation** | `api.goto()`, `api.reload()`, `api.back()` |
| **Wait** | `api.wait()`, `api.waitFor()`, `api.waitVisible()` |
| **Scroll** | `api.scroll()`, `api.scroll.toTop()`, `api.scroll.read()` |
| **Query** | `api.text()`, `api.attr()`, `api.visible()`, `api.exists()` |
| **Agent** | `api.agent('goal')`, `api.agent.see()`, `api.agent.do()` |
| **Game** | `api.gameAgent.run()`, `api.game.units.*`, `api.game.resources.*` |

---

## Testing

### Test Locations
```
api/tests/
├── unit/           # Unit tests (160+ files)
├── integration/    # Integration tests
├── edge-cases/     # Edge case scenarios
├── fixtures/       # Test fixtures
├── mocks/          # Mock objects
└── utils/          # Test utilities
```

### Vitest Configuration
- **Pool**: `threads` (optimized for parallel execution)
- **Coverage Provider**: Istanbul
- **Coverage Thresholds**: Lines 75%, Branches 70%, Functions 80%, Statements 70%

### Test Module Aliases
| Alias | Path |
|-------|------|
| `@api` | `api/` |
| `@tests` | `api/tests/` |
| `@unit` | `api/tests/unit/` |
| `@integration` | `api/tests/integration/` |
| `@tasks` | `tasks/` |

### Mocking Pattern
```javascript
vi.mock('@api/core/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));
```

---

## Reference Documents

| Document | Description |
|----------|-------------|
| [`.agents/MCP-TOOLS-REFERENCE.md`](.agents/MCP-TOOLS-REFERENCE.md) | MCP Tools usage guidelines |
| [`.agents/PROJECT-STRUCTURE.md`](.agents/PROJECT-STRUCTURE.md) | Codebase map and module descriptions |
| [`.agents/API-ARCHITECTURE.md`](.agents/API-ARCHITECTURE.md) | Unified API patterns and AI routing |
| [`.agents/TESTING-GUIDE.md`](.agents/TESTING-GUIDE.md) | Vitest testing strategy |
| [`.agents/TASK-AND-CONFIG.md`](.agents/TASK-AND-CONFIG.md) | Task system and configuration |
| [`.agents/TECH-STACK.md`](.agents/TECH-STACK.md) | Technology stack details |
| [`.agents/STEALTH-PROTOCOL.md`](.agents/STEALTH-PROTOCOL.md) | Ghost 3.0 anti-detection |

### Agent Skills (`\.agents/skills/`)
Specialized skill directories exist for agent operations including:
- Orchestration patterns
- Debug workflows
- Plan/audit capabilities
- File read/analyze utilities
