# Analyze Skill - Examples

> **Practical examples demonstrating file analysis capabilities.**

## Table of Contents

- [Basic File Analysis](#basic-file-analysis)
- [Code Structure Extraction](#code-structure-extraction)
- [Log File Analysis](#log-file-analysis)
- [Configuration Validation](#configuration-validation)
- [Batch Processing](#batch-processing)
- [Performance Monitoring](#performance-monitoring)
- [Error Handling](#error-handling)
- [Custom Analyzers](#custom-analyzers)

---

## Basic File Analysis

### Reading and Parsing Files

```javascript
// Example: Basic file content analysis
async function basicAnalysis(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    
    const analysis = {
        file: filePath,
        size: content.length,
        lines: content.split('\n').length,
        words: content.split(/\s+/).filter(w => w).length,
        characters: content.length
    };
    
    console.log('File Analysis:', analysis);
    return analysis;
}

// Usage
await basicAnalysis('/project/src/app.js');
// Output: { file: '/project/src/app.js', size: 15234, lines: 456, words: 2341, characters: 15234 }
```

### Extracting Metadata

```javascript
// Example: Extract file metadata
async function extractMetadata(filePath) {
    const info = await Desktop_Commander_get_file_info(filePath);
    const content = await Desktop_Commander_read_file(filePath);
    
    return {
        path: filePath,
        name: info.name,
        extension: info.ext,
        size: info.size,
        sizeFormatted: formatBytes(info.size),
        created: info.birthtime,
        modified: info.mtime,
        accessed: info.atime,
        permissions: info.mode,
        firstLine: content.split('\n')[0],
        lastLine: content.split('\n').pop()
    };
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
```

---

## Code Structure Extraction

### JavaScript/TypeScript Analysis

```javascript
// Example: Extract JavaScript code structure
async function analyzeJavaScript(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    
    const structure = {
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        constants: [],
        comments: []
    };
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Extract imports
        if (trimmed.startsWith('import ')) {
            const match = trimmed.match(/import\s+{?([^}]+)}?\s+from\s+['"](.+)['"]/);
            if (match) {
                structure.imports.push({
                    module: match[2],
                    items: match[1].split(',').map(s => s.trim()),
                    line: index + 1
                });
            }
        }
        
        // Extract exports
        if (trimmed.startsWith('export ')) {
            structure.exports.push({
                type: trimmed.includes('default') ? 'default' : 'named',
                declaration: trimmed.substring(0, 80),
                line: index + 1
            });
        }
        
        // Extract functions
        if (trimmed.match(/^(async\s+)?function\s+\w+/)) {
            const match = trimmed.match(/^(async\s+)?function\s+(\w+)/);
            structure.functions.push({
                name: match[2],
                async: !!match[1],
                line: index + 1
            });
        }
        
        // Extract classes
        if (trimmed.startsWith('class ')) {
            const match = trimmed.match(/class\s+(\w+)/);
            if (match) {
                structure.classes.push({
                    name: match[1],
                    line: index + 1
                });
            }
        }
        
        // Extract constants
        if (trimmed.match(/^const\s+[A-Z_]+/)) {
            const match = trimmed.match(/^const\s+([A-Z_]+)/);
            if (match) {
                structure.constants.push({
                    name: match[1],
                    line: index + 1
                });
            }
        }
        
        // Extract comments
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            structure.comments.push({
                type: trimmed.startsWith('//') ? 'single' : 'multi',
                content: trimmed.substring(0, 100),
                line: index + 1
            });
        }
    });
    
    return structure;
}

// Usage
const jsStructure = await analyzeJavaScript('/project/src/index.js');
console.log(`Found ${jsStructure.functions.length} functions, ${jsStructure.classes.length} classes`);
```

### Python Analysis

```javascript
// Example: Extract Python code structure
async function analyzePython(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    
    const structure = {
        imports: [],
        classes: [],
        functions: [],
        decorators: [],
        docstrings: []
    };
    
    const lines = content.split('\n');
    let inDocstring = false;
    let docstringContent = '';
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        
        // Track docstrings
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
            if (inDocstring) {
                structure.docstrings.push({
                    content: docstringContent,
                    line: index + 1
                });
                inDocstring = false;
                docstringContent = '';
            } else {
                inDocstring = true;
            }
        } else if (inDocstring) {
            docstringContent += trimmed + '\n';
        }
        
        // Extract imports
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
            structure.imports.push({
                statement: trimmed,
                line: index + 1
            });
        }
        
        // Extract classes
        if (trimmed.startsWith('class ')) {
            const match = trimmed.match(/class\s+(\w+)/);
            if (match) {
                structure.classes.push({
                    name: match[1],
                    line: index + 1
                });
            }
        }
        
        // Extract functions
        if (trimmed.startsWith('def ')) {
            const match = trimmed.match(/def\s+(\w+)/);
            if (match) {
                structure.functions.push({
                    name: match[1],
                    async: trimmed.includes('async'),
                    line: index + 1
                });
            }
        }
        
        // Extract decorators
        if (trimmed.startsWith('@')) {
            structure.decorators.push({
                name: trimmed.substring(1),
                line: index + 1
            });
        }
    });
    
    return structure;
}
```

---

## Log File Analysis

### Error Pattern Detection

```javascript
// Example: Analyze log files for error patterns
async function analyzeLogErrors(logPath, options = {}) {
    const { tailLines = 10000 } = options;
    
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -tailLines
    });
    
    const lines = logs.split('\n');
    const errors = [];
    const warnings = [];
    const errorPatterns = new Map();
    
    const errorRegex = /\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\]\s*\[ERROR\]\s*(.+)/i;
    const warningRegex = /\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\]\s*\[WARN\]\s*(.+)/i;
    
    lines.forEach((line, index) => {
        const errorMatch = line.match(errorRegex);
        if (errorMatch) {
            const [, timestamp, message] = errorMatch;
            errors.push({ timestamp, message, line: index + 1 });
            
            // Track error patterns
            const pattern = message.split(':')[0] || message.substring(0, 50);
            errorPatterns.set(pattern, (errorPatterns.get(pattern) || 0) + 1);
        }
        
        const warningMatch = line.match(warningRegex);
        if (warningMatch) {
            const [, timestamp, message] = warningMatch;
            warnings.push({ timestamp, message, line: index + 1 });
        }
    });
    
    // Sort patterns by frequency
    const sortedPatterns = Array.from(errorPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count }));
    
    return {
        summary: {
            totalLines: lines.length,
            errors: errors.length,
            warnings: warnings.length,
            errorRate: ((errors.length / lines.length) * 100).toFixed(2) + '%'
        },
        topErrorPatterns: sortedPatterns,
        recentErrors: errors.slice(-5),
        recentWarnings: warnings.slice(-5)
    };
}

// Usage
const logAnalysis = await analyzeLogErrors('/var/log/app.log');
console.log(`Error rate: ${logAnalysis.summary.errorRate}`);
console.log('Top error patterns:', logAnalysis.topErrorPatterns);
```

### Timeline Analysis

```javascript
// Example: Analyze log timeline
async function analyzeTimeline(logPath) {
    const logs = await Desktop_Commander_read_file(logPath, {
        offset: -50000
    });
    
    const lines = logs.split('\n');
    const hourlyStats = new Map();
    
    const timestampRegex = /\[(\d{4}-\d{2}-\d{2})\s+(\d{2}):\d{2}:\d{2})\]/;
    
    lines.forEach(line => {
        const match = line.match(timestampRegex);
        if (match) {
            const [, date, hour] = match;
            const key = `${date} ${hour}:00`;
            
            if (!hourlyStats.has(key)) {
                hourlyStats.set(key, { total: 0, errors: 0, warnings: 0 });
            }
            
            const stats = hourlyStats.get(key);
            stats.total++;
            
            if (line.includes('[ERROR]')) stats.errors++;
            if (line.includes('[WARN]')) stats.warnings++;
        }
    });
    
    return Array.from(hourlyStats.entries())
        .map(([hour, stats]) => ({
            hour,
            ...stats,
            errorRate: ((stats.errors / stats.total) * 100).toFixed(2) + '%'
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));
}
```

---

## Configuration Validation

### JSON Configuration Validation

```javascript
// Example: Validate JSON configuration
async function validateJsonConfig(configPath, schema = null) {
    const content = await Desktop_Commander_read_file(configPath);
    
    const result = {
        valid: true,
        errors: [],
        warnings: [],
        data: null
    };
    
    // Parse JSON
    try {
        result.data = JSON.parse(content);
    } catch (e) {
        result.valid = false;
        result.errors.push({
            type: 'PARSE_ERROR',
            message: e.message,
            position: extractJsonErrorPosition(e.message)
        });
        return result;
    }
    
    // Check for common issues
    const issues = findConfigIssues(result.data, '');
    result.warnings.push(...issues.warnings);
    result.errors.push(...issues.errors);
    
    // Validate against schema if provided
    if (schema) {
        const schemaErrors = validateAgainstSchema(result.data, schema);
        result.errors.push(...schemaErrors);
    }
    
    result.valid = result.errors.length === 0;
    return result;
}

function findConfigIssues(obj, path, depth = 0) {
    const issues = { errors: [], warnings: [] };
    
    if (depth > 10) {
        issues.errors.push({ path, message: 'Maximum nesting depth exceeded' });
        return issues;
    }
    
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check for empty strings
        if (value === '') {
            issues.warnings.push({
                path: currentPath,
                message: 'Empty string value',
                severity: 'warning'
            });
        }
        
        // Check for default passwords
        if (key.toLowerCase().includes('password') && 
            ['password', 'admin', '123456'].includes(value.toLowerCase())) {
            issues.errors.push({
                path: currentPath,
                message: 'Default or weak password detected',
                severity: 'error'
            });
        }
        
        // Check for localhost in production
        if (typeof value === 'string' && value.includes('localhost')) {
            issues.warnings.push({
                path: currentPath,
                message: 'Localhost URL detected',
                severity: 'warning'
            });
        }
        
        // Recurse into nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const nested = findConfigIssues(value, currentPath, depth + 1);
            issues.errors.push(...nested.errors);
            issues.warnings.push(...nested.warnings);
        }
    }
    
    return issues;
}
```

---

## Batch Processing

### Parallel File Analysis

```javascript
// Example: Batch analyze multiple files
async function batchAnalyzeFiles(filePaths, options = {}) {
    const { 
        maxConcurrent = 5,
        onProgress = null,
        timeout = 30000 
    } = options;
    
    const results = [];
    const errors = [];
    
    // Process in chunks
    for (let i = 0; i < filePaths.length; i += maxConcurrent) {
        const chunk = filePaths.slice(i, i + maxConcurrent);
        
        const promises = chunk.map(async (filePath) => {
            try {
                const result = await Promise.race([
                    analyzeFile(filePath),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]);
                return { filePath, result, success: true };
            } catch (error) {
                return { filePath, error: error.message, success: false };
            }
        });
        
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults.filter(r => r.success));
        errors.push(...chunkResults.filter(r => !r.success));
        
        if (onProgress) {
            onProgress({
                processed: Math.min(i + maxConcurrent, filePaths.length),
                total: filePaths.length,
                success: results.length,
                errors: errors.length
            });
        }
    }
    
    return {
        results,
        errors,
        summary: {
            total: filePaths.length,
            successful: results.length,
            failed: errors.length,
            successRate: ((results.length / filePaths.length) * 100).toFixed(1) + '%'
        }
    };
}

async function analyzeFile(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    return {
        path: filePath,
        size: content.length,
        lines: content.split('\n').length,
        isEmpty: content.trim().length === 0
    };
}
```

---

## Performance Monitoring

### Analysis Performance Tracking

```javascript
// Example: Monitor analysis performance
class AnalysisProfiler {
    constructor() {
        this.metrics = {
            filesProcessed: 0,
            totalBytes: 0,
            totalTime: 0,
            errors: 0
        };
        this.startTimes = new Map();
    }
    
    start(filePath) {
        this.startTimes.set(filePath, Date.now());
    }
    
    end(filePath, bytes, success = true) {
        const start = this.startTimes.get(filePath);
        if (start) {
            const duration = Date.now() - start;
            this.metrics.totalTime += duration;
            this.metrics.filesProcessed++;
            this.metrics.totalBytes += bytes;
            
            if (!success) {
                this.metrics.errors++;
            }
            
            this.startTimes.delete(filePath);
            return duration;
        }
        return 0;
    }
    
    getStats() {
        return {
            ...this.metrics,
            averageTime: this.metrics.filesProcessed > 0 
                ? (this.metrics.totalTime / this.metrics.filesProcessed).toFixed(2) + 'ms'
                : '0ms',
            throughput: this.metrics.totalTime > 0
                ? ((this.metrics.totalBytes / 1024 / 1024) / (this.metrics.totalTime / 1000)).toFixed(2) + ' MB/s'
                : '0 MB/s',
            errorRate: this.metrics.filesProcessed > 0
                ? ((this.metrics.errors / this.metrics.filesProcessed) * 100).toFixed(1) + '%'
                : '0%'
        };
    }
}

// Usage
const profiler = new AnalysisProfiler();

for (const file of files) {
    profiler.start(file);
    const content = await Desktop_Commander_read_file(file);
    profiler.end(file, content.length);
}

console.log('Performance Stats:', profiler.getStats());
```

---

## Error Handling

### Robust Analysis with Recovery

```javascript
// Example: Robust file analysis with error recovery
async function robustAnalysis(filePath, options = {}) {
    const {
        maxRetries = 3,
        fallbackEncoding = 'latin1',
        skipOnError = false
    } = options;
    
    const attempt = async (encoding = 'utf8') => {
        try {
            const info = await Desktop_Commander_get_file_info(filePath);
            
            if (!info.exists) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            if (info.size === 0) {
                return { 
                    file: filePath, 
                    empty: true, 
                    size: 0 
                };
            }
            
            const content = await Desktop_Commander_read_file(filePath, { encoding });
            
            return {
                file: filePath,
                size: info.size,
                content,
                encoding,
                success: true
            };
        } catch (error) {
            throw error;
        }
    };
    
    // Try with retries
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await attempt(i === 0 ? 'utf8' : fallbackEncoding);
        } catch (error) {
            if (i === maxRetries - 1) {
                if (skipOnError) {
                    return { 
                        file: filePath, 
                        error: error.message, 
                        success: false 
                    };
                }
                throw error;
            }
            await new Promise(r => setTimeout(r, 100 * Math.pow(2, i)));
        }
    }
}
```

---

## Custom Analyzers

### Creating a Custom Analyzer

```javascript
// Example: Create a custom code analyzer
class CustomAnalyzer {
    constructor(rules = []) {
        this.rules = rules;
        this.results = [];
    }
    
    addRule(name, pattern, handler) {
        this.rules.push({ name, pattern, handler });
    }
    
    async analyze(filePath) {
        const content = await Desktop_Commander_read_file(filePath);
        const lines = content.split('\n');
        
        this.results = [];
        
        lines.forEach((line, index) => {
            for (const rule of this.rules) {
                if (rule.pattern.test(line)) {
                    const result = rule.handler(line, index + 1, content);
                    this.results.push({
                        rule: rule.name,
                        line: index + 1,
                        content: line.trim(),
                        ...result
                    });
                }
            }
        });
        
        return this.results;
    }
    
    getSummary() {
        const byRule = {};
        this.results.forEach(r => {
            byRule[r.rule] = (byRule[r.rule] || 0) + 1;
        });
        return {
            totalFindings: this.results.length,
            byRule,
            findings: this.results
        };
    }
}

// Usage
const analyzer = new CustomAnalyzer();

// Add custom rules
analyzer.addRule('TODO', /TODO|FIXME|HACK/, (line, lineNum) => ({
    severity: 'warning',
    message: 'TODO comment found'
}));

analyzer.addRule('console.log', /console\.(log|debug)/, (line, lineNum) => ({
    severity: 'info',
    message: 'Debug statement found'
}));

analyzer.addRule('hardcoded-url', /https?:\/\/[^\s'"]+/, (line, lineNum) => ({
    severity: 'warning',
    message: 'Hardcoded URL found'
}));

// Analyze file
const findings = await analyzer.analyze('/project/src/app.js');
console.log(analyzer.getSummary());
```

---

## Best Practices

1. **Always check file existence** before reading
2. **Use appropriate chunking** for large files
3. **Handle encoding issues** gracefully
4. **Cache results** for repeated analysis
5. **Log errors** for debugging
6. **Set timeouts** to prevent hanging
7. **Validate output** before using results

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview and API reference
- [Auto-AI Documentation](https://docs.auto-ai.dev) - Full framework docs
