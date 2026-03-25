---
name: plan
description: |
  Project planning, task breakdown, and implementation roadmap creation.
  Use when planning new features, breaking down complex tasks, creating
  implementation timelines, estimating effort, or organizing development work.
  Triggers on tasks involving project planning, feature breakdown, sprint planning,
  task prioritization, or implementation strategy.
license: MIT
metadata:
  author: Auto-AI Framework
  version: '1.0.0'
---

# Project Planning Skill

Comprehensive guide for planning software projects, breaking down complex tasks,
and creating implementation roadmaps. This skill covers estimation techniques,
task organization, and systematic planning approaches.

## When to Use This Skill

Use this skill when:

- Planning new features or components
- Breaking down complex tasks into subtasks
- Creating implementation roadmaps
- Estimating development effort
- Organizing work into sprints or iterations
- Prioritizing features and fixes
- Designing system architecture
- Creating technical specifications

## Planning Workflow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Gather     │───▶│  Analyze    │───▶│  Break Down │───▶│  Prioritize │
│  Requirements│    │  & Research │    │  Tasks      │    │  & Schedule │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Requirements Gathering

### 1. User Story Format

```javascript
const userStory = {
    id: 'US-001',
    title: 'Browser Auto-Discovery',
    description: 'As a user, I want the system to automatically discover running browsers so that I don\'t need to manually configure connections.',
    acceptance: [
        'System detects all supported browser types',
        'Connection endpoints are validated',
        'Discovery completes within 10 seconds',
        'Failed discoveries are logged with details'
    ],
    priority: 'High',
    storyPoints: 8
};
```

### 2. Requirements Checklist

```javascript
const requirementsChecklist = {
    functional: [
        'What should the system do?',
        'What inputs are expected?',
        'What outputs are required?',
        'What are the edge cases?'
    ],
    nonFunctional: [
        'Performance requirements?',
        'Security considerations?',
        'Scalability needs?',
        'Reliability expectations?'
    ],
    constraints: [
        'Technology limitations?',
        'Time constraints?',
        'Resource limitations?',
        'External dependencies?'
    ]
};
```

## Task Breakdown Patterns

### 1. Feature Decomposition

```javascript
function decomposeFeature(feature) {
    return {
        feature: feature.name,
        components: [
            {
                name: 'Backend/API',
                tasks: feature.apiEndpoints.map(ep => ({
                    task: `Implement ${ep}`,
                    estimate: 4,
                    dependencies: []
                }))
            },
            {
                name: 'Frontend/UI',
                tasks: feature.components.map(comp => ({
                    task: `Create ${comp} component`,
                    estimate: 3,
                    dependencies: ['Backend/API']
                }))
            },
            {
                name: 'Testing',
                tasks: [
                    { task: 'Unit tests', estimate: 4, dependencies: ['Backend/API'] },
                    { task: 'Integration tests', estimate: 3, dependencies: ['Frontend/UI'] },
                    { task: 'E2E tests', estimate: 2, dependencies: ['Integration tests'] }
                ]
            },
            {
                name: 'Documentation',
                tasks: [
                    { task: 'API documentation', estimate: 2, dependencies: ['Backend/API'] },
                    { task: 'User guide', estimate: 3, dependencies: ['Frontend/UI'] }
                ]
            }
        ]
    };
}
```

### 2. Complexity Assessment

```javascript
function assessComplexity(task) {
    const factors = {
        technical: {
            newTechnology: task.requiresNewTech ? 2 : 0,
            integrationPoints: task.integrationCount,
            dataComplexity: task.dataModelComplexity,
            algorithmComplexity: task.algorithmDifficulty
        },
        scope: {
            linesOfCode: task.estimatedLOC / 500,
            componentsAffected: task.componentCount,
            externalDependencies: task.externalDeps
        },
        risk: {
            uncertainty: task.uncertaintyLevel,
            dependencies: task.blockingDependencies,
            testingDifficulty: task.testComplexity
        }
    };
    
    const score = Object.values(factors)
        .flatMap(Object.values)
        .reduce((a, b) => a + b, 0);
    
    return {
        score,
        level: score < 5 ? 'Low' : score < 10 ? 'Medium' : 'High',
        factors
    };
}
```

## Estimation Techniques

### 1. Story Points

```javascript
const storyPointScale = {
    1: { description: 'Trivial', hours: '0.5-1', example: 'Simple config change' },
    2: { description: 'Simple', hours: '1-2', example: 'Basic CRUD operation' },
    3: { description: 'Medium', hours: '2-4', example: 'New API endpoint with validation' },
    5: { description: 'Complex', hours: '4-8', example: 'Multi-step workflow' },
    8: { description: 'Very Complex', hours: '8-16', example: 'Integration with external service' },
    13: { description: 'Epic', hours: '16-32', example: 'Complete feature module' }
};

function estimateStoryPoints(task) {
    // Reference story comparison
    const referenceStories = {
        'config-change': 1,
        'simple-api': 2,
        'form-validation': 3,
        'multi-step-form': 5,
        'payment-integration': 8,
        'full-auth-system': 13
    };
    
    // Compare with references
    const comparable = findComparableStory(task, referenceStories);
    return referenceStories[comparable] || 5; // Default to 5
}
```

### 2. Time Estimation

```javascript
function estimateTime(tasks) {
    return tasks.map(task => {
        const optimistic = task.baseEstimate;
        const pessimistic = task.baseEstimate * 2.5;
        const mostLikely = task.baseEstimate * 1.5;
        
        // PERT formula
        const expected = (optimistic + 4 * mostLikely + pessimistic) / 6;
        
        // Add buffer for unknowns
        const withBuffer = expected * (1 + task.uncertainty);
        
        return {
            task: task.name,
            optimistic,
            mostLikely,
            pessimistic,
            expected: Math.round(expected * 10) / 10,
            withBuffer: Math.round(withBuffer * 10) / 10,
            unit: 'hours'
        };
    });
}
```

### 3. T-Shirt Sizing

```javascript
const tShirtSizes = {
    'XS': { description: '< 1 day', points: 1 },
    'S': { description: '1-2 days', points: 2 },
    'M': { description: '3-5 days', points: 5 },
    'L': { description: '1-2 weeks', points: 13 },
    'XL': { description: '2-4 weeks', points: 21 },
    'XXL': { description: '> 4 weeks', points: 34 }
};

function tshirtEstimate(feature) {
    // Compare with similar completed features
    const similarFeatures = findSimilarCompleted(feature);
    
    if (similarFeatures.length > 0) {
        const avgSize = average(similarFeatures.map(f => f.size));
        return avgSize;
    }
    
    // Default estimation based on description
    return estimateFromDescription(feature.description);
}
```

## Roadmap Creation

### 1. Phase Planning

```javascript
function createRoadmap(features, timeline) {
    const phases = [
        {
            name: 'Foundation',
            duration: '2 weeks',
            focus: 'Core infrastructure and architecture',
            features: features.filter(f => f.layer === 'core')
        },
        {
            name: 'MVP',
            duration: '4 weeks',
            focus: 'Minimum viable product features',
            features: features.filter(f => f.priority === 'High')
        },
        {
            name: 'Enhancement',
            duration: '3 weeks',
            focus: 'Additional features and polish',
            features: features.filter(f => f.priority === 'Medium')
        },
        {
            name: 'Optimization',
            duration: '2 weeks',
            focus: 'Performance and refinement',
            features: features.filter(f => f.type === 'optimization')
        }
    ];
    
    return phases.map(phase => ({
        ...phase,
        totalPoints: phase.features.reduce((sum, f) => sum + f.points, 0),
        startDate: calculateStartDate(phase, phases),
        endDate: calculateEndDate(phase, phases)
    }));
}
```

### 2. Sprint Planning

```javascript
function planSprint(backlog, velocity, sprintLength = 2) {
    // Sort by priority and dependencies
    const sorted = sortByPriorityAndDependencies(backlog);
    
    const sprint = {
        number: getNextSprintNumber(),
        duration: sprintLength,
        capacity: velocity,
        planned: [],
        stretch: []
    };
    
    let remainingCapacity = velocity;
    
    for (const item of sorted) {
        if (item.points <= remainingCapacity) {
            sprint.planned.push(item);
            remainingCapacity -= item.points;
        } else if (item.points <= remainingCapacity * 1.5) {
            sprint.stretch.push(item);
        }
    }
    
    sprint.utilization = ((velocity - remainingCapacity) / velocity * 100).toFixed(1);
    
    return sprint;
}
```

## Priority Matrix

### 1. MoSCoW Prioritization

```javascript
function moscowPrioritize(items) {
    return {
        mustHave: items.filter(item => 
            item.criticality === 'critical' || 
            item.businessValue > 8
        ),
        shouldHave: items.filter(item => 
            item.criticality === 'high' && 
            item.businessValue > 6
        ),
        couldHave: items.filter(item => 
            item.criticality === 'medium' && 
            item.businessValue > 4
        ),
        wontHave: items.filter(item => 
            item.criticality === 'low' || 
            item.businessValue <= 4
        )
    };
}
```

### 2. Value vs Effort Matrix

```javascript
function valueEffortMatrix(features) {
    return {
        quickWins: features.filter(f => 
            f.value > 6 && f.effort < 4
        ),
        majorProjects: features.filter(f => 
            f.value > 6 && f.effort >= 4
        ),
        fillIns: features.filter(f => 
            f.value <= 6 && f.effort < 4
        ),
        avoid: features.filter(f => 
            f.value <= 6 && f.effort >= 4
        )
    };
}
```

## Dependency Mapping

### 1. Task Dependencies

```javascript
function mapDependencies(tasks) {
    const graph = {};
    
    tasks.forEach(task => {
        graph[task.id] = {
            task,
            dependencies: task.dependencies || [],
            dependents: []
        };
    });
    
    // Build reverse dependencies
    Object.keys(graph).forEach(id => {
        graph[id].dependencies.forEach(depId => {
            if (graph[depId]) {
                graph[depId].dependents.push(id);
            }
        });
    });
    
    return graph;
}

function findCriticalPath(graph) {
    // Find tasks with no dependencies (start points)
    const starts = Object.keys(graph).filter(id => 
        graph[id].dependencies.length === 0
    );
    
    // Calculate longest path
    const paths = starts.map(start => calculatePathLength(graph, start));
    
    return {
        criticalPath: Math.max(...paths),
        bottlenecks: findBottlenecks(graph),
        parallelizable: findParallelizableTasks(graph)
    };
}
```

### 2. Dependency Visualization

```javascript
function visualizeDependencies(tasks) {
    const lines = ['Dependency Graph:', ''];
    
    tasks.forEach(task => {
        const deps = task.dependencies.map(d => `  - ${d}`).join('\n');
        lines.push(`${task.name}:`);
        if (deps) {
            lines.push(deps);
        } else {
            lines.push('  (no dependencies)');
        }
        lines.push('');
    });
    
    return lines.join('\n');
}
```

## Implementation Planning

### 1. Technical Design Document

```javascript
function createDesignDocument(feature) {
    return {
        title: `${feature.name} - Technical Design`,
        sections: [
            {
                name: 'Overview',
                content: feature.description
            },
            {
                name: 'Architecture',
                content: describeArchitecture(feature)
            },
            {
                name: 'Components',
                content: listComponents(feature)
            },
            {
                name: 'Data Model',
                content: describeDataModel(feature)
            },
            {
                name: 'API Design',
                content: describeAPI(feature)
            },
            {
                name: 'Security Considerations',
                content: describeSecurity(feature)
            },
            {
                name: 'Testing Strategy',
                content: describeTesting(feature)
            },
            {
                name: 'Migration Plan',
                content: describeMigration(feature)
            }
        ],
        reviewers: [],
        status: 'draft'
    };
}
```

### 2. Implementation Checklist

```javascript
const implementationChecklist = {
    preImplementation: [
        'Requirements finalized',
        'Design reviewed and approved',
        'Dependencies identified',
        'Environment setup complete',
        'Branch created'
    ],
    development: [
        'Code follows style guide',
        'Unit tests written',
        'Documentation updated',
        'Error handling implemented',
        'Logging added'
    ],
    review: [
        'Self-review completed',
        'Code reviewed by peer',
        'Tests passing',
        'No lint errors',
        'Performance verified'
    ],
    deployment: [
        'Staging deployment tested',
        'Rollback plan documented',
        'Monitoring configured',
        'Alerts set up',
        'Documentation published'
    ]
};
```

## Risk Management

### 1. Risk Assessment

```javascript
function assessRisks(tasks) {
    const risks = [];
    
    tasks.forEach(task => {
        // Technical risks
        if (task.complexity === 'high') {
            risks.push({
                task: task.name,
                type: 'technical',
                description: 'High complexity may lead to delays',
                probability: 'medium',
                impact: 'high',
                mitigation: 'Break into smaller tasks, add buffer time'
            });
        }
        
        // Dependency risks
        if (task.externalDependencies > 2) {
            risks.push({
                task: task.name,
                type: 'dependency',
                description: 'Multiple external dependencies',
                probability: 'medium',
                impact: 'medium',
                mitigation: 'Identify alternatives, add contingency'
            });
        }
        
        // Knowledge risks
        if (task.requiresNewSkill) {
            risks.push({
                task: task.name,
                type: 'knowledge',
                description: 'Team lacks required expertise',
                probability: 'high',
                impact: 'high',
                mitigation: 'Training, pair programming, external help'
            });
        }
    });
    
    return risks.sort((a, b) => {
        const impactScore = { high: 3, medium: 2, low: 1 };
        const probScore = { high: 3, medium: 2, low: 1 };
        return (impactScore[b.impact] * probScore[b.probability]) -
               (impactScore[a.impact] * probScore[a.probability]);
    });
}
```

### 2. Contingency Planning

```javascript
function createContingencyPlan(risks) {
    return risks.map(risk => ({
        risk: risk.description,
        trigger: `${risk.probability} probability, ${risk.impact} impact`,
        contingency: risk.mitigation,
        owner: identifyOwner(risk),
        reviewDate: calculateReviewDate()
    }));
}
```

## Progress Tracking

### 1. Burndown Chart Data

```javascript
function generateBurndownData(sprint) {
    const totalPoints = sprint.planned.reduce((sum, t) => sum + t.points, 0);
    const dailyIdeal = totalPoints / sprint.duration;
    
    const data = {
        dates: generateDateRange(sprint.startDate, sprint.duration),
        ideal: [],
        actual: []
    };
    
    let remaining = totalPoints;
    data.dates.forEach((date, i) => {
        data.ideal.push(Math.max(0, totalPoints - (dailyIdeal * (i + 1))));
        data.actual.push(remaining); // Update with actual remaining
    });
    
    return data;
}
```

### 2. Velocity Tracking

```javascript
function trackVelocity(sprints) {
    return {
        sprints: sprints.map(s => ({
            number: s.number,
            planned: s.plannedPoints,
            completed: s.completedPoints,
            velocity: s.completedPoints
        })),
        average: average(sprints.map(s => s.completedPoints)),
        trend: calculateTrend(sprints.map(s => s.completedPoints)),
        forecast: forecastNextSprint(sprints)
    };
}
```

## Planning Templates

### 1. Feature Plan Template

```javascript
const featurePlanTemplate = {
    id: 'FP-001',
    name: 'Feature Name',
    description: 'Brief description of what and why',
    
    goals: [
        'Primary goal',
        'Secondary goal'
    ],
    
    requirements: {
        functional: [],
        nonFunctional: [],
        constraints: []
    },
    
    tasks: [
        { id: 'T1', name: 'Task 1', estimate: 4, dependencies: [] }
    ],
    
    timeline: {
        start: '2024-01-01',
        end: '2024-01-15',
        milestones: []
    },
    
    risks: [],
    
    successCriteria: [
        'Criterion 1',
        'Criterion 2'
    ]
};
```

### 2. Sprint Plan Template

```javascript
const sprintPlanTemplate = {
    number: 1,
    goal: 'Sprint goal statement',
    duration: 14, // days
    
    capacity: {
        teamSize: 4,
        velocity: 40,
        availableHours: 320
    },
    
    planned: [],
    stretch: [],
    blocked: [],
    
    ceremonies: {
        planning: 'Date/Time',
        standup: 'Daily 9am',
        review: 'Date/Time',
        retrospective: 'Date/Time'
    },
    
    risks: [],
    
    definitionOfDone: [
        'Code reviewed',
        'Tests passing',
        'Documentation updated'
    ]
};
```

## Quick Planning Commands

```bash
# Generate task breakdown
node scripts/generate-breakdown.js --feature=newFeature

# Calculate velocity
node scripts/calculate-velocity.js --sprints=5

# Dependency analysis
node scripts/analyze-deps.js --tasks=./tasks.json

# Risk assessment
node scripts/assess-risks.js --project=./project.json
```

## Planning Tools Integration

### 1. Generate Plan from Codebase

```javascript
async function generatePlanFromCodebase(directory) {
    // Analyze existing code
    const files = await Desktop_Commander_start_search({
        path: directory,
        pattern: '*.{js,ts,py}',
        searchType: 'files'
    });
    
    const analysis = {
        modules: identifyModules(files),
        dependencies: analyzeDependencies(files),
        complexity: assessCodebaseComplexity(files),
        gaps: identifyGaps(files)
    };
    
    return createImprovementPlan(analysis);
}
```

### 2. Track Implementation Progress

```javascript
async function trackProgress(planFile) {
    const plan = await Desktop_Commander_read_file(planFile);
    const tasks = parseTasks(plan);
    
    const progress = {
        total: tasks.length,
        completed: 0,
        inProgress: 0,
        pending: 0
    };
    
    // Check implementation status
    for (const task of tasks) {
        const implemented = await checkImplementation(task);
        if (implemented) {
            progress.completed++;
        } else if (task.started) {
            progress.inProgress++;
        } else {
            progress.pending++;
        }
    }
    
    progress.percentComplete = (progress.completed / progress.total * 100).toFixed(1);
    
    return progress;
}
```

## Best Practices

1. **Start with clear goals** - Define what success looks like
2. **Break down early** - Identify tasks before starting
3. **Estimate realistically** - Include buffer for unknowns
4. **Track dependencies** - Avoid blockers
5. **Monitor progress** - Use burndown charts
6. **Communicate status** - Keep stakeholders informed
7. **Adapt plans** - Be flexible to change
8. **Learn from history** - Use past data for estimates
9. **Prioritize ruthlessly** - Focus on high-value items
10. **Document decisions** - Record why, not just what