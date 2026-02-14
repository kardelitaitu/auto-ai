const fs = require('fs');
const path = require('path');

const coveragePath = path.resolve('coverage/coverage-final.json');
if (!fs.existsSync(coveragePath)) {
    console.log('Coverage file not found');
    process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
// Find the key that ends with orchestrator.js (path might be absolute)
const orchestratorKey = Object.keys(coverage).find(k => k.endsWith('orchestrator.js'));

if (!orchestratorKey) {
  console.log('Orchestrator coverage not found in report');
  process.exit(1);
}

const data = coverage[orchestratorKey];
const fnMap = data.fnMap;
const f = data.f;

console.log(`Coverage for ${orchestratorKey}:`);
let uncoveredCount = 0;
let totalCount = 0;

Object.keys(fnMap).forEach(key => {
  totalCount++;
  if (f[key] === 0) {
    uncoveredCount++;
    const fn = fnMap[key];
    console.log(`- Uncovered: ${fn.name || 'anonymous'} at line ${fn.loc.start.line}`);
  }
});

console.log(`Total functions: ${totalCount}`);
console.log(`Uncovered functions: ${uncoveredCount}`);
console.log(`Coverage: ${((totalCount - uncoveredCount) / totalCount * 100).toFixed(2)}%`);
