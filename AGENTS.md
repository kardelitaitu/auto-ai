# AGENTS.md

Quick reference guide for agents working on this repository.

> **Detailed guides**: See `.agents/*.md` files for in-depth documentation.

## Codebase Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles using Playwright's CDP (Chrome DevTools Protocol). It leverages AI (local Ollama/Docker LLMs and cloud OpenRouter) for intelligent decision-making and includes sophisticated human-like behavior patterns to avoid detection.

### Context Management Strategy

**Proactively use context-mode tools** to protect context window and improve performance:
- Use `ctx_batch_execute` for 3+ commands or large outputs (>100 lines)
- Use `ctx_execute` for single commands with large output
- Use `ctx_index` for documentation/knowledge content
- Use `ctx_stats` periodically to verify savings
- Skip context-mode for simple commands (git status, ls, single file reads)

---

## Entry Points

| File | Purpose |
|------|---------|
| `main.js` | Browser web automation entry - runs tasks like `pageview`, `follow`, `retweet` |
| `agent-main.js` | Web-based game automation entry (OWB) - strategy game AI agent |
| `api/index.js` | Unified API export - `import { api } from './api/index.js'` |

---

## Quick Commands

### Development
```bash
npm run lint              # Check code style
npm run lint:fix          # Auto-fix lint issues
npm run format            # Format code with Prettier
```

### Testing (Use Bun for ~20-40% faster execution)

**Preferred (Bun):**
```bash
npm run test:bun:unit         # Unit tests with Bun
npm run test:bun:integration  # Integration tests with Bun
npm run test:bun:edge         # Edge case tests with Bun
npm run test:bun:all          # All test suites with Bun
npm run test:bun:coverage     # Coverage report with Bun
npm run test:bun:watch        # Watch mode with Bun
npm run test:bun:verbose      # Verbose output with Bun
```

**Alternative (Node.js):**
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

> **Performance**: Bun runs tests **20-40% faster** than Node.js. Use `test:bun:*` variants for development. Use `test:*` (Node.js) if Bun is unavailable or for CI environments requiring Node.js compatibility.

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

## Git Workflow (Feature Branches)

### Branch Naming Convention
- `feature/<name>` - New features (e.g., `feature/scheduler-queue`)
- `fix/<name>` - Bug fixes (e.g., `fix/navigator-error`)
- `refactor/<name>` - Code refactoring
- `docs/<name>` - Documentation updates

### Workflow
```bash
# 1. Create new branch from main
git checkout -b feature/my-feature

# 2. Make changes, run lint & tests
npm run lint
npm run test:bun:unit

# 3. Push and create PR
git push -u origin feature/my-feature
# Create PR on GitHub, merge after review

# 4. Sync with main
git checkout main
git pull origin main

# 5. Delete merged branch (local)
git branch -d feature/my-feature
```

### Rules
- Always run lint + tests before pushing
- Keep branches small and focused
- Merge to main only via PR (or after testing)
- Delete local/remote branches after merge

---

## Workflow Reminder

1. **Journal**: Append changes to `AGENT-JOURNAL.md`: `dd-mm-yyy--HH-MM > filename > description`
2. **Lint**: Run `npm run lint` after code changes
3. **Test**: Run `npm run test:bun:coverage` when modifying tests or core modules
4. **Patch Notes**: For major changes, update `patchnotes.md` with summary

---

## Installed MCP Tools

This project has the following MCP (Model Context Protocol) tools configured in `opencode.json`:

### Context Management

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **context-mode** | Context window protection - indexes large outputs, keeps raw data in sandbox | `ctx_execute`, `ctx_batch_execute`, `ctx_search`, `ctx_index`, `ctx_stats`, `ctx_doctor` |

**Usage Example:**
```bash
# Run command with automatic indexing
ctx_execute(language: "javascript", code: "console.log('hello')")

# Batch multiple commands and search results
ctx_batch_execute(commands: [...], queries: ["search term"])

# Check context savings
ctx_stats
```

> **Best Practice**: Use `ctx_batch_execute` when running multiple commands that produce large output. Raw data stays in sandbox - only indexed summaries enter context.

### When to Use Context-Mode

Use context-mode tools proactively to protect context window for:

| Scenario | Recommended Tool | Example |
|----------|-----------------|---------|
| **Large command outputs** | `ctx_execute` | Test runs (`npm test`), `git log`, `find` with many results |
| **Multiple commands** | `ctx_batch_execute` | Running lint + tests + coverage in one call |
| **Data processing** | `ctx_batch_execute` | CSV/JSON parsing, log analysis |
| **Search with many results** | `ctx_batch_execute` | `grep` across large codebase with many matches |
| **Documentation indexing** | `ctx_index` | Adding new API docs, README files |
| **Complex workflows** | `ctx_batch_execute` | Multi-step debugging with 3+ commands |

### When NOT to Use Context-Mode

Skip context-mode for:
- **Simple commands** (git status, git diff, ls)
- **Single small file reads** (under 50 lines)
- **Quick queries** (1-2 grep matches expected)
- **Interactive commands** (npm install, npm init)

### Context-Mode Decision Flow

```
Is the output likely > 100 lines?
├─ YES → Use ctx_execute or ctx_batch_execute
└─ NO → Is it a command chain (3+ steps)?
    ├─ YES → Use ctx_batch_execute
    └─ NO → Use regular bash/read tools
```

> **Remember**: Context-mode is opt-in, not automatic. Check `ctx_stats` periodically to verify savings.

---

### File Operations

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **filesystem** | Direct file operations within allowed directories | `filesystem_read_text_file`, `filesystem_write_file`, `filesystem_edit_file`, `filesystem_list_directory`, `filesystem_directory_tree`, `filesystem_get_file_info`, `filesystem_read_multiple_files`, `filesystem_move_file`, `filesystem_create_directory`, `filesystem_search_files` |

**Usage Example:**
```bash
# Read file with optional chunking
filesystem_read_text_file(path: "api/core/context.js", head: 50)

# Surgical line-based edits
filesystem_edit_file(path: "file.js", edits: [{oldText: "...", newText: "..."}])

# Read multiple files in parallel
filesystem_read_multiple_files(paths: ["file1.js", "file2.js"])
```

> **Best Practice**: Use `filesystem_edit_file` for surgical changes, `filesystem_write_file` for complete rewrites. Always verify with `npm run lint` after edits.

---

### Code Analysis

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **tree-sitter** | Advanced code parsing and analysis | Code structure extraction, AST analysis, language-aware search |

**Capabilities:**
- Parse JavaScript, TypeScript, Python, and other languages
- Extract function definitions, class structures, imports/exports
- Find code patterns using AST queries
- Analyze code complexity and dependencies

**Usage Patterns:**
- **Code refactoring**: Identify all usages of a function before renaming
- **Architecture analysis**: Map module dependencies and exports
- **Code review**: Detect potential issues like deep nesting or large functions
- **Documentation**: Auto-generate API docs from code structure

> **Best Practice**: Use tree-sitter for complex code analysis tasks. For simple file content searches, use `grep` instead. tree-sitter provides language-aware parsing which is more accurate for code structure analysis.

---

### Research & Documentation

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **Tavily** | AI-powered deep research for complex queries | `Tavily_tavily-search`, `Tavily_tavily-extract`, `Tavily_tavily-crawl`, `Tavily_tavily-map`, `Tavily_tavily-research` |

**Function Reference:**

| Function | Purpose | Best For |
|----------|---------|----------|
| `Tavily_tavily-search` | AI-powered search with ranked results | Finding information on a topic |
| `Tavily_tavily-extract` | Parse content from specific URLs | Getting full page content from known URLs |
| `Tavily_tavily-crawl` | Deep crawl starting from a URL | Exploring related pages from a starting point |
| `Tavily_tavily-map` | Map site structure from a URL | Understanding website navigation/layout |
| `Tavily_tavily-research` | Comprehensive multi-source research | In-depth analysis requiring multiple sources |

**Usage Examples:**
```bash
# Quick search for information
Tavily_tavily-search(query: "playwright stealth techniques", search_depth: "basic")

# Advanced search with more depth
Tavily_tavily-search(query: "anti-detection browser fingerprints", search_depth: "advanced", max_results: 5)

# Extract content from specific documentation pages
Tavily_tavily-extract(urls: ["https://playwright.dev/docs/api/class-page"], extract_depth: "basic")

# Extract with advanced parsing for complex pages
Tavily_tavily-extract(urls: ["https://example.com/dashboard"], extract_depth: "advanced", include_images: true)

# Map a website's structure
Tavily_tavily-map(url: "https://playwright.dev", max_depth: 2, max_breadth: 10)

# Crawl a site for related content
Tavily_tavily-crawl(url: "https://blog.example.com", max_depth: 3, limit: 50, select_paths: ["/posts/.*"])

# Comprehensive research on a complex topic
Tavily_tavily-research(input: "Compare stealth techniques across Playwright, Puppeteer, and Selenium", model: "pro")
```

> **Best Practice**: Use `Tavily_tavily-search` for most queries, `Tavily_tavily-extract` when you have specific URLs, and `Tavily_tavily-research` for deep analysis. For quick URL lookups, use built-in `webfetch` tool.

---

### Memory & Knowledge Graph

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **Memory** | Persistent knowledge graph for storing facts and relationships | `Memory_create_entities`, `Memory_create_relations`, `Memory_add_observations`, `Memory_search_nodes`, `Memory_read_graph`, `Memory_open_nodes`, `Memory_delete_entities` |

**Usage Example:**
```bash
# Store key decisions
Memory_create_entities(entities: [{name: "ContextIsolation", entityType: "Pattern", observations: ["Use api.withPage() for all API operations"]}])

# Search stored knowledge
Memory_search_nodes(query: "context isolation")
```

> **Best Practice**: Store architectural decisions, debugging insights, and project patterns. Search memory before making similar decisions.

---

### Problem Solving

| Tool | Purpose | Key Functions |
|------|---------|---------------|
| **Sequential Thinking** | Multi-step reasoning for complex problems | `Sequential_Thinking_sequentialthinking` |

**Usage Example:**
```bash
# Plan complex refactoring
Sequential_Thinking_sequentialthinking(
  thought: "Breaking down the refactoring task...",
  totalThoughts: 10,
  nextThoughtNeeded: true
)
```

> **Best Practice**: Use for debugging race conditions, planning architecture changes, complex refactors. Each thought builds on previous insights.

---

### Built-in Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| **read** | Read files from filesystem | `read(filePath: "...", offset: 1, limit: 2000)` |
| **write** | Write/overwrite files | `write(filePath: "...", content: "...")` |
| **edit** | Surgical string replacements | `edit(filePath: "...", oldString: "...", newString: "...")` |
| **grep** | Fast content search | `grep(pattern: "...", path: "...")` |
| **glob** | File pattern matching | `glob(pattern: "**/*.js")` |
| **bash** | Shell commands | `bash(command: "...", description: "...")` |
| **task** | Launch sub-agents | `task(description: "...", prompt: "...", subagent_type: "general")` |
| **question** | Ask user questions | `question(questions: [{question: "...", header: "...", options: [...]}])` |
| **webfetch** | Fetch URL content | `webfetch(url: "...", format: "markdown")` |

> **Important**: Prefer `filesystem_*` tools over `read`/`write`/`edit` for file operations. Use `bash` for simple commands, `ctx_batch_execute` for complex multi-command workflows (3+ commands or large output expected).

---

### Tool Selection Decision Matrix

**When to use each tool type:**

| Task | Primary Tool | Secondary Option | Avoid |
|------|--------------|------------------|-------|
| Find files by name | `glob` | `filesystem_search_files` | `bash ls` |
| Search file contents | `grep` | `ctx_batch_execute` with grep | `bash grep` |
| Read small file (<50 lines) | `filesystem_read_text_file` | `read` | `bash cat` |
| Read large file (>50 lines) | `filesystem_read_text_file(head/tail)` | `ctx_execute_file` | Full file read |
| Edit specific lines | `filesystem_edit_file` | `write` for complete rewrite | `bash sed` |
| Run single command | `bash` | | |
| Run 3+ commands | `ctx_batch_execute` | Multiple `bash` calls | |
| Simple URL lookup | `webfetch` | | Tavily |
| Research a topic | `Tavily_tavily-search` | `Tavily_tavily-research` | `webfetch` |
| Analyze code structure | `tree-sitter` | `grep` for simple patterns | |
| Store knowledge | `Memory_create_entities` | | |
| Complex reasoning | `Sequential_Thinking` | | |

> **Remember**: Context-mode is opt-in, not automatic. Check `ctx_stats` to verify context savings.

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

### Test Runner
**Bun** is the preferred test runner for this project:
- **20-40% faster** than Node.js
- Use `npm run test:bun:*` commands for all test operations
- Vitest runs inside Bun for compatibility with existing test patterns

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
