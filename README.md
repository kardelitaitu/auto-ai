# Auto-AI

Agentic orchestration framework for discovering and automating pre-existing browser instances via CDP. Uses AI for decision-making with human-like behavior patterns to reduce detection risk.

## Features

- **Multi-Browser Support** - ixBrowser, MoreLogin, Dolphin, Brave, Chrome, Edge, Vivaldi
- **AI-Powered** - Local Ollama/Docker LLMs + cloud OpenRouter integration
- **Human-Like Behavior** - Mouse movements, keystroke dynamics, scrolling patterns
- **Session Isolation** - AsyncLocalStorage-based context isolation
- **Error Recovery** - Automatic retry strategies and self-healing prompts

## Quick Start

### 1. Install

```bash
git clone https://github.com/kardelitaitu/auto-ai.git
cd auto-ai
pnpm install
```

### 2. Configure

```bash
copy .env-example .env
# Edit .env with your API keys
```

### 3. Run

```bash
# Start browser with remote debugging
node main.js pageview=example.com
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation and first automation |
| [API Reference](docs/api.md) | Complete API documentation |
| [Architecture](docs/architecture.md) | System design and concepts |
| [Configuration](docs/configuration.md) | Settings and environment |
| [Tasks](docs/tasks.md) | Built-in automation tasks |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |

## Usage

### Command Line

```bash
# Page navigation
node main.js pageview=example.com

# Twitter automation
node main.js twitterFollow=https://twitter.com/user
node main.js like tweetUrl="https://twitter.com/user/status/123"

# Game agent
node agent-main.js owb play
node agent-main.js owb rush
```

### Programmatic

```javascript
import { api } from './api/index.js';

await api.withPage(async (page) => {
    await api.navigate('https://example.com');
    await api.click('#button');
    await api.type('input', 'text');
});
```

## Requirements

- Node.js 18+
- pnpm 8+
- Browser with remote debugging (ixBrowser, Brave, Chrome, etc.)
- Docker (optional, for local LLM)

## Testing

```bash
pnpm test:unit       # Unit tests
pnpm test:integration # Integration tests
pnpm test:all        # All tests
```

## Project Structure

```
auto-ai/
├── api/              # Core API
│   ├── core/         # Context, orchestrator, session manager
│   ├── agent/        # AI agent stack
│   ├── interactions/ # Click, type, scroll
│   ├── behaviors/    # Humanization
│   └── utils/        # Config, logging, fingerprint
├── connectors/       # Browser discovery adapters
├── tasks/            # Automation scripts
├── config/           # Configuration files
└── docs/             # Documentation
```

## License

MIT
