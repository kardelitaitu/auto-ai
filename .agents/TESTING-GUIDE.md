# Testing Guide

Vitest testing strategy for the Auto-AI project.

---

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:edge-cases` | Run edge case tests |
| `npm run test:all` | Run all test suites |
| `npm run test:coverage` | Run with coverage (recommended) |
| `npm run test:watch` | Watch mode for development |
| `npm run test:verbose` | Detailed output |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |

---

## Test Structure

```
api/tests/
├── unit/                    # Unit tests (isolated)
│   ├── api/                 # API module tests
│   │   ├── actions.test.js
│   │   ├── context.test.js
│   │   ├── cursor.test.js
│   │   ├── init.test.js
│   │   ├── navigation.test.js
│   │   ├── scroll.test.js
│   │   └── ...
│   ├── agent/               # Agent system tests
│   │   ├── actionEngine.test.js
│   │   ├── confidenceScorer.test.js
│   │   ├── gameRunner.test.js
│   │   └── ...
│   └── ...                  # Other unit tests
│
├── integration/             # Integration tests (cross-module)
│   ├── agent-connector.test.js
│   ├── cloud-client.test.js
│   ├── orchestrator-dispatch.test.js
│   └── ...
│
├── edge-cases/              # Edge case scenarios
│   └── ...
│
└── vitest.setup.js          # Test setup (creates coverage dirs)
```

---

## Configuration

**Vitest Config**: `config/vitest.config.js`

Key settings:
- `pool: 'forks'` - Required for AsyncLocalStorage isolation
- Coverage target: >90% line coverage

**Important**: The `pool: 'forks'` setting is **critical**. Worker processes provide isolation for `AsyncLocalStorage` and prevent global namespace pollution during browser patching.

---

## Writing Tests

### Unit Test Pattern

```javascript
// api/tests/unit/api/myModule.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('myModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should do something', async () => {
        // Arrange
        const mockPage = { /* mock page */ };
        
        // Act
        const result = await myFunction(mockPage);
        
        // Assert
        expect(result).toBeDefined();
    });
});
```

### Mocking Pattern

```javascript
// Mock external dependencies
vi.mock('../core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock Playwright page
const mockPage = {
    goto: vi.fn(),
    click: vi.fn(),
    locator: vi.fn(() => ({
        click: vi.fn(),
        fill: vi.fn()
    }))
};
```

---

## Coverage Targets

| Metric | Target |
|--------|--------|
| Line coverage | >90% |
| Branch coverage | >85% |
| Function coverage | >90% |

View coverage:
```bash
npm run test:coverage
# Open coverage/index.html for visual report
```

---

## Common Test Patterns

### Testing API Methods

```javascript
import { api } from '../../index.js';

describe('api.click', () => {
    it('should click element with recovery', async () => {
        await api.withPage(mockPage, async () => {
            await api.init(mockPage);
            await api.click('.btn');
            expect(mockPage.click).toHaveBeenCalled();
        });
    });
});
```

### Testing Agent Modules

```javascript
import { actionEngine } from '../../../api/agent/actionEngine.js';

describe('actionEngine', () => {
    it('should execute click action with GhostCursor', async () => {
        const result = await actionEngine.execute({
            type: 'click',
            selector: '#btn'
        });
        expect(result.success).toBe(true);
    });
});
```

---

## Workflow

1. Write test first (`*.test.js`)
2. Run `npm run test:unit` to verify
3. Run `npm run lint` to check style
4. Run `npm run test:coverage` before commit
