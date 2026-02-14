# Performance Improvement Plan

## Goals
- Increase task snappiness under multi-session load
- Reduce task start latency and queue wait time
- Lower CPU and memory pressure during sustained runs
- Improve stability and recovery under network and browser failures

## Scope
- Browser orchestration and session lifecycle
- Task scheduling and execution workflow
- AI request routing and queueing
- Network retry and timeout behavior
- Memory and resource cleanup

## Key Risks and Bottlenecks
- Task broadcast to all sessions multiplies work under load
- Page creation per task inflates startup latency and memory churn
- Busy-retry loops for workers add latency jitter
- Double queueing for AI requests reduces throughput
- Timer-based timeouts not cleared can accumulate
- Retry and circuit breaker overlap can extend tail latency

## Optimization Plan

### 1) Orchestration and Scheduling
- Replace task broadcast with centralized task assignment
- Use per-session worker semaphores to await availability
- Track task affinity and deprioritize failing sessions

### 2) Page and Context Reuse
- Maintain a small pool of pages per worker
- Reuse contexts per session while healthy
- Close pages only when unhealthy or idle beyond threshold

### 3) AI Request Throughput
- Consolidate AI request queues into a single layer
- Unify retry policy and keep circuit breaker state only
- Cache stable prompts and configuration values

### 4) Network and Retry Behavior
- Normalize timeout settings across AI providers
- Use exponential backoff with jitter and max cap
- Add fast-fail on known fatal error classes

### 5) Memory and Cleanup
- Enforce bounds for queue sizes and occupancy maps
- Clear timeout handles on success and failure
- Add periodic cleanup for orphaned pages and stale sessions

## Task Breakdown
- Task A: Centralized task assignment with worker semaphores (branch: feat/scheduler-queue)
- Task B: Page pooling and context reuse (branch: feat/page-pooling)
- Task C: Retry and timeout unification (branch: feat/retry-timeout)
- Task D: Memory bounds and cleanup hardening (branch: feat/memory-hardening)

## Metrics and Success Criteria
- P50 and P95 task latency reduced by 30–50%
- Queue wait time reduced by 40–60%
- CPU usage reduced by 15–30% under steady load
- Memory growth bounded to <5% over 1 hour
- Task success rate above 98% under load

## Testing Requirements
- Concurrency tests with 3–10 sessions
- Long-running soak tests with repeated task cycles
- Failure injection for network timeouts and browser disconnects
- Regression tests for AI routing and task scheduling

## Implementation Phases

### Phase A: Scheduler and Queue Consolidation
- Central task assignment
- Worker semaphore
- Remove redundant AI queue

### Phase B: Page Pooling
- Page reuse with health checks
- Idle page cleanup

### Phase C: Retry and Timeout Unification
- Centralized retry policy
- Circuit breaker-only for state

### Phase D: Memory Hardening
- Bounded queues and maps
- Cleanup timers on shutdown
