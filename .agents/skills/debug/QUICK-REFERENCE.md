# Debug Quick Reference

## Common Commands

```bash
# Verbose logging
DEBUG=* node main.js task=url
DEBUG=orchestrator:* node main.js task=url
DEBUG=agent:* node main.js task=url

# Check ports
netstat -ano | findstr :9222
lsof -i :9222

# Check processes
ps aux | grep chrome
ps aux | grep node

# Memory check
node -e "console.log(process.memoryUsage())"

# Test WebSocket connection
node -e "const WebSocket = require('ws'); new WebSocket('ws://localhost:9222').on('open', () => console.log('OK'));"
```

## Log Locations

| Component | Log Location |
|-----------|--------------|
| Main | `logs/app.log` |
| Orchestrator | `logs/orchestrator.log` |
| Agent | `logs/agent.log` |
| API | `logs/api.log` |

## Error Patterns

### Browser Issues
```
ERROR: No browsers found
→ Check browser processes are running
→ Verify debug ports are open

ERROR: Session disconnected
→ Browser crashed or closed
→ Re-discover and get new session

ERROR: Target closed
→ Page or context was closed
→ Create new page/context
```

### Task Issues
```
ERROR: Timeout
→ Task took too long
→ Increase taskTimeout setting
→ Check page loading

ERROR: Element not found
→ Selector is wrong
→ Page structure changed
→ Add wait before action

ERROR: Navigation failed
→ URL invalid
→ Network issue
→ Redirect loop
```

### LLM Issues
```
ERROR: LLM timeout
→ Model too slow
→ Increase LLM timeout
→ Use faster model

ERROR: Invalid response
→ Response not JSON
→ Check prompt format
→ Validate response schema

ERROR: Rate limited
→ Too many requests
→ Add delay between calls
→ Use different API key
```

## Debug Code Snippets

### Check Browser Health
```javascript
async function checkBrowserHealth(browser) {
    try {
        const version = await browser.version();
        console.log('Browser version:', version);
        console.log('Is connected:', browser.isConnected());
        console.log('Contexts:', browser.contexts().length);
        return true;
    } catch (e) {
        console.error('Browser unhealthy:', e.message);
        return false;
    }
}
```

### Dump Page State
```javascript
async function dumpPageState(page) {
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
    console.log('Is closed:', page.isClosed());
    
    // Take screenshot
    await page.screenshot({ path: 'debug-state.png' });
    
    // Get page content summary
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Content preview:', text);
}
```

### Trace API Calls
```javascript
// Add to page to trace all requests
page.on('request', req => {
    if (req.url().includes('api')) {
        console.log('API Request:', req.method(), req.url());
    }
});

page.on('response', res => {
    if (res.url().includes('api')) {
        console.log('API Response:', res.status(), res.url());
    }
});
```

## Fix Patterns

### Retry with Backoff
```javascript
async function retryWithBackoff(fn, maxAttempts = 3, delay = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === maxAttempts - 1) throw e;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}
```

### Safe Element Action
```javascript
async function safeClick(page, selector, options = {}) {
    const { timeout = 5000, retries = 2 } = options;
    
    for (let i = 0; i <= retries; i++) {
        try {
            await page.waitForSelector(selector, { timeout });
            await page.click(selector);
            return true;
        } catch (e) {
            if (i === retries) throw e;
            await page.waitForTimeout(1000);
        }
    }
}
```

### Graceful Shutdown
```javascript
async function gracefulShutdown(orchestrator) {
    console.log('Shutting down...');
    
    try {
        await orchestrator.shutdown();
        console.log('Orchestrator stopped');
    } catch (e) {
        console.error('Shutdown error:', e);
    }
    
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown(orchestrator));
process.on('SIGTERM', () => gracefulShutdown(orchestrator));
```

## Settings Debug Configuration

```json
{
    "debug": {
        "logLevel": "debug",
        "verbose": true,
        "saveScreenshots": true,
        "savePageContent": true,
        "traceAPI": true
    },
    "timeouts": {
        "task": 60000,
        "navigation": 30000,
        "element": 10000,
        "llm": 120000
    },
    "retry": {
        "enabled": true,
        "maxAttempts": 3,
        "delay": 2000
    }
}
```
