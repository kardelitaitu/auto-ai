# Plan 0007: Performance Optimization

## Objective
Profile and optimize slow startup paths to reduce task initialization time.

## Current Issues
- Browser discovery can be slow
- Config loading may block
- Docker LLM check adds latency
- Parallel initialization may not be optimal

## Startup Flow Analysis

### Current Sequence (from main.js)
1. Show banner
2. Check Docker LLM (blocking)
3. Initialize orchestrator
4. Discover browsers (can take 10+ seconds)
5. Parse tasks
6. Execute tasks

### Bottlenecks
| Step | Est. Time | Severity |
|------|-----------|----------|
| Docker LLM check | 2-5s | High |
| Browser discovery | 5-15s | High |
| Config loading | 1-2s | Medium |
| Task parsing | <1s | Low |

## Optimization Strategies

### 1. Docker LLM Check - Make Non-Blocking
```javascript
// Current: blocking
const dockerReady = await ensureDockerLLM();

// Proposed: fire-and-forget
ensureDockerLLM().then(ready => {
    if (!ready) logger.warn('Docker LLM not ready');
});
```

### 2. Browser Discovery - Parallel Connect
- Connect to all browsers in parallel
- Add timeout per browser
- Track failures separately

### 3. Lazy Loading
- Defer loading of unused modules
- Load task modules on-demand
- Dynamic imports for heavy dependencies

### 4. Caching
- Cache profile configurations
- Cache browser endpoints
- Cache LLM responses

### 5. Connection Pooling
- Reuse CDP connections
- Keep sessions alive between tasks
- Reduce new browser launches

## Implementation Plan

### Phase 1: Profiling
Add timing to startup:
```javascript
const start = Date.now();
// ... startup steps
console.log(`Startup took ${Date.now() - start}ms`);
```

### Phase 2: Quick Wins
1. Make Docker check async
2. Add browser connect timeouts
3. Optimize config loading

### Phase 3: Major Changes
1. Implement lazy loading
2. Add connection pooling
3. Optimize orchestrator startup

## Files to Modify
- main.js
- api/core/orchestrator.js
- api/utils/dockerLLM.js
- api/utils/configLoader.js

## Success Criteria
- Startup time reduced by 30%+
- No functional regressions
- Better error messages for slow operations

## Estimated Effort
- High (~8-12 hours)
- Requires extensive testing

## Dependencies
- Browser vendor APIs
- CDP protocol knowledge
- Performance profiling tools

## Risks
- Breaking browser connections
- Race conditions in parallel code
- Must maintain error handling
