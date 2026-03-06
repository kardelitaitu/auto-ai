# Agentic APIs in Auto-AI

This document explains the unified architecture for interacting with the Browser Control LLM within the Auto-AI platform.

## The `api.agent` Interface

The `api.agent` object acts as a dual-callable interface. This means you can use it directly as a function to start high-level autonomous orchestration, or you can access its sub-properties for granular, low-level integration.

### High-Level Orchestration
To instruct the LLM to autonomously achieve a goal:

```javascript
import { api } from './api/index.js';

await api.withPage(page, async () => {
    // Spin up the full perception-action loop
    const result = await api.agent("Find the login button, enter 'user@email.com', and click submit", {
        maxSteps: 10,
        stepDelay: 1000
    });
    
    console.log("Goal achieved:", result.done);
});
```
*Note: This internally calls `agentRunner.run()` which orchestrates the visual processing, reasoning, and execution loop until the goal is achieved or max steps are reached.*

### Low-Level Control (Granular APIs)

If you prefer to manually control the agent's perception and reasoning, you can use the sub-properties attached to `api.agent`.

#### 1. Perception (`api.agent.see`)
Extracts the current state of the page (Accessibility Tree, DOM, and optionally screenshots) and converts it into a semantic map for the LLM.

```javascript
const view = await api.agent.see();
console.log(view); // Contains the interactive elements on the page
```

#### 2. Reasoning (`api.agent.llm`)
Call the LLM directly, providing the view state and asking it to plan the next action based on a specific prompt.

```javascript
const plan = await api.agent.llm.planAction(
    "What should I do to click the search bar?", 
    view
);
console.dir(plan); // { action: 'click', target: 5, reason: '...' }
```

#### 3. Execution (`api.agent.do`)
Execute a specific action string or structure determined by the reasoning phase.

```javascript
// Click element with ID 5
await api.agent.do('click', 5);

// Type into element with ID 2
await api.agent.do('type', 2, 'hello world');
```

#### 4. Additional Utilities
- `api.agent.vision`: Access to raw visual processing tools.
- `api.agent.stop()`: Halt a running autonomous agent process.
- `api.agent.isRunning()`: Check the status of the runner.
- `api.agent.getStats()`: Retrieve usage stats including token consumption.

---

### Configuration Separation
Remember that `api.agent` uses the configurations defined in the `agent` block of `settings.json`. It is distinct from the text-generation `llm.local` configuration, enabling independent selection of models tailored for orchestration versus language generation.
