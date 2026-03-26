# Code Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/code-quality-focused-orange.svg)]()

> **Professional code analysis, generation, and refactoring toolkit.**

## Overview

The Code Skill provides intelligent code analysis, generation, and refactoring capabilities. It enables agents to understand codebases, generate quality code, and apply best practices consistently.

## Key Features

| Feature               | Description                               |
| --------------------- | ----------------------------------------- |
| **Code Analysis**     | Parse and analyze code structure          |
| **Code Generation**   | Generate quality code from specifications |
| **Refactoring**       | Safe code transformations                 |
| **Pattern Detection** | Identify code patterns and anti-patterns  |
| **Style Enforcement** | Ensure consistent code style              |
| **Documentation**     | Generate code documentation               |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Code Engine                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Parser    │  │  Generator  │  │  Refactor   │             │
│  │   Module    │  │   Module    │  │   Module    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Code Analysis       │                          │
│              │   Report              │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```javascript
// Import code functions
import { analyzeCodeStructure, generateCode } from './skills/code/SKILL.md';

// Analyze code structure
const structure = await analyzeCodeStructure('/project/src/app.js');
console.log(`Found ${structure.functions.length} functions`);

// Generate code
const code = await generateCode({
    type: 'function',
    name: 'calculateTotal',
    params: ['items', 'tax'],
    returnType: 'number',
});
```

## Supported Languages

| Language   | Parser | Features      |
| ---------- | ------ | ------------- |
| JavaScript | ✅     | Full support  |
| TypeScript | ✅     | Full support  |
| Python     | ✅     | Full support  |
| Java       | ✅     | Basic support |
| Go         | ✅     | Basic support |
| Rust       | ✅     | Basic support |

## Code Quality Metrics

| Metric          | Description           | Target |
| --------------- | --------------------- | ------ |
| **Complexity**  | Cyclomatic complexity | < 10   |
| **Lines**       | Function length       | < 50   |
| **Depth**       | Nesting depth         | < 4    |
| **Duplication** | Code duplication      | < 5%   |
| **Coverage**    | Test coverage         | > 80%  |

## API Reference

### `analyzeCodeStructure(filePath)`

Analyzes code structure and returns AST-like representation.

**Parameters:**

- `filePath` (string): Path to source file

**Returns:** `Promise<CodeStructure>`

### `generateCode(specification)`

Generates code from specification.

**Parameters:**

- `specification` (object): Code specification
    - `type`: string - Type of code (function, class, module)
    - `name`: string - Name of generated item
    - `params`: string[] - Parameters
    - `returnType`: string - Return type

**Returns:** `Promise<string>`

### `refactorCode(filePath, transformations)`

Applies refactoring transformations.

**Parameters:**

- `filePath` (string): Path to source file
- `transformations`: object[] - Transformations to apply

**Returns:** `Promise<RefactorResult>`

## Configuration

```json
{
    "code": {
        "parser": {
            "ecmaVersion": 2022,
            "sourceType": "module"
        },
        "rules": {
            "maxComplexity": 10,
            "maxLines": 100,
            "maxDepth": 4
        },
        "style": {
            "indent": 4,
            "quotes": "single",
            "semicolons": true
        }
    }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/code-enhancement`)
3. Commit your changes (`git commit -m 'Add code feature'`)
4. Push to the branch (`git push origin feature/code-enhancement`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

_Built with ❤️ by the Auto-AI Team_
