# Plan Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Focus](https://img.shields.io/badge/planning-essential-blue.svg)]()

> **Project planning, task breakdown, and roadmap creation toolkit.**

## Overview

The Plan Skill provides comprehensive project planning capabilities including task decomposition, estimation, prioritization, and roadmap development.

## Key Features

| Feature | Description |
|---------|-------------|
| **Task Breakdown** | Decompose complex tasks into manageable items |
| **Estimation** | Story points, time estimates, complexity scoring |
| **Prioritization** | MoSCoW, value/effort matrices |
| **Dependency Mapping** | Identify task dependencies and critical path |
| **Roadmap Planning** | Create phased implementation plans |

## Quick Start

```javascript
// Import planning functions
import { createTaskBreakdown, estimateEffort, prioritizeTasks } from './skills/plan/SKILL.md';

// Break down a feature
const tasks = createTaskBreakdown('Build user authentication', {
    level: 'detailed',
    includeTests: true
});

// Estimate effort
const estimates = estimateEffort(tasks);

// Prioritize
const prioritized = prioritizeTasks(tasks, {
    method: 'value-effort'
});
```

## Estimation Scales

| Scale | Range | Use Case |
|-------|-------|----------|
| **T-Shirt** | XS, S, M, L, XL | High-level planning |
| **Story Points** | 1, 2, 3, 5, 8, 13 | Sprint planning |
| **Fibonacci** | 1, 2, 3, 5, 8, 13, 21 | Relative sizing |

## Configuration

```json
{
    "planning": {
        "estimationMethod": "story-points",
        "sprintDuration": 14,
        "teamVelocity": 40
    }
}
```

## License

This project is licensed under the MIT License.

---

*Built with ❤️ by the Auto-AI Team*
