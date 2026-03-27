# API Reference

Complete reference for the Auto-AI API.

## Core Modules

| Module | Description | Key Files |
|--------|-------------|-----------|
| [Context](api.md#context) | Session isolation with AsyncLocalStorage | `api/core/context.js` |
| [Orchestrator](api.md#orchestrator) | Browser discovery and task dispatch | `api/core/orchestrator.js` |
| [Session Manager](api.md#session-manager) | Session lifecycle management | `api/core/sessionManager.js` |
| [Agent](api.md#agent) | AI agent for autonomous decisions | `api/agent/index.js` |

## Importing the API

```javascript
import { api } from './api/index.js';
```

## Main API

### `api.withPage(callback)`

Execute code within an isolated page context.

```javascript
await api.withPage(async (page) => {
    await page.goto('https://example.com');
    const title = await page.title();
    return title;
});
```

### `api.navigate(url)`

Navigate to a URL with human-like behavior.

```javascript
await api.navigate('https://example.com');
```

### `api.click(selector)`

Click an element with human-like mouse movement.

```javascript
await api.click('#submit-button');
```

### `api.type(selector, text)`

Type text with keystroke dynamics.

```javascript
await api.type('input[name="email"]', 'user@example.com');
```

### `api.scroll(direction, amount)`

Scroll the page.

```javascript
await api.scroll('down', 500);
```

## Agent API

### `api.agent.run(prompt)`

Run the AI agent with a prompt.

```javascript
const result = await api.agent.run('Navigate to Twitter and follow @example');
```

### `api.agent.stop()`

Stop the running agent.

```javascript
await api.agent.stop();
```

## Configuration

### Settings

Load configuration:

```javascript
import { config } from './api/utils/config.js';
const settings = config.load();
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Cloud AI API key | - |
| `LOCAL_LLM_ENDPOINT` | Local LLM URL | `http://localhost:11434` |
| `LOCAL_LLM_MODEL` | Local model name | `llama3` |
| `BROWSER_PORT` | Default browser port | `9222` |

## More Information

- [Interactions](interactions.md) - Click, type, scroll, drag
- [Behaviors](behaviors.md) - Humanization, idle, persona
- [Utils](utils.md) - Config, logging, fingerprint
- [Core](core.md) - Orchestrator, session manager, context
