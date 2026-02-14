# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Tooling (MCP)

Agents are allowed to use MCP tools for filesystem access, code search, web fetch, and diagnostics when available.

## Workflow Reminder

Every time you make changes or modifications, append a new line to AGENTS-JOURNAL.md using this format:
dd-mm-yyy--HH-MM > filename > changes description

## Project Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles (ixBrowser, MoreLogin, Dolphin Anty, Undetectable, etc.) using Playwright's CDP (Chrome DevTools Protocol). It leverages AI (local Ollama/Docker LLMs and cloud OpenRouter) for intelligent decision-making and includes sophisticated human-like behavior patterns to avoid detection.

## Code Style Conventions

- All console.log statements must start with `[Scriptname]` followed by the content (e.g., `[orchestrator.js] Starting browser discovery`)
- Browser automation tasks must use `browser.wsEndpoint()` for logging browser context
- Error handling uses try/catch blocks with specific error messages including task names and session IDs
- Dynamic imports are used for task modules (`import(\`../tasks/${task.taskName}.js\`)`)
- Tasks export a default async function taking browser and payload parameters

## Testing Strategy

- **Framework**: Vitest is used for both unit and integration testing.
- **Running Tests**: Run `npm test` to execute the full test suite.
- **Structure**:
  - `tests/unit/`: Unit tests for individual modules (e.g., `agent-connector.test.js`).
  - `tests/integration/`: Integration tests for cross-module interactions (e.g., `cloud-client.test.js`).
- **Mocks**: Use `vi.mock()` for external dependencies to ensure isolation and speed.

## Project Structure

```
C:\My Script\auto-ai\
├── main.js                    # Main entry point
├── main-browser-use.js        # Alternative entry point
├── package.json               # Project manifest (v0.0.30)
├── AGENTS.md                  # This file
├── CONFIG.md                  # Configuration documentation
├── README.md                  # Quick start guide
├── GEMINI.md                  # Claude/Gemini integration notes
├── VISION-WORKFLOW.md         # Vision processing workflow
├── whitepaper-implementation.md
│
├── core/                      # Core orchestration modules
│   ├── orchestrator.js        # Task queue & parallel execution
│   ├── discovery.js           # Browser discovery via connectors
│   ├── sessionManager.js      # Browser session lifecycle management
│   ├── automator.js           # Playwright CDP connections & health checks
│   ├── agent-connector.js     # AI request router (local vs cloud)
│   ├── intent-classifier.js   # Task complexity analysis & routing
│   ├── local-client.js        # Local LLM (Ollama/Docker) facade
│   ├── cloud-client.js        # OpenRouter cloud LLM interface
│   ├── ollama-client.js       # Ollama-specific implementation
│   ├── vision-interpreter.js  # Vision task processing
│   ├── semantic-parser.js     # Page semantic analysis
│   ├── humanizer-engine.js    # Human-like behavior patterns
│   ├── state-manager.js       # Session state management
│   ├── history-compactor.js   # Context optimization
│   ├── audit-verifier.js      # Task verification
│   ├── idle-ghosting.js       # Idle behavior simulation
│   └── vision-packager.js     # Vision data packaging
│
├── connectors/                # Browser discovery connectors
│   ├── baseDiscover.js        # Base connector class
│   └── discovery/             # Specific browser connectors
│       ├── ixbrowser.js       # ixBrowser integration
│       ├── localChrome.js     # Local Chrome CDP
│       ├── localBrave.js      # Local Brave CDP
│       ├── localEdge.js       # Local Edge CDP
│       ├── localVivaldi.js    # Local Vivaldi CDP
│       ├── roxybrowser.js     # RoxyBrowser API
│       ├── morelogin.js       # MoreLogin API
│       └── undetectable.js    # Undetectable browser API
│
├── tasks/                     # Automation task modules (dynamically loaded)
│   ├── _template.js           # Task template
│   ├── agent.js               # Generic agent task
│   ├── agentNavigate.js       # AI-navigated task
│   ├── twitterActivity.js     # Twitter automation
│   ├── twitterscroll.js       # Twitter scrolling
│   ├── twitterFollow.js       # Twitter following
│   ├── twitterTweet.js        # Tweet posting
│   └── ... more tasks
│
├── utils/                     # Utility modules
│   ├── configLoader.js        # Config file management
│   ├── envLoader.js           # Environment variable loading
│   ├── logger.js              # Logging utility
│   ├── banner.js              # ASCII banner display
│   ├── validator.js           # Task/payload validation
│   ├── retry.js               # Retry logic with exponential backoff
│   ├── apiHandler.js          # HTTP API client
│   ├── metrics.js             # Metrics collection
│   ├── screenshot.js          # Screenshot utilities
│   ├── ghostCursor.js         # Human-like cursor movement
│   ├── randomScrolling.js     # Human-like scrolling
│   ├── randomZoom.js          # Human-like zoom behavior
│   ├── browserPatch.js        # Visibility spoofing
│   ├── profileManager.js      # Profile management
│   ├── entropyController.js   # Randomness for anti-detection
│   ├── dockerLLM.js           # Docker LLM management
│   └── ... more utilities
│
├── tools/                     # Browser extensions and tools
│   └── extension-tco-grabber/ # Twitter Content Observer extension
│
└── config/                    # Configuration files
    ├── settings.json          # Main settings (LLM, humanization, vision)
    ├── browserAPI.json        # Browser API endpoints for 18+ browsers
    └── timeouts.json          # Timeout configurations
```

## Architecture Patterns

### Browser Connection Flow
```
main.js → Orchestrator.startDiscovery() → Discovery.loadConnectors()
         → Discovery.discoverBrowsers() → Each Connector's discover()
         → Automator.connectToBrowser() → SessionManager.addSession()
```

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

## # Auto-AI Codebase Map

This map provides a high-level overview of the project structure, key modules, and their responsibilities to assist LLMs in navigating the codebase.

## 1. Project Root (Entry Points)
- `main.js`: Primary entry point. Initializes the Orchestrator and starts the automation loop.
- `main-browser-use.js`: Alternative entry point using `browser-use` library (experimental).
- `AGENTS.md`: Comprehensive guide for agents (rules, architecture, patterns).
- `CONFIG.md`: Documentation for configuration files.

## 2. Core System (`core/`)
*The "Brain" and "Nervous System" of the framework.*

### Orchestration & Lifecycle
- `orchestrator.js`: Central manager. Handles task queues, worker allocation, and parallel execution across sessions.
  - `startDiscovery(options)`: Starts the browser discovery process via Connectors.
  - `addTask(taskName, payload)`: Adds a new task to the global queue.
  - `processTasks()`: Main loop that assigns tasks to available workers in sessions.
- `sessionManager.js`: Manages browser session lifecycle (start, stop, health checks, persistence).
  - `addSession(browser, info)`: Registers a new connected browser session.
  - `getSession(id)`: Retrieves session object by ID.
  - `startCleanupTimer()`: Periodically cleans up stale sessions.
- `state-manager.js`: Tracks state across sessions.
- `automator.js`: Handles low-level Playwright CDP connections and health monitoring.
  - `connectToBrowser(wsEndpoint)`: Establishes CDP connection with retry logic.
  - `testConnection(browser)`: Verifies if the browser connection is still active.
  - `reconnect(wsEndpoint)`: Attempts to re-establish a dropped connection.
- `discovery.js`: Discovers running browser instances via Connectors.
  - `loadConnectors(allowed)`: Dynamically imports connector modules.
  - `discoverBrowsers()`: Aggregates browser endpoints from all loaded connectors.

### AI & Intelligence
- `agent-connector.js`: Router for AI requests. Decides between Local/Cloud LLMs and handles failover.
  - `processRequest(request)`: Main entry point for AI tasks. Routes to Local or Cloud client based on complexity/availability.
- `intent-classifier.js`: Analyzes task complexity to route to appropriate LLM (Local vs Cloud).
  - `classify(task)`: Determines if a task needs "fast" (local) or "smart" (cloud) processing.
- `local-client.js`: Facade for local LLMs (Ollama/Docker).
- `cloud-client.js`: Interface for OpenRouter/Cloud APIs.
- `vision-interpreter.js`: Processes images/screenshots for visual context.
- `humanizer-engine.js`: Core engine for generating human-like behavior patterns.

## 3. Browser Connectivity (`connectors/`)
*Adapters for different anti-detect browsers.*

- `baseDiscover.js`: Base class for all browser connectors.
  - `discover()`: Abstract method that must be implemented by subclasses to return browser endpoints.
- `discovery/`:
  - `ixbrowser.js`, `morelogin.js`, etc.: Connectors for specific anti-detect browsers. Implement `discover()`.

## 4. Task Modules (`tasks/`)
*Specific jobs that agents perform. Dynamically loaded.*

- `_template.js`: Template for creating new tasks.
- `agent.js`: Generic agent task implementation.
- `ai-twitterActivity.js`: **Critical**. Main task for AI-driven Twitter automation (replies, quotes, engagement).
  - `default function(page, payload)`: Main execution loop. Handles initialization, profile loading, and agent lifecycle.
- `twitterTweet.js`: Task for posting tweets.
- `twitterFollow.js`: Task for following users.

## 5. Utilities & Helpers (`utils/`)
*The Toolbox. Extensive collection of helper modules.*

### AI Components
- `ai-twitterAgent.js`: **Core Logic**. Extends `twitterAgent.js`. Handles split-phase diving (Scan vs AI), queue management, and action execution.
  - `diveTweet(tweetElement)`: Orchestrates the dive process. Splits into Scan Phase (no queue) and AI Phase (queue).
  - `startDive(tweetUrl)`: Initiates the diving logic for a specific tweet.
  - `executeAILogic(context)`: Runs the AI decision/action process inside the `DiveQueue`.
- `ai-context-engine.js`: Extracts and enhances context from tweets (replies, sentiment).
- `ai-reply-engine.js`: Generates replies using AI.
- `async-queue.js`: **New**. Implements `DiveQueue` and `AsyncQueue` to manage concurrency and prevent race conditions.
  - `addDive(taskFn, fallbackFn, options)`: Adds a task to the queue with timeout protection and optional fallback.
  - `_processQueue()`: Internal method to serialize task execution.

### AI Actions (`utils/actions/`)
- `index.js`: `ActionRunner` logic for smart action selection.
  - `selectAction()`: Probabilistically selects the next action (reply, like, quote) based on engagement limits.
  - `executeAction(action, context)`: Routes the execution to the specific action handler.
- `ai-twitter-reply.js`: `execute(agent, context)`: Generates and posts a reply.
- `ai-twitter-quote.js`: `execute(agent, context)`: Generates and posts a quote tweet.

### Humanization & Anti-Detection
- `twitterAgent.js`: Base class for Twitter interactions. Implements 6-layer click strategy and human behaviors.
  - `humanClick(target, description)`: Robust click method with scrolling, pausing, micro-movements, and ghost clicking.
  - `scrollDown()`, `scrollUp()`, `scrollRandom()`: Natural scrolling helpers with variable speed.
- `ghostCursor.js`: Simulates realistic mouse movements.
  - `move(x, y)`: Moves mouse using Bezier curves.
  - `click(selector)`: Human-like click sequence.
- `browserPatch.js`: Spoofs visibility and other browser properties.
  - `applyHumanizationPatch(page)`: Injects scripts to hide automation signals.

## 6. Configuration (`config/`)
- `settings.json`: Main configuration (LLM providers, humanization settings, timeouts).
- `browserAPI.json`: API endpoints for different browser vendors.
- `timeouts.json`: Centralized timeout definitions.

## Key Relationships
1.  **Task Execution**: `main.js` -> `Orchestrator.processTasks()` -> `SessionManager` -> `Task` (e.g., `ai-twitterActivity.js`).
2.  **AI Flow**: `Task` -> `AITwitterAgent.diveTweet()` -> `DiveQueue` -> `AgentConnector` -> `LocalClient`/`CloudClient`.
3.  **Concurrency**: `AITwitterAgent` uses `DiveQueue` (from `async-queue.js`) to serialize AI operations per session, ensuring thread safety during multi-browser runs.


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

- **Mouse Movement**: Variable speed, jitter, Bezier curves (`utils/ghostCursor.js`)
- **Keystroke Dynamics**: Randomized delays, punctuation pauses
- **Scrolling Patterns**: Natural reading rhythm, pauses (`utils/randomScrolling.js`)
- **Idle Behavior**: Periodic mouse wiggles when idle (`core/idle-ghosting.js`)
- **Viewport Spoofing**: Random zoom levels (`utils/randomZoom.js`)
- **Visibility Spoofing**: Navigator and screen property manipulation (`utils/browserPatch.js`)

## Task System

Tasks are dynamically loaded from `tasks/` directory:
- Files export a default async function: `async function(page, payload)`
- Tasks receive a Playwright Page object directly
- Payload contains task-specific parameters + browserInfo
- All tasks follow the template pattern with try/finally blocks

**Example Task Command:**
```bash
node main.js simpleNavigate targetUrl=https://example.com
```

## Configuration Management

Configuration hierarchy:
1. `config/settings.json` - Main settings (LLM, humanization, vision)
2. `config/browserAPI.json` - Browser API endpoints
3. `config/timeouts.json` - Timeout values
4. `.env` file - Environment variables

## Critical Project-Specific Patterns

- Browser connection discovery prioritizes CDP endpoints from local browser APIs (not launching new instances)
- Orchestrator simulates browser discovery in startDiscovery() using Playwright launch for demonstration
- Roxybrowser API requires X-API-Key header for connection_info endpoint
- No linter configuration exists; code style is enforced through manual review
- Package.json test script is placeholder only ("echo \"Error: no test specified\"")

## Phase 1: Race Condition Resolution (COMPLETED)

### 1.1 Async Queue Implementation

**File: `utils/async-queue.js`**

Created a new `AsyncQueue` and `DiveQueue` classes that replace the simple boolean lock with a proper async queue system:

```javascript
// BEFORE: Simple boolean lock (race condition prone)
this.aiReplyLock = true;
try {
    await this._diveTweetWithAI();
} finally {
    this.aiReplyLock = false;
}

// AFTER: Proper async queue (race-condition-free)
this.diveQueue = new DiveQueue({
    maxConcurrent: 3,      // Configurable concurrency
    maxQueueSize: 30,      // Queue capacity
    defaultTimeout: 5000,  // 5s timeout with fallback
    fallbackEngagement: true
});

// Usage:
await this.diveQueue.addDive(
    primaryDiveFn,         // AI processing
    fallbackFn,            // Quick engagement fallback
    { timeout: 5000 }
);
```

**Key Features:**
- **Configurable concurrency**: Max 3 concurrent dives (prevents overload)
- **Automatic timeout**: 5s timeout with immediate fallback engagement
- **Queue management**: Priority queue with size limits
- **Comprehensive stats**: Queue length, active count, utilization

### 1.2 Immediate Fallback Engagement

**Quick Fallback Mode** - When AI pipeline times out:
```javascript
async _quickFallbackEngagement() {
    // Perform basic engagement without AI processing
    const engagementRoll = Math.random();
    if (engagementRoll < 0.4) await this.handleLike();
    else if (engagementRoll < 0.7) await this.handleBookmark();
}
```

**Engagement Limit Tracking** - Dual tracking from both systems:
```javascript
// Check limits from both systems
const canEngage = this.engagementTracker.canPerform('likes') && 
                  this.diveQueue.canEngage('likes');

// Record in both systems
this.engagementTracker.record('likes');
this.diveQueue.recordEngagement('likes');
```

**Quick Mode for Cooldown**:
```javascript
// Enable quick mode during cooldown (faster timeouts)
if (this.isInCooldown() && !this.quickModeEnabled) {
    this.diveQueue.enableQuickMode();  // 3s timeout instead of 5s
    this.quickModeEnabled = true;
}
```

### Files Modified

| File | Changes |
|------|---------|
| `utils/async-queue.js` | New file - AsyncQueue and DiveQueue classes |
| `utils/ai-twitterAgent.js` | Replaced boolean lock with DiveQueue, added fallback engagement |
| `tasks/ai-twitterActivity.js` | Added dive queue status logging |

### Expected Improvements

- **Race Conditions**: Eliminated (queue instead of boolean lock)
- **Concurrent Processing**: Up to 3 dives simultaneously
- **Error Recovery**: 90% faster fallback engagement
- **Engagement Limits**: Dual tracking prevents over-engagement

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

### Alternative Names
- Step-by-step flow diagram
- Sequential flow chart
- Vertical process flow

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
```javascript
// OLD - Direct scrolling (won't use multiplier):
await page.mouse.wheel(0, 300);

// NEW - Using scroll helper (applies multiplier):
import { scrollDown, scrollUp, scrollRandom } from './utils/scroll-helper.js';

await scrollDown(page, 300);
await scrollUp(page, 200);
await scrollRandom(page, 150, 300);
```

**Affects All Scroll Operations:**
- Reply reading scrolls
- Quote context gathering
- Timeline navigation
- Tweet diving
- Humanization behaviors

**Anti-Detection:** Vary the multiplier per session by changing `config/settings.json` before starting the agent.
