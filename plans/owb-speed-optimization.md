# OWB Speed Optimization Plan

## Current Bottlenecks Analysis

Based on the `executeStateA()` flow, here are the time-consuming operations:

| Operation | Estimated Time | Impact |
|-----------|---------------|--------|
| LLM Inference (gemma3:4b) | 5-15 seconds | **HIGH** |
| V-PREP Processing | 1-2 seconds | MEDIUM |
| Screenshot Capture | 0.5-1 second | MEDIUM |
| Debug Screenshots (x2) | 0.5-1 second | LOW |
| Wait Times (500ms + 1000ms) | 1.5 seconds | MEDIUM |
| **Total per State A** | **~8-20 seconds** | - |

---

## Optimization Plan

### Phase 1: Remove Unnecessary Operations (Quick Wins)

#### 1.1 Remove Debug Screenshots in Production
**Current:** Takes 2 debug screenshots per state (`before-stateA`, `state-a-verified-*`)
**Change:** Only take debug screenshots when `DEBUG=true` or `--debug` flag is set

```javascript
// Before
await debugScreenshot('before-stateA');

// After
if (process.env.DEBUG === 'true') {
    await debugScreenshot('before-stateA');
}
```

**Time Saved:** ~0.5-1 second per state

#### 1.2 Reduce Wait Times
**Current:** 
- 500ms between double-clicks
- 1000ms after action

**Change:**
- 200ms between double-clicks (game still registers)
- 500ms after action (game processes faster than we think)

```javascript
// Before
await api.clickAt(x, y);
await api.wait(500);
await api.clickAt(x, y);
await api.wait(1000);

// After
await api.clickAt(x, y);
await api.wait(200);
await api.clickAt(x, y);
await api.wait(500);
```

**Time Saved:** ~0.8 seconds per state

#### 1.3 Skip Verification Screenshot
**Current:** Takes verification screenshot after every click
**Change:** Only take verification screenshot on first run or when debugging

```javascript
// Before
await debugScreenshot(`state-a-verified-${Date.now()}`);

// After
if (stateActionCount === 1 || process.env.DEBUG === 'true') {
    await debugScreenshot(`state-a-verified-${Date.now()}`);
}
```

**Time Saved:** ~0.5 seconds per state

---

### Phase 2: Optimize V-PREP Pipeline

#### 2.1 Use Smaller Image Size
**Current:** V-PREP outputs 640x360
**Change:** Use 480x270 for faster LLM processing

```javascript
// In owb-config.js or inline
vprepConfig: {
    targetWidth: 480,
    targetHeight: 270,
    quality: 70,  // Lower quality = smaller file = faster upload
    contrast: 1.2
}
```

**Time Saved:** ~1-2 seconds (LLM processes smaller images faster)

#### 2.2 Disable ROI Detection for OWB
**Current:** ROI detection runs on every frame
**Change:** Already disabled (`autoROI: false` in OWB_GAME preset) ✓

**Status:** Already optimized

---

### Phase 3: Optimize LLM Inference

#### 3.1 Reduce Prompt Token Count
**Current:** Long prompt with detailed visual guides (~500+ tokens)
**Change:** Create ultra-compact prompt for repeat runs

```javascript
// Compact prompt (saves ~200 tokens)
const compactPrompt = `Find grey hex with number touching blue hex. Return {"x": number, "y": number, "found": boolean}. Image: ${w}x${h}. Only JSON.`;
```

**Time Saved:** ~1-2 seconds (fewer tokens = faster processing)

#### 3.2 Use Smaller Model for Simple Tasks
**Current:** gemma3:4b (4B parameters)
**Change:** Test with gemma3:1b or qwen2.5vl:3b (smaller, faster)

```javascript
// In getOwbLlmClient()
model: 'gemma3:1b'  // or 'qwen2.5vl:3b'
```

**Time Saved:** ~2-5 seconds (smaller model = faster inference)

#### 3.3 Cache LLM Client Instance
**Current:** Creates new LLM client on each call
**Change:** Reuse existing client instance

```javascript
let cachedOwbClient = null;

async function getOwbLlmClient() {
    if (cachedOwbClient) return cachedOwbClient;
    // ... create and cache
}
```

**Time Saved:** ~0.5 seconds (avoids re-initialization)

---

### Phase 4: Parallel Operations

#### 4.1 Pre-capture Next Screenshot
**Current:** Sequential flow: capture → LLM → click → capture
**Change:** Capture next screenshot while waiting for game response

```javascript
// After click, start capturing next frame in background
const nextFramePromise = api.agent.captureState({ screenshot: true, vprep: true });
await api.wait(500);
const nextState = await nextFramePromise;  // Already captured!
```

**Time Saved:** ~1-2 seconds (overlaps capture with wait)

---

### Phase 5: Skip Unnecessary State Detection

#### 5.1 Assume State After Action
**Current:** Runs full state detection on every iteration
**Change:** After State A action, assume next state is either A again or B

```javascript
// After successful State A action
// Don't run full detection - just check if we're still in State A
const quickCheck = await quickStateCheck();
if (quickCheck === 'A') {
    // Skip full detection, go straight to State A action
}
```

**Time Saved:** ~5-10 seconds (skips full LLM detection cycle)

---

## Implementation Priority

| Priority | Optimization | Time Saved | Effort |
|----------|--------------|------------|--------|
| 1 | Remove debug screenshots | ~1s | LOW |
| 2 | Reduce wait times | ~0.8s | LOW |
| 3 | Smaller V-PREP size | ~1.5s | LOW |
| 4 | Compact prompt | ~1.5s | LOW |
| 5 | Smaller model | ~3s | MEDIUM |
| 6 | Cache LLM client | ~0.5s | LOW |
| 7 | Parallel capture | ~1.5s | MEDIUM |
| 8 | Skip state detection | ~5s | HIGH |

**Total Potential Savings:** ~15 seconds per cycle
**New Estimated Time:** ~3-5 seconds per State A (down from 8-20s)

---

## Quick Implementation (Phase 1-4)

### File: `owb-agents.js`

```javascript
// 1. Add debug flag check
const DEBUG = process.env.DEBUG === 'true';

// 2. In executeStateA():
async function executeStateA() {
    if (DEBUG) await debugScreenshot('before-stateA');  // Only if debug
    
    // ... existing code ...
    
    // 3. Reduce wait times
    await api.clickAt(x, y);
    await api.wait(200);  // Was 500
    await api.clickAt(x, y);
    await api.wait(500);  // Was 1000
    
    // 4. Skip verification screenshot
    if (DEBUG) {
        await debugScreenshot(`state-a-verified-${Date.now()}`);
    }
    
    // ... rest of code ...
}
```

### File: `owb-config.js`

```javascript
// 5. Smaller V-PREP preset
export const LLM_CONFIG = {
    model: 'gemma3:1b',  // Try smaller model
    // ...
};

// In executeStateA():
vprepConfig: {
    targetWidth: 480,
    targetHeight: 270,
    quality: 70,
    contrast: 1.2
}
```

---

## Testing Plan

1. Run `node agent-main.js owb state-a x20` with current settings
2. Note total time and time per iteration
3. Apply Phase 1 optimizations
4. Run again and compare
5. Apply Phase 2-3 optimizations
6. Run again and compare
7. Continue until target speed is reached

---

## Expected Results

| Phase | Time per State A | Improvement |
|-------|------------------|-------------|
| Current | ~10-15s | - |
| Phase 1 | ~7-10s | 30% faster |
| Phase 2 | ~5-7s | 50% faster |
| Phase 3 | ~3-5s | 65% faster |
| Phase 4 | ~2-3s | 80% faster |
