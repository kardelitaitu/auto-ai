# Core Modules

The core modules provide the foundation for the API, including context management, configuration, error handling, events, hooks, middleware, and plugins.

## Table of Contents

- [Context](#context)
- [Config](#config)
- [Errors](#errors)
- [Events](#events)
- [Hooks](#hooks)
- [Middleware](#middleware)
- [Plugins](#plugins)
- [Init](#init)
- [Lite Mode](#lite-mode)
- [Logger](#logger)

---

## Context

The context module manages session isolation and page tracking via `AsyncLocalStorage`.

### Functions

| Function             | Description                                       |
| -------------------- | ------------------------------------------------- |
| `withPage(page, fn)` | Execute a function within a specific page context |
| `clearContext()`     | Clear the current context                         |
| `isSessionActive()`  | Check if a session is active                      |
| `checkSession()`     | Verify session status                             |
| `getPage()`          | Get the current page object                       |
| `getCursor()`        | Get the cursor object for the current session     |
| `evalPage(code)`     | Execute code in the page context                  |

### Usage

```javascript
import { withPage, getPage, clearContext } from './api/core/context.js';

// Isolated execution
await withPage(page, async () => {
    const currentPage = getPage();
    await currentPage.goto('https://example.com');
});

// Clear context when done
await clearContext();
```

---

## Context State

Manages state sections within the context.

### Functions

| Function                            | Description                     |
| ----------------------------------- | ------------------------------- |
| `getContextState()`                 | Get the entire context state    |
| `setContextState(state)`            | Set the context state           |
| `getStateSection(section)`          | Get a specific section of state |
| `updateStateSection(section, data)` | Update a specific section       |

---

## Config

Configuration management for the API.

### Functions

| Function                 | Description                  |
| ------------------------ | ---------------------------- |
| `config.get(key)`        | Get a configuration value    |
| `config.set(key, value)` | Set a configuration value    |
| `config.load(path)`      | Load configuration from file |
| `config.save(path)`      | Save configuration to file   |

### Configuration Options

```javascript
const configManager = {
    // Humanization settings
    humanization: {
        enabled: true,
        patch: true,
        sensors: true,
    },
    // Agent settings
    agent: {
        provider: 'openrouter',
        model: 'claude-3.5-sonnet',
    },
    // Timing settings
    timing: {
        defaultDelay: 100,
        gaussianNoise: true,
    },
};
```

---

## Errors

Comprehensive error hierarchy for the API.

### Error Classes

| Error Class                  | Description                         |
| ---------------------------- | ----------------------------------- |
| `AutomationError`            | Base error class for all API errors |
| `SessionError`               | Session-related errors              |
| `SessionDisconnectedError`   | Session disconnected                |
| `SessionNotFoundError`       | Session not found                   |
| `SessionTimeoutError`        | Session timeout                     |
| `ContextError`               | Context management errors           |
| `ContextNotInitializedError` | Context not initialized             |
| `PageClosedError`            | Page closed                         |
| `ElementError`               | Element-related errors              |
| `ElementNotFoundError`       | Element not found                   |
| `ElementDetachedError`       | Element detached from DOM           |
| `ElementObscuredError`       | Element obscured by another element |
| `ElementTimeoutError`        | Element wait timeout                |
| `ActionError`                | Action execution errors             |
| `ActionFailedError`          | Action failed                       |
| `NavigationError`            | Navigation errors                   |
| `ConfigError`                | Configuration errors                |
| `LLMError`                   | AI/LLM errors                       |
| `LLMTimeoutError`            | LLM request timeout                 |
| `LLMRateLimitError`          | LLM rate limit exceeded             |
| `LLMCircuitOpenError`        | LLM circuit breaker open            |
| `ValidationError`            | Input validation errors             |

### Usage

```javascript
import { AutomationError, ElementNotFoundError, isErrorCode } from './api/core/errors.js';

try {
    await api.click('.button');
} catch (error) {
    if (isErrorCode(error, 'ELEMENT_NOT_FOUND')) {
        console.log('Element not found, retrying...');
    }
    throw error;
}
```

---

## Events

Event system for API lifecycle hooks.

### Functions

| Function                   | Description                   |
| -------------------------- | ----------------------------- |
| `getAvailableHooks()`      | Get all available event hooks |
| `getHookDescription(hook)` | Get description of a hook     |

### Available Hooks

| Hook              | Description          |
| ----------------- | -------------------- |
| `before:navigate` | Before navigation    |
| `after:navigate`  | After navigation     |
| `before:click`    | Before click action  |
| `after:click`     | After click action   |
| `before:type`     | Before type action   |
| `after:type`      | After type action    |
| `before:scroll`   | Before scroll action |
| `after:scroll`    | After scroll action  |
| `on:detection`    | On bot detection     |
| `on:error`        | On error             |

### Usage

```javascript
import { getAvailableHooks } from './api/core/events.js';

const hooks = getAvailableHooks();
console.log('Available hooks:', hooks);
```

---

## Hooks

Programmatic hooks for extending API behavior.

### Functions

| Function                      | Description                       |
| ----------------------------- | --------------------------------- |
| `createHookWrapper(name, fn)` | Create a hook wrapper             |
| `withErrorHook(fn)`           | Wrap function with error handling |

### Usage

```javascript
import { createHookWrapper, withErrorHook } from './api/core/hooks.js';

const wrapped = createHookWrapper('myHook', async (data) => {
    console.log('Hook called:', data);
});

await withErrorHook(async () => {
    await api.click('.button');
});
```

---

## Middleware

Pipeline-based middleware for intercepting and modifying API actions.

### Functions

| Function                            | Description              |
| ----------------------------------- | ------------------------ |
| `createPipeline(...middleware)`     | Create an async pipeline |
| `createSyncPipeline(...middleware)` | Create a sync pipeline   |
| `loggingMiddleware()`               | Logging middleware       |
| `validationMiddleware()`            | Validation middleware    |
| `retryMiddleware()`                 | Retry middleware         |
| `recoveryMiddleware()`              | Recovery middleware      |
| `metricsMiddleware()`               | Metrics middleware       |
| `rateLimitMiddleware()`             | Rate limiting middleware |

### Usage

```javascript
import { createPipeline, loggingMiddleware, retryMiddleware } from './api/core/middleware.js';

const pipeline = createPipeline(loggingMiddleware(), retryMiddleware({ maxRetries: 3 }));

await pipeline(async (ctx) => {
    await api.click('.button');
}, ctx);
```

---

## Plugins

Extensible plugin system for the API.

### Functions

| Function                 | Description            |
| ------------------------ | ---------------------- |
| `registerPlugin(plugin)` | Register a plugin      |
| `unregisterPlugin(name)` | Unregister a plugin    |
| `enablePlugin(name)`     | Enable a plugin        |
| `disablePlugin(name)`    | Disable a plugin       |
| `listPlugins()`          | List all plugins       |
| `listEnabledPlugins()`   | List enabled plugins   |
| `getPluginManager()`     | Get the plugin manager |
| `loadBuiltinPlugins()`   | Load built-in plugins  |

### Plugin Structure

```javascript
api.plugins.register({
    name: 'auto-logger',
    version: '1.0.0',
    hooks: {
        'before:click': async (selector) => {
            console.log(`[Plugin] Clicking: ${selector}`);
        },
        'after:click': async (selector) => {
            console.log(`[Plugin] Clicked: ${selector}`);
        },
        'on:error': async (error) => {
            console.error(`[Plugin] Error:`, error);
        },
    },
    init: async () => {
        console.log('Plugin initialized');
    },
    destroy: async () => {
        console.log('Plugin destroyed');
    },
});
```

---

## Init

Page initialization and patching.

### Functions

| Function                  | Description                                |
| ------------------------- | ------------------------------------------ |
| `initPage(page, options)` | Initialize a page with patches and persona |
| `diagnosePage(page)`      | Diagnose page state                        |
| `clearLiteMode()`         | Clear lite mode                            |

### Options

```javascript
await api.init(page, {
    persona: 'casual', // Persona name
    personaOverrides: {}, // Override persona values
    patch: true, // Enable detection patching
    humanizationPatch: true, // Enable humanization
    autoInitNewPages: true, // Auto-init new pages
    colorScheme: 'dark', // 'light' or 'dark'
    logger: customLogger, // Custom logger
    sensors: true, // Enable sensor simulation
});
```

---

## Lite Mode

Lite mode is a performance optimization feature that blocks resource-heavy requests to reduce bandwidth usage and memory consumption. It's particularly useful for low-bandwidth environments, automated testing, or when you need pages to load faster by skipping non-essential content.

### What Lite Mode Blocks

When enabled, lite mode intercepts and aborts the following resource types:

| Resource Type | Description                  |
| ------------- | ---------------------------- |
| `image`       | Images (PNG, JPG, GIF, etc.) |
| `media`       | Audio and video content      |
| `font`        | Web fonts (WOFF, TTF, etc.)  |
| `stylesheet`  | CSS stylesheets              |
| `texttrack`   | Video subtitles/captions     |
| `manifest`    | Web app manifests            |

Additionally, it blocks scripts and network requests from known tracking/advertising domains:

- `google-analytics.com`
- `googletagmanager.com`
- `facebook.net`
- `doubleclick.net`
- `amazon-adsystem.com`
- `adnxs.com`
- `quantserve.com`
- `scorecardresearch.com`
- `crashlytics.com`
- `hotjar.com`

### Enabling Lite Mode

Pass `lite: true` when initializing a page:

```javascript
import { initPage } from './api/core/init.js';

// Enable lite mode during initialization
await initPage(page, {
    lite: true,
    persona: 'casual',
    patch: true,
});
```

Or via the unified API:

```javascript
import { api } from './api/index.js';

await api.init(page, { lite: true });
```

### Clearing Lite Mode

Use [`clearLiteMode()`](#functions-1) to remove all resource blocking routes and restore normal page behavior:

```javascript
import { clearLiteMode } from './api/core/init.js';

// Clear lite mode to allow all resources
await clearLiteMode(page);
```

Or via the unified API:

```javascript
import { api } from './api/index.js';

await api.clearLiteMode();
```

### Use Cases

| Scenario                  | Recommendation                             |
| ------------------------- | ------------------------------------------ |
| **Low-bandwidth testing** | Enable lite mode to simulate slow networks |
| **Automated testing**     | Skip images/media for faster test runs     |
| **Progressive loading**   | Load text first, enable resources later    |
| **Memory-constrained**    | Reduce RAM usage on large pages            |
| **Ad/tracker analysis**   | Block trackers to focus on core content    |

### Example: Progressive Loading

```javascript
import { api } from './api/index.js';

// Load page with lite mode for fast initial render
await api.init(page, { lite: true });
await api.goto('https://example.com');

// Wait for critical content to load
await api.wait(2000);

// Clear lite mode to load images and styles
await api.clearLiteMode();

// Wait for full page render
await api.wait(3000);
```

### Functions

| Function              | Description                                   |
| --------------------- | --------------------------------------------- |
| `clearLiteMode(page)` | Remove all lite-mode resource blocking routes |

### Parameters

| Parameter | Type                        | Required | Description                                         |
| --------- | --------------------------- | -------- | --------------------------------------------------- |
| `page`    | `import('playwright').Page` | No       | Page instance. Uses current context if not provided |

### Returns

`Promise<void>` - Resolves when routes are cleared.

---

## Logger

Custom logging utility.

### Functions

| Function                | Description |
| ----------------------- | ----------- |
| `logger.info(message)`  | Info log    |
| `logger.warn(message)`  | Warning log |
| `logger.error(message)` | Error log   |
| `logger.debug(message)` | Debug log   |

### Usage

```javascript
import { logger } from './api/core/logger.js';

logger.info('Starting automation');
logger.error('Failed to click element');
```
