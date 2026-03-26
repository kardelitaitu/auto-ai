# Read File Skill - Examples

> **Practical examples for file reading and content analysis.**

## Basic File Reading

```javascript
// Example: Read entire file with error handling
async function safeRead(filePath) {
    try {
        const info = await Desktop_Commander_get_file_info(filePath);

        if (!info.exists) {
            return { success: false, error: 'File not found' };
        }

        if (info.size === 0) {
            return { success: true, content: '', empty: true };
        }

        const content = await Desktop_Commander_read_file(filePath);

        return {
            success: true,
            content,
            size: info.size,
            lines: content.split('\n').length,
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

## Chunked Reading

```javascript
// Example: Read large file in chunks
async function readLargeFile(filePath, chunkSize = 1000) {
    const chunks = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const chunk = await Desktop_Commander_read_file(filePath, {
            offset,
            length: chunkSize,
        });

        if (!chunk || chunk.trim() === '') {
            hasMore = false;
        } else {
            chunks.push(chunk);
            offset += chunkSize;
        }
    }

    return {
        totalChunks: chunks.length,
        totalLines: offset,
        content: chunks.join('\n'),
    };
}
```

## Format-Specific Reading

### PDF Files

```javascript
// Example: Read PDF with page range
async function readPDF(pdfPath, startPage = 0, pageCount = 5) {
    const content = await Desktop_Commander_read_file(pdfPath, {
        offset: startPage,
        length: pageCount,
    });

    return {
        pages: pageCount,
        content,
        textLength: content.length,
    };
}
```

### Excel Files

```javascript
// Example: Read Excel with specific range
async function readExcel(excelPath, sheet, range) {
    const content = await Desktop_Commander_read_file(excelPath, {
        sheet,
        range,
    });

    // Content is returned as JSON array
    const data = JSON.parse(content);

    return {
        sheet,
        range,
        rows: data.length,
        columns: data[0]?.length || 0,
        data,
    };
}
```

### DOCX Files

```javascript
// Example: Read DOCX outline
async function readDOCXOutline(docxPath) {
    // Default read returns outline
    const outline = await Desktop_Commander_read_file(docxPath);

    return {
        type: 'outline',
        content: outline,
    };
}

// Example: Read DOCX raw XML for editing
async function readDOCXRaw(docxPath, page = 1) {
    const xml = await Desktop_Commander_read_file(docxPath, {
        offset: page, // Must be non-zero for raw XML
        length: 100,
    });

    return {
        type: 'xml',
        content: xml,
    };
}
```

## Multi-File Operations

```javascript
// Example: Read multiple files in parallel
async function readMultipleFiles(filePaths) {
    const results = await Desktop_Commander_read_multiple_files(filePaths);

    return results.map((content, index) => ({
        path: filePaths[index],
        success: content !== null,
        content,
        size: content?.length || 0,
    }));
}

// Usage
const files = ['/project/package.json', '/project/README.md', '/project/src/index.js'];

const results = await readMultipleFiles(files);
console.log(`Read ${results.filter((r) => r.success).length} files successfully`);
```

## Search and Read

```javascript
// Example: Find files and read content
async function findAndRead(directory, pattern, maxFiles = 10) {
    const files = await Desktop_Commander_start_search({
        path: directory,
        pattern,
        searchType: 'files',
        maxResults: maxFiles,
    });

    const results = [];

    for (const file of files) {
        const readResult = await safeRead(file);
        if (readResult.success) {
            results.push({
                path: file,
                ...readResult,
            });
        }
    }

    return {
        filesFound: files.length,
        filesRead: results.length,
        results,
    };
}
```

## Line-Based Operations

```javascript
// Example: Find specific lines
async function findLines(filePath, pattern) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');

    const matches = [];

    lines.forEach((line, index) => {
        if (line.match(pattern)) {
            matches.push({
                line: index + 1,
                content: line.trim(),
                match: line.match(pattern)[0],
            });
        }
    });

    return {
        totalLines: lines.length,
        matches: matches.length,
        results: matches,
    };
}

// Usage
const todos = await findLines('/project/src/app.js', /TODO|FIXME/);
console.log(`Found ${todos.matches} TODO items`);
```

## Context Window

```javascript
// Example: Read context around a specific line
async function readContext(filePath, targetLine, contextLines = 5) {
    const startLine = Math.max(0, targetLine - contextLines - 1);
    const totalLines = contextLines * 2 + 1;

    const content = await Desktop_Commander_read_file(filePath, {
        offset: startLine,
        length: totalLines,
    });

    const lines = content.split('\n');

    return lines.map((line, i) => ({
        lineNum: startLine + i + 1,
        content: line,
        isTarget: startLine + i + 1 === targetLine,
    }));
}

// Usage
const context = await readContext('/project/src/app.js', 45, 3);
context.forEach((l) => {
    const marker = l.isTarget ? '>>>' : '   ';
    console.log(`${marker} ${l.lineNum}: ${l.content}`);
});
```

## File Statistics

```javascript
// Example: Get file statistics
async function getFileStats(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const info = await Desktop_Commander_get_file_info(filePath);

    const lines = content.split('\n');
    const words = content.split(/\s+/).filter((w) => w);

    return {
        path: filePath,
        size: info.size,
        sizeFormatted: formatBytes(info.size),
        created: info.birthtime,
        modified: info.mtime,
        lines: {
            total: lines.length,
            empty: lines.filter((l) => !l.trim()).length,
            code: lines.filter((l) => l.trim() && !l.trim().startsWith('//')).length,
            comments: lines.filter((l) => l.trim().startsWith('//')).length,
        },
        content: {
            characters: content.length,
            words: words.length,
            uniqueWords: new Set(words).size,
        },
    };
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
```

## Best Practices

1. **Check file exists** before reading
2. **Use chunking** for large files
3. **Handle encoding** explicitly
4. **Set timeouts** to prevent hanging
5. **Close processes** when done
6. **Cache results** for repeated reads
7. **Validate output** before using

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview
