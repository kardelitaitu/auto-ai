# Behaviors

The behaviors module implements human-like behavioral patterns including persona management, timing, attention, idle states, recovery, and warmup routines.

## Table of Contents

- [Persona](#persona)
- [Timing](#timing)
- [Attention](#attention)
- [Idle](#idle)
- [Recovery](#recovery)
- [Warmup](#warmup)

---

## Persona

The persona system controls biometrics like typing speed, typo rates, mouse "jitter", and movement patterns. There are 16 predefined profiles.

### Available Personas

| Persona | Description |
|---------|-------------|
| `casual` | Casual browser, moderate speed |
| `efficient` | Power user, fast and precise |
| `power` | Advanced user, shortcuts |
| `researcher` | Careful reader, thorough |
| `elderly` | Slower movements, careful |
| `teen` | Quick, distracted |
| `professional` | Business-like, efficient |
| `gamer` | Fast reflexes, precise |
| `distracted` | Often loses focus |
| `fast` | Quick execution |
| `slow` | Deliberate movements |
| `random` | Unpredictable behavior |
| `typer` | Fast typer |
| `careful` | Very cautious |
| `lazy` | Minimal effort |
| `default` | Balanced profile |

### Functions

| Function | Description |
|----------|-------------|
| `setPersona(name)` | Set the active persona |
| `getPersona()` | Get the current persona object |
| `getPersonaName()` | Get the current persona name |
| `listPersonas()` | List all available personas |
| `getSessionDuration()` | Get session duration in ms |

### Persona Properties

Each persona controls:

- **Typing Speed**: Characters per minute
- **Typo Rate**: Probability of typos
- **Mouse Speed**: Cursor movement speed
- **Mouse Jitter**: Random movement noise
- **Scroll Speed**: Scroll operation speed
- **Pause Duration**: Thinking pauses

### Usage

```javascript
// Set persona
await api.setPersona('researcher');

// Get current persona
const persona = await api.getPersona();
console.log('Current persona:', persona.name);

// List all personas
const personas = await api.listPersonas();
console.log('Available:', personas);

// Get session duration
const duration = await api.getSessionDuration();
```

---

## Timing

Timing utilities for realistic delays and pauses.

### Functions

| Function | Description |
|----------|-------------|
| `think(ms)` | Think pause (variable based on persona) |
| `delay(ms)` | Fixed delay |
| `gaussian(mean, stdDev)` | Gaussian random value |
| `randomInRange(min, max)` | Random value in range |

### Usage

```javascript
// Think pause (persona-based)
await api.think(); // Uses persona's default
await api.think(2000); // 2 seconds

// Fixed delay
await api.delay(500);

// Gaussian random
const value = await api.gaussian(1000, 200); // mean=1000, stdDev=200

// Random in range
const delay = await api.randomInRange(500, 1500);
```

---

## Attention

Simulates human attention patterns including gazing, distractions, and focus shifts.

### Functions

| Function | Description |
|----------|-------------|
| `gaze(selector)` | Gaze at an element |
| `attention(selector)` | Full attention sequence |
| `distraction()` | Random distraction behavior |
| `beforeLeave()` | Before leaving page |
| `focusShift()` | Shift focus randomly |
| `maybeDistract()` | Random chance of distraction |
| `setDistractionChance(chance)` | Set distraction probability |
| `getDistractionChance()` | Get current distraction chance |

### Usage

```javascript
// Gaze at element
await api.gaze('.important-content');

// Full attention sequence
await api.attention('.content-area');

// Random distraction
await api.distraction();

// Focus shift
await api.focusShift();

// Maybe distract (probabilistic)
await api.maybeDistract();

// Configure distraction
await api.setDistractionChance(0.3); // 30% chance
```

---

## Idle

Simulates presence during inactivity with micro-movements.

### Functions

| Function | Description |
|----------|-------------|
| `idle.start()` | Start idle behavior |
| `idle.stop()` | Stop idle behavior |
| `idle.isRunning()` | Check if idle is running |
| `idle.wiggle()` | Small cursor movement |
| `idle.scroll()` | Small scroll movement |
| `idle.heartbeat()` | Periodic presence signal |

### Usage

```javascript
// Start idle behavior
await api.idle.start();

// Stop idle behavior
await api.idle.stop();

// Check status
const running = await api.idle.isRunning();

// Manual idle actions
await api.idle.wiggle();
await api.idle.scroll();

// Heartbeat
await api.idle.heartbeat();
```

---

## Recovery

Error recovery and self-healing mechanisms.

### Functions

| Function | Description |
|----------|-------------|
| `recover()` | Attempt to restore state |
| `goBack()` | Go back with recovery |
| `findElement(selector)` | Find element by scrolling |
| `smartClick(selector, options)` | High-level click with recovery |
| `undo()` | Undo last action |
| `urlChanged()` | Check if URL changed |

### Smart Click Options

```javascript
{
    recovery: true,        // Enable auto-recovery
    maxRetries: 3,        // Max retry attempts
    scrollFirst: true,    // Scroll to element first
    hoverFirst: true,     // Hover before clicking
    forceNative: false     // Fallback to native click
}
```

### Usage

```javascript
// Smart click with recovery
await api.smartClick('.dynamic-button', {
    recovery: true,
    maxRetries: 3
});

// Find element (scroll if needed)
await api.findElement('.lazy-loaded-content');

// Recover from unexpected state
await api.recover();

// Go back safely
await api.goBack();

// Check URL change
const changed = await api.urlChanged();
```

---

## Warmup

Pre-navigation and preparation routines.

### Functions

| Function | Description |
|----------|-------------|
| `beforeNavigate()` | Execute warmup before navigation |
| `randomMouse()` | Random mouse movement |
| `fakeRead()` | Simulate reading behavior |
| `warmupPause()` | Warmup pause |

### Usage

```javascript
// Pre-navigation warmup
await api.beforeNavigate();
await api.randomMouse();
await api.fakeRead();
await api.warmupPause();

// Combined warmup sequence
async function warmup() {
    await api.randomMouse();
    await api.fakeRead();
    await api.warmupPause();
}

await api.goto('https://example.com');
await warmup();
```
