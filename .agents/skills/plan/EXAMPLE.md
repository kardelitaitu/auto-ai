# Plan Skill - Examples

> **Practical examples for project planning and task management.**

## Task Breakdown

```javascript
// Example: Break down a feature into tasks
function breakdownFeature(feature) {
    const phases = [
        {
            name: 'Design',
            tasks: [
                { name: 'Requirements gathering', estimate: 4, dependencies: [] },
                { name: 'Technical design', estimate: 8, dependencies: ['Requirements gathering'] },
                { name: 'Design review', estimate: 2, dependencies: ['Technical design'] }
            ]
        },
        {
            name: 'Implementation',
            tasks: [
                { name: 'Backend API', estimate: 16, dependencies: ['Design review'] },
                { name: 'Frontend UI', estimate: 12, dependencies: ['Design review'] },
                { name: 'Integration', estimate: 8, dependencies: ['Backend API', 'Frontend UI'] }
            ]
        },
        {
            name: 'Testing',
            tasks: [
                { name: 'Unit tests', estimate: 8, dependencies: ['Backend API'] },
                { name: 'Integration tests', estimate: 6, dependencies: ['Integration'] },
                { name: 'E2E tests', estimate: 4, dependencies: ['Integration tests'] }
            ]
        },
        {
            name: 'Deployment',
            tasks: [
                { name: 'Staging deploy', estimate: 2, dependencies: ['E2E tests'] },
                { name: 'Production deploy', estimate: 2, dependencies: ['Staging deploy'] }
            ]
        }
    ];
    
    return {
        feature,
        phases,
        totalEstimate: phases.reduce((sum, phase) => 
            sum + phase.tasks.reduce((s, t) => s + t.estimate, 0), 0
        )
    };
}

// Usage
const plan = breakdownFeature('User Authentication');
console.log(`Total estimate: ${plan.totalEstimate} hours`);
```

## Estimation

```javascript
// Example: PERT estimation
function pertEstimate(optimistic, likely, pessimistic) {
    return (optimistic + 4 * likely + pessimistic) / 6;
}

// Example: Story point estimation
function estimateStoryPoints(task) {
    const complexity = {
        simple: 1,
        moderate: 3,
        complex: 5,
        veryComplex: 8,
        epic: 13
    };
    
    return complexity[task.complexity] || 3;
}

// Usage
const estimate = pertEstimate(2, 4, 8); // 4.3 hours
```

## Prioritization

```javascript
// Example: Value vs Effort matrix
function prioritizeByValueEffort(tasks) {
    return {
        quickWins: tasks.filter(t => t.value > 7 && t.effort < 4),
        majorProjects: tasks.filter(t => t.value > 7 && t.effort >= 4),
        fillIns: tasks.filter(t => t.value <= 7 && t.effort < 4),
        avoid: tasks.filter(t => t.value <= 7 && t.effort >= 4)
    };
}

// Example: MoSCoW prioritization
function moscowPrioritize(tasks) {
    return {
        mustHave: tasks.filter(t => t.priority === 'critical'),
        shouldHave: tasks.filter(t => t.priority === 'high'),
        couldHave: tasks.filter(t => t.priority === 'medium'),
        wontHave: tasks.filter(t => t.priority === 'low')
    };
}
```

## Dependency Mapping

```javascript
// Example: Find critical path
function findCriticalPath(tasks) {
    const graph = new Map();
    tasks.forEach(t => graph.set(t.name, t));
    
    function getPathLength(taskName, visited = new Set()) {
        if (visited.has(taskName)) return 0;
        visited.add(taskName);
        
        const task = graph.get(taskName);
        if (!task || !task.dependencies.length) {
            return task?.estimate || 0;
        }
        
        const maxDep = Math.max(...task.dependencies.map(dep => 
            getPathLength(dep, new Set(visited))
        ));
        
        return maxDep + (task.estimate || 0);
    }
    
    return tasks.map(t => ({
        name: t.name,
        pathLength: getPathLength(t.name)
    })).sort((a, b) => b.pathLength - a.pathLength);
}
```

## Sprint Planning

```javascript
// Example: Plan a sprint
function planSprint(backlog, velocity, duration = 14) {
    const sorted = backlog.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    const sprint = {
        duration,
        capacity: velocity,
        planned: [],
        remaining: velocity
    };
    
    for (const task of sorted) {
        if (task.estimate <= sprint.remaining) {
            sprint.planned.push(task);
            sprint.remaining -= task.estimate;
        }
    }
    
    sprint.utilization = ((velocity - sprint.remaining) / velocity * 100).toFixed(1);
    
    return sprint;
}

// Usage
const sprint = planSprint(backlog, 40);
console.log(`Planned ${sprint.planned.length} tasks (${sprint.utilization}% capacity)`);
```

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview
