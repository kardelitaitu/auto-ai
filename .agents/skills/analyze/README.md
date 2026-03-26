# Analyze Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-passing-brightgreen.svg)]()

> **Professional file reading and analysis toolkit for AI-powered code inspection, data extraction, and content processing.**

## Overview

The Analyze Skill provides intelligent file reading and content analysis capabilities for the Auto-AI framework. It enables agents to efficiently read, parse, and analyze various file formats while optimizing for performance and accuracy.

## Key Features

| Feature                  | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| **Multi-Format Support** | Text, PDF, DOCX, Excel, images, and more                       |
| **Smart Chunking**       | Automatic large file handling with configurable chunk sizes    |
| **Format Detection**     | Automatic file type detection and appropriate parser selection |
| **Content Extraction**   | Structured data extraction from documents                      |
| **Batch Processing**     | Parallel file analysis for improved throughput                 |
| **Error Recovery**       | Graceful handling of corrupt or inaccessible files             |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Analyze Engine                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Reader    │  │  Analyzer   │  │  Extractor  │             │
│  │   Module    │  │   Module    │  │   Module    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Unified Result     │                           │
│              │      Pipeline        │                           │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```javascript
// Import the analyze functions
import { analyzeFile, batchAnalyze } from './skills/analyze/SKILL.md';

// Analyze a single file
const result = await analyzeFile('/path/to/file.js', {
    extractImports: true,
    extractFunctions: true,
    calculateComplexity: true,
});

// Batch analyze multiple files
const results = await batchAnalyze(
    ['/path/to/file1.js', '/path/to/file2.js', '/path/to/config.json'],
    { parallel: true, maxConcurrent: 5 }
);
```

## Use Cases

| Use Case              | Description                        | Example                                   |
| --------------------- | ---------------------------------- | ----------------------------------------- |
| **Code Review**       | Extract and analyze code structure | Function dependencies, complexity metrics |
| **Log Analysis**      | Parse and analyze log files        | Error patterns, frequency analysis        |
| **Config Validation** | Verify configuration files         | Schema validation, security checks        |
| **Data Processing**   | Extract data from documents        | CSV parsing, Excel extraction             |
| **Documentation**     | Generate docs from code            | API documentation, JSDoc extraction       |

## Performance Benchmarks

| File Size     | Format | Processing Time | Memory Usage |
| ------------- | ------ | --------------- | ------------ |
| < 100 KB      | Any    | < 50ms          | < 10 MB      |
| 100 KB - 1 MB | Text   | < 200ms         | < 50 MB      |
| 1 MB - 10 MB  | Text   | < 1s            | < 100 MB     |
| 10 MB+        | Any    | Chunked         | Configurable |

## Configuration

```json
{
    "analyze": {
        "defaultEncoding": "utf-8",
        "maxFileSize": 104857600,
        "chunkSize": 10000,
        "timeout": 30000,
        "supportedFormats": {
            "text": [".js", ".ts", ".py", ".json", ".md", ".txt"],
            "document": [".pdf", ".docx", ".xlsx"],
            "image": [".png", ".jpg", ".gif", ".svg"]
        }
    }
}
```

## API Reference

### `analyzeFile(filePath, options)`

Analyzes a single file and returns structured results.

**Parameters:**

- `filePath` (string): Path to the file
- `options` (object): Analysis options
    - `extractImports`: boolean - Extract import statements
    - `extractFunctions`: boolean - Extract function definitions
    - `calculateComplexity`: boolean - Calculate complexity metrics

**Returns:** `Promise<AnalysisResult>`

### `batchAnalyze(files, options)`

Analyzes multiple files in parallel.

**Parameters:**

- `files` (string[]): Array of file paths
- `options` (object): Batch options
    - `parallel`: boolean - Enable parallel processing
    - `maxConcurrent`: number - Maximum concurrent operations

**Returns:** `Promise<AnalysisResult[]>`

## Error Handling

```javascript
try {
    const result = await analyzeFile('/path/to/file');
} catch (error) {
    if (error.code === 'ENOENT') {
        // File not found
    } else if (error.code === 'EACCES') {
        // Permission denied
    } else if (error.code === 'UNSUPPORTED_FORMAT') {
        // Unsupported file format
    }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [docs.auto-ai.dev](https://docs.auto-ai.dev)
- **Issues:** [GitHub Issues](https://github.com/auto-ai/auto-ai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/auto-ai/auto-ai/discussions)

---

_Built with ❤️ by the Auto-AI Team_
