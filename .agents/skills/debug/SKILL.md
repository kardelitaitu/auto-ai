---
name: debug
description: |
  Debugging, troubleshooting, and problem diagnosis for the Auto-AI framework.
  Use when investigating errors, analyzing logs, diagnosing browser automation issues,
  troubleshooting session problems, or fixing code bugs.
  Triggers on tasks involving error investigation, log analysis, stack trace parsing,
  crash diagnosis, or performance troubleshooting.
license: MIT
metadata:
  author: Auto-AI Framework
  version: '1.0.0'
---

# Debugging Skill

Comprehensive guide for debugging the Auto-AI framework, analyzing errors,
and troubleshooting automation issues. This skill covers systematic debugging
approaches, log analysis, and common problem patterns.

## When to Use This Skill

Use this skill when:

- Investigating application errors or crashes
- Analyzing automation failures
- Troubleshooting browser connection issues
- Debugging task execution problems
- Analyzing log files for error patterns
- Reading and interpreting stack traces
- Diagnosing performance issues
- Investigating LLM/agent failures

## Debugging Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Reproduce  │───▶│  Collect    │───▶│  Analyze    │───▶│  Fix &      │
│  the Issue  │    │  Evidence   │    │  Root Cause │    │  Verify     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Quick Debugging Commands

```bash
# Run with verbose logging
DEBUG=orchestrator:*,agent:* node main.js taskName=url

# Check recent logs
tail -100 logs/app.log | grep -E "ERROR|WARN|FATAL"

# Test browser connection
node -e "const ws = require('ws'); const c = new ws('ws://localhost:9222'); c.on('open', () => console.log('Connected'));"

# Check running processes
ps aux | grep -E "node|chrome|browser"

# View memory usage
node -e "console.log(process.memoryUsage())"
```

## Common Auto-AI Issues

### 1. Browser Discovery Failures

```javascript
// Symptom: "No browsers found" or "Discovery failed"

async function debugBrowserDiscovery() {
    const diagnostics = {
        checks: []
    };
    
    // Check 1: Are browser processes running?
    const browserProcesses = await checkProcesses(['chrome', 'ixbrowser', 'brave']);
    diagnostics.checks.push({
        name: 'Browser Process',
        status: browserProcesses.length > 0 ? 'PASS' : 'FAIL',
        details: `Found ${browserProcesses.length} browser processes`
    });
    
    // Check 2: Are debug ports open?
    const ports = [9222, 9223, 18800, 18801];
    for (const port of ports) {
        const isOpen = await checkPort(port);
        diagnostics.checks.push({
            name: `Port ${port}`,
            status: isOpen ? 'OPEN' : 'CLOSED',
            details: isOpen ? 'Accepting connections' : 'Not listening'
        });
    }
    
    // Check 3: Can we connect via CDP?
    try {
        const response = await fetch('http://localhost:9222/json');
        diagnostics.checks.push({
            name: 'CDP Connection',
            status: 'PASS',
            details: `Response: ${response.status}`
        });
    } catch (e) {
        diagnostics.checks.push({
            name: 'CDP Connection',
            status: 'FAIL',
            details: e.message
        });
    }
    
    return diagnostics;
}

// Helper: Check if port is open
async function checkPort(port) {
    const net = require('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}
```

### 2. Session Disconnection Issues

```javascript
// Symptom: "Session disconnected" or "Browser context destroyed"

async function debugSessionIssues(session) {
    const issues = [];
    
    // Check browser connection state
    if (!session.browser.isConnected()) {
        issues.push({
            type: 'DISCONNECTED',
            severity: 'CRITICAL',
            message: 'Browser instance is disconnected',
            fix: 'Restart browser and re-discover'
        });
    }
    
    // Check for orphaned pages
    const contexts = session.browser.contexts();
    for (const context of contexts) {
        const pages = context.pages();
        for (const page of pages) {
            if (page.isClosed()) {
                issues.push({
                    type: 'CLOSED_PAGE',
                    severity: 'WARN',
                    message: 'Found closed page in context',
                    fix: 'Remove closed pages from tracking'
                });
            }
        }
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > memUsage.heapTotal * 0.8) {
        issues.push({
            type: 'HIGH_MEMORY',
            severity: 'WARN',
            message: `Heap usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            fix: 'Consider garbage collection or reducing concurrent sessions'
        });
    }
    
    return issues;
}
```

### 3. Task Execution Failures

```javascript
// Symptom: Tasks stuck, failing, or timing out

async function debugTaskExecution(task, error) {
    const analysis = {
        task: task.name,
        payload: task.payload,
        error: error.message,
        stack: error.stack,
        suggestions: []
    };
    
    // Analyze error type
    if (error.message.includes('timeout')) {
        analysis.suggestions.push({
            cause: 'Task took too long to complete',
            fixes: [
                'Increase taskTimeout in settings.json',
                'Check if page is loading correctly',
                'Verify network connectivity'
            ]
        });
    }
    
    if (error.message.includes('selector')) {
        analysis.suggestions.push({
            cause: 'Element not found on page',
            fixes: [
                'Verify selector is correct',
                'Add wait before action',
                'Check if page structure changed',
                'Use api.waitVisible() before click'
            ]
        });
    }
    
    if (error.message.includes('navigation')) {
        analysis.suggestions.push({
            cause: 'Page navigation failed',
            fixes: [
                'Check URL is valid',
                'Verify network connectivity',
                'Check for redirect loops',
                'Increase navigation timeout'
            ]
        });
    }
    
    if (error.message.includes('disconnected') || error.message.includes('Target closed')) {
        analysis.suggestions.push({
            cause: 'Browser or page disconnected',
            fixes: [
                'Check browser process is running',
                'Verify CDP connection is stable',
                'Reduce concurrent sessions',
                'Add reconnection logic'
            ]
        });
    }
    
    return analysis;
}
```

## Log Analysis Patterns

### 1. Parse Auto-AI Logs

```javascript
async function parseAutoAILogs(logPath, options = {}) {
    const { 
        tailLines = 1000, 
        level = null,
        component = null 
    } = options;
    
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -tailLines
    });
    
    const lines = logs.split('\n');
    const parsed = {
        errors: [],
        warnings: [],
        info: [],
        debug: []
    };
    
    // Log pattern: [timestamp] [level] [component] message
    const logPattern = /\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\]\s*\[(\w+)\]\s*\[([^\]]+)\]\s*(.*)/;
    
    for (const line of lines) {
        const match = line.match(logPattern);
        if (match) {
            const [, timestamp, logLevel, comp, message] = match;
            
            // Filter by level if specified
            if (level && logLevel.toUpperCase() !== level.toUpperCase()) continue;
            
            // Filter by component if specified
            if (component && !comp.toLowerCase().includes(component.toLowerCase())) continue;
            
            const entry = { timestamp, level: logLevel, component: comp, message };
            
            switch (logLevel.toUpperCase()) {
                case 'ERROR':
                case 'FATAL':
                    parsed.errors.push(entry);
                    break;
                case 'WARN':
                    parsed.warnings.push(entry);
                    break;
                case 'INFO':
                    parsed.info.push(entry);
                    break;
                case 'DEBUG':
                case 'TRACE':
                    parsed.debug.push(entry);
                    break;
            }
        }
    }
    
    return {
        summary: {
            errors: parsed.errors.length,
            warnings: parsed.warnings.length,
            info: parsed.info.length,
            debug: parsed.debug.length
        },
        ...parsed
    };
}
```

### 2. Error Pattern Detection

```javascript
async function detectErrorPatterns(logPath) {
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -5000
    });
    
    const errorPatterns = {
        'Session Disconnected': /session.*disconnected|browser.*disconnected|target.*closed/i,
        'Timeout': /timeout|timed out|exceeded.*timeout/i,
        'Element Not Found': /element.*not found|selector.*not found|no.*element/i,
        'Navigation Failed': /navigation.*failed|failed.*navigate|net::ERR/i,
        'Permission Denied': /permission denied|EACCES|unauthorized/i,
        'Memory Error': /out of memory|heap.*limit|ENOMEM/i,
        'Network Error': /ECONNREFUSED|ECONNRESET|network.*error/i,
        'LLM Error': /llm.*error|openrouter.*error|model.*error/i
    };
    
    const patterns = {};
    const lines = logs.split('\n');
    
    for (const [patternName, regex] of Object.entries(errorPatterns)) {
        const matches = lines.filter(line => regex.test(line));
        if (matches.length > 0) {
            patterns[patternName] = {
                count: matches.length,
                examples: matches.slice(0, 3),
                firstOccurrence: findTimestamp(matches[0]),
                lastOccurrence: findTimestamp(matches[matches.length - 1])
            };
        }
    }
    
    // Sort by frequency
    const sorted = Object.entries(patterns)
        .sort((a, b) => b[1].count - a[1].count)
        .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
    
    return sorted;
}
```

## Stack Trace Analysis

### 1. Parse Node.js Stack Trace

```javascript
function parseNodeStack(stack) {
    const frames = [];
    const lines = stack.split('\n');
    
    // Pattern: at Function (file:line:column)
    const pattern = /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/;
    
    for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
            const [, func, file, lineNum, col] = match;
            frames.push({
                function: func || '<anonymous>',
                file: file || 'unknown',
                line: parseInt(lineNum) || 0,
                column: parseInt(col) || 0,
                isInternal: file?.includes('node:') || file?.includes('node_modules'),
                raw: line.trim()
            });
        }
    }
    
    return {
        totalFrames: frames.length,
        internalFrames: frames.filter(f => f.isInternal).length,
        appFrames: frames.filter(f => !f.isInternal).length,
        frames,
        rootCause: frames.find(f => !f.isInternal) || frames[0]
    };
}
```

### 2. Extract Context from Stack

```javascript
async function extractErrorContext(stackAnalysis, sourceDir = null) {
    const context = [];
    
    for (const frame of stackAnalysis.frames.filter(f => !f.isInternal)) {
        if (frame.line > 0) {
            try {
                const filePath = sourceDir ? `${sourceDir}/${frame.file}` : frame.file;
                const startLine = Math.max(0, frame.line - 5);
                
                const code = await Desktop_Commander_read_file(filePath, {
                    offset: startLine,
                    length: 11
                });
                
                context.push({
                    file: frame.file,
                    function: frame.function,
                    line: frame.line,
                    code: code,
                    highlightLine: 6 // The error line in our 11-line window
                });
            } catch (e) {
                // File not found or unreadable
            }
        }
    }
    
    return context;
}
```

## Browser Automation Debugging

### 1. Page State Capture

```javascript
async function captureDebugState(page) {
    const state = {
        url: page.url(),
        title: await page.title(),
        viewport: page.viewportSize(),
        timestamp: new Date().toISOString()
    };
    
    try {
        // Capture screenshot
        state.screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 80
        });
        
        // Capture console logs
        state.consoleLogs = [];
        page.on('console', msg => {
            state.consoleLogs.push({
                type: msg.type(),
                text: msg.text()
            });
        });
        
        // Capture network failures
        state.networkErrors = [];
        page.on('requestfailed', request => {
            state.networkErrors.push({
                url: request.url(),
                error: request.failure()?.errorText
            });
        });
        
        // Get page metrics
        state.metrics = await page.metrics();
        
        // Get accessibility tree
        state.accessibility = await page.accessibility.snapshot();
        
    } catch (e) {
        state.captureError = e.message;
    }
    
    return state;
}
```

### 2. Element Debug Helper

```javascript
async function debugElement(page, selector) {
    const debug = {
        selector,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Check if element exists
        debug.exists = await page.locator(selector).count() > 0;
        
        if (debug.exists) {
            const element = page.locator(selector).first();
            
            // Get element properties
            debug.boundingBox = await element.boundingBox();
            debug.isVisible = await element.isVisible();
            debug.isEnabled = await element.isEnabled();
            debug.text = await element.textContent();
            debug.attributes = await element.evaluate(el => {
                const attrs = {};
                for (const attr of el.attributes) {
                    attrs[attr.name] = attr.value;
                }
                return attrs;
            });
            
            // Check if element is in viewport
            debug.inViewport = await element.isInViewport();
            
            // Get computed styles
            debug.styles = await element.evaluate(el => {
                const computed = window.getComputedStyle(el);
                return {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    position: computed.position
                };
            });
        }
        
    } catch (e) {
        debug.error = e.message;
    }
    
    return debug;
}
```

## LLM/Agent Debugging

### 1. Debug Agent Execution

```javascript
async function debugAgentExecution(agentResult) {
    const debug = {
        success: agentResult.success,
        steps: agentResult.steps || [],
        errors: []
    };
    
    // Analyze each step
    for (const step of debug.steps) {
        if (step.error) {
            debug.errors.push({
                step: step.action,
                error: step.error,
                timestamp: step.timestamp,
                context: step.context
            });
        }
    }
    
    // Check for common agent issues
    if (debug.steps.length === 0) {
        debug.issues = ['Agent took no steps - check goal parsing'];
    } else if (debug.steps.length > 50) {
        debug.issues = ['Agent took many steps - may be stuck in a loop'];
    }
    
    // Analyze LLM calls
    if (agentResult.llmCalls) {
        debug.llmStats = {
            totalCalls: agentResult.llmCalls.length,
            averageResponseTime: average(agentResult.llmCalls.map(c => c.duration)),
            errors: agentResult.llmCalls.filter(c => c.error).length
        };
    }
    
    return debug;
}
```

### 2. LLM Response Debugging

```javascript
async function debugLLMResponse(response, expectedFormat = null) {
    const debug = {
        raw: response,
        parsed: null,
        valid: false,
        issues: []
    };
    
    try {
        // Try to parse as JSON
        debug.parsed = JSON.parse(response);
        debug.valid = true;
    } catch (e) {
        debug.issues.push('Response is not valid JSON');
        
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                debug.parsed = JSON.parse(jsonMatch[0]);
                debug.valid = true;
                debug.issues.push('Extracted JSON from surrounding text');
            } catch (e2) {
                debug.issues.push('Could not extract valid JSON');
            }
        }
    }
    
    // Validate against expected format
    if (expectedFormat && debug.parsed) {
        for (const field of expectedFormat) {
            if (!(field in debug.parsed)) {
                debug.issues.push(`Missing required field: ${field}`);
            }
        }
    }
    
    return debug;
}
```

## Performance Debugging

### 1. Profile Task Execution

```javascript
async function profileTaskExecution(taskFn) {
    const profile = {
        startTime: Date.now(),
        checkpoints: [],
        memory: []
    };
    
    // Setup memory tracking
    const memoryInterval = setInterval(() => {
        profile.memory.push({
            time: Date.now() - profile.startTime,
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal
        });
    }, 1000);
    
    // Checkpoint helper
    const checkpoint = (name) => {
        profile.checkpoints.push({
            name,
            time: Date.now() - profile.startTime,
            memory: process.memoryUsage().heapUsed
        });
    };
    
    try {
        // Execute task with checkpointing
        checkpoint('start');
        const result = await taskFn(checkpoint);
        checkpoint('complete');
        
        profile.success = true;
        profile.result = result;
        profile.duration = Date.now() - profile.startTime;
        
    } catch (error) {
        checkpoint('error');
        profile.success = false;
        profile.error = error;
        profile.duration = Date.now() - profile.startTime;
    }
    
    clearInterval(memoryInterval);
    
    // Analyze profile
    profile.analysis = {
        totalTime: profile.duration,
        timeBetweenCheckpoints: profile.checkpoints.map((cp, i, arr) => ({
            from: arr[i-1]?.name || 'start',
            to: cp.name,
            duration: cp.time - (arr[i-1]?.time || 0)
        })),
        peakMemory: Math.max(...profile.memory.map(m => m.heapUsed)),
        memoryGrowth: profile.memory.length > 1 
            ? profile.memory[profile.memory.length - 1].heapUsed - profile.memory[0].heapUsed 
            : 0
    };
    
    return profile;
}
```

## Debug Utilities

### 1. Save Debug Snapshot

```javascript
async function saveDebugSnapshot(data, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug/${name}-${timestamp}.json`;
    
    await Desktop_Commander_write_file(filename, JSON.stringify({
        timestamp: new Date().toISOString(),
        name,
        data,
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        }
    }, null, 2));
    
    return filename;
}
```

### 2. Compare States

```javascript
function compareStates(state1, state2, ignoreFields = []) {
    const differences = [];
    
    const allKeys = new Set([
        ...Object.keys(state1 || {}),
        ...Object.keys(state2 || {})
    ]);
    
    for (const key of allKeys) {
        if (ignoreFields.includes(key)) continue;
        
        const val1 = state1?.[key];
        const val2 = state2?.[key];
        
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            differences.push({
                field: key,
                before: val1,
                after: val2
            });
        }
    }
    
    return {
        identical: differences.length === 0,
        differences
    };
}
```

## Debugging Checklist

### Before Debugging
- [ ] Reproduce the issue consistently
- [ ] Note the exact error message
- [ ] Identify what changed recently
- [ ] Gather relevant logs

### During Debugging
- [ ] Read error messages carefully
- [ ] Check the stack trace
- [ ] Look for patterns in logs
- [ ] Test hypotheses systematically
- [ ] Use debug snapshots

### After Fixing
- [ ] Verify the fix works
- [ ] Check for side effects
- [ ] Document the root cause
- [ ] Add tests if needed
- [ ] Update this guide if new pattern

## Common Fixes

| Issue | Quick Fix |
|-------|-----------|
| No browsers found | Check browser processes and ports |
| Session disconnected | Re-discover and get new session |
| Element not found | Add `api.waitVisible()` before action |
| Timeout errors | Increase timeout in settings |
| LLM errors | Check API key and model availability |
| Memory issues | Reduce concurrent sessions |
| Port conflicts | Check for existing processes on port |

## Debug Environment Setup

```javascript
// Enable debug mode
process.env.DEBUG = 'orchestrator:*,agent:*,api:*';

// Set log level
process.env.LOG_LEVEL = 'debug';

// Enable verbose timing
process.env.VERBOSE_TIMING = 'true';

// Disable humanization for faster debugging
process.env.DISABLE_HUMANIZATION = 'true';
```

## Best Practices

1. **Log early, log often** - Add debug logs before suspected issues
2. **Use structured logging** - Include context in log messages
3. **Capture state** - Save debug snapshots at key points
4. **Test in isolation** - Simplify to find root cause
5. **Check recent changes** - Git diff often reveals the issue
6. **Use breakpoints** - Pause execution to inspect state
7. **Monitor resources** - Memory and CPU can cause odd behavior
8. **Document findings** - Help future debugging efforts