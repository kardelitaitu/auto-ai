# Read Tool Examples

## Basic Usage

### Read Entire File

```javascript
// Simple read
const content = await Desktop_Commander_read_file('/path/to/file.js');
console.log(content);
```

### Read with Offset

```javascript
// Start from line 100
const content = await Desktop_Commander_read_file('/path/to/file.js', { offset: 100 });
```

### Read Specific Range

```javascript
// Lines 50-100
const content = await Desktop_Commander_read_file('/path/to/file.js', {
    offset: 50,
    length: 51,
});
```

### Read Last Lines

```javascript
// Last 20 lines
const content = await Desktop_Commander_read_file('/path/to/file.js', { offset: -20 });
```

## Advanced Patterns

### Large File Processing

```javascript
async function processLargeFile(filePath) {
    const info = await filesystem_get_file_info(filePath);
    const linesPerChunk = 1000;
    const totalLines = Math.ceil(info.size / 50); // Estimate

    for (let offset = 0; offset < totalLines; offset += linesPerChunk) {
        const chunk = await Desktop_Commander_read_file(filePath, {
            offset: offset,
            length: linesPerChunk,
        });

        if (!chunk) break;

        // Process chunk
        console.log(`Processing lines ${offset}-${offset + linesPerChunk}`);
    }
}
```

### Error Handling

```javascript
async function safeRead(filePath) {
    try {
        const info = await filesystem_get_file_info(filePath);
        if (!info.exists) {
            throw new Error(`File not found: ${filePath}`);
        }

        const content = await Desktop_Commander_read_file(filePath);
        return { success: true, content, size: info.size };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            filePath,
        };
    }
}
```

### PDF Processing

```javascript
// Read PDF with markdown extraction
const pdfContent = await Desktop_Commander_read_file('/path/to/document.pdf');

// Read specific pages (0-based)
const firstPages = await Desktop_Commander_read_file('/path/to/document.pdf', {
    offset: 0,
    length: 3, // First 3 pages
});
```

### Excel Processing

```javascript
// Read Excel file
const excelData = await Desktop_Commander_read_file('/path/to/data.xlsx', {
    sheet: 'Sheet1',
    range: 'A1:D100',
});

// Parse as JSON (if returns JSON format)
const data = JSON.parse(excelData);
```

### DOCX Processing

```javascript
// Read DOCX outline (shows structure)
const docxOutline = await Desktop_Commander_read_file('/path/to/document.docx');

// Read raw XML for editing
const docxXml = await Desktop_Commander_read_file('/path/to/document.docx', {
    offset: 1, // Non-zero for raw XML
    length: 100,
});
```

## Integration Examples

### With Search

```javascript
// Find and read configuration files
const configFiles = await Desktop_Commander_start_search({
    path: '/project',
    pattern: '*.config.js',
    searchType: 'files',
});

// Read each config
for (const configFile of configFiles) {
    const content = await Desktop_Commander_read_file(configFile);
    console.log(`Config: ${configFile}`);
    console.log(content);
}
```

### With Python Analysis

```javascript
// Analyze CSV file
const pid = await Desktop_Commander_start_process('python3 -i');

await Desktop_Commander_interact_with_process(
    pid,
    `
import pandas as pd
import matplotlib.pyplot as plt

# Read CSV
df = pd.read_csv('/path/to/data.csv')
print(df.head())
print(df.describe())
`
);

// Read analysis results
const results = await Desktop_Commander_read_file('/tmp/analysis.txt');
```

## Common Use Cases

### Log Analysis

```javascript
// Read recent logs
const logs = await Desktop_Commander_read_file('/var/log/app.log', {
    offset: -500, // Last 500 lines
});

// Extract errors
const errorLines = logs
    .split('\n')
    .filter((line) => line.includes('ERROR'))
    .slice(0, 10); // First 10 errors

console.log('Recent errors:', errorLines);
```

### Code Review

```javascript
// Read specific function
const code = await Desktop_Commander_read_file('/src/app.js');

// Find function definition
const functionRegex = /function\s+calculateTotal[\s\S]*?^}/m;
const match = code.match(functionRegex);

if (match) {
    console.log('Function found:', match[0]);
}
```

### Configuration Management

```javascript
// Read and update config
const configPath = '/project/config.json';
const configContent = await Desktop_Commander_read_file(configPath);
const config = JSON.parse(configContent);

// Modify config
config.debug = true;
config.version = '2.0.0';

// Write back
await Desktop_Commander_write_file(configPath, JSON.stringify(config, null, 2));
```

## Performance Tips

1. **Use negative offset for tail reading** - More efficient than reading entire file
2. **Chunk large files** - Avoid memory issues with files > 10MB
3. **Cache file info** - Check size before reading
4. **Use appropriate encoding** - Specify for text files if needed
5. **Close processes** - Terminate analysis processes when done

## Troubleshooting

### File Not Found

```javascript
// Always check existence first
const info = await filesystem_get_file_info('/path/to/file');
if (!info.exists) {
    console.error('File does not exist');
    return;
}
```

### Encoding Issues

```javascript
// Try different encodings
const content = await Desktop_Commander_read_file('/path/to/file.txt', {
    encoding: 'utf8', // Try: 'latin1', 'ascii', 'utf16le'
});
```

### Permission Errors

```bash
# Check file permissions
ls -la /path/to/file

# Fix permissions (if you have sudo)
sudo chmod 644 /path/to/file
```

### Memory Issues

```javascript
// Process in chunks
async function processInChunks(filePath) {
    const chunkSize = 1000;
    let offset = 0;

    while (true) {
        const chunk = await Desktop_Commander_read_file(filePath, {
            offset: offset,
            length: chunkSize,
        });

        if (!chunk || chunk.trim() === '') break;

        // Process chunk
        await processChunk(chunk);

        offset += chunkSize;
    }
}
```
