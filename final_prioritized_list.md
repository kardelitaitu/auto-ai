# Prioritized List of Files to Improve Test Coverage

## Executive Summary

Based on the test coverage analysis of the auto-ai project, here is a prioritized list of files that need improved test coverage:

### Current Coverage Status:

- Overall: 79.47% statement coverage
- 12 files below 70% threshold
- 3 files below 50% threshold (Critical)
- Many source files without test coverage

## PRIORITY 1: CRITICAL FILES (Coverage < 50%)

### 1. twitter/twitterAgent.js (13.77% coverage)

- Path: C:\My Script\auto-ai\api\twitter\twitterAgent.js
- Size: 2,091 lines (largest file in project)
- Impact: HIGH - Core Twitter automation component
- Current status: 5 test files exist but coverage is minimal
- Uncovered: postTweet(), humanType(), error handling, session management

### 2. api/index.js (30% coverage)

- Path: C:\My Script\auto-ai\api\index.js
- Size: 823 lines
- Impact: HIGH - Main API export file
- Uncovered: Agent functions (357-391), GameAgent (551-555), VPREP (557-606)

### 3. utils/patch.js (42.62% coverage)

- Path: C:\My Script\auto-ai\api\utils\patch.js
- Size: 419 lines
- Impact: MEDIUM-HIGH - Critical for anti-detection
- Uncovered: Function.prototype.toString patching, error handling

## PRIORITY 2: HIGH PRIORITY FILES (Coverage 50-69%)

### 4. agent/gameRunner.js (50.62% coverage)

- Path: C:\My Script\auto-ai\api\agent\gameRunner.js
- Size: 973 lines
- Uncovered: Lines 223-595, 630, 777 (majority of execution logic)

### 5. agent/sessionStore.js (58.69% coverage)

- Path: C:\My Script\auto-ai\api\agent\sessionStore.js
- Size: 314 lines
- Uncovered: Session persistence and recovery logic

### 6. ai-reply-engine/decision.js (61.42% coverage)

- Path: C:\My Script\auto-ai\api\agent\ai-reply-engine\decision.js
- Uncovered: Lines 299, 323-347, 359 (decision algorithms)

### 7. interactions/scroll.js (62.26% coverage)

- Path: C:\My Script\auto-ai\api\interactions\scroll.js
- Uncovered: Lines 463, 592-600, 668

### 8. core/init.js (64.28% coverage)

- Path: C:\My Script\auto-ai\api\core\init.js
- Size: (unknown)
- Uncovered: Lines 166-170, 229-233

### 9. core/orchestrator.js (64.47% coverage)

- Path: C:\My Script\auto-ai\api\core\orchestrator.js
- Size: 854 lines
- Uncovered: Browser management and task execution logic

### 10. core/context.js (64.55% coverage)

- Path: C:\My Script\auto-ai\api\core\context.js
- Size: 262 lines
- Uncovered: Lines 49-107, 256 (context state management)

## PRIORITY 3: TEST INFRASTRUCTURE FILES

### 11. tests/utils/test-helpers.js (42.64% coverage)

- Path: C:\My Script\auto-ai\api\tests\utils\test-helpers.js
- Size: 427 lines
- Uncovered: advanceTimers() (lines 363-364), setupTest() (lines 377-391)

### 12. tests/fixtures/mocks.js (66.66% coverage)

- Path: C:\My Script\auto-ai\api\tests\fixtures\mocks.js
- Uncovered: Lines 30-33

## FILES WITHOUT TEST COVERAGE

The following source files have NO corresponding test files:

1. actions/advanced-index.js
2. actions/ai-twitter-bookmark.js
3. actions/ai-twitter-go-home.js
4. actions/ai-twitter-like.js
5. actions/ai-twitter-quote.js
6. actions/ai-twitter-reply.js
7. actions/ai-twitter-retweet.js
8. agent/finder.js
9. agent/observer.js
10. behaviors/human-timing.js

## RECOMMENDED TESTING PATTERNS

### Error Handling Tests:

- Network failures and recovery
- Page crashes and reconnection
- Invalid selectors and timeouts
- API rate limiting and retries

### Edge Case Tests:

- Empty/null inputs
- Large data payloads
- Concurrent operations
- Memory leaks and cleanup

### Integration Tests:

- End-to-end Twitter workflows
- Multi-browser orchestration
- AI agent decision making
- Humanization patterns

## EXPECTED IMPACT

If all critical files are improved to 70%+ coverage:

- Overall coverage would increase to ~85%+
- Critical Twitter automation would be well-tested
