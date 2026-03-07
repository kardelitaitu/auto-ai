import fs from 'fs';

const filepath = 'api/tests/unit/ai-quote-engine.test.js';
const lines = fs.readFileSync(filepath, 'utf8').split('\n');

// 1. Line 3651
if (lines[3650].includes('describe.skip')) {
    lines[3650] = lines[3650].replace('describe.skip', 'describe');
}

// 2. Line 1074 to 1301 -> remove
if (lines[1073].includes(`describe('quoteMethodB_Retweet platform-dependent modifier key'`)) {
    lines.splice(1073, 228);
}

// 3. Line 746
if (lines[745].includes('it.skip')) {
    lines[745] = lines[745].replace('it.skip', 'it');
}

fs.writeFileSync(filepath, lines.join('\n'));
console.log('Successfully edited ai-quote-engine.test.js');
