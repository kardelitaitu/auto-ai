# Plan 0006: Error Handling Improvements

## Objective
Add robust retry logic to fragile network operations across the codebase.

## Current State
- Some retry logic exists in orchestrator
- Task modules have basic error handling
- Network operations may fail silently

## Fragile Operations to Target

### 1. Browser Connections
- CDP connections to anti-detect browsers
- Session creation
- Page navigation

### 2. Network Requests
- API calls to Twitter
- LLM inference calls
- External service calls

### 3. File Operations
- Profile loading
- Config file reading
- Log file writing

### 4. Docker Operations
- LLM container checks
- Container health monitoring

## Implementation Strategy

### Pattern: Exponential Backoff
```javascript
async function withRetry(fn, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelay = options.baseDelay ?? 1000;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            const delay = baseDelay * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
}
```

### Implementation Steps
1. Create retry utility: api/utils/retry.js
2. Identify fragile operations
3. Wrap with retry logic
4. Add proper logging
5. Test failure scenarios

## Key Considerations
- Distinguish retryable vs non-retryable errors
- Non-retryable: Auth errors, validation errors
- Retryable: Network timeout, 503, rate limits
- Add circuit breaker for persistent failures

## Files to Create
- api/utils/retry.js - Retry utility

## Files to Modify
- api/core/orchestrator.js
- api/twitter/ai-twitterAgent.js
- api/actions/*.js
- Tasks with external calls

## Success Criteria
- Network failures gracefully handled
- Users notified of persistent failures
- No silent failures
- Logs capture retry attempts

## Estimated Effort
- High (~5-8 hours)
- Requires careful testing

## Dependencies
- None (pure JS implementation)

## Risks
- Over-retries can worsen performance
- Must avoid retrying non-retryable errors
- Test failure scenarios carefully
