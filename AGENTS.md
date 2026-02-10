# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

**Auto-AI** is a multi-browser automation framework for orchestrating browser automation across multiple anti-detect browser profiles (ixBrowser, MoreLogin, Dolphin Anty, Undetectable, etc.) using Playwright's CDP (Chrome DevTools Protocol). It leverages AI (local Ollama/Docker LLMs and cloud OpenRouter) for intelligent decision-making and includes sophisticated human-like behavior patterns to avoid detection.

## Code Style Conventions

- All console.log statements must start with `[Scriptname]` followed by the content (e.g., `[orchestrator.js] Starting browser discovery`)
- Browser automation tasks must use `browser.wsEndpoint()` for logging browser context
- Error handling uses try/catch blocks with specific error messages including task names and session IDs
- Dynamic imports are used for task modules (`import(\`../tasks/${task.taskName}.js\`)`)
- Tasks export a default async function taking browser and payload parameters

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

## Key Modules

| Module | File | Responsibility |
|--------|------|----------------|
| Orchestrator | `core/orchestrator.js` | Task queue management, parallel execution across sessions, debouncing |
| SessionManager | `core/sessionManager.js` | Session lifecycle, worker allocation, timeout cleanup, persistence |
| Automator | `core/automator.js` | CDP connections, health checks, reconnection logic |
| Discovery | `core/discovery.js` | Connector loading, parallel browser discovery |
| IntentClassifier | `core/intent-classifier.js` | Analyzes task complexity to route to local/cloud |
| AgentConnector | `core/agent-connector.js` | Routes AI requests, handles failover, vision task processing |
| LocalClient | `core/local-client.js` | Facade for Ollama/Docker LLM |
| CloudClient | `core/cloud-client.js` | OpenRouter API integration |
| VisionInterpreter | `core/vision-interpreter.js` | Builds/parses vision prompts for page analysis |

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
