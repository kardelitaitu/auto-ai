# Utils

The utils module provides utility functions for file I/O, memory profiling, patching, retry logic, configuration, and various helper functions.

## Table of Contents

- [File I/O](#file-io)
- [Memory](#memory)
- [Patch](#patch)
- [Retry](#retry)
- [Config](#config)
- [Math](#math)
- [Timing](#timing)
- [Logger](#logger)
- [Misc](#misc)

---

## File I/O

Safe, concurrent utilities for handling text-based data.

### Functions

| Function | Description |
|----------|-------------|
| `file.readline(path)` | Read a random non-empty line |
| `file.consumeline(path)` | Read and remove a random line |

### Usage

```javascript
// Read random line (non-destructive)
const line = await api.file.readline('data.txt');
console.log('Random line:', line);

// Read and remove line (thread-safe)
const consumed = await api.file.consumeline('accounts.txt');
console.log('Consumed:', consumed);

// Thread-safety via .lock files
// Multiple agents can safely consume from same file
```

---

## Memory

Memory profiling utilities.

### Functions

| Function | Description |
|----------|-------------|
| `memory.getUsage()` | Get current memory usage |
| `memory.getHeap()` | Get heap statistics |
| `memory.track()` | Start tracking |

### Usage

```javascript
// Get memory usage
const mem = await api.memory.getUsage();
console.log('RSS:', mem.rss);
console.log('Heap Used:', mem.heapUsed);

// Get heap stats
const heap = await api.memory.getHeap();
console.log('Heap Total:', heap.total);
console.log('Heap Used:', heap.used);
```

---

## Patch

Detection patching utilities for anti-bot measures.

### Functions

| Function | Description |
|----------|-------------|
| `patch.apply()` | Apply detection patches |
| `patch.stripCDPMarkers()` | Strip CDP markers |
| `patch.check()` | Check patch status |

### Usage

```javascript
// Apply patches
await api.patch.apply(page);

// Strip CDP markers
await api.patch.stripCDPMarkers(page);

// Check status
const status = await api.patch.check(page);
console.log('Patched:', status.patched);
```

---

## Retry

Retry logic with exponential backoff.

### Functions

| Function | Description |
|----------|-------------|
| `retry(fn, options)` | Retry function |
| `retry.withBackoff(fn, options)` | Retry with backoff |

### Retry Options

```javascript
{
    maxAttempts: 3,        // Max retry attempts
    initialDelay: 100,     // Initial delay in ms
    maxDelay: 5000,       // Max delay in ms
    backoffMultiplier: 2,  // Exponential multiplier
    shouldRetry: (e) => true // Retry predicate
}
```

### Usage

```javascript
import { retry } from './api/utils/retry.js';

const result = await retry(async () => {
    await api.click('.button');
}, {
    maxAttempts: 3,
    initialDelay: 100,
    backoffMultiplier: 2
});
```

---

## Config

Configuration management utilities.

### Functions

| Function | Description |
|----------|-------------|
| `config.get(key)` | Get config value |
| `config.set(key, value)` | Set config value |
| `config.load(path)` | Load from file |
| `config.save(path)` | Save to file |
| `config.merge(obj)` | Merge config |

### Usage

```javascript
// Get/set values
await api.config.set('humanization.enabled', true);
const value = await api.config.get('humanization.enabled');

// Load/save
await api.config.load('./config.json');
await api.config.save('./config.json');

// Merge
await api.config.merge({
    humanization: {
        enabled: true
    }
});
```

---

## Math

Math utilities for calculations.

### Functions

| Function | Description |
|----------|-------------|
| `gaussian(mean, stdDev)` | Gaussian random |
| `randomInRange(min, max)` | Random in range |
| `clamp(value, min, max)` | Clamp value |
| `lerp(a, b, t)` | Linear interpolation |
| `map(value, inMin, inMax, outMin, outMax)` | Map value range |

### Usage

```javascript
import { gaussian, randomInRange, clamp, lerp, map } from './api/utils/math.js';

const num = gaussian(100, 15);
const rand = randomInRange(1, 10);
const clamped = clamp(15, 0, 10);
const interpolated = lerp(0, 100, 0.5);
const mapped = map(50, 0, 100, 0, 1);
```

---

## Timing

Timing utilities.

### Functions

| Function | Description |
|----------|-------------|
| `delay(ms)` | Fixed delay |
| `measure(fn)` | Measure execution time |
| `timeout(ms)` | Create timeout promise |

### Usage

```javascript
import { delay, measure, timeout } from './api/utils/timing.js';

// Delay
await delay(1000);

// Measure
const { result, duration } = await measure(async () => {
    return await api.goto('https://example.com');
});
console.log('Took', duration, 'ms');

// Timeout
await timeout(5000).catch(() => console.log('Timed out'));
```

---

## Logger

Logging utilities.

### Functions

| Function | Description |
|----------|-------------|
| `logger.info(msg)` | Info log |
| `logger.warn(msg)` | Warning log |
| `logger.error(msg)` | Error log |
| `logger.debug(msg)` | Debug log |

### Usage

```javascript
import { logger } from './api/utils/logger.js';

logger.info('Starting process');
logger.warn('Potential issue');
logger.error('Failed:', error);
logger.debug('Debug info');
```

---

## Misc

Other utility functions.

### Functions

| Function | Description |
|----------|-------------|
| `uniqueId()` | Generate unique ID |
| `uuid()` | Generate UUID |
| `sleep(ms)` | Sleep for ms |
| `chunk(arr, size)` | Split array into chunks |
| `debounce(fn, ms)` | Debounce function |
| `throttle(fn, ms)` | Throttle function |

### Usage

```javascript
import { uniqueId, uuid, sleep, chunk, debounce, throttle } from './api/utils/misc.js';

const id = uniqueId();
const uuid = uuid();

// Sleep
await sleep(1000);

// Chunk
const chunks = chunk([1,2,3,4,5], 2); // [[1,2], [3,4], [5]]

// Debounce
const debounced = debounce(() => console.log('Hi'), 100);

// Throttle
const throttled = throttle(() => console.log('Hi'), 100);
```
