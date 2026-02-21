import fs from 'fs';

const content = fs.readFileSync('test_timing_results.txt', 'utf8');
const cleanContent = content.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '');

const lines = cleanContent.split('\n');
const slowTests = [];
const fileTotals = {};

lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // Vitest verbose output for a passing test usually looks like:
    // ✓ tests/unit/file.test.js > suite > test name [123 ms]
    // Or sometimes without brackets but usually at the end.
    // Let's match the LAST occurrence of digits followed by ms/s

    const durations = cleanLine.match(/(\d+)\s*(ms|s)/g);
    if (durations && (cleanLine.includes('Γ£ô') || cleanLine.includes('✓') || cleanLine.includes('tests/unit/'))) {
        const lastDuration = durations[durations.length - 1];
        const val = parseInt(lastDuration);
        const unit = lastDuration.includes('ms') ? 'ms' : 's';
        const duration = unit === 'ms' ? val : val * 1000;

        // Exclude the false positives where the "ms" matched is part of the test description
        // If the same number exists in the test description, we need to be careful.
        // Usually the duration is at the very end of the line.

        if (duration >= 100) {
            slowTests.push({ line: cleanLine, duration });
        }

        const fileMatch = cleanLine.match(/(tests\/(unit|integration)\/[^\s>]+)/);
        if (fileMatch) {
            const file = fileMatch[1];
            fileTotals[file] = (fileTotals[file] || 0) + duration;
        }
    }
});

console.log('Slow Individual Tests (> 100ms):');
slowTests.sort((a, b) => b.duration - a.duration).forEach(t => {
    console.log(`${t.duration}ms: ${t.line}`);
});

console.log('\nTop Files by Accumulated Test Duration:');
Object.entries(fileTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .forEach(([file, total]) => {
        console.log(`${total}ms: ${file}`);
    });
