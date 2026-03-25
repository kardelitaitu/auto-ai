# Orchestrator Skill - Examples

> **Practical examples for multi-agent orchestration patterns.**

## Table of Contents

- [Supervisor Pattern](#supervisor-pattern)
- [Pipeline Pattern](#pipeline-pattern)
- [Fan-Out/Fan-In Pattern](#fan-outfan-in-pattern)
- [Message Passing](#message-passing)
- [Load Balancing](#load-balancing)
- [Fault Tolerance](#fault-tolerance)

---

## Supervisor Pattern

### Basic Supervisor

```javascript
// Example: Basic supervisor with worker registration
class BasicSupervisor {
    constructor() {
        this.workers = new Map();
        this.taskHistory = [];
    }

    registerWorker(name, worker, capabilities = []) {
        this.workers.set(name, {
            agent: worker,
            capabilities,
            status: 'idle',
            tasksCompleted: 0
        });
    }

    async delegate(task) {
        // Find best worker based on capabilities
        const worker = this.findBestWorker(task.requirements || []);
        
        if (!worker) {
            throw new Error('No suitable worker found');
        }

        console.log(`Delegating to: ${worker.name}`);
        
        worker.status = 'busy';
        const startTime = Date.now();
        
        try {
            const result = await worker.agent.execute(task);
            worker.status = 'idle';
            worker.tasksCompleted++;
            
            this.taskHistory.push({
                task: task.id,
                worker: worker.name,
                duration: Date.now() - startTime,
                success: true
            });
            
            return result;
        } catch (error) {
            worker.status = 'idle';
            
            this.taskHistory.push({
                task: task.id,
                worker: worker.name,
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }

    findBestWorker(requirements) {
        let bestMatch = null;
        let bestScore = 0;

        for (const [name, worker] of this.workers) {
            if (worker.status !== 'idle') continue;
            
            const score = requirements.filter(r => 
                worker.capabilities.includes(r)
            ).length;
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { name, ...worker };
            }
        }

        return bestMatch;
    }

    getStats() {
        return {
            totalWorkers: this.workers.size,
            idleWorkers: Array.from(this.workers.values()).filter(w => w.status === 'idle').length,
            tasksCompleted: this.taskHistory.filter(t => t.success).length,
            tasksFailed: this.taskHistory.filter(t => !t.success).length
        };
    }
}

// Usage
const supervisor = new BasicSupervisor();
supervisor.registerWorker('researcher', researcherAgent, ['research', 'summarize']);
supervisor.registerWorker('coder', codeAgent, ['code', 'test']);

const result = await supervisor.delegate({
    id: 'task-001',
    requirements: ['research'],
    description: 'Research AI agent patterns'
});

console.log('Stats:', supervisor.getStats());
```

---

## Pipeline Pattern

### Sequential Data Processing

```javascript
// Example: Data processing pipeline
class DataPipeline {
    constructor() {
        this.stages = [];
        this.results = [];
    }

    addStage(name, processor, options = {}) {
        this.stages.push({
            name,
            processor,
            skipOnError: options.skipOnError || false,
            timeout: options.timeout || 30000
        });
    }

    async execute(input) {
        let data = input;
        this.results = [];

        for (const stage of this.stages) {
            console.log(`Processing stage: ${stage.name}`);
            
            const startTime = Date.now();
            
            try {
                const result = await Promise.race([
                    stage.processor(data),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), stage.timeout)
                    )
                ]);

                data = result;
                
                this.results.push({
                    stage: stage.name,
                    success: true,
                    duration: Date.now() - startTime,
                    outputSize: JSON.stringify(result).length
                });

            } catch (error) {
                this.results.push({
                    stage: stage.name,
                    success: false,
                    duration: Date.now() - startTime,
                    error: error.message
                });

                if (!stage.skipOnError) {
                    return {
                        success: false,
                        failedAt: stage.name,
                        error: error.message,
                        results: this.results
                    };
                }
            }
        }

        return {
            success: true,
            output: data,
            results: this.results,
            totalTime: this.results.reduce((sum, r) => sum + r.duration, 0)
        };
    }
}

// Usage
const pipeline = new DataPipeline();

pipeline.addStage('fetch', async (data) => {
    const response = await fetch(data.url);
    return response.json();
});

pipeline.addStage('transform', async (data) => {
    return {
        ...data,
        processed: true,
        timestamp: new Date().toISOString()
    };
});

pipeline.addStage('validate', async (data) => {
    if (!data.id) throw new Error('Missing ID');
    return data;
});

const result = await pipeline.execute({ url: 'https://api.example.com/data' });
```

---

## Fan-Out/Fan-In Pattern

### Parallel Voting System

```javascript
// Example: Multi-agent consensus voting
class VotingOrchestrator {
    constructor(options = {}) {
        this.agents = [];
        this.threshold = options.threshold || 0.6;
        this.timeout = options.timeout || 30000;
    }

    addAgent(agent) {
        this.agents.push(agent);
    }

    async execute(task) {
        console.log(`Distributing to ${this.agents.length} agents`);
        
        // Fan out: Execute all agents in parallel
        const promises = this.agents.map(agent => 
            this.executeWithTimeout(agent, task)
        );

        const results = await Promise.allSettled(promises);
        
        // Separate successes and failures
        const successful = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
        
        const failed = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason.message);

        console.log(`${successful.length} succeeded, ${failed.length} failed`);

        // Fan in: Aggregate results
        return this.aggregateResults(successful, failed);
    }

    async executeWithTimeout(agent, task) {
        return Promise.race([
            agent.execute(task),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Agent timeout')), this.timeout)
            )
        ]);
    }

    aggregateResults(results, errors) {
        // Group similar responses
        const groups = new Map();
        
        results.forEach((result, index) => {
            const key = JSON.stringify(result);
            if (!groups.has(key)) {
                groups.set(key, { value: result, count: 0, agents: [] });
            }
            groups.get(key).count++;
            groups.get(key).agents.push(`agent-${index}`);
        });

        // Find majority
        const sorted = Array.from(groups.values()).sort((a, b) => b.count - a.count);
        const majority = sorted[0];
        
        const hasConsensus = majority && 
            (majority.count / results.length) >= this.threshold;

        return {
            consensus: hasConsensus,
            value: majority?.value,
            confidence: majority ? (majority.count / results.length) : 0,
            votes: results.length,
            dissenters: results.length - (majority?.count || 0),
            errors
        };
    }
}

// Usage
const voting = new VotingOrchestrator({ threshold: 0.66 });
voting.addAgent(reviewerAgent1);
voting.addAgent(reviewerAgent2);
voting.addAgent(reviewerAgent3);

const result = await voting.execute({
    type: 'review',
    code: 'function add(a, b) { return a + b; }'
});

console.log(`Consensus: ${result.consensus} (${result.confidence * 100}% agreement)`);
```

---

## Message Passing

### Agent Communication Bus

```javascript
// Example: Message passing between agents
class MessageBus {
    constructor() {
        this.agents = new Map();
        this.messageQueue = [];
        this.handlers = new Map();
    }

    register(id, agent) {
        this.agents.set(id, {
            agent,
            inbox: [],
            status: 'ready'
        });
    }

    on(messageType, handler) {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, []);
        }
        this.handlers.get(messageType).push(handler);
    }

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
            timestamp: new Date().toISOString()
        };

        recipient.inbox.push(msg);
        
        // Notify handlers
        const handlers = this.handlers.get(message.type) || [];
        await Promise.all(handlers.map(h => h(msg)));
        
        return msg.id;
    }

    async broadcast(from, message) {
        const promises = [];
        for (const [id] of this.agents) {
            if (id !== from) {
                promises.push(this.send(from, id, message));
            }
        }
        return Promise.all(promises);
    }

    async processMessages(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) return [];

        const processed = [];
        
        while (agent.inbox.length > 0) {
            const message = agent.inbox.shift();
            try {
                const response = await agent.agent.handleMessage(message);
                processed.push({ message, response, success: true });
            } catch (error) {
                processed.push({ message, error: error.message, success: false });
            }
        }
        
        return processed;
    }

    generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Usage
const bus = new MessageBus();
bus.register('coordinator', coordinatorAgent);
bus.register('worker1', workerAgent1);
bus.register('worker2', workerAgent2);

// Listen for task messages
bus.on('task', async (msg) => {
    console.log(`Task received by ${msg.to}`);
});

// Send message
await bus.send('coordinator', 'worker1', {
    type: 'task',
    content: { action: 'analyze', data: '...' }
});

// Broadcast
await bus.broadcast('coordinator', {
    type: 'status-check',
    content: { query: 'ready?' }
});
```

---

## Load Balancing

### Round-Robin Load Balancer

```javascript
// Example: Load balancer for agent distribution
class AgentLoadBalancer {
    constructor(strategy = 'round-robin') {
        this.agents = [];
        this.strategy = strategy;
        this.currentIndex = 0;
        this.metrics = new Map();
    }

    add(agent, weight = 1) {
        this.agents.push({
            agent,
            weight,
            activeTasks: 0,
            totalTasks: 0
        });
        this.metrics.set(agent.id || this.agents.length, {
            completed: 0,
            failed: 0,
            totalTime: 0
        });
    }

    getNext() {
        switch (this.strategy) {
            case 'round-robin':
                return this.roundRobin();
            case 'least-connections':
                return this.leastConnections();
            case 'weighted':
                return this.weighted();
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
        const total = this.agents.reduce((sum, a) => sum + a.weight, 0);
        let random = Math.random() * total;
        
        for (const agent of this.agents) {
            random -= agent.weight;
            if (random <= 0) return agent;
        }
        
        return this.agents[0];
    }

    async execute(task) {
        const agentInfo = this.getNext();
        agentInfo.activeTasks++;
        
        const start = Date.now();
        
        try {
            const result = await agentInfo.agent.execute(task);
            const duration = Date.now() - start;
            
            agentInfo.activeTasks--;
            agentInfo.totalTasks++;
            
            const metrics = this.metrics.get(agentInfo.agent.id);
            if (metrics) {
                metrics.completed++;
                metrics.totalTime += duration;
            }
            
            return result;
        } catch (error) {
            agentInfo.activeTasks--;
            
            const metrics = this.metrics.get(agentInfo.agent.id);
            if (metrics) metrics.failed++;
            
            throw error;
        }
    }

    getStats() {
        return this.agents.map((agent, i) => ({
            id: agent.agent.id || i,
            active: agent.activeTasks,
            total: agent.totalTasks,
            weight: agent.weight
        }));
    }
}

// Usage
const balancer = new AgentLoadBalancer('least-connections');
balancer.add(agent1, 2);  // Higher capacity
balancer.add(agent1, 1);
balancer.add(agent1, 1);

// Tasks will be distributed based on active connections
for (const task of tasks) {
    const result = await balancer.execute(task);
}

console.log('Stats:', balancer.getStats());
```

---

## Fault Tolerance

### Circuit Breaker Pattern

```javascript
// Example: Fault-tolerant execution with circuit breaker
class FaultTolerantOrchestrator {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.fallbacks = options.fallbacks || [];
        this.circuitBreaker = {
            failures: 0,
            threshold: options.threshold || 5,
            state: 'closed', // closed, open, half-open
            lastFailure: null,
            resetTimeout: options.resetTimeout || 30000
        };
    }

    addFallback(agent) {
        this.fallbacks.push(agent);
    }

    async execute(task, primaryAgent) {
        // Check circuit breaker
        if (this.circuitBreaker.state === 'open') {
            if (Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.resetTimeout) {
                this.circuitBreaker.state = 'half-open';
            } else {
                return this.executeWithFallback(task);
            }
        }

        let lastError;
        
        // Try primary with retries
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const result = await primaryAgent.execute(task);
                this.recordSuccess();
                return { success: true, result, agent: primaryAgent.id };
            } catch (error) {
                lastError = error;
                this.recordFailure();
                
                if (attempt < this.maxRetries) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }

        // Try fallbacks
        return this.executeWithFallback(task);
    }

    async executeWithFallback(task) {
        for (const fallback of this.fallbacks) {
            try {
                const result = await fallback.execute(task);
                return { 
                    success: true, 
                    result, 
                    agent: fallback.id,
                    usedFallback: true 
                };
            } catch (error) {
                // Continue to next fallback
            }
        }
        
        return { success: false, error: 'All agents failed' };
    }

    recordSuccess() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'closed';
    }

    recordFailure() {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        
        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            this.circuitBreaker.state = 'open';
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const orchestrator = new FaultTolerantOrchestrator({
    maxRetries: 2,
    threshold: 3,
    resetTimeout: 60000
});

orchestrator.addFallback(backupAgent);

const result = await orchestrator.execute(task, primaryAgent);
if (result.usedFallback) {
    console.log('Used fallback agent');
}
```

---

## Best Practices

1. **Choose the right pattern** - Match pattern to task characteristics
2. **Handle failures gracefully** - Always have fallback mechanisms
3. **Monitor agent health** - Track performance metrics
4. **Set reasonable timeouts** - Prevent hanging tasks
5. **Log interactions** - Enable debugging and auditing
6. **Balance load evenly** - Avoid agent bottlenecks

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview
