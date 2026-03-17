---
name: analyze-read
description: |
  Master file reading and analysis operations using Desktop Commander read tools.
  Use when reading files, analyzing file contents, processing different file formats
  (text, PDF, DOCX, Excel, images), or extracting data from local files.
  Triggers on tasks involving file inspection, content extraction, data analysis,
  or reading configuration files, logs, code files, and documents.
license: MIT
metadata:
  author: Auto-AI Framework
  version: '1.0.0'
---

# File Reading & Analysis Skill

Comprehensive guide for reading and analyzing files using Desktop Commander tools
in the Auto-AI framework. This skill covers efficient file reading, format handling,
and data extraction techniques.

## When to Use This Skill

Use this skill when:

- Reading files from the filesystem (text, binary, documents)
- Analyzing file contents or structure
- Processing large files that need pagination
- Working with different file formats (PDF, DOCX, Excel, images)
- Extracting specific sections of code or data
- Debugging file access issues
- Analyzing logs, configuration files, or code

## Tool Selection Guide

| Task | Tool | Best For |
|------|------|----------|
| Read any file | `Desktop_Commander_read_file` | Primary tool for all file types |
| Multiple files | `Desktop_Commander_read_multiple_files` | Batch reading |
| List directory | `Desktop_Commander_list_directory` | File discovery |
| Search files | `Desktop_Commander_start_search` | Finding files by pattern |
| Get file info | `Desktop_Commander_get_file_info` | Metadata without reading |
| File analysis | `start_process` + Python | Data processing |

## Core Reading Patterns

### 1. Basic File Reading

```javascript
// Read entire file (text or binary)
const content = await Desktop_Commander_read_file('/path/to/file.js');

// Read with options
const content = await Desktop_Commander_read_file('/path/to/file.txt', {
    encoding: 'utf8',     // File encoding
    offset: 0,            // Start line (0-based)
    length: 1000          // Max lines to read
});
```

### 2. Large File Handling

```javascript
// Read last N lines (tail behavior)
const tail = await Desktop_Commander_read_file('/var/log/app.log', {
    offset: -100          // Last 100 lines
});

// Read specific range
const section = await Desktop_Commander_read_file('/path/to/file.js', {
    offset: 50,           // Start at line 50
    length: 20            // Read 20 lines
});

// Chunked reading for very large files
async function readInChunks(filePath, chunkSize = 1000) {
    let offset = 0;
    let allContent = '';
    
    while (true) {
        const chunk = await Desktop_Commander_read_file(filePath, {
            offset: offset,
            length: chunkSize
        });
        
        if (!chunk || chunk.trim() === '') break;
        
        allContent += chunk;
        offset += chunkSize;
    }
    
    return allContent;
}
```

### 3. Format-Specific Reading

#### PDF Files
```javascript
// Read PDF with markdown extraction
const pdfContent = await Desktop_Commander_read_file('/path/to/document.pdf');

// Read specific pages
const firstPages = await Desktop_Commander_read_file('/path/to/document.pdf', {
    offset: 0,            // Start page (0-based)
    length: 5             // Number of pages
});
```

#### Excel Files
```javascript
// Read Excel with range
const excelData = await Desktop_Commander_read_file('/path/to/data.xlsx', {
    sheet: 'Sheet1',      // Sheet name or index
    range: 'A1:D100'      // Cell range
});

// Returns JSON array format
const data = JSON.parse(excelData);
```

#### DOCX Files
```javascript
// Read DOCX outline (structure view)
const outline = await Desktop_Commander_read_file('/path/to/document.docx');

// Read raw XML for editing
const xml = await Desktop_Commander_read_file('/path/to/document.docx', {
    offset: 1,            // Must be non-zero for raw XML
    length: 100
});
```

#### Image Files
```javascript
// Returns base64 encoded image
const imageData = await Desktop_Commander_read_file('/path/to/image.png');
// Content includes base64 data and MIME type
```

## Analysis Techniques

### 1. Code Analysis

```javascript
async function analyzeCodeFile(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    
    // Extract imports
    const imports = content.match(/import.*from.*/g) || [];
    
    // Extract functions
    const functions = content.match(/function\s+\w+/g) || [];
    
    // Extract classes
    const classes = content.match(/class\s+\w+/g) || [];
    
    // Count lines
    const lines = content.split('\n').length;
    
    return {
        imports: imports.length,
        functions: functions.length,
        classes: classes.length,
        totalLines: lines
    };
}
```

### 2. Log Analysis

```javascript
async function analyzeLogFile(filePath, options = {}) {
    const { tailLines = 1000, patterns = ['ERROR', 'WARN'] } = options;
    
    const logs = await Desktop_Commander_read_file(filePath, {
        offset: -tailLines
    });
    
    const lines = logs.split('\n');
    const analysis = {
        totalLines: lines.length,
        errors: [],
        warnings: [],
        timeline: []
    };
    
    lines.forEach(line => {
        if (line.includes('ERROR')) {
            analysis.errors.push(line);
        }
        if (line.includes('WARN')) {
            analysis.warnings.push(line);
        }
        
        // Extract timestamp if present
        const timeMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        if (timeMatch) {
            analysis.timeline.push({
                timestamp: timeMatch[0],
                level: line.includes('ERROR') ? 'error' : 
                       line.includes('WARN') ? 'warn' : 'info'
            });
        }
    });
    
    return analysis;
}
```

### 3. Configuration Analysis

```javascript
async function analyzeConfig(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    
    // Try parsing as JSON
    try {
        const config = JSON.parse(content);
        return {
            format: 'json',
            keys: Object.keys(config),
            size: JSON.stringify(config).length
        };
    } catch (e) {
        // Try parsing as YAML
        const yaml = require('js-yaml');
        try {
            const config = yaml.load(content);
            return {
                format: 'yaml',
                keys: Object.keys(config),
                size: content.length
            };
        } catch (e2) {
            // Plain text
            return {
                format: 'text',
                lines: content.split('\n').length,
                size: content.length
            };
        }
    }
}
```

## Advanced Patterns

### 1. Smart File Reading

```javascript
async function smartRead(filePath, purpose = 'analysis') {
    const info = await Desktop_Commander_get_file_info(filePath);
    
    // Decide reading strategy based on file size
    if (info.size > 10 * 1024 * 1024) { // > 10MB
        // Large file - read in chunks or tail
        if (purpose === 'log-analysis') {
            return await Desktop_Commander_read_file(filePath, { offset: -5000 });
        }
        return await readInChunks(filePath, 5000);
    }
    
    // Normal file - read all
    return await Desktop_Commander_read_file(filePath);
}
```

### 2. Multi-Format Comparison

```javascript
async function compareFiles(file1, file2) {
    const [content1, content2] = await Desktop_Commander_read_multiple_files([file1, file2]);
    
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    
    const differences = [];
    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
        if (lines1[i] !== lines2[i]) {
            differences.push({
                line: i + 1,
                file1: lines1[i] || '[EOF]',
                file2: lines2[i] || '[EOF]'
            });
        }
    }
    
    return {
        identical: differences.length === 0,
        differences,
        stats: {
            file1Lines: lines1.length,
            file2Lines: lines2.length,
            diffCount: differences.length
        }
    };
}
```

### 3. Data Extraction Pipeline

```javascript
async function extractData(filePath, extractionRules) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const results = [];
    
    for (const rule of extractionRules) {
        const { pattern, type = 'regex', multiple = false } = rule;
        
        if (type === 'regex') {
            const regex = new RegExp(pattern, 'g');
            const matches = multiple 
                ? [...content.matchAll(regex)].map(m => m[0])
                : content.match(regex);
            
            results.push({
                rule: pattern,
                matches,
                count: Array.isArray(matches) ? matches.length : (matches ? 1 : 0)
            });
        }
    }
    
    return results;
}
```

## Error Handling

### Robust Reading Pattern

```javascript
async function safeReadFile(filePath, options = {}) {
    try {
        // Check file exists
        const info = await Desktop_Commander_get_file_info(filePath);
        
        if (!info.exists) {
            return {
                success: false,
                error: 'File not found',
                filePath
            };
        }
        
        // Check file size
        if (info.size === 0) {
            return {
                success: true,
                content: '',
                warning: 'File is empty',
                filePath
            };
        }
        
        // Read file
        const content = await Desktop_Commander_read_file(filePath, options);
        
        return {
            success: true,
            content,
            size: info.size,
            modified: info.mtime,
            filePath
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            code: error.code,
            filePath
        };
    }
}
```

### Common Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOENT` | File not found | Check path, use `get_file_info` first |
| `EACCES` | Permission denied | Check file permissions |
| `EISDIR` | Reading directory as file | Use `list_directory` instead |
| `EMFILE` | Too many open files | Close files, use `read_multiple_files` |
| `EFBIG` | File too large | Use chunked reading |

## Integration Patterns

### 1. With Search Tools

```javascript
// Find and analyze files
const searchResults = await Desktop_Commander_start_search({
    path: '/project',
    pattern: '*.test.js',
    searchType: 'files'
});

// Analyze each file
for (const file of searchResults) {
    const analysis = await analyzeCodeFile(file);
    console.log(`${file}:`, analysis);
}
```

### 2. With Process Tools

```javascript
// Read, process, analyze
const pid = await Desktop_Commander_start_process('python3 -i');

await Desktop_Commander_interact_with_process(pid, `
import pandas as pd
import json

# Read CSV
df = pd.read_csv('/path/to/data.csv')

# Analyze
print('Shape:', df.shape)
print('Columns:', list(df.columns))
print('Types:')
print(df.dtypes)

# Save analysis
with open('/tmp/analysis.json', 'w') as f:
    json.dump({
        'rows': len(df),
        'columns': list(df.columns),
        'null_counts': df.isnull().sum().to_dict()
    }, f)
`);

// Read analysis results
const analysis = await Desktop_Commander_read_file('/tmp/analysis.json');
```

### 3. With Context Server

```javascript
// Set context profile for better understanding
await File_Context_Server_set_profile('javascript');

// Get project context
const context = await File_Context_Server_get_profile_context();

// Read specific files with context
const fileContext = await File_Context_Server_read_context('/path/to/file.js');
```

## Best Practices

1. **Check before reading** - Use `get_file_info` to verify existence and size
2. **Use appropriate offset/length** - For large files and pagination
3. **Handle empty files** - Check for empty content
4. **Cache file info** - Avoid repeated stat calls
5. **Use chunked reading** - For files > 10MB
6. **Specify encoding** - For text files if not UTF-8
7. **Close processes** - Terminate analysis processes when done
8. **Validate output** - Check parsing results

## Quick Reference

```bash
# Command line alternatives
cat file.txt                    # Read entire file
head -n 100 file.txt           # First 100 lines
tail -n 100 file.txt           # Last 100 lines
sed -n '10,20p' file.txt       # Lines 10-20
wc -l file.txt                 # Line count
file file.txt                  # File type
stat file.txt                  # File info
```

## Troubleshooting

### File Not Reading
1. Check path is absolute
2. Verify file exists with `get_file_info`
3. Check permissions
4. Try different encoding

### Large File Issues
1. Use negative offset for tail reading
2. Use chunked reading strategy
3. Consider file size before reading
4. Use `read_multiple_files` for batch operations

### Encoding Problems
1. Specify encoding parameter
2. Try different encodings (utf8, latin1, ascii)
3. Check file with `file` command

## Examples

### Analyze Package Dependencies
```javascript
async function analyzeDependencies(projectPath) {
    const packageJson = await Desktop_Commander_read_file(
        `${projectPath}/package.json`
    );
    
    const pkg = JSON.parse(packageJson);
    
    return {
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: Object.keys(pkg.scripts || {}),
        engines: pkg.engines || {}
    };
}
```

### Extract TODO Comments
```javascript
async function extractTODOs(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');
    
    const todos = [];
    
    lines.forEach((line, index) => {
        if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
            todos.push({
                line: index + 1,
                content: line.trim(),
                type: line.includes('TODO') ? 'todo' :
                      line.includes('FIXME') ? 'fixme' : 'hack'
            });
        }
    });
    
    return todos;
}
```