# Orchestrator Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/multi--agent-ready-purple.svg)]()

> **Multi-agent orchestration and task delegation framework.**

## Overview

The Orchestrator Skill enables coordinated execution of tasks across multiple AI agents. It provides patterns for task delegation, result aggregation, and agent communication.

## Key Features

| Feature | Description |
|---------|-------------|
| **Supervisor Pattern** | Central coordinator delegates to workers |
| **Pipeline Pattern** | Sequential multi-stage processing |
| **Fan-Out/Fan-In** | Parallel execution with consensus |
| **Message Passing** | Inter-agent communication |
| **Load Balancing** | Distribute tasks evenly |
| **Fault Tolerance** | Automatic retry and fallback |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestrator Core                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Supervisor │  │  Pipeline   │  │   Fan-Out   │             │
│  │   Pattern   │  │   Pattern   │  │   Pattern   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   Agent Registry      │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Patterns

| Pattern | Best For | Complexity |
|---------|----------|------------|
| Supervisor | Task delegation | Medium |
| Pipeline | Sequential processing | Low |
| Fan-Out/Fan-In | Parallel voting | Medium |
| Hierarchical | Complex tasks | High |

## Quick Start

```javascript
// Supervisor pattern
const supervisor = new SupervisorOrchestrator();
supervisor.registerWorker('researcher', researchAgent);
supervisor.registerWorker('coder', codeAgent);
const result = await supervisor.delegate(task);

// Pipeline pattern
const pipeline = new PipelineOrchestrator();
pipeline.addStage('research', researchAgent);
pipeline.addStage('code', codeAgent);
pipeline.addStage('review', reviewAgent);
const result = await pipeline.execute(input);
```

## API Reference

### `SupervisorOrchestrator`

Central coordinator for task delegation.

**Methods:**
- `registerWorker(name, agent)` - Register a worker agent
- `delegate(task)` - Delegate task to best worker
- `selectWorker(requirements)` - Select worker by capability

### `PipelineOrchestrator`

Sequential multi-stage processing.

**Methods:**
- `addStage(name, agent, transform)` - Add pipeline stage
- `execute(input)` - Execute pipeline

### `FanOutFanInOrchestrator`

Parallel execution with result aggregation.

**Methods:**
- `addAgent(agent)` - Add agent to fan-out
- `execute(task)` - Execute and aggregate results

## Configuration

```json
{
    "orchestration": {
        "pattern": "supervisor",
        "maxWorkers": 5,
        "timeout": 30000,
        "retryAttempts": 3
    }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License.

---

*Built with ❤️ by the Auto-AI Team*
