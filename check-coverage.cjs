const fs = require('fs');
const path = require('path');

const coveragePath = path.resolve('coverage/coverage-final.json');
if (!fs.existsSync(coveragePath)) {
    console.log('Coverage file not found');
    process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
// Find the key that ends with orchestrator.js (path might be absolute)
const targetFile = process.argv[2] || 'orchestrator.js';
const orchestratorKey = Object.keys(coverage).find(k => k.endsWith(targetFile));

if (!orchestratorKey) {
  console.log(`Coverage for ${targetFile} not found in report`);
  console.log('Available keys:');
  Object.keys(coverage).forEach(key => console.log(`- ${key}`));
  process.exit(1);
}

const data = coverage[orchestratorKey];
const fnMap = data.fnMap;
const f = data.f;
const s = data.s;
const b = data.b;

console.log(`Coverage for ${orchestratorKey}:`);

// Function Coverage
let uncoveredFnCount = 0;
let totalFnCount = 0;
Object.keys(fnMap).forEach(key => {
  totalFnCount++;
  if (f[key] === 0) {
    uncoveredFnCount++;
    const fn = fnMap[key];
    console.log(`- Uncovered Function: ${fn.name || 'anonymous'} at line ${fn.loc.start.line}`);
  }
});

// Statement Coverage
let totalStmts = 0;
let coveredStmts = 0;
const statementMap = data.statementMap;
Object.keys(s).forEach(key => {
  totalStmts++;
  if (s[key] > 0) {
    coveredStmts++;
  } else {
    const stmt = statementMap[key];
    console.log(`- Uncovered Statement: Line ${stmt.start.line}`);
  }
});

// Branch Coverage
let totalBranches = 0;
let coveredBranches = 0;
const branchMap = data.branchMap;
Object.keys(b).forEach(key => {
  const branchCounts = b[key];
  branchCounts.forEach((count, index) => {
    totalBranches++;
    if (count > 0) {
      coveredBranches++;
    } else {
      const branch = branchMap[key];
      console.log(`- Uncovered Branch: Line ${branch.loc.start.line} (Location ${index})`);
    }
  });
});

console.log('\nSummary:');
console.log(`Functions: ${((totalFnCount - uncoveredFnCount) / totalFnCount * 100).toFixed(2)}% (${totalFnCount - uncoveredFnCount}/${totalFnCount})`);
console.log(`Statements: ${(coveredStmts / totalStmts * 100).toFixed(2)}% (${coveredStmts}/${totalStmts})`);
console.log(`Branches: ${(coveredBranches / totalBranches * 100).toFixed(2)}% (${coveredBranches}/${totalBranches})`);