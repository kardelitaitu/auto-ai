# Phase 3: Roadmap Checklist

- [ ] Set up Vitest test suite for `core/` and `interactions/`
- [ ] Build action recorder (`api/core/recorder.js`)
- [ ] Implement per-site persona auto-selection
- [ ] Add OpenTelemetry integration (optional dependency)
- [ ] Add Playwright trace capture on task failure
- [ ] Build multi-model LLM routing
- [ ] Evaluate distributed orchestration with BullMQ

---

# Phase 3: Future Upgrades

> **Priority**: Strategic | **Effort**: High | **Risk**: Medium
> **Goal**: Build the features that take the framework from "internal tool" to "production platform".

---

## 3.1 Unit Test Suite

### Priority Test Targets

| Module                 | What to Test                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `core/context.js`      | Session isolation — two concurrent `withPage()` calls don't leak state        |
| `core/middleware.js`   | Pipeline composition, retry backoff timing, recovery strategies               |
| `core/errors.js`       | Error hierarchy (`instanceof` chains), `isErrorCode()` matching               |
| `utils/math.js`        | Gaussian distribution bounds, `randomInRange` min/max, `roll()` probabilities |
| `interactions/wait.js` | Timeout behavior, predicate polling, jitter bounds                            |
| `core/config.js`       | Dot-path resolution, override precedence, missing key defaults                |

### Recommended Setup

- **Runner**: Vitest (already in project ecosystem)
- **Mocking**: Vitest built-in mocks for Playwright `Page` objects
- **Target**: ≥80% coverage on `core/` and `interactions/`

---

## 3.2 Action Replay & Recording

Record every API action as a JSON event stream for debugging failed runs.

### Design

```js
// New file: api/core/recorder.js
class ActionRecorder {
    constructor() {
        this.events = [];
        this.recording = false;
    }

    start() {
        this.recording = true;
        this.events = [];
    }
    stop() {
        this.recording = false;
        return this.events;
    }

    record(action, args, result, duration) {
        if (!this.recording) return;
        this.events.push({
            timestamp: Date.now(),
            action,
            args,
            result: result?.success ?? result,
            duration,
        });
    }

    export() {
        return JSON.stringify(this.events, null, 2);
    }
}
```

### Integration

- Hook into the `metricsMiddleware` or the event system (`after:click`, `after:type`, etc.)
- Expose as `api.recorder.start()` / `api.recorder.stop()` / `api.recorder.export()`
- Save recordings alongside orchestrator task logs

---

## 3.3 Per-Site Persona Profiles

Automatically select a persona based on the target domain.

### Design

```js
// New file: api/behaviors/site-personas.js
const SITE_PERSONA_MAP = {
    'twitter.com': 'casual',
    'x.com': 'casual',
    'linkedin.com': 'professional',
    'reddit.com': 'researcher',
    'facebook.com': 'casual',
    'instagram.com': 'teen',
    'github.com': 'power',
    // custom overrides via config
};

export function getPersonaForSite(url) {
    const hostname = new URL(url).hostname.replace('www.', '');
    return SITE_PERSONA_MAP[hostname] || 'casual';
}
```

### Integration

- In `navigation.js` `goto()`, after navigation, auto-set persona if `options.autoPersona !== false`
- Configurable via settings file so users can override mappings

---

## 3.4 OpenTelemetry Integration

Replace the custom `metricsMiddleware` with OpenTelemetry spans for industry-standard observability.

### Benefits

- Distributed tracing across orchestrator → worker → agent
- Export to Jaeger, Grafana Tempo, or Datadog
- Correlate LLM latency, action success rates, and session duration

### Approach

1. Add `@opentelemetry/api` as optional dependency
2. Create `api/core/telemetry.js` that wraps the OTel API
3. Replace `metricsMiddleware` event emissions with span creation
4. If OTel SDK is not installed, gracefully degrade to current behavior (no-op spans)

---

## 3.5 Playwright Trace Integration

Attach Playwright trace files to failed task reports for deep visual debugging.

### Design

```js
// In orchestrator-v2.js executeTask()
const context = page.context();
await context.tracing.start({ screenshots: true, snapshots: true });

try {
    await taskFn(page, ...);
} catch (e) {
    await context.tracing.stop({ path: `traces/${taskId}-failed.zip` });
    throw e;
}

await context.tracing.stop(); // Discard on success (or keep if configured)
```

### Benefits

- Failed tasks produce a `.zip` trace viewable in [Playwright Trace Viewer](https://trace.playwright.dev)
- Captures DOM snapshots, network requests, and screenshots at each step
- Eliminates guesswork when debugging site-specific failures

---

## 3.6 Multi-Model LLM Routing

Route agent tasks to different models based on complexity.

### Design

```js
// api/agent/model-router.js
const ROUTING_TABLE = {
    simple: { model: 'qwen2.5:7b', serverType: 'ollama' }, // Local, fast
    medium: { model: 'qwen2.5:32b', serverType: 'ollama' }, // Local, capable
    complex: { model: 'gpt-4o-mini', serverType: 'openai' }, // Cloud, powerful
};

export function selectModel(taskComplexity) {
    return ROUTING_TABLE[taskComplexity] || ROUTING_TABLE.simple;
}
```

### Complexity Detection

- Token count of page context → high token count = complex
- Number of interactive elements → many elements = complex
- Task goal keywords (e.g., "analyze" → complex, "click" → simple)

---

## 3.7 Distributed Orchestration (Stretch Goal)

Scale the orchestrator across multiple machines.

### Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Task Queue │────▶│  Worker Node 1  │     │  Worker Node 2 │
│  (Redis +   │────▶│  (Orchestrator) │     │  (Orchestrator) │
│   BullMQ)   │     └─────────────────┘     └──────────────┘
└─────────────┘              │                       │
                     ┌───────┴───────┐       ┌───────┴───────┐
                     │ Browser 1..N  │       │ Browser 1..N  │
                     └───────────────┘       └───────────────┘
```

### Requirements

- Replace in-memory task queue with Redis-backed BullMQ
- Add worker heartbeat and task re-assignment on worker failure
- Centralized metrics dashboard aggregating all worker nodes

---

## Checklist

the checklist is on top of the file
