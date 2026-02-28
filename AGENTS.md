# AGENTS.md

# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Codebase Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles (ixBrowser, MoreLogin, Dolphin Anty, Undetectable, etc.) using Playwright's CDP (Chrome DevTools Protocol). It leverages AI (local Ollama/Docker LLMs and cloud OpenRouter) for intelligent decision-making and includes sophisticated human-like behavior patterns to avoid detection.

## Workflow Reminder

1. Every time you make changes or modifications, append a new line to `AGENT-JOURNAL.md` using this format: `dd-mm-yyy--HH-MM > filename > changes description`
2. NEVER delete lines on `AGENT-JOURNAL.md`
3. Always check 'npx eslint .' after doing large code changes
4. If we do a lot of files modifications, append `summarized patch notes` on `patchnotes.md`
5. Note: When editing test files, run the test suite to ensure no regressions. Run `npx vitest run --coverage --silent --reporter=dot tests/unit/api/` as a baseline check.

## Code Style Conventions

- All console.log statements must start with `[Scriptname]` followed by the content (e.g., `[orchestrator.js] Starting browser discovery`)
- Browser automation tasks must use `browser.wsEndpoint()` for logging browser context
- Error handling uses try/catch blocks with specific error messages including task names and session IDs
- Dynamic imports are used for task modules (`import(\`../tasks/${task.taskName}.js\`)`)
- Tasks export a default async function taking browser and payload parameters

## Vitest Testing Strategy

- **Framework**: Vitest is used for both unit and integration testing.
- **Running Tests**: Run `npm run test:coverage` to execute the full test suite.
- **Test Individual Files**:

```powershell
npm run test:coverage -- file1.test.js file2.test.js | Select-String -Pattern "%|file1|file2"
```

```bash
npm run test:coverage -- tests/unit/async-queue.test.js 2>&1 | grep -E "(async-queue|% coverage|Branch|Statement|Line|Function)" | head -20
```

- **Coverage**: Aim for 90%+ code coverage using Vitest's built-in coverage reporter.
- **Structure**:
  - `tests/unit/`: Unit tests for individual modules (e.g., `agent-connector.test.js`).
  - `tests/integration/`: Integration tests for cross-module interactions (e.g., `cloud-client.test.js`).
- **Mocks**: Use `vi.mock()` for external dependencies to ensure isolation and speed.

## MCP Tools Usage Guidelines

You have access to a specific set of tools. You must use the most appropriate tool for the task to save resources and ensure accuracy.

### Reasoning & Memory
* **Sequential Thinking (Use when you face a complex, multi-step problem (e.g., debugging a race condition, planning a new feature architecture.))**:
    * **Action:** Break down your thought process into steps before writing any code.
    * **Note:** Sometimes i turned this tool off, if LLM endpoints is unresponsive.
* **Memory (Use when you need to remember user preferences, project-specific facts, or architectural decisions for *future* conversations.)**:
    * `Memory_create_entities` : Create multiple new entities in the knowledge graph
    * `Memory_create_relations` : Create multiple relations between entities
    * `Memory_add_observations` : Add new observations to existing entities
    * `Memory_delete_entities` : Delete entities and their relations
    * `Memory_delete_observations` : Delete specific observations from entities
    * `Memory_delete_relations` : Delete relations from the graph
    * `Memory_read_graph` : Read the entire knowledge graph
    * `Memory_search_nodes` : Search nodes by query (matches name, type, observations)
    * `Memory_open_nodes` : Open specific entities by their names
* **context7 (Upstash) (Use when you need to retrieve high-volume SDK documentation or code examples that doesn't fit in the standard "Memory" graph.)**:
    * `context7_resolve-library-id` : Resolve a package/library name to Context7-compatible library ID  (e.g., "react", "express")
    * `context7_query-docs` : Query documentation and code examples from Context7
* **code-index (Use when you are exploring the codebase and don't know where files are located. (e.g., "Where is the authentication logic?").)**:
    * `code-index_find_files` : Find files matching glob patterns (e.g., *.js, test_*.ts)
    * `code-index_search_code_advanced` : Search code patterns using regex with fuzzy matching, case sensitivity, file filtering
    * `code-index_get_file_summary` : Get file summary including line count, function/class definitions, imports, complexity metrics
* **filesystem (Use when you need to read full file contents or write changes to the disk.)**:
    * `filesystem_read_text_file` : Read complete file as text (supports head/tail for partial reads)
    * `filesystem_read_multiple_files` : Read multiple files simultaneously
    * `filesystem_write_file` : Create or overwrite file (supports append mode)
    * `filesystem_edit_file` : Make line-based edits with diff output
    * `filesystem_create_directory` : Create directory (supports nested)
    * `filesystem_move_file` : Move or rename files
    * `filesystem_list_directory` : List files (with depth parameter)
    * `filesystem_list_directory_with_sizes` : List files with sizes
    * `filesystem_directory_tree` : Get recursive tree view (JSON)
* **File Context Server (Use when you need to list files, get a directory overview, or manage the active file context efficiently)**:
    * `File_Context_Server_read_context` : Read and analyze code files with advanced filtering and chunking
    * `File_Context_Server_get_chunk_count` : Get total chunks for large files
    * `File_Context_Server_set_profile` : Set active profile for context generation
    * `File_Context_Server_get_profile_context` : Get repository context based on profile settings
    * `File_Context_Server_generate_outline` : Generate file outline showing classes, functions, imports
* **Tavily (Use when you need deep, complex research (e.g., "Find the latest documentation for Vercel AI SDK 3.0" or "Compare 3 different libraries").)**:
    * `Tavily_tavily-search` : Search with AI for comprehensive, real-time results
    * `Tavily_tavily-extract` : Extract and parse raw content from URLs
* **DuckDuckGo Search Server (Use when you need a quick fact check or need to find a specific URL (e.g., "What is the URL for the React docs?").)**:
    * `DuckDuckGo_Search_Server_search` : Search DuckDuckGo and return formatted results
    * `DuckDuckGo_Search_Server_fetch_content` : Fetch and parse content from a webpage URL
* **Fetch (Use when you have a specific URL (found via Search) and need to read its content.)**:
    * `Fetch_fetch` : Fetch URL content with format options (markdown/text/html)
* **Desktop Commander (Use when you need to interact with the OS UI (e.g., take a screenshot to verify a UI layout). *Use with caution.*)**:
    * `Desktop_Commander_get_config` : Get complete server configuration as JSON
    * `Desktop_Commander_set_config_value` : Set a specific configuration value by key
    * `Desktop_Commander_read_file` : Read file contents (supports PDF, Excel, DOCX, images)
    * `Desktop_Commander_read_multiple_files` : Read multiple files simultaneously
    * `Desktop_Commander_write_file` : Write or append to file contents
    * `Desktop_Commander_write_pdf` : Create or modify PDF files
    * `Desktop_Commander_create_directory` : Create new directory
    * `Desktop_Commander_move_file` : Move or rename files
    * `Desktop_Commander_list_directory` : List files with depth parameter
    * `Desktop_Commander_start_search` : Start streaming search (files or content)
    * `Desktop_Commander_get_more_search_results` : Get search results with pagination
    * `Desktop_Commander_stop_search` : Stop active search
    * `Desktop_Commander_list_searches` : List all active searches
    * `Desktop_Commander_get_file_info` : Get file metadata (size, dates, permissions, line count)
    * `Desktop_Commander_edit_block` : Apply surgical edits to files
    * `Desktop_Commander_start_process` : Start terminal process (Python, Node, etc.)
    * `Desktop_Commander_read_process_output` : Read output from running process
    * `Desktop_Commander_interact_with_process` : Send input to running process
    * `Desktop_Commander_force_terminate` : Force terminate terminal session
    * `Desktop_Commander_list_sessions` : List all active terminal sessions
    * `Desktop_Commander_list_processes` : List running processes
    * `Desktop_Commander_kill_process` : Terminate process by PID
    * `Desktop_Commander_get_usage_stats` : Get usage statistics
    * `Desktop_Commander_get_recent_tool_calls` : Get recent tool call history
    * `Desktop_Commander_get_prompts` : Retrieve onboarding prompts

---

## Project Structure & Codebase Map

This section provides a high-level overview of the project structure, key modules, and their responsibilities to assist LLMs in navigating the codebase.

### Tree View
```
C:\My Script\auto-ai\
├── main.js                    # Main entry point (CLI)
├── main-browser-use.js           # Alternative entry point (browser-use library)
├── package.json                  # Project manifest & scripts
├── AGENTS.md                     # This file (Rules & Architecture) 
├── CONFIG.md                     # Configuration documentation
├── README.md                     # Quick start guide
├── vitest.config.js              # Test configuration (pool: 'forks')
├── eslint.config.js              # Linter configuration
│
├── api/                       # Unified API (New Architecture)
│   ├── index.js                  # Primary exports (api.goto, api.scroll, etc.)
│   ├── agent/                    # AI agent components (executor, finder, observer)
│   ├── behaviors/                # Human-like behaviors (attention, idle, persona)
│   ├── core/                     # System core (context, events, hooks, logger)
│   ├── interactions/             # User actions (actions, cursor, navigation, scroll)
│   ├── utils/                    # Internal API utilities (fingerprint, math, timing)
│   └── _api-overview.md          # Detailed API documentation
│
├── core/                      # Legacy/Orchestrator Core
│   ├── orchestrator.js           # Task queue & parallel execution management
│   ├── discovery.js              # Browser endpoint discovery via connectors
│   ├── sessionManager.js         # Browser session lifecycle & health
│   ├── automator.js              # Playwright CDP connections & monitoring
│   ├── agent-connector.js        # AI request router (Local/Cloud failover)
│   ├── intent-classifier.js      # Task complexity analysis
│   └── ... humanizer, vision, state-manager (legacy)
│
├── connectors/                # Browser Discovery Connectors
│   ├── baseDiscover.js           # Base class for all adapters
│   └── discovery/                # Specific adapters (ixbrowser, morelogin, etc.)
│
├── tasks/                     # Modular Automation Tasks
│   ├── ai-twitterActivity.js     # Main AI driving loop for Twitter
│   ├── twitterFollow.js          # Isolated following task
│   └── twitterTweet.js           # Isolated tweeting task
│
├── utils/                     # Legacy/Shared Utilities
│   ├── async-queue.js            # Per-session execution serialization
│   ├── ghostCursor.js            # Human-like mouse movement physics
│   └── ... config, env, logger helpers
│
├── tests/                     # Test Suite
│   ├── unit/                     # Unit tests (mirrors source structure)
│   └── integration/              # End-to-end integration scenarios
│
├── config/                    # Static Configuration
│   ├── settings.json             # Global LLM/Humanization settings
│   └── browserAPI.json           # Browser vendor API ports/endpoints
│
└── tools/                     # Extensions & Sidecar tools
    └── extension-tco-grabber/    # Twitter Content Observer
```

### 1. Project Root (Entry Points)
- `main.js`: Primary entry point. Initializes the Orchestrator and starts the automation loop.
- `main-browser-use.js`: Alternative entry point using `browser-use` library (experimental).
- `AGENTS.md`: Comprehensive guide for agents (rules, architecture, patterns).
- `CONFIG.md`: Documentation for configuration files.
- `vitest.config.js`: **Critical**. Uses `pool: 'forks'` to ensure `AsyncLocalStorage` stability during API tests.

### 2. Unified API (`api/`)
*The modern foundation for all interactions. Preferred for all new development.*
- `index.js`: Exports the `api` object. Usage: `api.goto()`, `api.wait()`, `api.scroll.read()`.
- `core/context.js`: Manages session isolation and page tracking via `contextStore`.
- `behaviors/persona.js`: Implements the 16-profile persona system for unique interaction signatures.

### 3. Core System (`core/`) [LEGACY]
- `orchestrator.js`: Manages task queueing (being superseded by modular tasks).
- `discovery.js`: Handles multi-browser port detection.
- `sessionManager.js`: **Legacy**. Use `api/core/context.js` for session-aware logic.

### 4. Shared Utilities (`utils/`) [LEGACY]
- `ghostCursor.js`: **Deprecated**. Use `api/utils/ghostCursor.js`.
- `async-queue.js`: Internal concurrency management for legacy agents.

---

## Ghost 3.0: Stealth Pillars

The project implements the "Phantom Protocol" (version 0.3.0+) for industry-leading anti-detection. 

1.  **Layer 0 Hardening**: Source-level driver masking via recursive proxy-based `navigator` spoofing and `patch.js`.
2.  **Deep Sensor Spoofing**: Hardened Permissions API and deep `navigator` property spoofing (plugins, memory, hardware).
3.  **Kinetic Interaction**: Fitts's Law motion physics and Physiological Jitter for organic movement.
4.  **Bio-Profiles**: PID-driven "Muscle Models" providing unique per-persona acceleration signatures for every session.
5.  **Semantic Presence**: Visual-Semantic Guards (Obstruction detection) and "Flinch" reactions to moving UI elements.
6.  **Sensory Simulation**: Injection of noisy battery status, network speed, and device orientation mocks.
7.  **Temporal Hygiene**: Performance-aware "Impatience" (Page Lag detection) and session longevity tracking.

### Task Execution Flow
```
main.js → Orchestrator.addTask() → Task Queue
       → Orchestrator.processTasks() → For each session
       → processChecklistForSession() → For each worker
       → executeTask() → Dynamic import of ../tasks/{taskName}.js
```

### AI Request Routing (DAO Architecture)
```
Task → IntentClassifier.classify() → Decision: local vs cloud
       ↓                                            ↓
  LocalClient                              CloudClient
  (Ollama/Docker)                          (OpenRouter)
       ↓                                            ↓
  VisionInterpreter                        AgentConnector
  parseResponse()                          complex reasoning
```

### Connector Pattern
All browser connectors extend `BaseDiscover` and implement:
- `async discover()` - Returns array of `{ws, http, windowName, port, etc.}`

### Context Management & Hygiene
The Unified API uses `AsyncLocalStorage` to manage per-session state (cursor, persona, configuration) without global variables.

#### [DEPRECATED] `api.setPage(page)`
Sets the context for the current synchronous execution tree.
- **Risk**: Potential context leakage in complex parallel execution.
- **Usage**: Only for simple one-off scripts.

#### [RECOMMENDED] `api.withPage(page, async () => { ... })`
Executes a function block within a strictly isolated context.
- **Benefit**: Guaranteed isolation for multi-agent orchestration.
- **Integration**: Automatically binds session-aware logging (loggerContext).

```js
// Standard pattern for tasks
await api.withPage(page, async () => {
    await api.goto('https://twitter.com');
    await api.think('explorer');
    await api.click('[data-testid="login"]');
});
```

## Unified API Architecture

The `api/` directory follows a modular, middleware-driven architecture designed for reliability and humanization.

### Pattern: Lifecycle of an Interaction
↓ `api.init(page, settings)`: Sets up context, applies humanization patches.
↓ `api.goto(url)`: Navigates with smart retry and self-healing.
↓ `api.think(persona)`: Calculates variable delay based on current persona/state.
↓ `api.interactions.*`: Performs the high-level action (scroll, click, type).
↓ `api.verify()`: Confirms the action had the intended effect on the DOM.

### Pattern: Execution with Recovery
All high-level actions use `executeWithRecovery` to automatically handle:
- Element detached from DOM
- Element obscured by overlays
- Page navigation resets
- Unexpected dialogs/popups

## Supported Browsers

| Browser | API Port | Type |
|---------|----------|------|
| ixBrowser | 53200 | Anti-detect |
| MoreLogin | 6699 | Anti-detect |
| AdsPower | 50325 | Anti-detect |
| RoxyBrowser | Env vars | Anti-detect |
| Dolphin Anty | 5050 | Anti-detect |
| Undetectable | 25325 | Anti-detect |
| MultiLogin | 35000 | Anti-detect |
| GoLogin | 36912 | Anti-detect |
| Incogniton | 35000 | Anti-detect |
| Kameleo | 5050 | Anti-detect |
| OctoBrowser | 58888 | Anti-detect |
| NSTBrowser | 60080 | Anti-detect |
| HideMyAcc | 8888 | Anti-detect |
| AntBrowser | 40000 | Anti-detect |
| Local Chrome/Brave/Edge/Vivaldi | Various | Standard browsers |

## Humanization Features

- **Mouse Movement**: Variable speed, jitter, Bezier curves (`api/utils/ghostCursor.js`)
- **Keystroke Dynamics**: Randomized delays, punctuation pauses via `typeText`
- **Scrolling Patterns**: Natural reading rhythm via `api.scroll.read()`
- **Idle Behavior**: Periodic micro-fidgeting when waiting (`api/behaviors/idle.js`)
- **PID Muscle Model**: Individualized movement acceleration per session.
- **Sensor Noise**: Dynamic battery/network/orientation spoofing.

## Testing Strategy

All new development must be verified using **Vitest**.

- **Command**: `npm run test:api` or `npx vitest api/`
- **Configuration**: `vitest.config.js` MUST use `pool: 'forks'`.
- **Reasoning**: Worker processes provide isolation for `AsyncLocalStorage` and prevent global namespace pollution during browser patching.
- **Coverage**: Target >90% line coverage for all interactions and core logic.

## Task System

Tasks are dynamically loaded from `tasks/` directory:
- Files export a default async function: `async function(page, payload)`
- Tasks receive a Playwright Page object directly
- Payload contains task-specific parameters + browserInfo
- All tasks follow the template pattern with try/finally blocks

**Example Task Command:**
```bash
node main.js pageview=https://example.com
node main.js pageview=www.example.com
```

## Configuration Management

Configuration hierarchy:
1. `config/settings.json` - Main settings (LLM, humanization, vision)
2. `config/browserAPI.json` - Browser API endpoints
3. `config/timeouts.json` - Timeout values
4. `.env` file - Environment variables

## Critical Project-Specific Patterns

- **API Precedence**: Always use `api.*` methods instead of raw `page.*` calls for humanized interactions.
- **CDP Stability**: Connection discovery prioritizes existing CDP endpoints via browser vendor APIs.
- **Async Safety**: `api.getCurrentUrl()` and navigation helpers are strictly `async` and must be `await`ed.
- **Lock Management**: Use `DiveQueue` in `utils/async-queue.js` to manage concurrent AI operations.
- **Error Recovery**: Prefer `api.recover()` and `executeWithRecovery` over manual try-catch loops.

## Technology Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 16+ (ES Modules) |
| **Browser Automation** | Playwright 1.56.1 (CDP connections) |
| **Local LLM** | Ollama, Docker model (ai/qwen3-vl:4B) |
| **Cloud LLM** | OpenRouter API (Claude 3.5, GPT-4, etc.) |
| **Configuration** | JSON files + dotenv |
| **Dependencies** | dotenv, playwright (core only) |

## Communication Format

When explaining code flows or processes, use **Flowchart** or **Vertical Flow Diagram**:

### Format Specification
- Top-to-bottom direction with ↓ arrows
- Each step is a separate line
- Shows sequential order of operations
- Simple and linear

### Example
```
Read replies (10-15s with scrolling)
    ↓
Scroll to top: window.scrollTo(0, 0)
    ↓
Wait 500-1000ms (settle)
    ↓
Type reply/quote
```

## Global Scroll Multiplier

All scrolling operations support a configurable multiplier in `config/settings.json`:

```json
"twitter": {
  "timing": {
    "globalScrollMultiplier": 1.0
  }
}
```

### Usage Examples

**Multiplier Values:**
- `0.5` = 50% slower scrolling (more careful)
- `1.0` = Normal speed (default)
- `1.5` = 50% faster scrolling
- `2.0` = Double speed (quick runs)

**Implementation:**
All `api.scroll.*` and `utils/scroll-helper.js` functions automatically apply this multiplier to their base distances and timings.