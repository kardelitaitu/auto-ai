# Unified Browser Tool API

## Architectural Blueprint & Anti-Detection System

### Progress

- [x] Phase 1 — Core scaffolding & barrel export (`api/index.js`)
- [x] Phase 2 — Context binding (`api/context.js`)
- [x] Phase 3 — Spatial & Kinetic (`api/scroll.js`, `api/cursor.js`)
- [x] Phase 4 — Action layer (`api/actions.js` — click, type, hover, rightClick)
- [x] Phase 5 — Query & Sync (`api/queries.js`, `api/wait.js`)
- [x] Phase 6 — Persona & Timing (`api/persona.js`, `api/timing.js`)
- [x] Phase 7 — Navigation (`api/navigation.js`)
- [x] Phase 8 — Trampoline / warmup integration (`api/warmup.js`)
- [x] Phase 9 — Scroll reading simulation (`api/scroll.js` - read, back)
- [x] Phase 10 — Trajectory sophistication (`api/cursor.js` - bezier/arc/zigzag/overshoot)
- [x] Phase 11 — Error recovery (`api/recover.js`)
- [x] Phase 12 — Attention modeling (`api/attention.js` - gaze, exit intent)
- [x] Phase 13 — Idle & patch (`api/idle.js`, `api/patch.js`)
- [ ] Phase 14 — Integration testing
- [ ] Phase 15 — Agentic migration (refactor existing tasks)

---

## 1. System Overview

This document outlines the architecture for a streamlined, intuitive, and highly evasive browser automation API. It is designed for multi-agent orchestration, emphasizing behavioral simulation over raw speed. All spatial interactions strictly adhere to the "Golden View" principle, preparing the target element mathematically before kinetic execution.

The system is built around a centralized, memory-safe orchestrator utilizing a WeakMap. This ensures strict session hygiene, preventing cross-contamination between different browser contexts or concurrent agentic workflows.

```js
import { api } from './api/index.js';

await api.click(".btn");                    // scroll.focus + move cursor + click
await api.type(".input", "hello");         // scroll.focus + move cursor + type
await api.hover(".avatar");                // scroll.focus + move cursor + hover
await api.scroll.focus(".element");        // explicit: scroll to golden view + move cursor
await api.scroll(300);                     // simple scroll without focus
```

---

## 2. Core Design Principles

### 2.1 Golden View First

Every kinetic action (`click`, `type`, `hover`) automatically prepares the DOM element:

1. **Spatial Alignment (Scroll)**: Centers the element in the viewport applying a $Y_{offset}$ with $\pm 10\%$ randomness
2. **Kinetic Pathing (Cursor)**: Calculates and executes a Bezier curve path to the target coordinates
3. **Execution & Entropy**: Performs the action while injecting context-aware human behavior (e.g., typos, hesitation)

### 2.2 Implicit Page Context

- Tools strictly prohibit passing page parameters repetitively
- The Playwright page instance is secured in a WeakMap, keyed by the execution context
- Invocation discipline: Set once at task start via `setPage(page)`

### 2.3 Minimal Options, Sensible Defaults

- No mandatory configurations or bloated option objects
- All functions execute flawlessly with zero configuration, defaulting to the active Persona
- Overrides are handled via optional parameter objects for granular agentic control

### 2.4 Composable & Variant Ready

- Modularity allows raw extraction: `api.scroll.focus(.el)` explicit calls when only spatial preparation is needed
- Low-level bypasses available: `api.cursor.move(.el)` or `api.scroll(300)`

---

## 3. Golden View Specification

**Definition**: The exact mathematical and spatial positioning of a DOM element to minimize automation signatures.

| Property | Formula |
|----------|---------|
| Horizontal | $X = \text{Center of Viewport}$ |
| Vertical | $Y = \text{Center of Viewport} + (\text{Viewport Height} \times 0.10 \times \mathcal{N}(0,1))$ |
| Scroll Behavior | Multi-step kinetic loops injected with Gaussian delays |

**Strategic Purpose**: Avoids edge-pixel interactions that instantly trigger bot-detection heuristics. Randomness breaks time-series pattern analysis.

---

## 4. Unified API Reference

### 4.1 Actions (Kinetic & Humanized)

| Function | Description |
|----------|-------------|
| `api.click(selector)` | Spawns scroll.focus variant → moves cursor → clicks with micro-delay |
| `api.type(selector, text)` | Spawns scroll.focus variant → moves cursor → types. Evaluates P(typo), executes repair variant if triggered |
| `api.hover(selector)` | Spawns scroll.focus variant → moves cursor → executes micro-drift |
| `api.rightClick(selector)` | Spawns scroll.focus variant → moves cursor → executes secondary click |

### 4.2 Spatial Operations (Scroll)

| Function | Description |
|----------|-------------|
| `api.scroll.focus(selector)` | Explicit spatial preparation. Calculates Golden View bounding box → executes human scroll → moves cursor |
| `api.scroll(distance)` | Blind vertical scroll by raw pixels. Cursor remains anchored |
| `api.scroll.toTop()` | Multi-step scroll to Y = 0 |
| `api.scroll.toBottom()` | Multi-step scroll to Y = Document Height |

### 4.3 Cursor Control (Low-Level)

| Function | Description |
|----------|-------------|
| `api.cursor.move(selector)` | Calculates Bezier coordinates → moves cursor physically to element |
| `api.cursor.up(distance)` | Relative Y axis subtraction → moves cursor up |
| `api.cursor.down(distance)` | Relative Y axis addition → moves cursor down |

### 4.4 Read-Only Queries (Audit & Validation)

| Function | Description |
|----------|-------------|
| `api.text(selector)` | Extracts innerText. Zero entropy injected |
| `api.attr(selector, name)` | Extracts specified DOM attribute |
| `api.visible(selector)` | Boolean check for layout visibility |
| `api.count(selector)` | Returns integer count of matching nodes |
| `api.exists(selector)` | Boolean check for DOM presence |

### 4.5 State Transitions (Navigation)

| Function | Description |
|----------|-------------|
| `api.goto(url)` | Triggers warmup.beforeNavigate → executes Playwright navigation → resolves on network idle |
| `api.reload()` | Executes humanized page refresh |
| `api.back()` | Retreats in browser history |
| `api.forward()` | Advances in browser history |

### 4.6 Synchronization (Wait)

| Function | Description |
|----------|-------------|
| `api.wait(ms)` | Halts thread for ms + (σ × N(0,1)) |
| `api.waitFor(selector)` | Polls for DOM attachment |
| `api.waitVisible(selector)` | Polls for CSS layout visibility |
| `api.waitHidden(selector)` | Polls for CSS layout destruction/hiding |

---

## 5. Directory Structure

```
api/                            # Flat structure (15 files)
├── index.js                    # Central barrel export — assembles the api object
├── context.js                  # Session Hygiene — setPage(), getPage(), clearContext()
├── persona.js                  # 16 behavioral profiles + setPersona(), getPersona()
├── timing.js                   # think(), delay(), gaussian helpers (persona-aware)
├── scroll.js                   # focus(), scroll(), toTop(), toBottom(), read(), back()
├── cursor.js                   # move(), up(), down() + setPathStyle() (bezier/arc/zigzag/overshoot)
├── actions.js                  # click(), type() (QWERTY typo injection), hover(), rightClick()
├── queries.js                  # text(), attr(), visible(), count(), exists()
├── wait.js                     # wait(), waitFor(), waitVisible(), waitHidden()
├── navigation.js               # goto(), reload(), back(), forward() + warmup exports
├── warmup.js                   # beforeNavigate(), randomMouse(), fakeRead(), pause()
├── recover.js                  # recover(), goBack(), findElement(), smartClick(), undo()
├── attention.js                # gaze(), attention(), distraction(), beforeLeave(), focusShift()
├── idle.js                     # start(), stop(), wiggle(), idleScroll()
└── patch.js                    # apply(), stripCDPMarkers(), check()
```

---

## 6. Implementation Specifications

### 6.1 Module Pattern Standard

Flat file structure — each module is a single file exporting named functions.
The central `index.js` barrel assembles everything into the `api` object:

```js
// api/actions.js — Individual module
import { getPage, getCursor } from './context.js';
import { focus } from './scroll.js';

export async function click(selector, options = {}) {
    const page = getPage();
    await focus(selector);
    // ... GhostCursor click delegation
}
```

### 6.2 Context & Session Hygiene

Module-scoped variables (not WeakMap — WeakMap requires object keys, strings throw TypeError):

```js
import { GhostCursor } from '../utils/ghostCursor.js';

let currentPage = null;
let currentCursor = null;

export function setPage(page) {
    if (!page) throw new Error('setPage requires a valid Playwright page instance.');
    currentPage = page;
    currentCursor = new GhostCursor(page);
}

export function getPage() {
    if (!currentPage) throw new Error('Session Hygiene Violation: Page context uninitialized. Call api.setPage(page) first.');
    return currentPage;
}

export function getCursor() {
    if (!currentCursor) throw new Error('Session Hygiene Violation: Cursor uninitialized. Call api.setPage(page) first.');
    return currentCursor;
}

export function clearContext() {
    currentPage = null;
    currentCursor = null;
}
```

### 6.3 Spatial Focus Math (scroll.focus)

```js
export async function scrollFocus(selector, options = {}) {
    const page = getPage();
    const { randomness = 0.1 } = options; 
    
    await page.waitForSelector(selector, { state: 'attached' });
    const box = await page.locator(selector).boundingBox();
    const viewport = page.viewportSize();
    
    // Y-Offset math with injected entropy
    const yOffset = (box.height / 2) + (viewport.height * randomness * (Math.random() - 0.5));
    const targetY = box.y - yOffset + (viewport.height / 2);
    
    await humanScroll(page, targetY);
    await cursorMove(selector);
}
```

---

## 7. Anti-Detection System (Phase 2)

Advanced human behavior simulation focusing on systemic cognitive patterns, not just superficial fingerprint spoofing (fingerprinting handled by anti-detect browsers).

### 7.1 Trampoline (Warmup System)

Simulates human behavior before a state transition to establish a believable session baseline.

| Function | Description |
|----------|-------------|
| `warmup.beforeNavigate(url)` | Master execution wrapper |
| `warmup.randomMouse()` | Sweeps cursor randomly across viewport constraints (1-2s) |
| `warmup.fakeRead()` | Evaluates layout and executes short kinetic scrolls |
| `warmup.pause()` | Halts execution (2-5s) to simulate cognitive decision-making |

**Flow:**
```
Random mouse movement (1-2s)
    ↓
Optional: Fake scroll through content (reading simulation)
    ↓
Random pause (2-5s) - "deciding to click"
    ↓
Navigate to URL
    ↓
Wait for load + random extra delay
    ↓
Initial scroll to center
```

### 7.2 Behavioral Personas

Granular control over the system's cognitive speed and error probability.

| Persona | Speed | Hover Duration | Typo Rate | Scroll | Characteristics |
|---------|-------|---------------|-----------|--------|-----------------|
| `casual` | 0.8x | 1-3s | 8% | Moderate | General browsing, relaxed pace |
| `efficient` | 1.5x | 100-300ms | 2% | Minimal | Fast automation, bulk actions |
| `researcher` | 0.7x | 2-4s | 5% | Heavy | Deep diving, data extraction |
| `power` | 2.0x | 50-100ms | 1% | Minimal | Keyboard-heavy, shortcuts |
| `glitchy` | 1.0x | Variable | 15% | Random | Undetectable chaos |
| `elderly` | 0.4x | 3-5s | 12% | Slow | Senior user simulation |
| `teen` | 1.3x | Short bursts | 10% | Fast | Social media behavior |
| `professional` | 1.2x | 500ms-1s | 3% | Balanced | Business tasks |
| `gamer` | 1.8x | Quick reflexes | 4% | Fast | Quick clicks, rapid movements |
| `typer` | 1.0x | 200-400ms | 3% | Moderate | Fast accurate typing |
| `hesitant` | 0.6x | 3-6s | 10% | Moderate | Second-guesses, long pauses |
| `impulsive` | 1.6x | 50-150ms | 12% | Fast | Quick decisions, more errors |
| `distracted` | 0.9x | Random | 7% | Erratic | Random pauses, mid-action stops |
| `focused` | 1.1x | 800ms-1.5s | 2% | Balanced | Deep work, minimal errors |
| `newbie` | 0.5x | 2-4s | 18% | Slow | Learning simulation, lots of errors |
| `expert` | 1.4x | 150-400ms | 1% | Efficient | Pro user, minimal wasted motion |

**Detailed Persona Parameters:**

| Parameter | Range | Description |
|-----------|-------|-------------|
| `speed` | 0.4x - 2.0x | Cursor movement multiplier |
| `hoverMin` | 50ms - 5000ms | Minimum hover before action |
| `hoverMax` | 100ms - 6000ms | Maximum hover before action |
| `typoRate` | 0.01 - 0.18 | Probability of typo per character |
| `correctionRate` | 0.5 - 1.0 | Chance to fix typo (vs leaving it) |
| `hesitation` | 0 - 0.3 | Chance to pause mid-action |
| `hesitationDelay` | 100ms - 1000ms | Duration of hesitation pause |
| `scrollVolume` | 0 - 100 | Expected scrolls per session |
| `scrollSpeed` | 0.3x - 1.5x | Scroll movement speed |
| `idleChance` | 0 - 0.2 | Probability of random idle pauses |
| `idleDuration` | 2s - 10s | Duration of idle pauses |
| `clickHold` | 50ms - 300ms | Mouse button hold duration |
| `pathStyle` | bezier/arc/zigzag | Cursor movement path |
| `overshootChance` | 0 - 0.2 | Chance to overshoot target |
| `microMoveChance` | 0 - 0.5 | Chance for micro-adjustments before click |

**Multi-Agent Randomization**: A single orchestrator can spawn multiple concurrent browsers, safely assigning a unique, randomized persona to each instance.

```js
// All available personas
const personas = [
    'casual', 'efficient', 'researcher', 'power', 'glitchy', 
    'elderly', 'teen', 'professional', 'gamer', 'typer',
    'hesitant', 'impulsive', 'distracted', 'focused', 'newbie', 'expert'
];

// Random persona for multi-agent
const randomPersona = personas[Math.floor(Math.random() * personas.length)];
await api.setPersona(randomPersona);

// Custom persona configuration
await api.setPersona('custom', {
    speed: 0.9,
    hoverMin: 1500,
    hoverMax: 3000,
    typoRate: 0.06,
    hesitation: 0.1,
    pathStyle: 'bezier',
    overshootChance: 0.1,
    microMoveChance: 0.3
});

// Preset combinations
await api.setPersona('stealth');      // Balanced, minimal footprint
await api.setPersona('chaos');        // Random values, unpredictable
await api.setPersona('consistent');   // Same timing every time
```

### 7.3 Entropy-Rich Cursor Movement

Kinetic trajectories are dynamically shaped by the active Persona.

| Property | Options |
|----------|---------|
| Paths | bezier (default), arc, zigzag |
| Speed | Multiplier 0.5x → 2.0x |
| Tremor | Injectable micro-movements 0-2px |
| Hesitation | Probability to pause mid-trajectory 0-300ms |

### 7.4 Detection API Patching

Automation Markers: Nullifies CDP leaks (`window.cdc_adoQjvpsHSjkbJjLPRbPQ = undefined`).

Stack Traces: Overrides `Function.prototype.toString` to return `[native code]` for Playwright wrappers.

Execution: Triggered implicitly via `api.patch.apply()` upon setPage initialization via addInitScript.

### 7.5 Idle Simulation

Ensures connection persistence and maintains a human signature when the orchestrator is awaiting backend operations.

```js
await api.idle.start({
    wiggle: true,      // Cursor micro-movements
    scroll: true,      // Occasional scrolling
    frequency: 3000,   // Movement every 3s
    magnitude: 5       // 5px movement range
});
```

### 7.6 Typing Humanization

Calculates string length and translates text into granular keystrokes.

| Feature | Description |
|---------|-------------|
| Variable Speed | Base interval 50-150ms per character |
| Typo Simulation | Evaluates P(typo) (default 5%). Spawns repair variant |
| Punctuation | Appends additional Gaussian delay (+200ms) upon punctuation boundaries |

---

### 7.7 Temporal Pattern Breaking

Varies timing patterns to avoid predictable intervals.

| Feature | Description |
|---------|-------------|
| `burst` | Rapid sequential actions with minimal delay |
| `pause` | Extended delay between actions |
| `thinkingPause` | Random "cognitive" pauses mid-task |
| `intervalRandomization` | Sometimes fast, sometimes slow between actions |

**Timing Modes:**

| Mode | Behavior |
|------|----------|
| `gaussian` | Bell-curve distribution (default) |
| `burst` | Fast succession, 50-100ms between actions |
| `pause` | Slow, 3-8s between actions |
| `random` | Completely unpredictable timing |

```js
await api.setTimingMode('random');  // Unpredictable intervals
await api.think();                  // Random "thinking" pause (1-5s)
await api.think(3000);              // Specific thinking pause
```

### 7.8 Scroll Reading Simulation

Mimics natural human reading behavior during scroll.

| Feature | Description |
|---------|-------------|
| `stopAndRead` | Scroll, pause, scroll, pause pattern |
| `variableSpeed` | Speed changes during single scroll |
| `backScroll` | Occasional re-read of previous content |
| `readingFocus` | Move cursor to text area while scrolling |

**Implementation:**

```js
// Reading scroll - simulates reading content
await api.scroll.read('.article');  // Scroll through article with pauses

// Back-scroll to re-read
await api.scroll.back();            // Scroll up slightly

// Variable speed scroll
await api.scroll(500, { speed: 'variable' });  // Speed varies during scroll
```

**Flow:**
```
Scroll to position
    ↓
Pause (reading time based on content)
    ↓
Maybe scroll back slightly (re-read)
    ↓
Continue scrolling
    ↓
Repeat
```

### 7.9 Mouse Trajectory Sophistication

Advanced cursor path modeling.

| Feature | Description |
|---------|-------------|
| `microStops` | Brief pauses along path (humans don't move straight) |
| `acceleration` | Variable speed during movement |
| `correction` | Adjustments after reaching target |
| `jitter` | Tiny random movements after settling |

**Path Variations:**

| Style | Description |
|-------|-------------|
| `bezier` | Smooth curve (default) |
| `arc` | Curved arc path |
| `zigzag` | Slight back-and-forth |
| `overshoot` | Go past, come back |
| `stopped` | Multiple micro-stops along path |

```js
await api.cursor.setPathStyle('bezier');
await api.cursor.setPathStyle('overshoot', { overshootDistance: 20 });
await api.click('.target', { correction: true });  // Adjust after reaching
```

### 7.10 Error Recovery Behavior

Human-like error handling and recovery.

| Scenario | Behavior |
|----------|----------|
| Element not found | Scroll and search, then retry |
| Wrong click | Pause → check URL → if changed, go back |
| Timeout | Realistic retry with variable delay |
| Accidental action | Pause → optionally undo |

**Implementation:**

```js
// Smart click with recovery
await api.click('.target', { 
    recovery: true,          // Enable error recovery
    maxRetries: 3,          // Max retry attempts
    scrollOnFail: true      // Scroll and try again
});

// Mistake recovery
await api.recover();        // Go back if URL changed unexpectedly
await api.undo();           // Undo last action if possible
```

**Flow:**
```
Attempt action
    ↓
Element not visible?
    ↓
Scroll to find element
    ↓
Retry action
    ↓
Still failing?
    ↓
Pause (frustration simulation)
    ↓
Final attempt or skip
```

### 7.11 Attention Modeling

Simulates human attention and focus patterns.

| Feature | Description |
|---------|-------------|
| `gaze` | Move mouse to area before acting |
| `distraction` | Randomly look at other elements |
| `exitIntent` | Move to top bar before leaving page |
| `focusShift` | Click elsewhere before main target |

**Implementation:**

```js
// Gaze - look at area before action
await api.attention('.article');  // Move to area, pause, then act

// Distraction - randomly look around
await api.setOption('distractionChance', 0.3);  // 30% chance to get distracted

// Exit intent - move to navigation before leaving
await api.beforeLeave();  // Move to menu bar, pause

// Focus shift - click something else first
await api.click('.target', { focusShift: true });  // Click nearby element first
```

---

## 8. Implementation Roadmap

| Phase | Status | Action |
|-------|--------|--------|
| 1 | ✅ Done | Core scaffolding. Created `api/` with 10-file flat structure. Barrel export in `index.js` |
| 2 | ✅ Done | Context Binding. Module-scoped page/cursor management in `context.js` |
| 3 | ✅ Done | Spatial & Kinetic. Golden View math in `scroll.js`, cursor wrapping in `cursor.js` |
| 4 | ✅ Done | Action Layer. `actions.js` — click, type (QWERTY typo injection), hover, rightClick |
| 5 | ✅ Done | Query & Sync. `queries.js` + `wait.js` — DOM extraction and synchronization |
| 6 | ✅ Done | Persona & Timing. 16 profiles in `persona.js`, think/delay in `timing.js` |
| 7 | ✅ Done | Navigation. `navigation.js` — goto, reload, back, forward |
| 8 | | Trampoline Integration. Build warmup/ and bind to navigation/goto.js |
| 9 | | Scroll Reading. Add stop-and-read simulation to scroll.js |
| 10 | | Trajectory Sophistication. Add bezier/arc/zigzag/overshoot path variations |
| 11 | | Error Recovery. Add recover.js with smart retry logic |
| 12 | | Attention Modeling. Build attention/ with gaze and exit intent |
| 13 | | Idle & Patch. Build idle simulation and detection API patching |
| 14 | | Integration Testing. Test all modules together |
| 15 | | Agentic Migration. Refactor existing orchestration tasks to consume the unified api |

---

## 9. Acceptance Criteria

- [x] `api.click(selector)` natively triggers Golden View variant + Bezier cursor logic + micro-delayed mousedown
- [x] `api.type(selector, text)` evaluates typo probability per character and natively spawns backspace repairs
- [x] `api.scroll.focus(selector)` correctly calculates Y_offset bounding box with ±10% drift
- [x] Context is implicitly routed via module-scoped variables without requiring page parameters
- [x] Persona switching natively recalibrates typing base speed and Bezier curve duration multipliers
- [x] Backward compatibility with existing scroll-helper.js and other utilities (purely additive, zero changes)
- [x] `api.think()` injects random "thinking pause" (1-5s)
- [x] `api.scroll(distance)` performs multi-step humanized scroll
- [x] `api.scroll.toTop()` / `api.scroll.toBottom()` with smooth behavior
- [x] `api.cursor.move(selector)` / `api.cursor.up(px)` / `api.cursor.down(px)` for low-level control
- [x] `api.text()`, `api.attr()`, `api.visible()`, `api.count()`, `api.exists()` for read-only queries
- [x] `api.wait()`, `api.waitFor()`, `api.waitVisible()`, `api.waitHidden()` for synchronization
- [x] `api.goto()`, `api.reload()`, `api.back()`, `api.forward()` for navigation
- [x] `api.beforeNavigate(url)` successfully injects ≥2 seconds of fake mouse wiggling prior to state transition
- [x] Automation environment successfully strips cdc_ CDP signatures and passes navigator.webdriver checks
- [x] `api.scroll.read()` implements stop-and-read scrolling pattern
- [x] `api.scroll.back()` performs occasional back-scroll for re-reading
- [x] Cursor path supports bezier/arc/zigzag/overshoot/stopped variations
- [x] `api.cursor.setPathStyle()` configures trajectory style
- [x] Error recovery scrolls and searches when element not found
- [x] Wrong click triggers URL check and optional go-back
- [x] `api.attention()` implements gaze tracking before actions
- [x] `api.beforeLeave()` simulates exit intent behavior
- [x] Distraction mode randomly moves to other elements

---

## 10. Future Capability Extensions

### 10.1 Advanced Cognitive & Biometric Evasion

**Fitts's Law Kinetic Scaling** (`api.movement.fitts`)

Replaces static speed multipliers with dynamic trajectory scaling. Small, distant elements force slower, deliberate curves with high terminal micro-tremor probabilities.

Math: $T_{movement} = \alpha + \beta \log_2 \left(1 + \frac{Distance}{Width}\right)$

**Symmetrical Keystroke Biometrics** (`api.keyboard.biometric`)

Simulates muscle memory: alternating hands (e.g., "al") drastically reduces Delay, while same-finger sequences (e.g., "ed") incur a topographical latency penalty.

Math: $Delay_{total} = \mu_{base} + \Delta_{topography} - \Delta_{muscle\_memory}$

**Viewport Abandonment** (`api.idle.abandon`)

Simulates biological distraction. Evaluates active time-in-viewport to calculate P(Abandon). If triggered, the cursor exits the bounds, window.blur() is dispatched, and the thread halts.

**Saccadic Reading & Micro-Highlighting** (`api.warmup.auditRead`)

Simulates eye-tracking anchors. Scrolls to text block, horizontally highlights 3-4 random words, pauses to "read", and clicks in whitespace to clear highlight.

**Intent Abort & False Starts** (`api.movement.abort`)

Injects severe cognitive hesitation when pathing toward high-risk elements. Executes 70% of the Bezier path, halts abruptly, and dynamically recalculates or aborts entirely.

### 10.2 Cryptographic & Extension Orchestration

**Vault Bridge** (`api.extension.vault(command, payload)`)

Facilitates isolated, bidirectional CDP communication with custom background Service Workers. Securely injects mnemonic seed phrases, orchestrates transaction signing requests.

**Hardware Wallet Simulation** (`api.extension.hardware`)

Mocks physical hardware interrupt events and biometric confirmation cadences required by extension providers.

### 10.3 Agentic State & Topology Manipulation

**Sandboxed Evaluation** (`api.eval(script)`)

Injects dynamic payload execution via CDP. Implicitly strips CDP signatures before runtime.

**Cryptographic State Injection** (`api.storage(payload)`)

Granular manipulation of localStorage, sessionStorage, and IndexedDB.

**Contextual Boundary Traversal** (`api.iframe(selector)`)

Automated resolution of nested cross-origin frames. Natively transfers active WeakMap session hygiene into isolated iframe context.

**Network Topology Routing** (`api.network(rules)`)

Intelligent route interception. Blackhole telemetry tracking payloads, spoof response bodies, or mock asynchronous API validations.

**Audit-Ready Capture** (`api.screenshot(options)`)

Calculates exact structural bounds for layout clipping. Supports injection of execution metadata and cryptographic watermarks.
