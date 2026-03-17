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
| `agent-main.js` | Agent entry - strategy game automation |
| `api/index.js` | Unified API export - `import { api } from './api/index.js'` |

---

## Quick Commands

```bash
# Development
npm run lint              # Check code style
npm run lint:fix          # Auto-fix lint issues

# Testing
npm run test:coverage     # Run tests with coverage (recommended)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode for development

# Running
node main.js taskName=url     # Run automation task
node agent-main.js owb play   # Run strategy game agent
```

---

## Workflow Reminder

1. **Journal**: Append changes to `AGENT-JOURNAL.md`: `dd-mm-yyy--HH-MM > filename > description`
2. **Lint**: Run `npm run lint` after code changes
3. **Test**: Run `npm run test:coverage` when modifying tests or core modules
4. **Patch Notes**: For major changes, update `patchnotes.md` with summary

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
