# Agent

The agent module provides an AI-powered interaction layer designed for LLMs to interact with pages semantically rather than using complex selectors.

## Table of Contents

- [Overview](#overview)
- [Observer](#observer)
- [Executor](#executor)
- [Finder](#finder)
- [Vision](#vision)
- [Runner](#runner)
- [LLM Client](#llm-client)
- [Action Engine](#action-engine)

---

## Overview

The agent system enables semantic interactions with web pages using natural language descriptions instead of CSS selectors. It provides:

- **Semantic Mapping**: Get a compact view of interactive elements with IDs and Labels
- **Natural Actions**: Act on elements using labels or descriptions
- **Visual Understanding**: Screenshot analysis with optional annotations
- **LLM Integration**: Full LLM-driven automation when needed

---

## Observer

Gets a semantic map of interactive elements on the page.

### Functions

| Function       | Description                                  |
| -------------- | -------------------------------------------- |
| `see()`        | Returns compact list of interactive elements |
| `see(options)` | Get view with custom options                 |

### See Options

```javascript
{
    verbose: false,      // Include more details
    maxElements: 50,    // Maximum elements to return
    includeHidden: false // Include hidden elements
}
```

### Element View Structure

```javascript
{
    id: 'login-button',
    label: 'Login',
    role: 'button',
    tag: 'button',
    text: 'Log In',
    href: null,
    placeholder: null,
    visible: true,
    enabled: true,
    x: 100,
    y: 200
}
```

### Usage

```javascript
// Get semantic map
const view = await api.agent.see();

// Iterate over interactive elements
for (const el of view) {
    console.log(`[${el.id}] ${el.label} (${el.role})`);
}

// Verbose mode
const detailed = await api.agent.see({ verbose: true });
```

---

## Executor

Executes actions on elements using IDs or Labels.

### Functions

| Function                    | Description               |
| --------------------------- | ------------------------- |
| `do(action, target, value)` | Execute action on element |

### Actions

| Action    | Description        | Value        |
| --------- | ------------------ | ------------ |
| `click`   | Click element      | -            |
| `type`    | Type text          | text string  |
| `hover`   | Hover over element | -            |
| `focus`   | Focus element      | -            |
| `select`  | Select option      | option value |
| `check`   | Check checkbox     | -            |
| `uncheck` | Uncheck checkbox   | -            |
| `submit`  | Submit form        | -            |

### Usage

```javascript
// Click by label
await api.agent.do('click', 'Login');

// Click by ID
await api.agent.do('click', 'login-button');

// Type by label
await api.agent.do('type', 'Username', 'myuser');

// Hover by label
await api.agent.do('hover', 'Menu');

// Select option
await api.agent.do('select', 'Country', 'US');
```

---

## Finder

Locates elements based on fuzzy text descriptions.

### Functions

| Function                     | Description                 |
| ---------------------------- | --------------------------- |
| `find(description)`          | Find element by description |
| `find(description, options)` | Find with options           |

### Usage

```javascript
// Find by description
const element = await api.agent.find('login button');
console.log('Found:', element.id);

// Find with options
const searchBox = await api.agent.find('search input', {
    fuzzy: true,
    caseSensitive: false,
});
```

---

## Vision

Screenshot capture and analysis.

### Functions

| Function              | Description                          |
| --------------------- | ------------------------------------ |
| `screenshot(options)` | Capture screenshot                   |
| `annotate(elements)`  | Annotate screenshot with element IDs |

### Screenshot Options

```javascript
{
    type: 'png',           // 'png' or 'jpeg'
    quality: 80,          // JPEG quality
    fullPage: false,      // Capture full page
    annotate: false,       // Annotate with element IDs
    highlight: []         // Elements to highlight
}
```

### Usage

```javascript
// Basic screenshot
const screenshot = await api.agent.screenshot();

// Screenshot as base64
const base64 = await api.agent.screenshot({
    type: 'png',
});

// Annotated screenshot
const annotated = await api.agent.screenshot({
    annotate: true,
    highlight: ['login-button', 'username'],
});
```

---

## Runner

Full LLM-driven agent for complex automation tasks.

### Functions

| Function            | Description               |
| ------------------- | ------------------------- |
| `run(goal, config)` | Run agent with goal       |
| `stop()`            | Stop running agent        |
| `isRunning()`       | Check if agent is running |
| `getStats()`        | Get usage statistics      |

### Runner Config

```javascript
{
    model: 'claude-3.5-sonnet',  // LLM model
    provider: 'openrouter',      // LLM provider
    maxSteps: 20,               // Max steps per run
    timeout: 300000,            // Timeout in ms
    verbose: true,              // Verbose output
    headless: false            // Show browser
}
```

### Usage

```javascript
// Run LLM-driven task
await api.agent.run('Search for "AI news" and click the first result', {
    model: 'claude-3.5-sonnet',
    maxSteps: 10,
});

// Check status
if (await api.agent.isRunning()) {
    console.log('Agent is running...');
}

// Get stats
const stats = await api.agent.getStats();
console.log('Steps:', stats.steps);
console.log('Tokens:', stats.tokens);

// Stop agent
await api.agent.stop();
```

---

## LLM Client

Direct LLM interaction for custom prompts.

### Functions

| Function                    | Description              |
| --------------------------- | ------------------------ |
| `complete(prompt)`          | Complete prompt with LLM |
| `complete(prompt, options)` | Complete with options    |

### Usage

```javascript
// Simple completion
const response = await api.agent.llm.complete('What is on the page?');

// With options
const response = await api.agent.llm.complete('Summarize this page', {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 500,
});
```

---

## Action Engine

Low-level action execution engine.

### Functions

| Function                              | Description                |
| ------------------------------------- | -------------------------- |
| `execute(action, target, value)`      | Execute action             |
| `executeAsync(action, target, value)` | Execute async              |
| `captureAXTree()`                     | Capture accessibility tree |
| `captureState()`                      | Capture full page state    |

### Usage

```javascript
// Capture AX Tree
const tree = await api.agent.engine.captureAXTree();
console.log('AX Tree:', tree);

// Capture state
const state = await api.agent.engine.captureState();
console.log('State:', state);
```

---

## Complete Agent Example

```javascript
await api.withPage(page, async () => {
    await api.init(page, { persona: 'researcher' });
    await api.goto('https://twitter.com');

    // Get semantic view
    const view = await api.agent.see();

    // Click login by label
    await api.agent.do('click', 'Login');

    // Wait for form
    await api.waitVisible('#username');

    // Type credentials
    await api.agent.do('type', 'Username', 'myuser');
    await api.agent.do('type', 'Password', 'mypass');

    // Submit
    await api.agent.do('click', 'Log in');

    // Take screenshot
    const screenshot = await api.agent.screenshot({ annotate: true });
});
```
