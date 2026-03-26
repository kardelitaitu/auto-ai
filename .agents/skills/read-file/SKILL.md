---
name: read-file
description: Master file reading operations using Desktop Commander and generic read tools.
    Use when reading files, analyzing file contents, handling large files, or
    processing different file formats (text, PDF, DOCX, Excel, images).
    Triggers on tasks involving file inspection, content extraction, or data
    analysis from local files.
license: MIT
metadata:
    author: Auto-AI Framework
    version: '1.0.0'
---

# File Reading Tool

Comprehensive guide for reading files efficiently using the available read tools in
the Auto-AI framework. This skill covers Desktop Commander's read_file and
related tools for handling various file formats and sizes.

## When to Apply

Reference these guidelines when:

- Reading any file from the filesystem
- Analyzing file contents or structure
- Processing large files that need pagination
- Working with different file formats (text, PDF, DOCX, Excel, images)
- Extracting specific sections of code or data
- Debugging file access issues

## Tool Selection

### Desktop Commander Read File (`Desktop_Commander_read_file`)

**Primary tool for all file reading operations.** Use this for:

- Text files (code, configuration, logs)
- Binary files (PDF, DOCX, Excel, images)
- Partial file reading with offset/length
- URL content fetching

### Generic Read Tool (`read`)

**Secondary tool with simpler interface.** Use this for:

- Quick file inspection
- Directory listings
- Simple text file reading

## Quick Reference

| Task                  | Tool                               | Parameters           |
| --------------------- | ---------------------------------- | -------------------- |
| Read entire text file | `Desktop_Commander_read_file`      | path                 |
| Read PDF file         | `Desktop_Commander_read_file`      | path                 |
| Read Excel file       | `Desktop_Commander_read_file`      | path, sheet, range   |
| Read DOCX file        | `Desktop_Commander_read_file`      | path, offset, length |
| Read image file       | `Desktop_Commander_read_file`      | path                 |
| Read from URL         | `Desktop_Commander_read_file`      | path, isUrl=true     |
| List directory        | `Desktop_Commander_list_directory` | path, depth          |
| Search files          | `Desktop_Commander_start_search`   | path, pattern        |

## File Type Handling

### Text Files

```javascript
// Read entire file
const content = await Desktop_Commander_read_file('/path/to/file.js');

// Read with offset (start at line 100)
const content = await Desktop_Commander_read_file('/path/to/file.js', { offset: 100 });

// Read specific range (lines 50-100)
const content = await Desktop_Commander_read_file('/path/to/file.js', { offset: 50, length: 51 });

// Read last 20 lines
const content = await Desktop_Commander_read_file('/path/to/file.js', { offset: -20 });
```

### PDF Files

```javascript
// Read PDF with markdown extraction
const content = await Desktop_Commander_read_file('/path/to/document.pdf');

// Read specific pages
const content = await Desktop_Commander_read_file('/path/to/document.pdf', {
    offset: 0,
    length: 5,
});
```

### Excel Files

```javascript
// Read specific sheet
const content = await Desktop_Commander_read_file('/path/to/data.xlsx', {
    sheet: 'Sheet1',
    range: 'A1:D100',
});

// Read by sheet index
const content = await Desktop_Commander_read_file('/path/to/data.xlsx', {
    sheet: '0', // First sheet
    range: 'A1:C50',
});
```

### DOCX Files

```javascript
// Read outline (default - shows structure)
const content = await Desktop_Commander_read_file('/path/to/document.docx');

// Read raw XML for editing
const content = await Desktop_Commander_read_file('/path/to/document.docx', {
    offset: 1, // Must be non-zero for raw XML
    length: 100,
});
```

### Image Files

```javascript
// Returns base64 encoded image
const content = await Desktop_Commander_read_file('/path/to/image.png');
// Content includes base64 data and MIME type
```

## Large File Handling

### Chunked Reading Strategy

For files larger than 1MB, use chunked reading:

```javascript
// Get total chunks first
const chunkCount = await File_Context_Server_get_chunk_count('/path/to/large/file.js');

// Read specific chunks
for (let i = 0; i < chunkCount; i++) {
    const chunk = await File_Context_Server_read_context('/path/to/large/file.js', {
        chunkNumber: i,
    });
    // Process chunk
}
```

### Line-Based Pagination

For text files, use offset/length for efficient reading:

```javascript
// Read file in 100-line chunks
const linesPerChunk = 100;
let offset = 0;

while (true) {
    const content = await Desktop_Commander_read_file('/path/to/large.log', {
        offset: offset,
        length: linesPerChunk,
    });

    if (!content || content.trim() === '') break;

    // Process chunk
    offset += linesPerChunk;
}
```

## Error Handling

### Common Errors and Solutions

| Error             | Cause                    | Solution                                          |
| ----------------- | ------------------------ | ------------------------------------------------- |
| File not found    | Invalid path             | Check file exists with `filesystem_get_file_info` |
| Permission denied | Insufficient permissions | Run with appropriate permissions                  |
| Encoding issues   | Wrong file encoding      | Specify encoding parameter                        |
| Timeout           | Very large file          | Use chunked reading                               |

### Robust Reading Pattern

```javascript
async function safeReadFile(filePath, options = {}) {
    try {
        // Check if file exists first
        const info = await filesystem_get_file_info(filePath);
        if (!info.exists) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Read with error handling
        const content = await Desktop_Commander_read_file(filePath, options);
        return { success: true, content, metadata: info };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            filePath,
            options,
        };
    }
}
```

## Best Practices

### 1. Always Check File Info First

```javascript
const info = await filesystem_get_file_info('/path/to/file');
console.log(`Size: ${info.size} bytes, Modified: ${info.mtime}`);
```

### 2. Use Appropriate Tool for Format

- **Text files**: Desktop_Commander_read_file with offset/length
- **Binary files**: Desktop_Commander_read_file (handles automatically)
- **Directories**: Desktop_Commander_list_directory
- **Search**: Desktop_Commander_start_search

### 3. Handle Large Files Efficiently

- Use negative offset for tail reading
- Use chunked reading for very large files
- Consider memory usage when processing

### 4. Preserve File Context

```javascript
// Read with context for better understanding
const content = await Desktop_Commander_read_file('/path/to/file.js', {
    offset: 10,
    length: 20, // Get 20 lines around line 10
});
```

### 5. Use File Context Server for Project Analysis

```javascript
// Set profile for context generation
await File_Context_Server_set_profile('javascript');

// Get project context
const context = await File_Context_Server_get_profile_context();
```

## Advanced Usage

### Reading Multiple Files

```javascript
const files = ['/path/to/file1.js', '/path/to/file2.js', '/path/to/config.json'];

const contents = await Desktop_Commander_read_multiple_files(files);
```

### File Analysis with Python

```javascript
// Start Python REPL for data analysis
const pid = await Desktop_Commander_start_process('python3 -i');

// Analyze CSV file
await Desktop_Commander_interact_with_process(
    pid,
    `
import pandas as pd
df = pd.read_csv('/path/to/data.csv')
print(df.describe())
`
);
```

### Searching File Contents

```javascript
// Search for specific patterns
const results = await Desktop_Commander_start_search({
    path: '/project',
    pattern: 'TODO|FIXME',
    searchType: 'content',
    contextLines: 2,
});
```

## Common Patterns

### Code Review

```javascript
// Read specific function or class
const content = await Desktop_Commander_read_file('/path/to/code.js');
const functionMatch = content.match(/function\s+myFunction[\s\S]*?^}/m);
```

### Log Analysis

```javascript
// Read last 100 lines of log
const logs = await Desktop_Commander_read_file('/var/log/app.log', {
    offset: -100,
});

// Extract errors
const errors = logs.split('\n').filter((line) => line.includes('ERROR'));
```

### Configuration Inspection

```javascript
// Read and parse JSON config
const configContent = await Desktop_Commander_read_file('/path/to/config.json');
const config = JSON.parse(configContent);
```

## Integration with Other Tools

### With Search Tools

```javascript
// Find files then read them
const files = await Desktop_Commander_start_search({
    path: '/project',
    pattern: '*.test.js',
    searchType: 'files',
});

// Read first test file
if (files.length > 0) {
    const content = await Desktop_Commander_read_file(files[0]);
}
```

### With Process Tools

```javascript
// Read file, process with command, read result
await Desktop_Commander_start_process('cat /path/to/file | sort | uniq > /tmp/result');
const result = await Desktop_Commander_read_file('/tmp/result');
```

## Troubleshooting

### File Encoding Issues

```javascript
// Specify encoding for text files
const content = await Desktop_Commander_read_file('/path/to/file.txt', {
    encoding: 'utf8', // or 'latin1', 'ascii', etc.
});
```

### Binary File Corruption

```javascript
// Check file type before reading
const info = await filesystem_get_file_info('/path/to/file');
if (info.type === 'file' && info.size > 0) {
    const content = await Desktop_Commander_read_file('/path/to/file');
}
```

### Memory Issues with Large Files

```javascript
// Use streaming approach for very large files
const lineCount = await countLines('/path/to/large/file');
const chunkSize = Math.ceil(lineCount / 10);

for (let i = 0; i < 10; i++) {
    const chunk = await Desktop_Commander_read_file('/path/to/large/file', {
        offset: i * chunkSize,
        length: chunkSize,
    });
    // Process chunk immediately
}
```

## Quick Commands

```bash
# Read file with bash (simple cases)
cat /path/to/file

# Read with line numbers
cat -n /path/to/file

# Read specific lines
sed -n '10,20p' /path/to/file

# Read last lines
tail -20 /path/to/file
```

## Summary

The read tool system provides comprehensive file reading capabilities:

1. **Desktop_Commander_read_file** - Primary tool for all file formats
2. **Chunked reading** - For large files with offset/length
3. **Format-specific handling** - PDF, DOCX, Excel, images
4. **Error recovery** - Robust patterns for reliable reading
5. **Integration** - Works with search, process, and analysis tools

Always choose the right tool for your file type and use chunked reading for large files to avoid memory issues.
