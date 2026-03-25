# Plan Improvement Skill - Examples

> **Practical examples for systematic improvement planning.**

## Gap Analysis

```javascript
// Example: Analyze gaps between current and desired state
function analyzeGaps(current, desired) {
    const gaps = [];
    
    for (const [key, desiredValue] of Object.entries(desired)) {
        const currentValue = current[key];
        
        if (currentValue === undefined) {
            gaps.push({
                area: key,
                type: 'MISSING',
                severity: 'HIGH',
                current: null,
                desired: desiredValue
            });
        } else if (JSON.stringify(currentValue) !== JSON.stringify(desiredValue)) {
            gaps.push({
                area: key,
                type: 'DIFFERENT',
                severity: 'MEDIUM',
                current: currentValue,
                desired: desiredValue
            });
        }
    }
    
    return gaps;
}

// Usage
const gaps = analyzeGaps(
    { testing: 'basic', docs: 'partial', monitoring: null },
    { testing: 'comprehensive', docs: 'complete', monitoring: 'enabled' }
);
```

## Priority Matrix

```javascript
// Example: Create priority matrix
function createPriorityMatrix(improvements) {
    return improvements.map(imp => ({
        ...imp,
        score: (imp.impact * imp.ease) / imp.cost,
        quadrant: getQuadrant(imp.impact, imp.cost)
    })).sort((a, b) => b.score - a.score);
}

function getQuadrant(impact, cost) {
    if (impact > 7 && cost < 5) return 'Quick Wins';
    if (impact > 7 && cost >= 5) return 'Major Projects';
    if (impact <= 7 && cost < 5) return 'Fill-ins';
    return 'Thankless Tasks';
}
```

## Progress Tracking

```javascript
// Example: Track improvement progress
class ImprovementTracker {
    constructor() {
        this.items = new Map();
    }
    
    addItem(id, item) {
        this.items.set(id, {
            ...item,
            status: 'pending',
            progress: 0,
            startDate: null,
            endDate: null
        });
    }
    
    updateProgress(id, progress) {
        const item = this.items.get(id);
        if (item) {
            item.progress = Math.min(100, Math.max(0, progress));
            if (item.progress === 100) {
                item.status = 'completed';
                item.endDate = new Date().toISOString();
            } else if (item.progress > 0) {
                item.status = 'in-progress';
            }
        }
    }
    
    getSummary() {
        const items = Array.from(this.items.values());
        return {
            total: items.length,
            completed: items.filter(i => i.status === 'completed').length,
            inProgress: items.filter(i => i.status === 'in-progress').length,
            pending: items.filter(i => i.status === 'pending').length,
            averageProgress: items.reduce((sum, i) => sum + i.progress, 0) / items.length
        };
    }
}
```

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview
