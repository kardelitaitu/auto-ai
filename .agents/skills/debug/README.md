# Debug Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/debugging-comprehensive-brightgreen.svg)]()

> **Professional debugging and troubleshooting toolkit for the Auto-AI framework.**

## Overview

The Debug Skill provides systematic debugging capabilities for investigating errors, analyzing logs, diagnosing automation issues, and troubleshooting complex problems in the Auto-AI framework.

## Key Features

| Feature | Description |
|---------|-------------|
| **Log Analysis** | Parse and analyze application logs |
| **Stack Trace Parsing** | Extract and analyze stack traces |
| **Error Pattern Detection** | Identify common error patterns |
| **State Capture** | Capture debugging snapshots |
| **Performance Profiling** | Profile task execution |
| **Browser Debugging** | Debug browser automation issues |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Debug Engine                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Log      │  │   Stack     │  │   State     │             │
│  │   Parser    │  │   Analyzer  │  │  Capturer   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Debug Report       │                           │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```javascript
// Import debug functions
import { analyzeErrorPatterns, parseStackTrace } from './skills/debug/SKILL.md';

// Analyze error patterns in logs
const patterns = await analyzeErrorPatterns('/var/log/app.log');
console.log(`Most common error: ${patterns.mostFrequent.category}`);

// Parse stack trace
const stack = await parseStackTrace(error.stack);
console.log(`Root cause: ${stack.rootCause.function} at ${stack.rootCause.file}:${stack.rootCause.line}`);
```

## Debug Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **TRACE** | Most detailed | Complex debugging |
| **DEBUG** | Detailed info | Development |
| **INFO** | Normal operations | General logging |
| **WARN** | Potential issues | Monitoring |
| **ERROR** | Failures | Alerting |
| **FATAL** | Critical failures | Immediate attention |

## Use Cases

| Use Case | Description | Tool |
|----------|-------------|------|
| **Error Investigation** | Find root cause of errors | `analyzeErrorPatterns` |
| **Log Analysis** | Parse and filter logs | `parseAutoAILogs` |
| **Stack Analysis** | Analyze stack traces | `parseStackTrace` |
| **Performance Issues** | Identify bottlenecks | `profileTaskExecution` |
| **State Debugging** | Capture page state | `captureDebugState` |
| **Element Debugging** | Debug element issues | `debugElement` |

## Common Issues Guide

### Browser Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| No browsers found | Discovery fails | Check processes and ports |
| Session disconnected | Automation stops | Re-discover sessions |
| Target closed | Page crashes | Create new page/context |

### Task Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Timeout | Task hangs | Increase timeout |
| Element not found | Click fails | Add wait before action |
| Navigation failed | Page load fails | Check URL and network |

### LLM Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| LLM timeout | Slow response | Use faster model |
| Invalid response | Parse error | Validate format |
| Rate limited | 429 errors | Add delays |

## API Reference

### `parseAutoAILogs(logPath, options)`

Parses Auto-AI framework logs.

**Parameters:**
- `logPath` (string): Path to log file
- `options` (object): Parse options
  - `tailLines`: number - Lines to read
  - `level`: string - Filter by level
  - `component`: string - Filter by component

**Returns:** `Promise<ParsedLogs>`

### `analyzeErrorPatterns(logPath)`

Analyzes error patterns in logs.

**Parameters:**
- `logPath` (string): Path to log file

**Returns:** `Promise<ErrorPatterns>`

### `parseStackTrace(stack)`

Parses a stack trace string.

**Parameters:**
- `stack` (string): Stack trace

**Returns:** `StackAnalysis`

### `captureDebugState(page)`

Captures debug state from a page.

**Parameters:**
- `page` (Page): Playwright page

**Returns:** `Promise<DebugState>`

## Configuration

```json
{
    "debug": {
        "logLevel": "info",
        "verbose": false,
        "saveScreenshots": true,
        "screenshotPath": "./debug/screenshots",
        "traceAPI": false,
        "profileTasks": false
    }
}
```

## Environment Variables

```bash
# Enable debug logging
DEBUG=orchestrator:*,agent:*,api:*

# Set log level
LOG_LEVEL=debug

# Enable verbose timing
VERBOSE_TIMING=true

# Disable humanization (for faster debugging)
DISABLE_HUMANIZATION=true
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/debug-enhancement`)
3. Commit your changes (`git commit -m 'Add debug feature'`)
4. Push to the branch (`git push origin feature/debug-enhancement`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation:** [docs.auto-ai.dev](https://docs.auto-ai.dev)
- **Issues:** [GitHub Issues](https://github.com/auto-ai/auto-ai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/auto-ai/auto-ai/discussions)

---

*Built with ❤️ by the Auto-AI Team*
