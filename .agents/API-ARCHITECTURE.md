# API Architecture & Patterns

Architecture patterns for the Unified API, task execution, and AI routing.

---

## Core Concepts

### 1. Context Isolation (AsyncLocalStorage)

All API operations are isolated per-session using `AsyncLocalStorage`:

```javascript
// api/core/context.js
import { AsyncLocalStorage } from 'node:async_hooks';

const contextStore = new AsyncLocalStorage();

// Each page gets its own isolated store
await api.withPage(page, async () => {
    // Inside here, api.click() knows which page to use
    await api.click('.btn');
});
```

**Key Pattern**: Always wrap browser operations in `withPage()`:

```javascript
// CORRECT
await api.withPage(page, async () => {
    await api.init(page, { persona: 'casual' });
    await api.goto('https://example.com');
    await api.click('.submit');
});

// AVOID (deprecated)
api.setPage(page);
await api.click('.submit');
```

---

### 2. Task Execution Flow

```
main.js → Orchestrator.addTask()
         → Orchestrator.processTasks()
         → For each browser session:
             → sessionManager.createWorker()
             → Dynamic import of tasks/{taskName}.js
             → Execute task(page, payload)
```

**Task Module Pattern**:

```javascript
// tasks/example.js
export default async function (page, payload) {
    try {
        // Use api for all interactions
        await api.withPage(page, async () => {
            await api.init(page);
            await api.goto(payload.targetUrl);
            // ... task logic
        });
    } finally {
        // Cleanup guaranteed
    }
}
```

---

### 3. AI Request Routing (DAO Architecture)

Tasks are routed to appropriate LLM based on complexity:

```
┌─────────────────────────────────────────────────────────────┐
│                    IntentClassifier                         │
│                  (classify task complexity)                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
   ┌──────────────┐              ┌──────────────┐
   │ LocalClient  │              │ CloudClient  │
   │  (Ollama)    │              │ (OpenRouter) │
   │              │              │              │
   │ Fast & Free  │              │ Powerful     │
   │ Simple tasks │              │ Complex tasks│
   └──────────────┘              └──────────────┘
          │                               │
          ▼                               ▼
   ┌──────────────┐              ┌──────────────┐
   │ VisionInterp │              │AgentConnector│
   │ parseResponse│              │  reasoning   │
   └──────────────┘              └──────────────┘
```

**Routing Logic** (api/core/agent-connector.js):

- **Local LLM** (confidence > 0.7, complexity < 4): Navigation, simple clicks, scrolling
- **Cloud LLM**: Captcha solving, error recovery, complex analysis

---

### 4. Agent Perception-Action Loop

The autonomous agent follows a continuous perception-action cycle:

```
┌─────────────────────────────────────────────────────────────┐
│                    GameRunner.run(goal)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     1. PERCEIVE (agent.see())       │
        │  - Screenshot capture               │
        │  - AXTree extraction                │
        │  - Context compression              │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     2. REASON (llmClient)           │
        │  - Send to LLM with system prompt   │
        │  - Parse JSON response              │
        │  - Validate action                  │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     3. ACT (actionEngine)           │
        │  - Execute with GhostCursor         │
        │  - Human-like timing                │
        │  - Retry on failure                 │
        └─────────────────┬───────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     4. VERIFY (visualDiff)          │
        │  - Compare before/after state       │
        │  - Check DOM changes                │
        │  - Rollback if failed               │
        └─────────────────┬───────────────────┘
                          │
                          ▼
                    (Repeat until done)
```

---

### 5. Middleware Pipeline

Actions pass through a composable middleware stack:

```javascript
// api/core/middleware.js
const pipeline = [
    validateInput, // Check parameters
    preAction, // Before action hooks
    humanizeTiming, // Add realistic delays
    executeAction, // Perform the action
    verifyAction, // Confirm it worked
    postAction, // After action hooks
    logResult, // Record for debugging
];
```

---

### 6. Error Recovery Pattern

All high-level actions use `executeWithRecovery`:

```javascript
await executeWithRecovery(
    async () => {
        await api.click('.dynamic-element');
    },
    {
        maxRetries: 3,
        strategies: [
            'same_action_retry',
            'alternative_selector',
            'wait_and_retry',
            'scroll_and_retry',
        ],
    }
);
```

**Custom Error Types** (api/core/errors.js):

- `ContextNotInitializedError` - `withPage()` not called
- `PageClosedError` - Page closed during operation
- `SessionDisconnectedError` - Browser disconnected
- `TaskTimeoutError` - Task exceeded timeout

---

### 7. Connector Pattern

All browser connectors extend `BaseDiscover`:

```javascript
// connectors/baseDiscover.js
export default class BaseDiscover {
    async discover() {
        // Returns array of:
        // { ws, http, windowName, port, browserName }
    }
}
```

---

### 8. Humanization Layers

Multiple layers of human-like behavior:

```
┌─────────────────────────────────────────────┐
│              GhostCursor                     │
│  - Fitts's Law motion physics               │
│  - Bezier curve paths                       │
│  - Variable speed/acceleration              │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│              Keystroke Timing               │
│  - Random delays between keys               │
│  - Punctuation pauses                       │
│  - Typo simulation (optional)               │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│              Persona System                 │
│  - 16 unique interaction profiles           │
│  - Per-session persona assignment           │
│  - Affects all timing/movement              │
└─────────────────────────────────────────────┘
```

---

## Code Patterns

### Standard Task Entry Point

```javascript
// main.js
import { api } from './api/index.js';

const browser = await connectToBrowser();
const page = await browser.newPage();

await api.withPage(page, async () => {
    await api.init(page, {
        persona: 'focused',
        humanizationPatch: true,
    });

    await api.goto('https://example.com');
    await api.type('#input', 'hello');
    await api.click('#submit');
});
```

### Agent Autonomous Mode

```javascript
import { api } from './api/index.js';
import { gameRunner } from './api/agent/gameRunner.js';

await api.withPage(page, async () => {
    await api.init(page);

    const result = await gameRunner.run('Train 5 units', {
        maxSteps: 50,
        stepDelay: 500,
        stuckDetection: true,
    });
});
```

### Adding New Interactions

```javascript
// api/interactions/myAction.js
import { getPage } from '../core/context.js';
import { actionEngine } from '../agent/actionEngine.js';

export async function myAction(selector, options = {}) {
    const page = getPage(); // Gets current context page
    await actionEngine.execute({
        type: 'custom',
        selector,
        ...options,
    });
}

// Export from api/interactions/actions.js
export { myAction } from './myAction.js';
```
