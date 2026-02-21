const c = require('./coverage/coverage-final.json');
const key = Object.keys(c).find(k => k.includes('free-api-router.js') && !k.includes('openrouter'));
const f = c[key];

// Calculate coverage from statement counts
const statements = f.s;
const totalStatements = Object.keys(statements).length;
const coveredStatements = Object.values(statements).filter(v => v > 0).length;
const linePct = (coveredStatements / totalStatements * 100).toFixed(2);

// Branches
const branches = f.b;
const totalBranches = Object.keys(branches).length;
const coveredBranches = Object.values(branches).filter(arr => arr.some(v => v > 0)).length;
const branchPct = (coveredBranches / totalBranches * 100).toFixed(2);

// Find uncovered line numbers
const uncoveredLines = [];
Object.entries(f.statementMap).forEach(([idx, map]) => {
    if (statements[idx] === 0) {
        uncoveredLines.push(map.start.line);
    }
});

console.log('Lines %:', linePct);
console.log('Branches %:', branchPct);
console.log('Uncovered line numbers:', [...new Set(uncoveredLines)].sort((a,b) => a-b).slice(0, 50));
