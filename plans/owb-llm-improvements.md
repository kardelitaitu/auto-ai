# OWB LLM Improvements Plan

## Overview
Comprehensive improvements to enhance the LLM's decision-making capabilities, response quality, and overall performance in the OWB (Open World Browser) system.

---

## Phase 1: Prompt Engineering Enhancements (P1 - High Impact)

### 1.1 Dynamic Prompt Adaptation
**Goal:** Adapt prompts based on page type and context

**Tasks:**
- [ ] Create `PromptAdapter` class in `api/agent/promptAdapter.js`
- [ ] Detect page type (form, navigation, content, game, etc.)
- [ ] Generate context-specific examples
- [ ] Adjust prompt structure based on complexity
- [ ] Add page-type-specific rules and tips

**Implementation:**
```javascript
// api/agent/promptAdapter.js
class PromptAdapter {
    detectPageType(axTree, url) {
        // Analyze AXTree and URL to determine page type
        // Return: 'form', 'navigation', 'content', 'game', 'social', 'unknown'
    }
    
    generateContextualPrompt(pageType, goal, axTree) {
        // Generate page-type-specific prompt additions
    }
    
    getContextualExamples(pageType) {
        // Return relevant examples for the page type
    }
}
```

### 1.2 Multi-Step Reasoning Prompts
**Goal:** Encourage the LLM to think step-by-step

**Tasks:**
- [ ] Add "Think Step-by-Step" section to system prompt
- [ ] Include reasoning chain examples
- [ ] Add "Plan before Action" instruction
- [ ] Create `ReasoningPrompt` helper

**Prompt Addition:**
```
## Reasoning Process
Before taking action, think through:
1. What is the current state?
2. What obstacles exist?
3. What is the best next action?
4. What could go wrong?
5. How will I verify success?
```

### 1.3 Error Recovery Prompts
**Goal:** Help the LLM recover from failures

**Tasks:**
- [ ] Create error-specific prompt templates
- [ ] Add "Previous Attempt Failed" context
- [ ] Include recovery strategies
- [ ] Add alternative approach suggestions

**Implementation:**
```javascript
// api/agent/errorRecoveryPrompt.js
class ErrorRecoveryPrompt {
    generateRecoveryPrompt(lastError, failedAction, attempts) {
        return `
## Previous Attempt Failed
Action: ${failedAction.action}
Error: ${lastError}
Attempts: ${attempts}

## Recovery Strategies
1. Try a different selector
2. Use coordinates instead of selector
3. Wait and retry
4. Navigate to a different page first
5. Use a different approach entirely
        `;
    }
}
```

---

## Phase 2: Response Quality Improvements (P1 - High Impact)

### 2.1 Response Validator
**Goal:** Validate and correct LLM responses

**Tasks:**
- [ ] Create `ResponseValidator` class in `api/agent/responseValidator.js`
- [ ] Validate JSON structure
- [ ] Check action parameters
- [ ] Verify selector syntax
- [ ] Auto-correct common errors

**Implementation:**
```javascript
// api/agent/responseValidator.js
class ResponseValidator {
    validate(response) {
        const errors = [];
        
        // Check JSON structure
        if (!response.action) errors.push('Missing action');
        
        // Validate action type
        const validActions = ['click', 'clickAt', 'type', 'wait', 'verify', 'done', 'scroll', 'navigate'];
        if (!validActions.includes(response.action)) {
            errors.push(`Invalid action: ${response.action}`);
        }
        
        // Validate required parameters
        if (response.action === 'click' && !response.selector) {
            errors.push('Click action requires selector');
        }
        
        if (response.action === 'type' && (!response.selector || !response.value)) {
            errors.push('Type action requires selector and value');
        }
        
        return { valid: errors.length === 0, errors };
    }
    
    autoCorrect(response) {
        // Attempt to fix common errors
        const corrected = { ...response };
        
        // Fix selector format
        if (corrected.selector && !corrected.selector.startsWith('#') && !corrected.selector.startsWith('.')) {
            // Try to infer selector type
        }
        
        return corrected;
    }
}
```

### 2.2 Confidence Scoring
**Goal:** Score LLM response confidence

**Tasks:**
- [ ] Create `ConfidenceScorer` class
- [ ] Analyze response patterns
- [ ] Check against learned patterns
- [ ] Calculate confidence score
- [ ] Trigger re-prompt if confidence low

**Implementation:**
```javascript
// api/agent/confidenceScorer.js
class ConfidenceScorer {
    score(response, context) {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for common patterns
        if (this._isCommonPattern(response)) confidence += 0.2;
        
        // Boost confidence for clear selectors
        if (response.selector && response.selector.length > 3) confidence += 0.1;
        
        // Reduce confidence for vague actions
        if (response.action === 'wait' && !response.value) confidence -= 0.2;
        
        // Check against session history
        const historicalSuccess = sessionStore.getActionSuccessRate(
            context.url, response.selector, response.action
        );
        confidence = confidence * 0.7 + historicalSuccess * 0.3;
        
        return Math.max(0, Math.min(1, confidence));
    }
    
    shouldReprompt(confidence, threshold = 0.6) {
        return confidence < threshold;
    }
}
```

### 2.3 Response Caching with Semantic Similarity
**Goal:** Cache responses for similar contexts

**Tasks:**
- [ ] Create `ResponseCache` class
- [ ] Implement semantic similarity matching
- [ ] Add cache invalidation logic
- [ ] Track cache hit rates

**Implementation:**
```javascript
// api/agent/responseCache.js
class ResponseCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
    }
    
    getKey(context) {
        // Create semantic key from context
        const { url, goal, pageType, elementHash } = context;
        return `${url}|${goal}|${pageType}|${elementHash}`;
    }
    
    get(context) {
        const key = this.getKey(context);
        const cached = this.cache.get(key);
        
        if (cached && !this._isExpired(cached)) {
            return cached.response;
        }
        
        return null;
    }
    
    set(context, response, ttl = 300000) { // 5 minutes default
        const key = this.getKey(context);
        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            ttl,
        });
        
        // Evict oldest if over limit
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }
    
    _isExpired(cached) {
        return Date.now() - cached.timestamp > cached.ttl;
    }
}
```

---

## Phase 3: Context Management (P2 - Medium Impact)

### 3.1 Smart History Management
**Goal:** Better history selection for context

**Tasks:**
- [ ] Create `HistoryManager` class
- [ ] Implement relevance scoring
- [ ] Add history compression
- [ ] Track action outcomes

**Implementation:**
```javascript
// api/agent/historyManager.js
class HistoryManager {
    constructor() {
        this.history = [];
        this.maxSize = 50;
    }
    
    add(entry) {
        this.history.push({
            ...entry,
            timestamp: Date.now(),
            relevance: this._calculateRelevance(entry),
        });
        
        if (this.history.length > this.maxSize) {
            this._prune();
        }
    }
    
    getRelevant(currentContext, limit = 4) {
        // Score each history entry for relevance
        const scored = this.history.map(entry => ({
            entry,
            score: this._scoreRelevance(entry, currentContext),
        }));
        
        // Sort by score and return top entries
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.entry);
    }
    
    _scoreRelevance(entry, context) {
        let score = 0;
        
        // Same URL = higher relevance
        if (entry.url === context.url) score += 0.3;
        
        // Same goal = higher relevance
        if (entry.goal === context.goal) score += 0.3;
        
        // Recent = higher relevance
        const age = Date.now() - entry.timestamp;
        score += Math.max(0, 1 - age / 300000); // 5 minute decay
        
        // Successful actions = higher relevance
        if (entry.success) score += 0.2;
        
        return score;
    }
    
    _prune() {
        // Remove least relevant entries
        this.history.sort((a, b) => a.relevance - b.relevance);
        this.history = this.history.slice(-this.maxSize);
    }
}
```

### 3.2 Context Compression
**Goal:** Reduce token usage while maintaining context

**Tasks:**
- [ ] Create `ContextCompressor` class
- [ ] Implement AXTree summarization
- [ ] Add screenshot description generation
- [ ] Track compression ratios

**Implementation:**
```javascript
// api/agent/contextCompressor.js
class ContextCompressor {
    compressAXTree(tree, maxTokens = 1000) {
        // Extract only essential information
        const summary = {
            interactiveElements: this._extractInteractive(tree),
            forms: this._extractForms(tree),
            navigation: this._extractNavigation(tree),
            headings: this._extractHeadings(tree),
        };
        
        return JSON.stringify(summary);
    }
    
    describeScreenshot(screenshot) {
        // Generate text description of screenshot
        // This could use a vision model or heuristics
        return "Screenshot shows a form with input fields and a submit button";
    }
    
    _extractInteractive(tree) {
        // Extract interactive elements with selectors
        const elements = [];
        // ... traversal logic
        return elements;
    }
}
```

### 3.3 Memory-Augmented Prompts
**Goal:** Include learned patterns in prompts

**Tasks:**
- [ ] Create `MemoryInjector` class
- [ ] Query session store for patterns
- [ ] Inject relevant patterns into prompt
- [ ] Track pattern effectiveness

**Implementation:**
```javascript
// api/agent/memoryInjector.js
class MemoryInjector {
    async injectMemory(context) {
        const patterns = await sessionStore.getRelevantPatterns(
            context.url,
            context.goal
        );
        
        if (patterns.length === 0) return '';
        
        let memory = '\n## Learned Patterns\n';
        
        for (const pattern of patterns) {
            memory += `- ${pattern.description}: ${pattern.selector} (${pattern.successRate}% success)\n`;
        }
        
        return memory;
    }
}
```

---

## Phase 4: Error Handling & Recovery (P2 - Medium Impact)

### 4.1 Intelligent Retry Strategy
**Goal:** Smart retry with different approaches

**Tasks:**
- [ ] Create `RetryStrategy` class
- [ ] Implement strategy selection
- [ ] Track retry effectiveness
- [ ] Add exponential backoff

**Implementation:**
```javascript
// api/agent/retryStrategy.js
class RetryStrategy {
    constructor() {
        this.strategies = [
            'same_action_retry',
            'alternative_selector',
            'coordinate_click',
            'wait_and_retry',
            'scroll_and_retry',
            'navigate_back',
        ];
    }
    
    getNextStrategy(lastError, attempt) {
        // Select strategy based on error type and attempt count
        if (lastError.includes('selector')) {
            return 'alternative_selector';
        }
        
        if (lastError.includes('timeout')) {
            return 'wait_and_retry';
        }
        
        if (lastError.includes('not visible')) {
            return 'scroll_and_retry';
        }
        
        // Default: cycle through strategies
        return this.strategies[attempt % this.strategies.length];
    }
    
    shouldRetry(attempt, maxAttempts = 3) {
        return attempt < maxAttempts;
    }
}
```

### 4.2 Error Pattern Recognition
**Goal:** Learn from errors to prevent repetition

**Tasks:**
- [ ] Create `ErrorPatternLearner` class
- [ ] Track error patterns
- [ ] Generate prevention strategies
- [ ] Update prompts with warnings

**Implementation:**
```javascript
// api/agent/errorPatternLearner.js
class ErrorPatternLearner {
    constructor() {
        this.patterns = new Map();
    }
    
    recordError(error, context) {
        const key = this._getKey(error, context);
        
        if (!this.patterns.has(key)) {
            this.patterns.set(key, {
                count: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                contexts: [],
            });
        }
        
        const pattern = this.patterns.get(key);
        pattern.count++;
        pattern.lastSeen = Date.now();
        pattern.contexts.push(context);
    }
    
    getWarning(context) {
        const relevantPatterns = this._findRelevantPatterns(context);
        
        if (relevantPatterns.length > 0) {
            return `⚠️ Warning: This error has occurred ${relevantPatterns[0].count} times before. Consider alternative approaches.`;
        }
        
        return null;
    }
    
    _getKey(error, context) {
        // Create key from error type and context
        return `${error.type}|${context.pageType}`;
    }
}
```

### 4.3 Self-Healing Prompts
**Goal:** Prompts that adapt based on failures

**Tasks:**
- [ ] Create `SelfHealingPrompt` class
- [ ] Track failure patterns
- [ ] Generate adaptive instructions
- [ ] Update system prompt dynamically

**Implementation:**
```javascript
// api/agent/selfHealingPrompt.js
class SelfHealingPrompt {
    generateHealingInstructions(failures) {
        if (failures.length === 0) return '';
        
        let instructions = '\n## Recent Failures to Avoid\n';
        
        for (const failure of failures.slice(-3)) {
            instructions += `- ${failure.action} failed: ${failure.error}\n`;
            instructions += `  Alternative: ${failure.alternative}\n`;
        }
        
        return instructions;
    }
}
```

---

## Phase 5: Performance Optimization (P3 - Low Impact)

### 5.1 Prompt Caching
**Goal:** Cache generated prompts

**Tasks:**
- [ ] Create `PromptCache` class
- [ ] Implement cache key generation
- [ ] Add cache invalidation
- [ ] Track cache performance

### 5.2 Response Streaming
**Goal:** Stream LLM responses for faster feedback

**Tasks:**
- [ ] Implement streaming in `llmClient.js`
- [ ] Add progressive response handling
- [ ] Update UI with partial responses
- [ ] Handle stream interruptions

### 5.3 Batch Processing
**Goal:** Process multiple actions in batch

**Tasks:**
- [ ] Create `BatchProcessor` class
- [ ] Implement action batching
- [ ] Add batch validation
- [ ] Track batch performance

### 5.4 Token Optimization
**Goal:** Reduce token usage

**Tasks:**
- [ ] Create `TokenOptimizer` class
- [ ] Implement prompt compression
- [ ] Add abbreviation system
- [ ] Track token savings

---

## Implementation Priority

| Phase | Priority | Impact | Effort | Timeline |
|-------|----------|--------|--------|----------|
| 1. Prompt Engineering | P1 | 🔴 High | 🟡 Medium | Week 1-2 |
| 2. Response Quality | P1 | 🔴 High | 🟡 Medium | Week 2-3 |
| 3. Context Management | P2 | 🟡 Medium | 🟡 Medium | Week 3-4 |
| 4. Error Handling | P2 | 🟡 Medium | 🟢 Low | Week 4-5 |
| 5. Performance | P3 | 🟢 Low | 🟡 Medium | Week 5-6 |

---

## Success Metrics

1. **Response Accuracy**: >90% valid JSON responses
2. **First-Attempt Success**: >70% actions succeed on first try
3. **Token Usage**: 30% reduction in average tokens per request
4. **Response Time**: 20% faster average response time
5. **Error Recovery**: >80% errors recovered automatically
6. **Cache Hit Rate**: >40% for repetitive tasks

---

## Files to Create

1. `api/agent/promptAdapter.js` - Dynamic prompt adaptation
2. `api/agent/responseValidator.js` - Response validation
3. `api/agent/confidenceScorer.js` - Confidence scoring
4. `api/agent/responseCache.js` - Response caching
5. `api/agent/historyManager.js` - Smart history management
6. `api/agent/contextCompressor.js` - Context compression
7. `api/agent/memoryInjector.js` - Memory-augmented prompts
8. `api/agent/retryStrategy.js` - Intelligent retry
9. `api/agent/errorPatternLearner.js` - Error pattern recognition
10. `api/agent/selfHealingPrompt.js` - Self-healing prompts
11. `api/agent/promptCache.js` - Prompt caching
12. `api/agent/batchProcessor.js` - Batch processing
13. `api/agent/tokenOptimizer.js` - Token optimization

---

## Files to Modify

1. `api/agent/gameRunner.js` - Integrate all new modules
2. `api/agent/llmClient.js` - Add streaming support
3. `api/agent/semanticMapper.js` - Enhance with more patterns

---

## Notes

- Start with Phase 1 and 2 for maximum impact
- Each phase can be implemented independently
- Test thoroughly after each phase
- Update AGENT-JOURNAL.md after each implementation
