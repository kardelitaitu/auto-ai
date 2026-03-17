# Orchestration Patterns Quick Reference

## Pattern Selection Guide

| Pattern | Best For | Complexity | Example Use Case |
|---------|----------|------------|------------------|
| Supervisor | Central coordination | Medium | Task delegation to specialists |
| Pipeline | Sequential processing | Low | Research → Code → Review |
| Fan-Out/Fan-In | Parallel voting | Medium | Fact-checking with multiple agents |
| Hierarchical | Complex tasks | High | Multi-level project breakdown |
| Message Bus | Event-driven | Medium | Real-time agent communication |
| Load Balancer | High throughput | Low | Distributing identical tasks |

---

## Supervisor Pattern

```javascript
// Quick setup
const supervisor = new SupervisorOrchestrator();

// Register specialized agents
supervisor.registerWorker('researcher', { 
    agent: researchAgent,
    capabilities: ['web-search', 'summarization'] 
});

supervisor.registerWorker('coder', { 
    agent: codeAgent,
    capabilities: ['javascript', 'python', 'debugging'] 
});

// Delegate task
const result = await supervisor.delegate({
    type: 'coding',
    requirements: ['javascript'],
    description: 'Create a function to...'
});
```

---

## Pipeline Pattern

```javascript
// Quick setup
const pipeline = new PipelineOrchestrator();

// Define stages
pipeline.addStage('research', researchAgent);
pipeline.addStage('draft', draftAgent, (input, result) => ({ ...input, research: result }));
pipeline.addStage('edit', editAgent, (input, result) => ({ ...input, draft: result }));
pipeline.addStage('review', reviewAgent);

// Execute
const result = await pipeline.execute({ topic: 'AI Agents' });
```

---

## Fan-Out/Fan-In Pattern

```javascript
// Quick setup
const fan = new FanOutFanInOrchestrator({
    parallel: true,
    combiner: (results, errors) => ({
        consensus: findConsensus(results),
        votes: results.length,
        disagreements: errors.length
    })
});

// Add multiple agents for voting
fan.addAgent(agent1);
fan.addAgent(agent2);
fan.addAgent(agent3);

// Execute and get consensus
const result = await fan.execute('Is this code correct?');
```

---

## Message Passing

```javascript
// Quick setup
const bus = new AgentMessageBus();

// Register agents
bus.registerAgent('supervisor', supervisorAgent);
bus.registerAgent('worker1', workerAgent1);
bus.registerAgent('worker2', workerAgent2);

// Subscribe to messages
bus.subscribe('worker1', 'task', async (msg) => {
    console.log('Worker1 received:', msg.content);
    return { status: 'processing' };
});

// Send message
await bus.send('supervisor', 'worker1', {
    type: 'task',
    content: { action: 'analyze', data: '...' }
});

// Broadcast to all
await bus.broadcast('supervisor', {
    type: 'status-check',
    content: { query: 'Are you ready?' }
});
```

---

## Load Balancing

```javascript
// Quick setup
const balancer = new LoadBalancer('least-connections');

// Add agents with weights
balancer.addAgent(agent1, weight: 2);  // More capable
balancer.addAgent(agent2, weight: 1);  // Standard
balancer.addAgent(agent3, weight: 1);  // Standard

// Get next agent
const agent = balancer.getNext();
const result = await agent.execute(task);

// Record completion for metrics
balancer.recordCompletion(agent, duration, success);
```

---

## Priority Queue

```javascript
// Quick setup
const queue = new PriorityTaskQueue();

// Add tasks with priority
queue.enqueue({ action: 'fix-bug', data: '...' }, 'critical');
queue.enqueue({ action: 'feature', data: '...' }, 'high');
queue.enqueue({ action: 'docs', data: '...' }, 'low');

// Process in priority order
while (true) {
    const task = queue.dequeue();
    if (!task) break;
    
    const agent = balancer.getNext();
    await agent.execute(task);
}

// Check queue status
console.log(queue.getStatus());
// { critical: 0, high: 1, medium: 2, low: 3, total: 6 }
```

---

## Consensus Building

```javascript
// Quick setup
const consensus = new ConsensusBuilder({
    threshold: 0.6,      // 60% agreement required
    minResponses: 3      // Minimum agents needed
});

// Collect responses from agents
const responses = [
    { agentId: 'agent1', value: 'Option A' },
    { agentId: 'agent2', value: 'Option A' },
    { agentId: 'agent3', value: 'Option B' }
];

// Build consensus
const result = consensus.buildConsensus(responses);

if (result.consensus) {
    console.log('Consensus reached:', result.value);
    console.log('Confidence:', result.confidence);
    console.log('Agreeing:', result.agreeingAgents);
} else {
    console.log('No consensus:', result.reason);
}
```

---

## Fault Tolerance

```javascript
// Quick setup
const faultTolerant = new FaultTolerantOrchestrator({
    maxRetries: 3,
    fallbackAgents: [fallbackAgent1, fallbackAgent2]
});

// Execute with automatic retry and fallback
const result = await faultTolerant.executeWithFallback(
    task,
    primaryAgent  // Will retry 3 times, then use fallbacks
);

if (result.usedFallback) {
    console.log('Used fallback agent:', result.agent);
}
```

---

## Shared State

```javascript
// Quick setup
const sharedState = new SharedStateManager();

// Agents can read state
const data = sharedState.get('project.requirements');

// Agents can write state (with locking)
await sharedState.set('project.status', 'in-progress', 'agent1');

// Watch for changes
sharedState.watch('project.status', ({ newValue, changedBy }) => {
    console.log(`Status changed to ${newValue} by ${changedBy}`);
});
```

---

## Monitoring

```javascript
// Quick setup
const monitor = new OrchestrationMonitor();

// Record task completion
monitor.recordTask({
    agentId: 'researcher',
    success: true,
    duration: 1500
});

// Get dashboard data
const dashboard = monitor.getDashboard();
console.log(dashboard.overview);
// { totalTasks: 100, successRate: '95.0%', activeAgents: 5 }

// Check for alerts
if (dashboard.alerts.length > 0) {
    console.warn('Alerts:', dashboard.alerts);
}
```

---

## Common Patterns Combinations

### Research + Code + Review Pipeline

```javascript
const pipeline = new PipelineOrchestrator();
pipeline.addStage('research', researchAgent);
pipeline.addStage('code', codeAgent);
pipeline.addStage('review', reviewAgent);
pipeline.addStage('test', testAgent);
```

### Multi-Agent Fact Checking

```javascript
const fan = new FanOutFanInOrchestrator();
fan.addAgent(factChecker1);
fan.addAgent(factChecker2);
fan.addAgent(factChecker3);
const result = await fan.execute(claim);
```

### Supervisor with Load Balancing

```javascript
const supervisor = new SupervisorOrchestrator();
const balancer = new LoadBalancer();

// Add workers to balancer
workers.forEach(w => balancer.addAgent(w));

// Supervisor delegates through balancer
supervisor.execute = async (task) => {
    const worker = balancer.getNext();
    return worker.execute(task);
};
```

---

## Error Handling Template

```javascript
async function orchestrateWithHandling(task, orchestrator) {
    try {
        const result = await orchestrator.execute(task);
        
        if (!result.success) {
            console.error('Task failed:', result.error);
            
            // Retry or escalate
            if (result.retriable) {
                return await orchestrator.execute(task);
            }
        }
        
        return result;
    } catch (error) {
        console.error('Orchestration error:', error);
        
        // Log for debugging
        await logError({ task, error, timestamp: new Date() });
        
        throw error;
    }
}
```