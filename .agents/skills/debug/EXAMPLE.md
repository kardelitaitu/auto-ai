# Debug Skill - Examples

> **Practical examples for debugging, log analysis, and troubleshooting.**

## Table of Contents

- [Log Analysis](#log-analysis)
- [Error Pattern Detection](#error-pattern-detection)
- [Stack Trace Analysis](#stack-trace-analysis)
- [Browser Debugging](#browser-debugging)
- [Performance Debugging](#performance-debugging)
- [State Capture](#state-capture)
- [Debug Utilities](#debug-utilities)
- [Common Debug Patterns](#common-debug-patterns)

---

## Log Analysis

### Basic Log Parsing

```javascript
// Example: Parse structured logs
async function parseStructuredLogs(logPath, options = {}) {
    const { tailLines = 1000, level = null, component = null } = options;
    
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
    
    // Pattern: [timestamp] [level] [component] message
    const logPattern = /\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?)\]\s*\[(\w+)\]\s*\[([^\]]+)\]\s*(.*)/;
    
    lines.forEach((line, index) => {
        const match = line.match(logPattern);
        if (!match) return;
        
        const [, timestamp, logLevel, comp, message] = match;
        
        // Apply filters
        if (level && logLevel.toUpperCase() !== level.toUpperCase()) return;
        if (component && !comp.toLowerCase().includes(component.toLowerCase())) return;
        
        const entry = { 
            timestamp, 
            level: logLevel, 
            component: comp, 
            message,
            lineNumber: index + 1 
        };
        
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
    });
    
    return {
        summary: {
            total: lines.length,
            errors: parsed.errors.length,
            warnings: parsed.warnings.length,
            info: parsed.info.length,
            debug: parsed.debug.length
        },
        ...parsed
    };
}

// Usage
const logs = await parseStructuredLogs('/var/log/app.log', { 
    level: 'ERROR',
    tailLines: 5000 
});
console.log(`Found ${logs.errors.length} errors`);
```

### Log Time Range Analysis

```javascript
// Example: Analyze logs within time range
async function analyzeLogTimeRange(logPath, startTime, endTime) {
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -50000
    });
    
    const lines = logs.split('\n');
    const inRange = [];
    
    const timestampRegex = /\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/;
    
    lines.forEach((line, index) => {
        const match = line.match(timestampRegex);
        if (!match) return;
        
        const timestamp = match[1];
        if (timestamp >= startTime && timestamp <= endTime) {
            inRange.push({
                line: index + 1,
                timestamp,
                content: line
            });
        }
    });
    
    // Analyze the time range
    const errors = inRange.filter(l => l.content.includes('[ERROR]'));
    const warnings = inRange.filter(l => l.content.includes('[WARN]'));
    
    return {
        timeRange: { start: startTime, end: endTime },
        totalLines: inRange.length,
        errors: errors.length,
        warnings: warnings.length,
        errorRate: inRange.length > 0 
            ? ((errors.length / inRange.length) * 100).toFixed(2) + '%'
            : '0%',
        samples: {
            first: inRange[0],
            last: inRange[inRange.length - 1]
        }
    };
}

// Usage
const analysis = await analyzeLogTimeRange(
    '/var/log/app.log',
    '2024-01-15T10:00:00',
    '2024-01-15T11:00:00'
);
```

---

## Error Pattern Detection

### Error Categorization

```javascript
// Example: Categorize errors by type
async function categorizeErrors(logPath) {
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -10000
    });
    
    const errorCategories = {
        'Database': /database|mysql|postgres|mongo|redis|sql|connection.*refused/i,
        'Network': /network|timeout|ECONNREFUSED|ECONNRESET|socket|fetch/i,
        'Authentication': /auth|unauthorized|forbidden|401|403|token.*expired/i,
        'Memory': /memory|heap|OOM|out of memory|allocation failed/i,
        'File System': /ENOENT|EACCES|EISDIR|file.*not.*found|permission denied/i,
        'Validation': /validation|invalid|parse.*error|schema.*error/i,
        'External Service': /external|upstream|service.*unavailable|502|503|504/i,
        'Application': /null.*pointer|undefined.*reference|type.*error/i
    };
    
    const lines = logs.split('\n');
    const categorized = {};
    const uncategorized = [];
    
    lines.forEach((line, index) => {
        if (!line.includes('[ERROR]') && !line.includes('[FATAL]')) return;
        
        let matched = false;
        
        for (const [category, pattern] of Object.entries(errorCategories)) {
            if (pattern.test(line)) {
                if (!categorized[category]) {
                    categorized[category] = [];
                }
                categorized[category].push({
                    line: index + 1,
                    message: line.substring(0, 200),
                    timestamp: extractTimestamp(line)
                });
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            uncategorized.push({
                line: index + 1,
                message: line.substring(0, 200)
            });
        }
    });
    
    // Sort by count
    const sorted = Object.entries(categorized)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([category, errors]) => ({
            category,
            count: errors.length,
            percentage: ((errors.length / lines.filter(l => l.includes('[ERROR]')).length) * 100).toFixed(1) + '%',
            recent: errors.slice(-3)
        }));
    
    return {
        totalErrors: Object.values(categorized).flat().length + uncategorized.length,
        categories: sorted,
        uncategorized: uncategorized.length,
        topCategory: sorted[0]?.category || 'None'
    };
}

function extractTimestamp(line) {
    const match = line.match(/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : null;
}

// Usage
const errors = await categorizeErrors('/var/log/app.log');
console.log(`Top error category: ${errors.topCategory}`);
```

### Error Frequency Analysis

```javascript
// Example: Analyze error frequency over time
async function analyzeErrorFrequency(logPath, bucketMinutes = 5) {
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -50000
    });
    
    const lines = logs.split('\n');
    const buckets = new Map();
    
    lines.forEach(line => {
        if (!line.includes('[ERROR]')) return;
        
        const timestamp = extractTimestamp(line);
        if (!timestamp) return;
        
        // Round to bucket
        const date = new Date(timestamp);
        const bucketKey = `${date.toISOString().substring(0, 16)}:${Math.floor(date.getSeconds() / (bucketMinutes * 60)) * bucketMinutes}`;
        
        buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
    });
    
    const sorted = Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([bucket, count]) => ({ bucket, count }));
    
    // Calculate statistics
    const counts = sorted.map(s => s.count);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    
    return {
        bucketMinutes,
        totalBuckets: sorted.length,
        statistics: {
            average: avg.toFixed(2),
            max,
            min,
            peak: sorted.find(s => s.count === max)?.bucket
        },
        timeline: sorted,
        spikes: sorted.filter(s => s.count > avg * 2)
    };
}

// Usage
const frequency = await analyzeErrorFrequency('/var/log/app.log', 5);
console.log(`Average errors per 5min: ${frequency.statistics.average}`);
console.log(`Peak: ${frequency.statistics.peak}`);
```

---

## Stack Trace Analysis

### Node.js Stack Parsing

```javascript
// Example: Parse Node.js stack traces
function parseNodeStack(stack) {
    const frames = [];
    const lines = stack.split('\n');
    
    // Patterns for different stack formats
    const patterns = [
        // Standard: at Function (file:line:column)
        /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?)\)?/,
        // Anonymous: at file:line:column
        /at\s+(?:(.+?):(\d+)(?::(\d+))?)/
    ];
    
    // Extract error message (first line)
    const errorMatch = lines[0].match(/^(\w+Error|Error):\s*(.+)/);
    const errorInfo = errorMatch ? {
        type: errorMatch[1],
        message: errorMatch[2]
    } : null;
    
    // Parse frames
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        for (const pattern of patterns) {
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
                break;
            }
        }
    }
    
    // Find root cause (first non-internal frame)
    const appFrames = frames.filter(f => !f.isInternal);
    const rootCause = appFrames[appFrames.length - 1] || frames[0];
    
    return {
        error: errorInfo,
        totalFrames: frames.length,
        internalFrames: frames.filter(f => f.isInternal).length,
        appFrames: appFrames.length,
        frames,
        rootCause
    };
}

// Usage
const stack = `TypeError: Cannot read property 'id' of undefined
    at User.findById (/app/src/services/user.js:45:23)
    at async UserController.get (/app/src/controllers/user.js:12:20)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:144:13)`;

const parsed = parseNodeStack(stack);
console.log(`Error: ${parsed.error.type}: ${parsed.error.message}`);
console.log(`Root cause: ${parsed.rootCause.function} at ${parsed.rootCause.file}:${parsed.rootCause.line}`);
```

### Extract Error Context

```javascript
// Example: Extract source code context from stack
async function extractErrorContext(stackAnalysis, projectDir = null) {
    const context = [];
    
    for (const frame of stackAnalysis.frames.filter(f => !f.isInternal && f.line > 0)) {
        try {
            const filePath = projectDir ? `${projectDir}/${frame.file}` : frame.file;
            const startLine = Math.max(0, frame.line - 5);
            
            const code = await Desktop_Commander_read_file(filePath, {
                offset: startLine,
                length: 11 // 5 before, the line, 5 after
            });
            
            const codeLines = code.split('\n');
            
            context.push({
                function: frame.function,
                file: frame.file,
                line: frame.line,
                code: codeLines.map((c, i) => ({
                    lineNum: startLine + i + 1,
                    content: c,
                    isErrorLine: startLine + i + 1 === frame.line
                }))
            });
        } catch (e) {
            // File not found or unreadable
        }
    }
    
    return context;
}

// Usage
const stack = parseNodeStack(error.stack);
const context = await extractErrorContext(stack, '/project');
context.forEach(ctx => {
    console.log(`\nIn ${ctx.function} (${ctx.file}:${ctx.line}):`);
    ctx.code.forEach(c => {
        const marker = c.isErrorLine ? '>>> ' : '    ';
        console.log(`${marker}${c.lineNum}: ${c.content}`);
    });
});
```

---

## Browser Debugging

### Page State Capture

```javascript
// Example: Capture comprehensive page state for debugging
async function captureDebugState(page, options = {}) {
    const {
        includeScreenshot = true,
        includeConsole = true,
        includeNetwork = true,
        includeAccessibility = true
    } = options;
    
    const state = {
        url: page.url(),
        title: await page.title(),
        viewport: page.viewportSize(),
        timestamp: new Date().toISOString()
    };
    
    // Screenshot
    if (includeScreenshot) {
        try {
            state.screenshot = await page.screenshot({
                type: 'jpeg',
                quality: 80,
                fullPage: false
            });
        } catch (e) {
            state.screenshotError = e.message;
        }
    }
    
    // Console logs
    if (includeConsole) {
        state.consoleLogs = [];
        page.on('console', msg => {
            state.consoleLogs.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString()
            });
        });
    }
    
    // Network failures
    if (includeNetwork) {
        state.networkErrors = [];
        page.on('requestfailed', request => {
            state.networkErrors.push({
                url: request.url(),
                method: request.method(),
                error: request.failure()?.errorText,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    // Accessibility tree
    if (includeAccessibility) {
        try {
            state.accessibility = await page.accessibility.snapshot();
        } catch (e) {
            state.accessibilityError = e.message;
        }
    }
    
    // Page metrics
    try {
        state.metrics = await page.metrics();
    } catch (e) {
        state.metricsError = e.message;
    }
    
    // Current elements state
    try {
        state.activeElement = await page.evaluate(() => {
            const el = document.activeElement;
            return el ? {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                text: el.textContent?.substring(0, 100)
            } : null;
        });
    } catch (e) {
        // Ignore
    }
    
    return state;
}

// Usage
const state = await captureDebugState(page);
console.log('URL:', state.url);
console.log('Network errors:', state.networkErrors.length);
```

### Element Debug Helper

```javascript
// Example: Debug an element's state
async function debugElement(page, selector) {
    const debug = {
        selector,
        timestamp: new Date().toISOString(),
        checks: []
    };
    
    // Check existence
    const exists = await page.locator(selector).count() > 0;
    debug.checks.push({ check: 'exists', result: exists });
    
    if (!exists) {
        debug.summary = 'Element not found';
        return debug;
    }
    
    const element = page.locator(selector).first();
    
    // Visibility
    const isVisible = await element.isVisible();
    debug.checks.push({ check: 'visible', result: isVisible });
    
    // Bounding box
    const box = await element.boundingBox();
    debug.boundingBox = box;
    debug.checks.push({ check: 'hasBounds', result: !!box });
    
    // Enabled state
    const isEnabled = await element.isEnabled();
    debug.checks.push({ check: 'enabled', result: isEnabled });
    
    // Content
    const text = await element.textContent();
    debug.text = text?.substring(0, 200);
    
    // Attributes
    debug.attributes = await element.evaluate(el => {
        const attrs = {};
        for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
        }
        return attrs;
    });
    
    // Computed styles
    debug.styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            position: computed.position,
            zIndex: computed.zIndex
        };
    });
    
    // In viewport
    const inViewport = await element.isInViewport();
    debug.checks.push({ check: 'inViewport', result: inViewport });
    
    // Summary
    debug.summary = {
        found: exists,
        interactable: exists && isVisible && isEnabled,
        issues: debug.checks.filter(c => !c.result).map(c => c.check)
    };
    
    return debug;
}

// Usage
const debug = await debugElement(page, '#submit-button');
console.log('Interactable:', debug.summary.interactable);
if (debug.summary.issues.length > 0) {
    console.log('Issues:', debug.summary.issues.join(', '));
}
```

---

## Performance Debugging

### Task Execution Profiling

```javascript
// Example: Profile task execution
async function profileTaskExecution(taskName, taskFn) {
    const profile = {
        task: taskName,
        startTime: Date.now(),
        checkpoints: [],
        memorySnapshots: []
    };
    
    // Memory tracking
    const memoryInterval = setInterval(() => {
        profile.memorySnapshots.push({
            time: Date.now() - profile.startTime,
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external
        });
    }, 1000);
    
    // Checkpoint function
    const checkpoint = (name) => {
        profile.checkpoints.push({
            name,
            time: Date.now() - profile.startTime,
            memory: process.memoryUsage().heapUsed
        });
    };
    
    try {
        checkpoint('start');
        const result = await taskFn(checkpoint);
        checkpoint('complete');
        
        profile.success = true;
        profile.result = result;
        profile.duration = Date.now() - profile.startTime;
        
    } catch (error) {
        checkpoint('error');
        profile.success = false;
        profile.error = {
            message: error.message,
            stack: error.stack
        };
        profile.duration = Date.now() - profile.startTime;
    }
    
    clearInterval(memoryInterval);
    
    // Analyze
    profile.analysis = {
        totalTime: profile.duration,
        checkpoints: profile.checkpoints.map((cp, i, arr) => ({
            name: cp.name,
            time: cp.time,
            sinceLast: arr[i-1] ? cp.time - arr[i-1].time : 0
        })),
        memory: {
            peak: Math.max(...profile.memorySnapshots.map(m => m.heapUsed)),
            growth: profile.memorySnapshots.length > 1
                ? profile.memorySnapshots[profile.memorySnapshots.length - 1].heapUsed - 
                  profile.memorySnapshots[0].heapUsed
                : 0
        }
    };
    
    return profile;
}

// Usage
const profile = await profileTaskExecution('dataProcessing', async (checkpoint) => {
    checkpoint('loadData');
    const data = await loadData();
    
    checkpoint('processData');
    const result = await processData(data);
    
    checkpoint('saveResult');
    await saveResult(result);
    
    return result;
});

console.log(`Task completed in ${profile.duration}ms`);
console.log('Checkpoints:', profile.analysis.checkpoints);
```

---

## State Capture

### Save Debug Snapshot

```javascript
// Example: Save debug snapshot to file
async function saveDebugSnapshot(name, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `debug/${name}-${timestamp}.json`;
    
    const snapshot = {
        name,
        timestamp: new Date().toISOString(),
        data,
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            cwd: process.cwd()
        }
    };
    
    await Desktop_Commander_write_file(filename, JSON.stringify(snapshot, null, 2));
    
    return filename;
}

// Usage
const snapshotId = await saveDebugSnapshot('session-error', {
    error: error.message,
    session: session.id,
    url: page.url(),
    state: await captureDebugState(page)
});
console.log(`Snapshot saved: ${snapshotId}`);
```

### Compare States

```javascript
// Example: Compare two states
function compareStates(before, after, options = {}) {
    const { ignoreFields = [], deep = true } = options;
    
    const differences = [];
    
    function compare(obj1, obj2, path = '') {
        const allKeys = new Set([
            ...Object.keys(obj1 || {}),
            ...Object.keys(obj2 || {})
        ]);
        
        for (const key of allKeys) {
            if (ignoreFields.includes(key)) continue;
            
            const fullPath = path ? `${path}.${key}` : key;
            const val1 = obj1?.[key];
            const val2 = obj2?.[key];
            
            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                if (deep && typeof val1 === 'object' && typeof val2 === 'object') {
                    compare(val1, val2, fullPath);
                } else {
                    differences.push({
                        field: fullPath,
                        before: val1,
                        after: val2,
                        type: val1 === undefined ? 'ADDED' : 
                              val2 === undefined ? 'REMOVED' : 'CHANGED'
                    });
                }
            }
        }
    }
    
    compare(before, after);
    
    return {
        identical: differences.length === 0,
        differences,
        summary: {
            added: differences.filter(d => d.type === 'ADDED').length,
            removed: differences.filter(d => d.type === 'REMOVED').length,
            changed: differences.filter(d => d.type === 'CHANGED').length
        }
    };
}

// Usage
const state1 = await captureDebugState(page);
// ... do something ...
const state2 = await captureDebugState(page);

const diff = compareStates(state1, state2, {
    ignoreFields: ['timestamp', 'screenshot']
});
console.log('Changes:', diff.summary);
```

---

## Debug Utilities

### Debug Logger

```javascript
// Example: Debug logger with levels
class DebugLogger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.prefix = options.prefix || 'DEBUG';
        this.levels = {
            trace: 0,
            debug: 1,
            info: 2,
            warn: 3,
            error: 4,
            fatal: 5
        };
    }
    
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.level];
    }
    
    format(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}]`;
        
        if (data) {
            return `${prefix} ${message} ${JSON.stringify(data)}`;
        }
        return `${prefix} ${message}`;
    }
    
    trace(message, data) {
        if (this.shouldLog('trace')) console.log(this.format('trace', message, data));
    }
    
    debug(message, data) {
        if (this.shouldLog('debug')) console.log(this.format('debug', message, data));
    }
    
    info(message, data) {
        if (this.shouldLog('info')) console.log(this.format('info', message, data));
    }
    
    warn(message, data) {
        if (this.shouldLog('warn')) console.warn(this.format('warn', message, data));
    }
    
    error(message, data) {
        if (this.shouldLog('error')) console.error(this.format('error', message, data));
    }
    
    fatal(message, data) {
        if (this.shouldLog('fatal')) console.error(this.format('fatal', message, data));
    }
}

// Usage
const logger = new DebugLogger({ level: 'debug', prefix: 'APP' });
logger.info('Starting application');
logger.debug('User data', { userId: 123, name: 'John' });
logger.error('Connection failed', { host: 'localhost', port: 5432 });
```

### Retry with Logging

```javascript
// Example: Retry with debug logging
async function retryWithDebug(fn, options = {}) {
    const {
        maxAttempts = 3,
        delay = 1000,
        backoff = 'exponential',
        onRetry = null
    } = options;
    
    const logger = new DebugLogger({ prefix: 'RETRY' });
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            logger.debug(`Attempt ${attempt}/${maxAttempts}`);
            const result = await fn();
            logger.info(`Success on attempt ${attempt}`);
            return result;
            
        } catch (error) {
            logger.warn(`Attempt ${attempt} failed`, { error: error.message });
            
            if (attempt === maxAttempts) {
                logger.error(`All ${maxAttempts} attempts failed`);
                throw error;
            }
            
            const waitTime = backoff === 'exponential' 
                ? delay * Math.pow(2, attempt - 1)
                : delay;
            
            logger.debug(`Waiting ${waitTime}ms before retry`);
            
            if (onRetry) {
                await onRetry(attempt, error, waitTime);
            }
            
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}

// Usage
const result = await retryWithDebug(
    async () => {
        const response = await fetch('https://api.example.com/data');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },
    { maxAttempts: 3, delay: 2000, backoff: 'exponential' }
);
```

---

## Common Debug Patterns

### Debugging Workflow Template

```javascript
// Example: Standard debugging workflow
async function debugWorkflow(error, context) {
    console.log('\n=== DEBUGGING WORKFLOW ===\n');
    
    // 1. Capture initial state
    console.log('1. Capturing initial state...');
    const snapshot = await saveDebugSnapshot('error-state', {
        error: {
            message: error.message,
            stack: error.stack
        },
        context
    });
    console.log(`   Snapshot saved: ${snapshot}`);
    
    // 2. Parse stack trace
    console.log('2. Analyzing stack trace...');
    if (error.stack) {
        const stack = parseNodeStack(error.stack);
        console.log(`   Root cause: ${stack.rootCause.function}`);
        console.log(`   Location: ${stack.rootCause.file}:${stack.rootCause.line}`);
    }
    
    // 3. Check recent logs
    console.log('3. Checking recent logs...');
    const errors = await analyzeErrorPatterns('/var/log/app.log');
    console.log(`   Recent error patterns: ${Object.keys(errors).length}`);
    
    // 4. Generate report
    console.log('4. Generating debug report...');
    const report = {
        timestamp: new Date().toISOString(),
        error: error.message,
        snapshot,
        stackAnalysis: error.stack ? parseNodeStack(error.stack) : null,
        recentPatterns: errors
    };
    
    console.log('\n=== DEBUG REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    return report;
}

// Usage
try {
    // ... code that might fail ...
} catch (error) {
    await debugWorkflow(error, { userId: 123, action: 'checkout' });
}
```

---

## Best Practices

1. **Capture state early** - Don't let bugs escape without context
2. **Use structured logging** - Include context in log messages
3. **Add checkpoints** - Track progress through complex operations
4. **Save snapshots** - Preserve state for later analysis
5. **Compare states** - Find what changed between working and broken
6. **Profile performance** - Identify bottlenecks early
7. **Use appropriate log levels** - Don't log everything at ERROR
8. **Clean up debug code** - Remove or disable in production

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview and API reference
- [Auto-AI Documentation](https://docs.auto-ai.dev) - Full framework docs
