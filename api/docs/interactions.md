# Interactions

The interactions module provides high-level user action functions that simulate human behavior, including clicking, typing, scrolling, cursor movement, navigation, waiting, and querying.

## Table of Contents

- [Actions](#actions)
- [Scroll](#scroll)
- [Cursor](#cursor)
- [Navigation](#navigation)
- [Wait](#wait)
- [Queries](#queries)
- [Banners](#banners)

---

## Actions

Kinetic actions that follow a 3-step pipeline: **Focus (Scroll) → Move Cursor → Execute**.

### Functions

| Function | Description |
|----------|-------------|
| `click(selector, options)` | Human-mimetic click with coordinate noise |
| `type(selector, text, options)` | Character-by-character typing |
| `hover(selector)` | Moves cursor to element with drift |
| `rightClick(selector)` | Context menu interaction |

### Click Options

```javascript
{
    recovery: true,           // Auto-recovery on failure
    maxRetries: 3,           // Max retry attempts
    hoverBeforeClick: true,  // Hover before clicking
    precision: 'safe',        // 'exact', 'safe', 'rough'
    button: 'left',          // 'left', 'right', 'middle'
    force: false             // Force click even if obscured
}
```

### Type Options

```javascript
{
    delay: 50,              // Delay between keystrokes in ms
    noClear: false,         // Don't clear field before typing
    humanize: true,         // Apply human-like keystroke timing
    clearFirst: false       // Clear field first
}
```

### Usage

```javascript
// Click with recovery
await api.click('.login-button', { 
    recovery: true, 
    maxRetries: 3 
});

// Type with humanization
await api.type('#username', 'myuser', { 
    humanize: true,
    clearFirst: true 
});

// Hover
await api.hover('.menu-item');

// Right-click
await api.rightClick('.context-menu');
```

---

## Scroll

Implements the **Golden View** principle: centering elements vertically with random entropy.

### Functions

| Function | Description |
|----------|-------------|
| `scroll(pixels, options)` | Smooth vertical scroll |
| `scroll.focus(selector)` | Centers an element in the viewport |
| `scroll.toTop()` | Smoothly scroll to top |
| `scroll.toBottom()` | Smoothly scroll to bottom |
| `scroll.read(target)` | Simulates reading by scrolling in bursts |
| `scroll.back()` | Scroll back to previous position |

### Scroll Options

```javascript
{
    pauses: 3,              // Number of scroll+pause cycles
    scrollAmount: 500,      // Pixels per scroll
    variableSpeed: true,    // Vary scroll speed
    backScroll: true        // Occasional back-scroll
}
```

### Usage

```javascript
// Simple scroll
await api.scroll(300);

// Focus on element
await api.scroll.focus('.content-area');

// Read-like scrolling
await api.scroll.read({
    distance: 1000,
    pauses: 5,
    minPause: 500,
    maxPause: 1500
});

// Go to top/bottom
await api.scroll.toTop();
await api.scroll.toBottom();
```

---

## Cursor

Controls the low-level "Ghost Cursor" trajectories for realistic mouse movement.

### Functions

| Function | Description |
|----------|-------------|
| `cursor(selector)` | Shortcut for move |
| `cursor.move(selector)` | Move cursor to element using sophisticated paths |
| `cursor.up(pixels)` | Move cursor up |
| `cursor.down(pixels)` | Move cursor down |
| `cursor.setPathStyle(style)` | Set path style |
| `cursor.getPathStyle()` | Get current path style |
| `cursor.startFidgeting()` | Enable background micro-tremors |
| `cursor.stopFidgeting()` | Stop fidgeting |

### Path Styles

| Style | Description |
|-------|-------------|
| `muscle` | PID-driven movement (default) |
| `bezier` | Bezier curve paths |
| `arc` | Arc movement |
| `zigzag` | Zigzag pattern |
| `overshoot` | Overshoot and correct |

### Usage

```javascript
// Move to element
await api.cursor.move('.button');

// Set path style
await api.cursor.setPathStyle('muscle');

// Start fidgeting (micro-tremors)
await api.cursor.startFidgeting();

// Stop fidgeting
await api.cursor.stopFidgeting();

// Move relative
await api.cursor.down(100);
await api.cursor.up(50);
```

---

## Navigation

Navigation functions with warmup and human-like behavior.

### Functions

| Function | Description |
|----------|-------------|
| `goto(url, options)` | Navigate to URL with warmup |
| `reload(options)` | Reload current page |
| `back()` | Go back in history |
| `forward()` | Go forward in history |
| `beforeNavigate()` | Execute warmup before navigation |
| `randomMouse()` | Random mouse movement |
| `fakeRead()` | Simulate reading behavior |
| `warmupPause()` | Warmup pause |
| `setExtraHTTPHeaders(headers)` | Set extra HTTP headers |

### Navigation Options

```javascript
{
    timeout: 30000,           // Navigation timeout in ms
    waitUntil: 'load',        // 'load', 'domcontentloaded', 'networkidle'
    headers: {}               // Extra HTTP headers
}
```

### Usage

```javascript
// Navigate with warmup
await api.goto('https://twitter.com', {
    timeout: 30000,
    waitUntil: 'networkidle'
});

// Go back/forward
await api.back();
await api.forward();

// Reload
await api.reload();

// Warmup before navigation
await api.beforeNavigate();
await api.randomMouse();
await api.fakeRead();
```

---

## Wait

Synchronization and waiting functions.

### Functions

| Function | Description |
|----------|-------------|
| `wait(ms)` | Wait for specified milliseconds |
| `waitFor(condition, options)` | Wait for condition |
| `waitVisible(selector, options)` | Wait for element to be visible |
| `waitHidden(selector, options)` | Wait for element to be hidden |
| `waitForLoadState(state)` | Wait for load state |
| `waitForURL(pattern)` | Wait for URL pattern |

### Wait Options

```javascript
{
    timeout: 10000,          // Timeout in ms
    state: 'visible',        // 'visible', 'hidden', 'attached'
    throwOnTimeout: true     // Throw on timeout vs return false
}
```

### Usage

```javascript
// Simple wait
await api.wait(1000);

// Wait for element
await api.waitVisible('.content', { timeout: 5000 });
await api.waitHidden('.loading', { timeout: 5000 });

// Wait for load state
await api.waitForLoadState('networkidle');

// Wait for URL
await api.waitForURL('**/twitter.com/**');
```

---

## Queries

Read-only DOM queries.

### Functions

| Function | Description |
|----------|-------------|
| `text(selector)` | Get text content of element |
| `attr(selector, name)` | Get attribute value |
| `visible(selector)` | Check if element is visible |
| `count(selector)` | Count elements |
| `exists(selector)` | Check if element exists |
| `currentUrl()` | Get current URL |

### Usage

```javascript
// Get text
const content = await api.text('.article-title');

// Get attribute
const href = await api.attr('a.link', 'href');

// Check visibility
const isVisible = await api.visible('.modal');

// Count elements
const count = await api.count('.list-item');

// Check existence
const hasButton = await api.exists('.submit-btn');

// Get current URL
const url = await api.getCurrentUrl();
```

---

## Banners

Handle and dismiss banners/modals.

### Functions

| Function | Description |
|----------|-------------|
| `handleBanners(options)` | Handle common banners and modals |

### Usage

```javascript
// Handle banners
await api.handleBanners({
    acceptCookies: true,    // Accept cookie banners
    closePopups: true,      // Close popup ads
    dismissNotifications: true  // Dismiss notification prompts
});
```
