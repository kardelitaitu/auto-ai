---
name: orchestrator
description: |
    Multi-agent orchestration for delegating tasks to specialized AI agents.
    Use when coordinating multiple agents, designing agent workflows, implementing
    task delegation, building agent pipelines, or creating supervisor patterns.
    Triggers on tasks involving agent coordination, task distribution, multi-agent
    systems, agent communication, or hierarchical task management.
license: MIT
metadata:
    author: Auto-AI Framework
    version: '1.0.0'
---

# Multi-Agent Orchestrator Skill

Comprehensive guide for orchestrating multiple AI agents, delegating tasks,
and building coordinated multi-agent systems. This skill covers agent patterns,
communication protocols, and task distribution strategies.

## When to Use This Skill

Use this skill when:

- Delegating tasks to multiple specialized agents
- Designing multi-agent workflows and pipelines
- Building supervisor/worker agent patterns
- Implementing agent-to-agent communication
- Coordinating parallel agent execution
- Creating hierarchical agent systems
- Managing agent state and context sharing
- Building consensus among multiple agents

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Agent Orchestrator                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │  Task       │    │  Agent      │    │  Result     │            │
│  │  Router     │───▶│  Dispatcher │───▶│  Aggregator │            │
│  └─────────────┘    └──────┬──────┘    └─────────────┘            │
│                            │                                        │
│         ┌──────────────────┼──────────────────┐                    │
│         ▼                  ▼                  ▼                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│  │   Agent A   │    │   Agent B   │    │   Agent C   │            │
│  │  (Research) │    │  (Code)     │    │  (Review)   │            │
│  └─────────────┘    └─────────────┘    └─────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Orchestration Patterns

### 1. Supervisor Pattern

A supervisor agent coordinates and delegates to worker agents.

```javascript
class SupervisorOrchestrator {
    constructor() {
        this.workers = new Map();
        this.taskQueue = [];
        this.results = new Map();
    }

    // Register specialized workers
    registerWorker(name, worker) {
        this.workers.set(name, {
            agent: worker,
            status: 'idle',
            capabilities: worker.capabilities || [],
            tasksCompleted: 0,
        });
    }

    // Delegate task to appropriate worker
    async delegate(task) {
        // Analyze task requirements
        const requirements = this.analyzeRequirements(task);

        // Find best matching worker
        const worker = this.selectWorker(requirements);

        if (!worker) {
            throw new Error('No suitable worker found');
        }

        // Update worker status
        worker.status = 'busy';

        try {
            // Execute task
            const result = await worker.agent.execute(task);

            worker.tasksCompleted++;
            worker.status = 'idle';

            return {
                success: true,
                worker: worker.name,
                result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            worker.status = 'idle';
            return {
                success: false,
                worker: worker.name,
                error: error.message,
            };
        }
    }

    // Select best worker for task
    selectWorker(requirements) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [name, worker] of this.workers) {
            if (worker.status !== 'idle') continue;

            const score = this.calculateMatchScore(worker, requirements);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { name, ...worker };
            }
        }

        return bestMatch;
    }

    calculateMatchScore(worker, requirements) {
        let score = 0;
        for (const req of requirements) {
            if (worker.capabilities.includes(req)) {
                score += 1;
            }
        }
        return score;
    }
}
```

### 2. Pipeline Pattern

Agents process data in sequence, each adding value.

```javascript
class PipelineOrchestrator {
    constructor() {
        this.stages = [];
        this.context = {};
    }

    // Add pipeline stage
    addStage(name, agent, transform = null) {
        this.stages.push({
            name,
            agent,
            transform: transform || ((input, result) => result),
            status: 'pending',
        });
    }

    // Execute pipeline
    async execute(input) {
        let data = input;
        const stageResults = [];

        for (const stage of this.stages) {
            console.log(`[Pipeline] Executing stage: ${stage.name}`);

            stage.status = 'running';
            const startTime = Date.now();

            try {
                const result = await stage.agent.execute(data);

                // Transform output for next stage
                data = stage.transform(data, result);

                stage.status = 'completed';
                stageResults.push({
                    stage: stage.name,
                    success: true,
                    duration: Date.now() - startTime,
                    output: data,
                });
            } catch (error) {
                stage.status = 'failed';
                stageResults.push({
                    stage: stage.name,
                    success: false,
                    error: error.message,
                });

                // Stop pipeline on failure
                return {
                    success: false,
                    failedAt: stage.name,
                    stages: stageResults,
                };
            }
        }

        return {
            success: true,
            finalOutput: data,
            stages: stageResults,
        };
    }
}

// Example: Research -> Code -> Review pipeline
const pipeline = new PipelineOrchestrator();
pipeline.addStage('research', researchAgent);
pipeline.addStage('code', codeAgent, (input, result) => ({
    specs: input,
    code: result,
}));
pipeline.addStage('review', reviewAgent, (input, result) => ({
    ...input,
    review: result,
}));
```

### 3. Fan-Out/Fan-In Pattern

Distribute work to multiple agents, then combine results.

```javascript
class FanOutFanInOrchestrator {
    constructor(options = {}) {
        this.agents = [];
        this.combiner = options.combiner || this.defaultCombiner;
        this.parallel = options.parallel !== false;
    }

    // Register agents
    addAgent(agent) {
        this.agents.push(agent);
    }

    // Execute with fan-out/fan-in
    async execute(task) {
        console.log(`[FanOut] Distributing to ${this.agents.length} agents`);

        // Fan out: Execute all agents
        const promises = this.agents.map((agent) => this.executeWithTimeout(agent, task));

        const results = await Promise.allSettled(promises);

        // Fan in: Combine results
        const successful = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

        const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);

        console.log(`[FanIn] ${successful.length} succeeded, ${failed.length} failed`);

        return this.combiner(successful, failed);
    }

    async executeWithTimeout(agent, task, timeout = 60000) {
        return Promise.race([
            agent.execute(task),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
        ]);
    }

    defaultCombiner(results, errors) {
        return {
            success: errors.length === 0,
            results,
            errors,
            consensus: this.findConsensus(results),
        };
    }

    findConsensus(results) {
        // Find common elements across results
        if (results.length === 0) return null;
        if (results.length === 1) return results[0];

        // Simple voting mechanism
        const votes = new Map();
        for (const result of results) {
            const key = JSON.stringify(result);
            votes.set(key, (votes.get(key) || 0) + 1);
        }

        let maxVotes = 0;
        let consensus = null;
        for (const [key, count] of votes) {
            if (count > maxVotes) {
                maxVotes = count;
                consensus = JSON.parse(key);
            }
        }

        return consensus;
    }
}
```

### 4. Hierarchical Pattern

Multi-level agent hierarchy for complex tasks.

```javascript
class HierarchicalOrchestrator {
    constructor() {
        this.levels = new Map();
        this.communication = new Map();
    }

    // Define hierarchy level
    addLevel(level, agents) {
        this.levels.set(level, {
            agents,
            coordinator: null,
        });
    }

    // Set coordinator for a level
    setCoordinator(level, coordinatorAgent) {
        const levelData = this.levels.get(level);
        if (levelData) {
            levelData.coordinator = coordinatorAgent;
        }
    }

    // Execute hierarchical task
    async execute(task) {
        // Start from top level
        const topLevel = Math.max(...this.levels.keys());
        return this.executeLevel(topLevel, task);
    }

    async executeLevel(level, task) {
        const levelData = this.levels.get(level);
        if (!levelData) {
            throw new Error(`Level ${level} not found`);
        }

        // If this level has a coordinator, use it to plan
        if (levelData.coordinator) {
            const subtasks = await levelData.coordinator.plan(task);

            // Execute subtasks at next level
            const nextLevel = level - 1;
            if (nextLevel >= 0) {
                const results = [];
                for (const subtask of subtasks) {
                    const result = await this.executeLevel(nextLevel, subtask);
                    results.push(result);
                }
                return this.aggregateLevelResults(results);
            }
        }

        // Leaf level: execute directly
        return levelData.agents[0].execute(task);
    }

    aggregateLevelResults(results) {
        return {
            success: results.every((r) => r.success),
            results,
            aggregated: this.mergeResults(results),
        };
    }
}
```

## Agent Communication

### 1. Message Passing

```javascript
class AgentMessageBus {
    constructor() {
        this.agents = new Map();
        this.messageQueue = [];
        this.subscriptions = new Map();
    }

    // Register agent
    registerAgent(id, agent) {
        this.agents.set(id, {
            agent,
            inbox: [],
            status: 'ready',
        });
    }

    // Subscribe to message types
    subscribe(agentId, messageType, handler) {
        if (!this.subscriptions.has(messageType)) {
            this.subscriptions.set(messageType, []);
        }
        this.subscriptions.get(messageType).push({ agentId, handler });
    }

    // Send message
    async send(from, to, message) {
        const recipient = this.agents.get(to);
        if (!recipient) {
            throw new Error(`Agent ${to} not found`);
        }

        const msg = {
            id: this.generateId(),
            from,
            to,
            type: message.type,
            content: message.content,
            timestamp: new Date().toISOString(),
            correlationId: message.correlationId,
        };

        recipient.inbox.push(msg);

        // Notify subscribers
        await this.notifySubscribers(msg);

        return msg.id;
    }

    // Broadcast message
    async broadcast(from, message) {
        const promises = [];
        for (const [id, agent] of this.agents) {
            if (id !== from) {
                promises.push(this.send(from, id, message));
            }
        }
        return Promise.all(promises);
    }

    // Process inbox
    async processInbox(agentId) {
        const agentData = this.agents.get(agentId);
        if (!agentData) return [];

        const processed = [];
        while (agentData.inbox.length > 0) {
            const message = agentData.inbox.shift();
            try {
                const response = await agentData.agent.handleMessage(message);
                processed.push({ message, response, success: true });
            } catch (error) {
                processed.push({ message, error: error.message, success: false });
            }
        }
        return processed;
    }

    async notifySubscribers(message) {
        const handlers = this.subscriptions.get(message.type) || [];
        for (const { handler } of handlers) {
            await handler(message);
        }
    }

    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
```

### 2. Shared State

```javascript
class SharedStateManager {
    constructor() {
        this.state = {};
        this.locks = new Map();
        this.watchers = new Map();
    }

    // Get state with optional path
    get(path = null) {
        if (!path) return this.state;

        return path
            .split('.')
            .reduce(
                (obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined),
                this.state
            );
    }

    // Set state with locking
    async set(path, value, agentId) {
        // Acquire lock
        await this.acquireLock(path, agentId);

        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {};
                return obj[key];
            }, this.state);

            const oldValue = target[lastKey];
            target[lastKey] = value;

            // Notify watchers
            await this.notifyWatchers(path, value, oldValue, agentId);

            return { success: true, oldValue };
        } finally {
            this.releaseLock(path, agentId);
        }
    }

    // Lock management
    async acquireLock(path, agentId, timeout = 5000) {
        const start = Date.now();

        while (this.locks.has(path)) {
            if (Date.now() - start > timeout) {
                throw new Error(`Lock timeout for ${path}`);
            }
            await new Promise((r) => setTimeout(r, 100));
        }

        this.locks.set(path, agentId);
    }

    releaseLock(path, agentId) {
        if (this.locks.get(path) === agentId) {
            this.locks.delete(path);
        }
    }

    // Watch for changes
    watch(path, callback) {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }
        this.watchers.get(path).push(callback);
    }

    async notifyWatchers(path, newValue, oldValue, changedBy) {
        const watchers = this.watchers.get(path) || [];
        for (const watcher of watchers) {
            await watcher({ path, newValue, oldValue, changedBy });
        }
    }
}
```

## Task Distribution

### 1. Load Balancing

```javascript
class LoadBalancer {
    constructor(strategy = 'round-robin') {
        this.agents = [];
        this.strategy = strategy;
        this.currentIndex = 0;
        this.metrics = new Map();
    }

    // Add agent to pool
    addAgent(agent, weight = 1) {
        this.agents.push({
            agent,
            weight,
            activeTasks: 0,
            totalTasks: 0,
            averageTime: 0,
        });
        this.metrics.set(agent.id, {
            tasksCompleted: 0,
            totalTime: 0,
            errors: 0,
        });
    }

    // Get next agent based on strategy
    getNext() {
        switch (this.strategy) {
            case 'round-robin':
                return this.roundRobin();
            case 'least-connections':
                return this.leastConnections();
            case 'weighted':
                return this.weighted();
            case 'response-time':
                return this.responseTime();
            default:
                return this.roundRobin();
        }
    }

    roundRobin() {
        const agent = this.agents[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.agents.length;
        return agent;
    }

    leastConnections() {
        return this.agents.reduce((min, agent) =>
            agent.activeTasks < min.activeTasks ? agent : min
        );
    }

    weighted() {
        const totalWeight = this.agents.reduce((sum, a) => sum + a.weight, 0);
        let random = Math.random() * totalWeight;

        for (const agent of this.agents) {
            random -= agent.weight;
            if (random <= 0) return agent;
        }

        return this.agents[0];
    }

    responseTime() {
        return this.agents.reduce((min, agent) =>
            agent.averageTime < min.averageTime ? agent : min
        );
    }

    // Record task completion
    recordCompletion(agent, duration, success = true) {
        const metrics = this.metrics.get(agent.id);
        if (metrics) {
            metrics.tasksCompleted++;
            metrics.totalTime += duration;
            if (!success) metrics.errors++;
        }

        const agentData = this.agents.find((a) => a.agent.id === agent.id);
        if (agentData) {
            agentData.activeTasks--;
            agentData.totalTasks++;
            agentData.averageTime = metrics.totalTime / metrics.tasksCompleted;
        }
    }
}
```

### 2. Task Prioritization

```javascript
class PriorityTaskQueue {
    constructor() {
        this.queues = {
            critical: [],
            high: [],
            medium: [],
            low: [],
        };
        this.paused = false;
    }

    // Add task with priority
    enqueue(task, priority = 'medium') {
        const queue = this.queues[priority];
        if (queue) {
            queue.push({
                ...task,
                id: task.id || this.generateId(),
                priority,
                enqueuedAt: Date.now(),
            });
        }
    }

    // Get next task (priority order)
    dequeue() {
        if (this.paused) return null;

        const priorities = ['critical', 'high', 'medium', 'low'];

        for (const priority of priorities) {
            const queue = this.queues[priority];
            if (queue.length > 0) {
                return queue.shift();
            }
        }

        return null;
    }

    // Get queue status
    getStatus() {
        return {
            critical: this.queues.critical.length,
            high: this.queues.high.length,
            medium: this.queues.medium.length,
            low: this.queues.low.length,
            total: Object.values(this.queues).reduce((sum, q) => sum + q.length, 0),
        };
    }

    // Pause/resume processing
    pause() {
        this.paused = true;
    }
    resume() {
        this.paused = false;
    }

    generateId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
```

## Result Aggregation

### 1. Consensus Builder

```javascript
class ConsensusBuilder {
    constructor(options = {}) {
        this.threshold = options.threshold || 0.5;
        this.minResponses = options.minResponses || 2;
    }

    // Build consensus from multiple agent responses
    buildConsensus(responses) {
        if (responses.length < this.minResponses) {
            return {
                consensus: false,
                reason: 'Insufficient responses',
                responses,
            };
        }

        // Group similar responses
        const groups = this.groupResponses(responses);

        // Find majority group
        const majority = this.findMajority(groups);

        if (majority.count / responses.length >= this.threshold) {
            return {
                consensus: true,
                value: majority.value,
                confidence: majority.count / responses.length,
                agreeingAgents: majority.agents,
                dissentingAgents: this.getDissentingAgents(responses, majority),
            };
        }

        return {
            consensus: false,
            reason: 'No clear majority',
            groups,
            bestGuess: this.getBestGuess(groups),
        };
    }

    groupResponses(responses) {
        const groups = new Map();

        responses.forEach((response, index) => {
            const key = this.normalizeResponse(response.value);
            if (!groups.has(key)) {
                groups.set(key, {
                    value: response.value,
                    count: 0,
                    agents: [],
                });
            }
            const group = groups.get(key);
            group.count++;
            group.agents.push(response.agentId || index);
        });

        return Array.from(groups.values());
    }

    findMajority(groups) {
        return groups.reduce((max, group) => (group.count > max.count ? group : max));
    }

    normalizeResponse(value) {
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value).toLowerCase().trim();
    }

    getDissentingAgents(responses, majority) {
        return responses
            .filter(
                (r) => this.normalizeResponse(r.value) !== this.normalizeResponse(majority.value)
            )
            .map((r) => r.agentId);
    }

    getBestGuess(groups) {
        return groups.sort((a, b) => b.count - a.count)[0]?.value;
    }
}
```

### 2. Result Merger

```javascript
class ResultMerger {
    // Merge results based on type
    merge(results, strategy = 'combine') {
        switch (strategy) {
            case 'combine':
                return this.combineResults(results);
            case 'latest':
                return this.latestResult(results);
            case 'best':
                return this.bestResult(results);
            case 'union':
                return this.unionResults(results);
            case 'intersection':
                return this.intersectionResults(results);
            default:
                return this.combineResults(results);
        }
    }

    combineResults(results) {
        return results.reduce(
            (merged, result) => ({
                ...merged,
                ...result,
                _sources: [...(merged._sources || []), result._source || 'unknown'],
            }),
            {}
        );
    }

    latestResult(results) {
        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    }

    bestResult(results) {
        return results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    }

    unionResults(results) {
        const union = new Set();
        results.forEach((result) => {
            if (Array.isArray(result)) {
                result.forEach((item) => union.add(item));
            }
        });
        return Array.from(union);
    }

    intersectionResults(results) {
        if (results.length === 0) return [];

        const sets = results.map((r) => new Set(Array.isArray(r) ? r : [r]));
        const intersection = new Set(sets[0]);

        for (let i = 1; i < sets.length; i++) {
            for (const item of intersection) {
                if (!sets[i].has(item)) {
                    intersection.delete(item);
                }
            }
        }

        return Array.from(intersection);
    }
}
```

## Error Handling & Recovery

### 1. Fault Tolerant Execution

```javascript
class FaultTolerantOrchestrator {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.fallbackAgents = options.fallbackAgents || [];
        this.circuitBreaker = new CircuitBreaker();
    }

    async executeWithFallback(task, primaryAgent) {
        // Check circuit breaker
        if (this.circuitBreaker.isOpen()) {
            return this.executeWithFallback(task, this.fallbackAgents[0]);
        }

        let lastError;

        // Try primary agent with retries
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await primaryAgent.execute(task);
                this.circuitBreaker.recordSuccess();
                return { success: true, result, agent: primaryAgent.id };
            } catch (error) {
                lastError = error;
                this.circuitBreaker.recordFailure();

                if (attempt < this.maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }

        // Try fallback agents
        for (const fallbackAgent of this.fallbackAgents) {
            try {
                const result = await fallbackAgent.execute(task);
                return {
                    success: true,
                    result,
                    agent: fallbackAgent.id,
                    usedFallback: true,
                };
            } catch (error) {
                // Continue to next fallback
            }
        }

        return { success: false, error: lastError.message };
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000;
        this.failures = 0;
        this.state = 'closed'; // closed, open, half-open
        this.lastFailure = null;
    }

    isOpen() {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.resetTimeout) {
                this.state = 'half-open';
                return false;
            }
            return true;
        }
        return false;
    }

    recordSuccess() {
        this.failures = 0;
        this.state = 'closed';
    }

    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();

        if (this.failures >= this.failureThreshold) {
            this.state = 'open';
        }
    }
}
```

## Monitoring & Metrics

### 1. Orchestration Dashboard

```javascript
class OrchestrationMonitor {
    constructor() {
        this.metrics = {
            tasks: { total: 0, completed: 0, failed: 0 },
            agents: new Map(),
            latency: [],
            throughput: [],
        };
    }

    // Record task metrics
    recordTask(task) {
        this.metrics.tasks.total++;

        if (task.success) {
            this.metrics.tasks.completed++;
        } else {
            this.metrics.tasks.failed++;
        }

        // Record agent metrics
        const agentMetrics = this.metrics.agents.get(task.agentId) || {
            tasks: 0,
            successes: 0,
            failures: 0,
            totalTime: 0,
        };

        agentMetrics.tasks++;
        agentMetrics.totalTime += task.duration || 0;
        if (task.success) agentMetrics.successes++;
        else agentMetrics.failures++;

        this.metrics.agents.set(task.agentId, agentMetrics);
    }

    // Get dashboard data
    getDashboard() {
        return {
            overview: {
                totalTasks: this.metrics.tasks.total,
                successRate:
                    this.metrics.tasks.total > 0
                        ? ((this.metrics.tasks.completed / this.metrics.tasks.total) * 100).toFixed(
                              1
                          ) + '%'
                        : '0%',
                activeAgents: this.metrics.agents.size,
            },
            agents: Array.from(this.metrics.agents.entries()).map(([id, m]) => ({
                id,
                tasks: m.tasks,
                successRate: m.tasks > 0 ? ((m.successes / m.tasks) * 100).toFixed(1) + '%' : '0%',
                averageTime: m.tasks > 0 ? (m.totalTime / m.tasks).toFixed(0) + 'ms' : '0ms',
            })),
            alerts: this.getAlerts(),
        };
    }

    getAlerts() {
        const alerts = [];

        // Check for failing agents
        for (const [id, m] of this.metrics.agents) {
            if (m.tasks > 10 && m.failures / m.tasks > 0.3) {
                alerts.push({
                    level: 'warning',
                    message: `Agent ${id} has high failure rate`,
                    value: ((m.failures / m.tasks) * 100).toFixed(1) + '%',
                });
            }
        }

        return alerts;
    }
}
```

## Quick Reference

```javascript
// Supervisor Pattern
const supervisor = new SupervisorOrchestrator();
supervisor.registerWorker('researcher', researchAgent);
supervisor.registerWorker('coder', codeAgent);
const result = await supervisor.delegate(task);

// Pipeline Pattern
const pipeline = new PipelineOrchestrator();
pipeline.addStage('research', researchAgent);
pipeline.addStage('code', codeAgent);
pipeline.addStage('review', reviewAgent);
const result = await pipeline.execute(input);

// Fan-Out/Fan-In Pattern
const fan = new FanOutFanInOrchestrator();
fan.addAgent(agent1);
fan.addAgent(agent2);
fan.addAgent(agent3);
const result = await fan.execute(task);

// Message Passing
const bus = new AgentMessageBus();
bus.registerAgent('agent1', agent1);
bus.registerAgent('agent2', agent2);
await bus.send('agent1', 'agent2', { type: 'task', content: task });

// Load Balancing
const balancer = new LoadBalancer('least-connections');
balancer.addAgent(agent1);
balancer.addAgent(agent2);
const agent = balancer.getNext();
```

## Best Practices

1. **Choose the right pattern** - Match pattern to task characteristics
2. **Handle failures gracefully** - Always have fallback mechanisms
3. **Monitor everything** - Track metrics for optimization
4. **Limit agent complexity** - Keep agents focused and simple
5. **Use message passing** - For loose coupling between agents
6. **Implement circuit breakers** - Prevent cascade failures
7. **Balance load evenly** - Avoid agent bottlenecks
8. **Log agent interactions** - For debugging and auditing
9. **Test with edge cases** - Ensure robust error handling
10. **Document agent capabilities** - Enable smart task routing
