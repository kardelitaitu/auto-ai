# OWB Improvement Plan

> **Created:** 2026-03-14
> **Status:** Planning
> **Priority:** High

## 📋 Executive Summary

This plan addresses critical issues identified in the OWB (Open World Browser) system review. The goal is to transform the current prototype into a production-ready agent system with better reliability, humanization, and maintainability.

---

## 🎯 Phase 1: Critical Fixes (Week 1)

### 1.1 Fix Configuration Inconsistency
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:131)

**Problem:** `verifyAction` defaults to `true` in owb.js but `false` in gameRunner.js

**Solution:**
```javascript
// gameRunner.js - Line 131
this.verifyAction = config.verifyAction ?? true;  // Change default to true
```

**Acceptance Criteria:**
- [ ] Default behavior is consistent across all entry points
- [ ] Add unit test for default config values

---

### 1.2 Add Input Validation
**File:** [`tasks/owb.js`](tasks/owb.js:52)

**Problem:** No type checking on goal parameter

**Solution:**
```javascript
// owb.js - After line 52
const goal = payload?.goal || payload?.value || payload;

// Add validation
if (!goal || typeof goal !== 'string') {
    throw new Error('OWB task requires a string goal. Usage: owb="Your goal here"');
}

if (goal.length < 3) {
    throw new Error('Goal must be at least 3 characters');
}

if (goal.length > 500) {
    throw new Error('Goal must be under 500 characters');
}
```

**Acceptance Criteria:**
- [ ] Validation rejects non-string goals
- [ ] Validation rejects empty/short goals
- [ ] Validation rejects overly long goals
- [ ] Unit tests for all validation cases

---

### 1.3 Fix History Memory Leak
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:275)

**Problem:** History grows unbounded, causing memory issues

**Solution:**
```javascript
// Add to constructor
this.maxHistorySize = 20;  // Keep last 10 exchanges

// Replace lines 275-279
this.history.push({ role: 'assistant', content: JSON.stringify(llmResponse) });
this.history.push({
    role: 'user',
    content: actionSuccess ? 'Action succeeded.' : `Action failed: ${lastResult?.error}`,
});

// Trim history if too large
if (this.history.length > this.maxHistorySize) {
    this.history = this.history.slice(-this.maxHistorySize);
}
```

**Acceptance Criteria:**
- [ ] History never exceeds `maxHistorySize`
- [ ] Recent context is preserved
- [ ] Memory usage stays constant during long runs

---

### 1.4 Add LLM Retry Logic
**File:** [`api/agent/llmClient.js`](api/agent/llmClient.js:133)

**Problem:** Single attempt, no retry on transient failures

**Solution:**
```javascript
// Add to LLMClient class
async generateCompletionWithRetry(messages, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await this.generateCompletion(messages);
        } catch (error) {
            lastError = error;
            
            // Don't retry on validation errors
            if (error.message.includes('400') || error.message.includes('401')) {
                throw error;
            }
            
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                logger.warn(`LLM attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}
```

**Acceptance Criteria:**
- [ ] Transient failures are retried with exponential backoff
- [ ] Permanent errors (400, 401) fail immediately
- [ ] Configurable retry count
- [ ] Retry attempts are logged

---

## 🎯 Phase 2: Humanization (Week 2)

### 2.1 Add Mouse Movement to ActionEngine
**File:** [`api/agent/actionEngine.js`](api/agent/actionEngine.js:207)

**Problem:** Robotic, instant clicks easily detectable

**Solution:**
```javascript
// Import ghost cursor
import { moveMouse } from '../utils/ghostCursor.js';

async performClick(page, selector) {
    const locator = this.getLocator(page, selector);
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    
    const box = await locator.boundingBox();
    if (box) {
        // Move mouse naturally to element
        await moveMouse(page, {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
        });
        
        // Small pause before click (human hesitation)
        await page.waitForTimeout(Math.random() * 100 + 50);
    }
    
    await locator.click();
}

async performClickAt(page, x, y, clickType = 'single', duration = 500) {
    const finalX = Array.isArray(x) ? x[0] : x;
    const finalY = Array.isArray(y) ? y[0] : y;
    
    // Move mouse naturally to coordinates
    await moveMouse(page, { x: finalX, y: finalY });
    
    // Human hesitation
    await page.waitForTimeout(Math.random() * 150 + 50);
    
    // Execute click (existing logic)
    if (clickType === 'double') {
        await page.mouse.dblclick(finalX, finalY);
    } else if (clickType === 'long') {
        await page.mouse.down();
        await page.waitForTimeout(duration || 100);
        await page.mouse.up();
    } else {
        await page.mouse.click(finalX, finalY);
    }
}
```

**Acceptance Criteria:**
- [ ] Mouse moves naturally to targets (Bezier curves)
- [ ] Random hesitation before clicks
- [ ] Configurable humanization level
- [ ] Works with both selector and coordinate clicks

---

### 2.2 Add Configurable Timeouts
**File:** [`api/agent/actionEngine.js`](api/agent/actionEngine.js:209)

**Problem:** Hardcoded timeouts

**Solution:**
```javascript
// Add to ActionEngine constructor
constructor() {
    this.timeouts = {
        elementVisible: 5000,
        navigation: 30000,
        action: 10000,
    };
}

// Add method to configure
setTimeouts(config) {
    this.timeouts = { ...this.timeouts, ...config };
}

// Use in methods
async performClick(page, selector) {
    const locator = this.getLocator(page, selector);
    await locator.waitFor({ 
        state: 'visible', 
        timeout: this.timeouts.elementVisible 
    });
    await locator.click();
}
```

**Acceptance Criteria:**
- [ ] Timeouts configurable via constructor
- [ ] Timeouts configurable per-action
- [ ] Default values match current behavior
- [ ] Documented in API docs

---

### 2.3 Add Typing Humanization
**File:** [`api/agent/actionEngine.js`](api/agent/actionEngine.js:219)

**Problem:** Instant text filling looks robotic

**Solution:**
```javascript
async performType(page, selector, value, options = {}) {
    const locator = this.getLocator(page, selector);
    await locator.waitFor({ state: 'visible', timeout: this.timeouts.elementVisible });
    await locator.click();
    
    if (options.humanize !== false) {
        // Type character by character with variable delay
        for (const char of value) {
            await page.keyboard.type(char);
            // Random delay between 30-120ms
            await page.waitForTimeout(Math.random() * 90 + 30);
            
            // Occasional longer pause (thinking)
            if (Math.random() < 0.1) {
                await page.waitForTimeout(Math.random() * 200 + 100);
            }
        }
    } else {
        await locator.fill(value);
    }
}
```

**Acceptance Criteria:**
- [ ] Character-by-character typing with variable delay
- [ ] Occasional "thinking" pauses
- [ ] Option to disable for speed
- [ ] Backspace/correction simulation (optional)

---

## 🎯 Phase 3: Reliability (Week 3)

### 3.1 Improve Verification System
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:297)

**Problem:** Naive AXTree string comparison

**Solution:**
```javascript
async _verifyAction(page, preState, action) {
    if (!this.useAXTree) {
        return true;
    }

    try {
        await page.waitForTimeout(300);
        const postState = await this._captureState(page);

        if (action.action === 'click' || action.action === 'clickAt') {
            // Multiple verification strategies
            const verifications = [
                this._compareAXTree(preState.axTree, postState.axTree),
                this._compareUrl(preState.url, postState.url),
                await this._compareVisual(preState.screenshot, postState.screenshot),
            ];
            
            // At least one verification should pass
            return verifications.some(v => v === true);
        }

        if (action.action === 'type') {
            return postState.axTree.includes(action.value);
        }

        return true;
    } catch (e) {
        logger.warn('Verification error:', e.message);
        return false;  // Fail closed
    }
}

_compareUrl(preUrl, postUrl) {
    return preUrl !== postUrl;
}

async _compareVisual(preScreenshot, postScreenshot) {
    // Simple pixel difference check
    if (!preScreenshot || !postScreenshot) return false;
    
    // Could use sharp/pixelmatch for proper comparison
    // For now, simple length check as proxy
    const diff = Math.abs(preScreenshot.length - postScreenshot.length);
    return diff > 100;  // Threshold for "changed"
}
```

**Acceptance Criteria:**
- [ ] Multiple verification strategies
- [ ] URL change detection
- [ ] Visual difference detection
- [ ] Configurable verification strictness

---

### 3.2 Improve System Prompt
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:27)

**Problem:** Confusing rules, no examples

**Solution:**
```javascript
const GAME_SYSTEM_PROMPT = `You are a strategy game automation agent.

## Your Task
Analyze the screenshot and accessibility tree to understand the current game state, then take actions to complete the goal.

## Available Actions
Respond with a JSON object or array of objects:

\`\`\`json
// Single action
{ "action": "click", "selector": "#build-btn", "rationale": "Click build button to start construction" }

// Coordinate click (for canvas games)
{ "action": "clickAt", "x": 450, "y": 320, "clickType": "single", "rationale": "Click on unit at coordinates" }

// Type text
{ "action": "type", "selector": "#chat-input", "value": "Hello team!", "rationale": "Send message to team chat" }

// Wait for animation
{ "action": "wait", "value": "1000", "rationale": "Wait for build animation to complete" }

// Verify something happened
{ "action": "verify", "description": "Check if barracks appeared", "rationale": "Confirm building was placed" }

// Task complete
{ "action": "done", "rationale": "All 5 footmen have been trained" }
\`\`\`

## Rules
1. Output ONLY valid JSON - no markdown, no explanation outside JSON
2. Always include "rationale" explaining your tactical decision
3. After clicking, add a "verify" action to confirm it worked
4. Use coordinates (clickAt) for canvas-based games
5. Use "wait" with 500-1500ms for animations
6. If stuck, try alternative approaches before giving up

## Example Response
\`\`\`json
[
  { "action": "click", "selector": ".unit-card[data-type='footman']", "rationale": "Select footman unit to train" },
  { "action": "wait", "value": "800", "rationale": "Wait for selection animation" },
  { "action": "click", "selector": "#train-btn", "rationale": "Click train button to start training" },
  { "action": "verify", "description": "Check if training started", "rationale": "Confirm action succeeded" }
]
\`\`\``;
```

**Acceptance Criteria:**
- [ ] Clear action examples
- [ ] Single set of rules (no duplicates)
- [ ] Example response included
- [ ] No shouting (ALL CAPS)

---

### 3.3 Add Structured Output Support
**File:** [`api/agent/llmClient.js`](api/agent/llmClient.js:147)

**Problem:** Overengineered JSON repair suggests malformed output

**Solution:**
```javascript
// Add function calling support for compatible models
async generateCompletion(messages) {
    await this.init();

    let payload;
    
    if (this.config.serverType === 'ollama') {
        payload = {
            model: this.config.model,
            messages: this._convertToOllamaFormat(messages),
            stream: false,
            format: 'json',  // Ollama structured output
            options: { /* ... */ },
        };
    } else {
        // OpenAI-compatible function calling
        payload = {
            model: this.config.model,
            messages: messages,
            response_format: { type: "json_object" },  // Structured output
            tools: [{
                type: "function",
                function: {
                    name: "execute_action",
                    description: "Execute a game action",
                    parameters: {
                        type: "object",
                        properties: {
                            action: { 
                                type: "string",
                                enum: ["click", "clickAt", "type", "press", "scroll", "wait", "verify", "done"]
                            },
                            selector: { type: "string" },
                            x: { type: "number" },
                            y: { type: "number" },
                            value: { type: "string" },
                            rationale: { type: "string" }
                        },
                        required: ["action", "rationale"]
                    }
                }
            }],
            tool_choice: { type: "function", function: { name: "execute_action" } }
        };
    }
    
    // ... rest of implementation
}
```

**Acceptance Criteria:**
- [ ] Function calling for OpenAI-compatible APIs
- [ ] Structured output for Ollama
- [ ] Fallback to JSON mode for older models
- [ ] Reduced JSON repair code

---

## 🎯 Phase 4: Performance (Week 4)

### 4.1 Add Screenshot Caching
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:365)

**Problem:** Screenshot captured every step

**Solution:**
```javascript
constructor() {
    // ... existing
    this.screenshotCache = null;
    this.screenshotCacheTime = 0;
    this.screenshotCacheTTL = 1000;  // 1 second
}

async _captureScreenshot(page, forceRefresh = false) {
    const now = Date.now();
    
    // Return cached if fresh enough
    if (!forceRefresh && 
        this.screenshotCache && 
        (now - this.screenshotCacheTime) < this.screenshotCacheTTL) {
        return this.screenshotCache;
    }
    
    // Capture new screenshot
    const screenshot = await this._captureScreenshotRaw(page);
    this.screenshotCache = screenshot;
    this.screenshotCacheTime = now;
    
    return screenshot;
}
```

**Acceptance Criteria:**
- [ ] Screenshots cached for 1 second
- [ ] Force refresh option
- [ ] Cache invalidation on page change
- [ ] Memory efficient (single cache)

---

### 4.2 Add Incremental AXTree
**File:** [`api/agent/gameRunner.js`](api/agent/gameRunner.js:391)

**Problem:** Full AXTree captured every step

**Solution:**
```javascript
async _captureAXTree(page) {
    try {
        const tree = await page.accessibility.snapshot();
        const fullTree = JSON.stringify(tree, null, 2);
        
        // Extract only interactive elements for LLM
        const interactiveElements = this._extractInteractiveElements(tree);
        const compactTree = JSON.stringify(interactiveElements, null, 2);
        
        // Store full for verification, compact for LLM
        this.lastFullAXTree = fullTree;
        
        return compactTree;
    } catch (e) {
        logger.error('AXTree capture failed:', e.message);
        return '';
    }
}

_extractInteractiveElements(tree, depth = 0) {
    if (!tree) return null;
    
    const result = {
        role: tree.role,
        name: tree.name,
    };
    
    // Only include interactive roles
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab'];
    if (interactiveRoles.includes(tree.role)) {
        result.selector = tree.selector;  // If available
    }
    
    if (tree.children && depth < 3) {  // Limit depth
        result.children = tree.children
            .map(child => this._extractInteractiveElements(child, depth + 1))
            .filter(Boolean);
    }
    
    return result;
}
```

**Acceptance Criteria:**
- [ ] Compact tree for LLM (interactive elements only)
- [ ] Full tree stored for verification
- [ ] Depth limiting
- [ ] Significant token reduction

---

## 📊 Implementation Timeline

| Week | Focus | Tasks | Effort |
|------|-------|-------|--------|
| 1 | Critical Fixes | Config, Validation, History, Retry | 16h |
| 2 | Humanization | Mouse, Timeouts, Typing | 20h |
| 3 | Reliability | Verification, Prompt, Structured | 24h |
| 4 | Performance | Caching, Incremental | 16h |

**Total Estimated Effort:** 76 hours

---

## 🧪 Testing Strategy

### Unit Tests Required
- [ ] `owb.js` - Input validation tests
- [ ] `gameRunner.js` - Config defaults, history trimming
- [ ] `llmClient.js` - Retry logic, structured output
- [ ] `actionEngine.js` - Humanization, timeouts

### Integration Tests Required
- [ ] Full OWB flow with mock LLM
- [ ] Stuck detection scenario
- [ ] Verification success/failure paths
- [ ] History memory usage over time

### Manual Testing
- [ ] Real game automation scenarios
- [ ] Detection bypass verification
- [ ] Long-running session stability

---

## 📈 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Success Rate (simple tasks) | ~60% | 85% |
| Success Rate (complex tasks) | ~30% | 60% |
| Detection Risk | High | Low |
| Memory Usage (30 steps) | ~50MB | ~20MB |
| Avg Response Time | ~8s | ~5s |

---

## 🔗 Related Files

- [`tasks/owb.js`](tasks/owb.js) - Task entry point
- [`api/agent/gameRunner.js`](api/agent/gameRunner.js) - Main engine
- [`api/agent/actionEngine.js`](api/agent/actionEngine.js) - Action execution
- [`api/agent/llmClient.js`](api/agent/llmClient.js) - LLM communication
- [`api/utils/ghostCursor.js`](api/utils/ghostCursor.js) - Mouse humanization

---

## 📝 Notes

- Phase 1 should be implemented first as it addresses critical bugs
- Phase 2 (Humanization) is essential for anti-detection
- Phase 3 and 4 can be parallelized
- Consider adding telemetry to track success rates per action type
