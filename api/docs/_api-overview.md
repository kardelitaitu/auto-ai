# API Overview

This document provides a high-level overview of the Auto-AI Unified Browser Tool API.

## Quick Links

- [API README](./README.md) - Main API documentation
- [Architecture](./ARCHITECTURE.md) - System architecture diagrams
- [Core Modules](./core.md) - Context, config, errors, events
- [Interactions](./interactions.md) - Actions, scroll, cursor, navigation
- [Behaviors](./behaviors.md) - Persona, timing, attention, idle
- [Agent](./agent.md) - LLM-powered semantic interactions
- [Utils](./utils.md) - Utility functions

## What To Read First

- Start with [README.md](./README.md) for module selection and basic usage.
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the runtime flow and internal layers.
- Read [core.md](./core.md) before changing session isolation, config, middleware, or hooks.
- Read [interactions.md](./interactions.md) before adding or modifying browser actions.
- Read [agent.md](./agent.md) before changing semantic or LLM-driven behavior.
- Read [LLM-PROVIDERS.md](./LLM-PROVIDERS.md) before changing model routing or provider setup.

## Quick Start

```javascript
import { api } from './api/index.js';

await api.withPage(page, async () => {
    await api.init(page, { persona: 'casual' });
    await api.goto('https://example.com');
    await api.click('.login-button');
});
```

---

_For detailed documentation, see the files listed above._
