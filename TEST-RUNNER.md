# Test Runner Guide

## Problem
The test suite has 248+ test files that collectively import too many modules, causing JavaScript heap out of memory errors even with 8GB allocated.

## Solutions

### Option 1: Run Tests in Batches (Recommended)

Use the batch test runner to run tests in smaller groups:

```bash
# Run unit tests only (smaller subset)
npm run test:unit

# Run integration tests only
npm run test:integration

# Run specific test files
npx vitest run api/tests/unit/standalone.test.js api/tests/unit/actions-like.test.js -c config/vitest.config.js
```

### Option 2: Increase Memory Further

Edit `package.json` to increase memory to 16GB:

```json
"test:coverage": "node --max-old-space-size=16384 node_modules/vitest/vitest.mjs run -c config/vitest.config.js --coverage --silent --reporter=dot"
```

### Option 3: Run Without Coverage First

Coverage collection adds significant memory overhead. Run tests without coverage first:

```bash
npx vitest run -c config/vitest.config.js --reporter=verbose
```

### Option 4: Exclude Problematic Test Files

Some test files may be importing heavy modules. Create a custom config that excludes them:

```javascript
// vitest.batch.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        include: ['api/tests/unit/**/*.test.js'],
        exclude: [
            'node_modules',
            'dist',
            '.git',
            // Add problematic test files here
            'api/tests/unit/ai-twitterAgent*.test.js',
            'api/tests/unit/ai-quote-engine*.test.js',
        ],
        pool: 'forks',
        maxWorkers: 1,
        fileParallelism: false,
    },
});
```

## Current Configuration

The following changes have been made to [`config/vitest.config.js`](config/vitest.config.js):

- `maxWorkers: 1` - Run tests sequentially
- `fileParallelism: false` - Don't parallelize file execution
- Vitest version downgraded to 3.x for compatibility

## Running Specific Test Categories

```bash
# Quick sanity check
npx vitest run api/tests/unit/standalone.test.js -c config/vitest.config.js

# Action tests
npx vitest run api/tests/unit/actions-*.test.js -c config/vitest.config.js

# Agent tests (may be heavy)
npx vitest run api/tests/unit/ai-twitterAgent.test.js -c config/vitest.config.js

# Integration tests
npx vitest run api/tests/integration/*.test.js -c config/vitest.config.js
```

## Known Issues

1. **Memory Limit**: Running all 248+ test files together exceeds Node.js memory limits
2. **Coverage Collection**: Adds significant memory overhead
3. **Module Loading**: Each test file imports multiple modules, cumulative memory grows quickly

## Recommended Workflow

1. Run specific test files during development
2. Run `npm run test:unit` for unit test validation
3. Run `npm run test:integration` for integration test validation
4. Run full `npm run test:coverage` on CI/CD with sufficient memory allocation
