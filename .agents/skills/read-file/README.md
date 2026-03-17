# Read File Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/file--reading-comprehensive-purple.svg)]()

> **Professional file reading and content analysis toolkit.**

## Overview

The Read File Skill provides efficient file reading capabilities for various formats including text, PDF, DOCX, Excel, and images. It handles large files through chunking and provides robust error recovery.

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Format Support** | Text, PDF, DOCX, Excel, images |
| **Chunked Reading** | Handle large files efficiently |
| **Error Recovery** | Graceful handling of corrupt files |
| **Encoding Support** | UTF-8, Latin-1, ASCII, and more |
| **Partial Reading** | Offset and length for pagination |

## Supported Formats

| Format | Extensions | Features |
|--------|------------|----------|
| **Text** | .js, .ts, .py, .json, .md, .txt | Full parsing, syntax highlighting |
| **PDF** | .pdf | Text extraction, page pagination |
| **Office** | .docx, .xlsx | XML parsing, sheet selection |
| **Images** | .png, .jpg, .gif, .svg | Base64 encoding |
| **Config** | .yaml, .yml, .toml, .ini | Structured parsing |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Read Engine                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Format    │  │   Chunk     │  │   Error     │             │
│  │   Detector  │  │   Manager   │  │   Handler   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Unified Result     │                           │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```javascript
// Import read functions
import { readFile, readChunk, readMultiple } from './skills/read-file/SKILL.md';

// Read entire file
const content = await readFile('/path/to/file.js');

// Read specific lines
const lines = await readChunk('/path/to/file.log', {
    offset: 100,
    length: 50
});

// Read multiple files
const contents = await readMultiple([
    '/path/to/file1.js',
    '/path/to/file2.js'
]);
```

## Options

### `readFile(path, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | string | 'utf8' | File encoding |
| `offset` | number | 0 | Start line (0-indexed) |
| `length` | number | -1 | Lines to read (-1 = all) |
| `timeout` | number | 30000 | Read timeout (ms) |

### `readChunk(path, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `offset` | number | 0 | Start line |
| `length` | number | 100 | Lines to read |
| `encoding` | string | 'utf8' | File encoding |

## Performance

| File Size | Format | Time | Memory |
|-----------|--------|------|--------|
| < 100 KB | Any | < 50ms | < 10 MB |
| 100 KB - 1 MB | Text | < 200ms | < 50 MB |
| 1 MB - 10 MB | Text | < 1s | < 100 MB |
| 10 MB+ | Any | Chunked | Configurable |

## Error Handling

| Error | Code | Solution |
|-------|------|----------|
| File not found | ENOENT | Check path exists |
| Permission denied | EACCES | Check file permissions |
| Encoding error | ENCODING | Specify correct encoding |
| Timeout | ETIMEDOUT | Increase timeout |

## Configuration

```json
{
    "readFile": {
        "defaultEncoding": "utf-8",
        "maxFileSize": 104857600,
        "chunkSize": 10000,
        "timeout": 30000
    }
}
```

## License

This project is licensed under the MIT License.

---

*Built with ❤️ by the Auto-AI Team*
