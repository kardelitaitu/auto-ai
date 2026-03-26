to check single test file coverage

npx vitest run --coverage --filter "api/tests/unit/semantic-parser-runner.js"

to check multiple test file coverage

npx vitest run --coverage --filter "api/tests/unit/semantic-parser-runner.js" --filter "api/tests/unit/api-handler.js"

to check all test file coverage

npx vitest run --coverage

the goal is to have 95%+ line coverage for all test files