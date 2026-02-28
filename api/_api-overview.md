# Unified Browser Tool API Overview

A high-level, human-mimetic browser automation API built on Playwright. It focuses on bypassing bot detection through behavioral persona modeling, realistic kinetic movements, and robust error recovery.

## 🚀 Quick Start

```javascript
import { api } from './api/index.js';

// Isolated session execution
await api.withPage(page, async () => {
    // 1. Initialize with a behavioral persona
    await api.init(page, { persona: 'casual' });

    // 2. Human-like navigation with warmup
    await api.goto('https://example.com');

    // 3. Kinetic actions (automatically handles scroll + cursor move)
    await api.click('.login-button');
    await api.type('#username', 'myuser', { clearFirst: true });
});
```

---

## 🧠 Core Concepts

### Context & Session Isolation
The API uses `AsyncLocalStorage` to ensure that multiple browser sessions can run concurrently without state leakage.
- `api.withPage(page, fn)`: The primary way to scope API calls to a specific page.
- `api.init(page, options)`: Injects anti-detection patches and sets the persona.

### Persona System
16 profiles control biometrics like typing speed, typo rates, and mouse "jitter".
- **Profiles**: `casual`, `efficient`, `power`, `researcher`, `elderly`, `teen`, `professional`, `gamer`, etc.
- **Usage**: `api.setPersona('researcher')`

---

## 🛠️ API Modules

### ⌨️ Actions (`api.*`)
Kinetic actions follow a 3-step pipeline: **Focus (Scroll) → Move Cursor → Execute**.
- `api.click(selector)`: Human-mimetic click with coordinate noise and obstruction checks.
- `api.type(selector, text)`: Character-by-character typing with persona-driven typos and corrections.
- `api.hover(selector)`: Moves cursor to element with realistic drift.
- `api.rightClick(selector)`: Context menu interaction.

### 📜 Scroll & Viewport (`api.scroll.*`)
Implements the **Golden View** principle: centering elements vertically with random entropy.
- `api.scroll(pixels)`: Smooth vertical scroll.
- `api.scroll.focus(selector)`: Centers an element in the viewport.
- `api.scroll.read(target)`: Simulates reading by scrolling in bursts with varying pauses.
- `api.scroll.toTop() / toBottom()`: Smoothly navigates to page boundaries.

### 🖱️ Cursor & Physics (`api.cursor.*`)
Controls the low-level "Ghost Cursor" trajectories.
- `api.cursor.move(selector|x,y)`: Moves cursor using sophisticated paths.
- **Path Styles**: `muscle` (PID-driven), `bezier`, `arc`, `zigzag`, `overshoot`.
- `api.cursor.startFidgeting()`: Enables background micro-tremors to simulate a resting human hand.

### 📂 File I/O (`api.file.*`)
Safe, concurrent utilities for handling text-based data (e.g., accounts, links, proxies).
- `api.file.readline(path)`: Reads a random non-empty line from a file.
- `api.file.consumeline(path)`: Atomically reads and **removes** a random line (Thread-safe via `.lock` files).
- **Example**:
  ```javascript
  const account = await api.file.consumeline('accounts.txt'); // Safe for multi-agent use
  ```

### 🤖 Agent Interaction Layer (`api.agent.*`)
Designed for LLMs to interact with pages semantically rather than using complex selectors.
- `api.agent.see()`: Returns a compact list of interactive elements with IDs and Labels.
- `api.agent.do(action, target, [value])`: Acts on an element using its ID or Label (e.g., `click`, `type`).
- `api.agent.find(description)`: Locates an element based on a fuzzy text description.
- `api.agent.screenshot([options])`: Captures a screenshot and returns it as a Base64 string (avoids filesystem clutter). Can optionally `annotate` with element IDs.

### 🛡️ Recovery & Error Handling (`api.*`)
- `api.smartClick(selector)`: High-level wrapper that retries with scrolling and native fallbacks if an element is obscured.
- `api.recover()`: Attempts to restore state after unexpected navigation.
- `api.findElement(selectors)`: Searches for elements by scrolling if not immediately visible.

### 👁️ Attention & Idle (`api.*`)
- `api.attention(selector)`: Gazes at an area before acting.
- `api.distraction()`: Randomly looks at other elements to simulate loss of focus.
- `api.idle.start()`: Simulates presence during inactivity (micro-scrolls, mouse wiggles).

---

## ⚡ Advanced Features

### 🔌 Plugin System
Extend the API with custom lifecycle logic.
```javascript
api.plugins.register({
    name: 'auto-logger',
    hooks: {
        'before:click': async (selector) => console.log(`Clicking ${selector}`)
    }
});
```

### 🌉 Middleware
Intercept and modify API actions using a pipeline.
- `api.middleware.retry()`: Auto-retry failed actions.
- `api.middleware.logging()`: Comprehensive debug output.
- `api.middleware.metrics()`: Track performance and success rates.

### ⚓ Events & Hooks
Listen to internal API state transitions via `api.events`.
- **Common Hooks**: `before:navigate`, `after:click`, `on:detection`, `on:error`.
