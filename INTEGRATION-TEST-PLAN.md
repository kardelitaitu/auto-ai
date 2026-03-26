# Integration Test Coverage Improvement Plan

**Baseline Coverage**: 0.81% statements (as of 2025-03-26)
**Target**: ≥90% integration coverage
**Strategy**: Iterative measure → identify gaps → write tests → re-run loop

---

## Phase 1: Critical Paths (Priority 1)

### 1.1 Authentication & Session Management

**Why**: Foundation for all browser automation; failure here breaks everything.

**Test Areas**:

- `api/core/context.js` - AsyncLocalStorage context isolation
- `api/core/sessionManager.js` - Session lifecycle, worker health
- `api/core/context-state.js` - State persistence across async boundaries
- `api/index.js` - `withPage()` wrapper functionality

**Test Scenarios**:

- ✅ Session creation and destruction
- ✅ Context isolation between concurrent sessions
- ✅ Session state persistence (store/retrieve)
- ✅ Error propagation within session context
- ✅ Session timeout and cleanup
- ✅ Multiple sessions running in parallel without interference

---

### 1.2 Core Orchestration & Task Dispatch

**Why**: Central coordination layer; ensures tasks execute correctly.

**Test Areas**:

- `api/core/orchestrator.js` - Task queueing, dispatch, abort signals
- `api/core/request-queue.js` - Request prioritization and concurrency
- `api/core/circuit-breaker.js` - Failure detection and recovery
- `api/core/health-monitor.js` - System health checks

**Test Scenarios**:

- ✅ Task queuing and ordered execution
- ✅ Centralized vs broadcast dispatch modes
- ✅ Task/group timeouts with abort signal propagation
- ✅ Worker health monitoring and session removal
- ✅ Circuit breaker open/close transitions
- ✅ Request queue concurrency limits
- ✅ Health check aggregation and scoring

---

### 1.3 Agent Connector & AI Integration

**Why**: AI decision-making core; handles LLM routing and vision.

**Test Areas**:

- `api/core/agent-connector.js` - Request routing, fallback logic
- `api/agent/llmClient.js` - LLM API interactions
- `api/agent/vision.js` - Vision interpreter integration
- `api/agent/responseCache.js` - Caching layer
- `api/agent/retryStrategy.js` - Retry with backoff

**Test Scenarios**:

- ✅ Local LLM (Ollama) request/response flow
- ✅ Cloud LLM (OpenRouter) request/response flow
- ✅ Vision request handling with image processing
- ✅ Request queueing and prioritization
- ✅ Circuit breaker per provider
- ✅ Cache hit/miss behavior
- ✅ Retry strategy with exponential backoff
- ✅ Health score calculation and reporting

---

## Phase 2: Business Workflows (Priority 2)

### 2.1 Unified API Flow

**Why**: Primary user-facing API; must ensure end-to-end correctness.

**Test Areas**:

- `api/index.js` - Composed API exports
- `api/interactions/actions.js` - Click, type, hover, etc.
- `api/interactions/navigation.js` - goto, reload, back, forward
- `api/interactions/scroll.js` - Scrolling behaviors
- `api/interactions/wait.js` - Wait conditions and timeouts
- `api/interactions/queries.js` - Element queries and assertions

**Test Scenarios**:

- ✅ Full navigation flow: goto → waitForLoadState → query → action
- ✅ Click with humanized cursor movement and fallback handling
- ✅ Type with keystroke dynamics and validation
- ✅ Scroll with variable speed and drift
- ✅ Wait conditions (selector, URL, load state, custom)
- ✅ Element existence and visibility checks
- ✅ Error handling for missing elements
- ✅ Banner handling integration

---

### 2.2 Humanization & Anti-Detection

**Why**: Critical for avoiding bot detection; complex behavioral patterns.

**Test Areas**:

- `api/behaviors/humanization/engine.js` - Humanization orchestration
- `api/behaviors/humanization/action.js` - Action humanization
- `api/behaviors/humanization/scroll.js` - Scroll humanization
- `api/behaviors/humanization/timing.js` - Timing variations
- `api/behaviors/motor-control.js` - Mouse movement physics
- `api/behaviors/persona.js` - Persona-based behavior profiles
- `api/behaviors/idle.js` - Idle behavior patterns

**Test Scenarios**:

- ✅ Mouse movement with PID control and drift
- ✅ Keystroke dynamics (dwell time, error rates)
- ✅ Scroll acceleration and deceleration curves
- ✅ Random pauses and thinking delays
- ✅ Persona switching and persistence
- ✅ Idle behavior activation after inactivity
- ✅ Micro-interactions (cursor fidgeting, small movements)

---

### 2.3 Recovery & Self-Healing

**Why**: Robustness against transient failures and page changes.

**Test Areas**:

- `api/behaviors/recover.js` - Error recovery strategies
- `api/agent/errorPatternLearner.js` - Pattern detection
- `api/agent/selfHealingPrompt.js` - LLM-based recovery prompts
- `api/agent/executor.js` - Execution with retry logic

**Test Scenarios**:

- ✅ Element not found → retry with alternative selector
- ✅ Navigation failure → goBack and retry
- ✅ Stale element → re-query and retry
- ✅ Network error → exponential backoff retry
- ✅ Timeout → graceful degradation
- ✅ Recovery pattern learning and application

---

## Phase 3: External Service Boundaries (Priority 3)

### 3.1 Browser Connectors

**Why**: Integration with anti-detect browser vendors.

**Test Areas**:

- `connectors/` - Browser vendor adapters (ixBrowser, MoreLogin, Dolphin, etc.)
- `api/core/discovery.js` - Browser profile discovery
- `api/core/automator.js` - CDP connection management

**Test Scenarios**:

- ✅ Profile discovery and listing
- ✅ CDP connection establishment
- ✅ Browser launch with profile configuration
- ✅ Connection health checks
- ✅ Reconnection logic after disconnect
- ✅ Multiple concurrent browser sessions

---

### 3.2 LLM Providers

**Why**: External API dependencies; need resilience testing.

**Test Areas**:

- `api/agent/ollama-client.js` - Local Ollama integration
- `api/agent/vllm-client.js` - vLLM integration
- `api/agent/cloud-client.js` - OpenRouter cloud integration
- `api/utils/free-openrouter-helper.js` - Free model discovery

**Test Scenarios**:

- ✅ Ollama API request/response with streaming
- ✅ vLLM API request/response
- ✅ OpenRouter API with multiple provider fallback
- ✅ Model selection based on capabilities
- ✅ Rate limit handling and retry
- ✅ API timeout and cancellation
- ✅ Streaming response processing

---

### 3.3 File I/O & Configuration

**Why**: Persistent storage and configuration management.

**Test Areas**:

- `api/utils/configLoader.js` - Config loading and caching
- `api/utils/file-io.js` - File operations
- `api/agent/sessionStore.js` - Session persistence
- `api/agent/historyManager.js` - History compaction

**Test Scenarios**:

- ✅ Config loading from multiple sources (JSON, .env)
- ✅ Config validation and defaults
- ✅ File read/write with error handling
- ✅ Session save/load across restarts
- ✅ History compaction and pruning

---

## Phase 4: Edge Cases & Error Scenarios (Priority 4)

### 4.1 Concurrency & Race Conditions

**Test Scenarios**:

- ✅ Multiple sessions accessing shared resources
- ✅ Concurrent task execution with semaphore limits
- ✅ Race condition in session state updates
- ✅ Deadlock prevention in request queue

---

### 4.2 Resource Exhaustion

**Test Scenarios**:

- ✅ Memory limits with many concurrent sessions
- ✅ File descriptor limits
- ✅ Request queue overflow handling
- ✅ Circuit breaker activation under load

---

### 4.3 Network & Browser Failures

**Test Scenarios**:

- ✅ CDP connection loss and reconnection
- ✅ Page crash recovery
- ✅ Network timeout propagation
- ✅ Browser process kill and restart

---

### 4.4 Invalid Inputs & Malformed Data

**Test Scenarios**:

- ✅ Invalid task names → proper error codes
- ✅ Malformed payloads → validation errors
- ✅ Corrupted config files → fallback to defaults
- ✅ Invalid selectors → ElementNotFoundError

---

## Phase 5: Performance & Load (Priority 5)

### 5.1 Throughput Testing

**Test Scenarios**:

- ✅ Tasks per second with increasing concurrency
- ✅ Request queue latency under load
- ✅ Memory usage growth over time
- ✅ Circuit breaker response time

---

### 5.2 Stress Testing

**Test Scenarios**:

- ✅ Burst of 100+ concurrent tasks
- ✅ Long-running sessions (24+ hours)
- ✅ Large payloads and responses
- ✅ High-frequency LLM requests

---

## Execution Strategy

### Iteration 1 (Weeks 1-2)

**Focus**: Phase 1.1 & 1.2 (Authentication, Orchestration)
**Goal**: Reach 20% coverage
**Deliverables**:

- 15-20 integration tests covering context isolation, session lifecycle, task dispatch
- Tests for orchestrator timeouts, abort signals, health monitoring

---

### Iteration 2 (Weeks 3-4)

**Focus**: Phase 1.3 & 2.1 (Agent Connector, Unified API)
**Goal**: Reach 40% coverage
**Deliverables**:

- 20-25 tests for agent-connector (LLM routing, vision, caching, retries)
- 15-20 tests for end-to-end API flows (navigation, actions, waits)

---

### Iteration 3 (Weeks 5-6)

**Focus**: Phase 2.2 & 2.3 (Humanization, Recovery)
**Goal**: Reach 60% coverage
**Deliverables**:

- 20-25 tests for humanization behaviors (mouse, keyboard, scroll, timing)
- 15-20 tests for recovery strategies and error patterns

---

### Iteration 4 (Weeks 7-8)

**Focus**: Phase 3 (External Services)
**Goal**: Reach 75% coverage
**Deliverables**:

- 15-20 tests for browser connectors and discovery
- 15-20 tests for LLM providers and fallback logic
- 10-15 tests for config and file I/O

---

### Iteration 5 (Weeks 9-10)

**Focus**: Phase 4 (Edge Cases)
**Goal**: Reach 85% coverage
**Deliverables**:

- 20-25 tests for concurrency, race conditions, resource exhaustion
- 15-20 tests for network failures, invalid inputs, browser crashes

---

### Iteration 6 (Weeks 11-12)

**Focus**: Phase 5 (Performance) + Gap Filling
**Goal**: Reach ≥90% coverage
**Deliverables**:

- 10-15 performance and stress tests
- Fill any remaining coverage gaps identified in analysis
- Final verification of all critical user journeys

---

## Test Structure Guidelines

### Integration Test Pattern

```javascript
describe('Module Integration', () => {
    let realInstance;
    let mocks;

    beforeEach(async () => {
        // Setup real instances with selective mocking
        // Mock only external dependencies (network, file system, browser)
        // Test internal component interactions
    });

    it('should integrate component A with component B', async () => {
        // Exercise full flow across multiple modules
        // Assert on observable outcomes and side effects
        // Verify error propagation and recovery
    });
});
```

### Mocking Strategy

- ✅ Mock external services (LLM APIs, browser vendors)
- ✅ Mock file system for I/O tests
- ✅ Use real in-memory implementations for internal modules
- ✅ Avoid mocking within the same module boundary
- ✅ Use `vi.hoisted()` for shared mock instances

### Test Data

- Use realistic but synthetic data
- Avoid hardcoded paths; use temporary directories
- Clean up resources in `afterEach` hooks
- Use fixtures for complex payloads

---

## Success Criteria

1. **Coverage**: ≥90% statement coverage on integration test run
2. **Critical Paths**: All Phase 1 & 2 scenarios have ≥95% coverage
3. **Error Coverage**: ≥80% of error branches exercised
4. **Performance**: Baseline benchmarks established and stable
5. **Documentation**: All integration tests documented with clear scenarios

---

## Immediate Next Steps (Day 1)

1. ✅ Run coverage analysis (DONE - 0.81% baseline)
2. ✅ Create this test plan (IN PROGRESS)
3. **Write first integration test**: Context isolation with `api.withPage()`
4. **Write second integration test**: Session lifecycle in `sessionManager`
5. Run coverage → verify improvement
6. Continue iterative development

---

## Notes

- Integration tests run via `pnpm test:bun:coverage:integration`
- Coverage reports in `api/coverage/`
- Use `analyze-coverage.js` to identify low-coverage files
- Prioritize tests that exercise multiple modules together
- Focus on behavior over implementation details
