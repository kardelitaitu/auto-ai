# Planning Templates

Quick reference templates for common planning tasks.

## Feature Implementation Plan

```markdown
# Feature: [Name]

## Overview
- **Goal**: What we're building
- **Why**: Business value / user need
- **Who**: Target users

## Requirements
### Functional
- [ ] Requirement 1
- [ ] Requirement 2

### Non-Functional
- [ ] Performance: < 100ms response
- [ ] Scalability: Support 1000 concurrent users

## Task Breakdown

| ID | Task | Estimate | Dependencies | Owner |
|----|------|----------|--------------|-------|
| T1 | Design API | 4h | - | - |
| T2 | Implement backend | 8h | T1 | - |
| T3 | Create UI | 6h | T1 | - |
| T4 | Write tests | 4h | T2, T3 | - |

## Timeline
- Start: [Date]
- MVP: [Date]
- Complete: [Date]

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High | Plan B |

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

## Sprint Plan Template

```markdown
# Sprint [Number]: [Goal]

## Duration
- Start: [Date]
- End: [Date]
- Days: 14

## Capacity
- Team size: 4
- Velocity: 40 points
- Available: 320 hours

## Planned Work

### Committed (32 points)
| Task | Points | Assignee |
|------|--------|----------|
| Task 1 | 8 | - |
| Task 2 | 5 | - |
| Task 3 | 8 | - |
| Task 4 | 5 | - |
| Task 5 | 6 | - |

### Stretch Goals
| Task | Points | Priority |
|------|--------|----------|
| Task 6 | 5 | Medium |

## Blockers
- None currently

## Ceremonies
- Planning: Monday 9am
- Standup: Daily 9am
- Review: Friday 2pm
- Retro: Friday 3pm
```

## Task Breakdown Template

```json
{
  "feature": "Browser Auto-Discovery",
  "tasks": [
    {
      "id": "T1",
      "name": "Create discovery service",
      "description": "Implement base discovery class",
      "estimate": 8,
      "priority": "High",
      "dependencies": [],
      "acceptance": [
        "Service can be instantiated",
        "Logs discovery attempts"
      ]
    },
    {
      "id": "T2",
      "name": "Implement IxBrowser connector",
      "description": "Add IxBrowser-specific discovery",
      "estimate": 4,
      "priority": "High",
      "dependencies": ["T1"],
      "acceptance": [
        "Detects running IxBrowser instances",
        "Returns valid endpoints"
      ]
    }
  ]
}
```

## Risk Register Template

```markdown
# Risk Register

| ID | Risk | Category | Probability | Impact | Score | Mitigation | Owner | Status |
|----|------|----------|-------------|--------|-------|------------|-------|--------|
| R1 | API changes | Technical | Medium | High | 6 | Pin versions, mock tests | - | Open |
| R2 | Team availability | Resource | Low | High | 3 | Cross-training | - | Open |
| R3 | Third-party outage | Dependency | Medium | Medium | 4 | Fallback providers | - | Monitoring |
```

## Estimation Worksheet

```javascript
// Quick estimation helper
const estimationWorksheet = {
  small: {
    examples: ['Config change', 'Bug fix', 'Documentation'],
    points: 1,
    hours: '0.5-2'
  },
  medium: {
    examples: ['New API endpoint', 'Form validation', 'Unit tests'],
    points: 3,
    hours: '4-8'
  },
  large: {
    examples: ['New feature', 'Integration', 'Refactor module'],
    points: 8,
    hours: '16-32'
  },
  epic: {
    examples: ['New system', 'Major rewrite', 'Platform migration'],
    points: 13,
    hours: '40-80'
  }
};
```

## Progress Report Template

```markdown
# Status Report: [Date]

## Summary
- Overall: [On Track / At Risk / Delayed]
- Sprint Progress: [X]% complete

## Completed This Week
- [x] Task 1
- [x] Task 2

## In Progress
- [ ] Task 3 (60% complete)
- [ ] Task 4 (30% complete)

## Blocked
- Task 5: Waiting for API credentials

## Upcoming
- Task 6: Starts Monday
- Task 7: Starts Wednesday

## Risks/Issues
- Issue 1: Resolved
- Issue 2: Mitigation in progress

## Metrics
- Velocity: 35 points
- Bug count: 3 open
- Test coverage: 85%
```

## Quick Estimation Formula

```javascript
// PERT Estimation
function pertEstimate(optimistic, likely, pessimistic) {
  return (optimistic + 4 * likely + pessimistic) / 6;
}

// Example usage
const task = pertEstimate(
  2,    // Best case: 2 hours
  4,    // Most likely: 4 hours
  8     // Worst case: 8 hours
);
// Result: 4.3 hours

// Add buffer for uncertainty
const withBuffer = task * 1.2; // 20% buffer
```

## Priority Scoring

```javascript
// Score features 1-10 for value and effort
function priorityScore(value, effort) {
  return value / effort;
}

// Examples
const features = [
  { name: 'Quick Win', value: 8, effort: 2, score: 4.0 },   // Do first
  { name: 'Major Project', value: 9, effort: 8, score: 1.1 }, // Plan carefully
  { name: 'Fill-in', value: 3, effort: 2, score: 1.5 },      // Do if time
  { name: 'Avoid', value: 2, effort: 8, score: 0.25 }        // Skip
];
```