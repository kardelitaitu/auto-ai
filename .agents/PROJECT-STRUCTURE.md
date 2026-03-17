# Project Structure & Codebase Map

Actual structure and module responsibilities for the Auto-AI framework.

## Directory Overview

```
C:\My Script\auto-ai\
├── main.js                    # CLI entry point
├── agent-main.js              # Agent/strategy game entry point
├── package.json               # Project manifest & scripts
├── vitest.config.js           # Test config (pool: 'forks' for AsyncLocalStorage)
├── eslint.config.js           # Linter rules
│
├── api/                       # Unified API (Modern Architecture)
│   ├── index.js               # Main export: `import { api } from './api/index.js'`
│   ├── index.d.ts             # TypeScript definitions
│   ├── _api-overview.md       # Detailed API documentation
│   │
│   ├── agent/                 # AI Agent System
│   │   ├── index.js           # Agent entry point
│   │   ├── gameRunner.js      # Autonomous game automation
│   │   ├── llmClient.js       # LLM communication (OpenRouter/Local)
│   │   ├── actionEngine.js    # Action execution with humanization
│   │   ├── executor.js        # Task execution logic
│   │   ├── finder.js          # Element finding strategies
│   │   ├── observer.js        # Page state observation
│   │   ├── vision.js          # Visual perception
│   │   └── ... (retry, caching, context management)
│   │
│   ├── core/                  # Core Infrastructure
│   │   ├── context.js         # AsyncLocalStorage session isolation
│   │   ├── context-state.js   # Session state management
│   │   ├── orchestrator.js    # Task queue & parallel execution
│   │   ├── discovery.js       # Browser endpoint detection
│   │   ├── sessionManager.js  # Browser session lifecycle
│   │   ├── automator.js       # Playwright CDP connections
│   │   ├── agent-connector.js # AI request router (Local/Cloud)
│   │   ├── cloud-client.js    # OpenRouter API client
│   │   ├── local-client.js    # Ollama/Docker LLM client
│   │   ├── logger.js          # Logging with context binding
│   │   ├── middleware.js       # Request middleware pipeline
│   │   ├── events.js          # Event system
│   │   ├── hooks.js           # Lifecycle hooks
│   │   └── plugins/           # Plugin system
│   │
│   ├── interactions/          # User Actions
│   │   ├── actions.js         # Main action exports
│   │   ├── cursor.js          # Mouse movement (GhostCursor)
│   │   ├── navigation.js      # Page navigation
│   │   ├── scroll.js          # Scrolling operations
│   │   ├── wait.js            # Wait conditions
│   │   ├── clickAt.js         # Coordinate clicking
│   │   ├── drag.js            # Drag operations
│   │   ├── keys.js            # Keyboard input
│   │   ├── multiSelect.js     # Multi-select operations
│   │   ├── game-units.js      # Game unit selection
│   │   ├── gameMenus.js       # Game menu automation
│   │   └── resourceTracker.js # Game resource monitoring
│   │
│   ├── behaviors/             # Human-like Behaviors
│   │   ├── persona.js         # 16-profile persona system
│   │   ├── idle.js            # Idle micro-movements
│   │   └── attention.js       # Attention simulation
│   │
│   ├── utils/                 # API Utilities
│   │   ├── ghostCursor.js     # Mouse movement physics
│   │   ├── fingerprint.js     # Browser fingerprint utils
│   │   ├── math.js            # Math utilities
│   │   └── timing.js          # Timing functions
│   │
│   ├── actions/               # High-Level Actions
│   │   ├── ai-twitter-*.js    # AI-powered Twitter actions
│   │   └── ... (like, follow, retweet, etc.)
│   │
│   ├── twitter/               # Twitter-specific Logic
│   │   └── intent-*.js        # Intent classification
│   │
│   └── ui/                    # User Interface
│       └── electron-dashboard/ # Electron dashboard app
│
├── connectors/                # Browser Discovery
│   ├── baseDiscover.js        # Base adapter class
│   └── discovery/             # Specific adapters
│       ├── ixbrowser.js
│       ├── morelogin.js
│       ├── dolphin.js
│       └── ...
│
├── tasks/                     # Automation Tasks
│   ├── api-twitterActivity.js # Twitter AI driving loop
│   ├── pageview.js            # Page view task
│   ├── cookiebot.js           # Cookie handling
│   └── owb.js                 # Strategy game task
│
├── utils/                     # Legacy Utilities
│   ├── async-queue.js         # Per-session serialization
│   ├── ghostCursor.js         # Deprecated - use api/utils/
│   ├── config.js              # Config loader
│   └── scroll-helper.js       # Scroll utilities
│
├── config/                    # Configuration
│   ├── settings.json          # Main settings (LLM, humanization)
│   ├── browserAPI.json        # Browser vendor ports
│   └── timeouts.json          # Timeout values
│
├── tests/                     # Test Suite
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
│
└── .agents/                   # Agent Documentation
    └── *.md                   # Reference files (this doc, etc.)
```

---

## Module Purposes

### API Entry (`api/index.js`)

The main export that assembles all modules:

```javascript
import { api } from './api/index.js';

await api.withPage(page, async () => {
    await api.init(page, { persona: 'casual' });
    await api.click('.btn');
    await api.type('.input', 'hello');
});
```

**Key exports**: `api.init()`, `api.click()`, `api.type()`, `api.scroll.*`, `api.goto()`, `api.wait()`, `api.gameAgent`, `api.file.*`

---

### Core Context (`api/core/context.js`)

Session isolation using `AsyncLocalStorage`:

- Manages per-session state (cursor, persona, configuration)
- Prevents global namespace pollution
- Provides `withPage()` for isolated execution blocks
- Caches session stores via WeakMap

---

### Agent System (`api/agent/`)

Autonomous AI agent for browser automation:

| Module | Purpose |
|--------|---------|
| `gameRunner.js` | Main autonomous loop for strategy games |
| `llmClient.js` | LLM communication (OpenRouter/Ollama) |
| `actionEngine.js` | Execute actions with GhostCursor humanization |
| `vision.js` | Screenshot analysis and visual perception |
| `executor.js` | Task execution with retry logic |
| `responseValidator.js` | Validate LLM responses |
| `confidenceScorer.js` | Score action confidence |
| `historyManager.js` | Manage conversation history |
| `contextCompressor.js` | Compress AXTree for LLM context |

---

### Interactions (`api/interactions/`)

High-level user actions with humanization:

| Module | Purpose |
|--------|---------|
| `actions.js` | Main action exports |
| `cursor.js` | Mouse movement with GhostCursor |
| `navigation.js` | Page navigation with retry |
| `scroll.js` | Natural scrolling patterns |
| `wait.js` | Wait conditions (network, element, etc.) |

---

### Connectors (`connectors/`)

Browser discovery adapters:

```javascript
// All extend BaseDiscover
class IxBrowserDiscover extends BaseDiscover {
    async discover() {
        // Returns [{ws, http, windowName, port, ...}]
    }
}
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `config/settings.json` | LLM endpoints, humanization settings, personas |
| `config/browserAPI.json` | Browser vendor API ports |
| `.env` | OpenRouter API key, local LLM config |

---

## Testing

- **Framework**: Vitest with `pool: 'forks'`
- **Command**: `npm run test:coverage`
- **Location**: `tests/unit/` and `tests/integration/`
