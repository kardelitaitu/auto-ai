/**
 * Quick debug test for human-like methods
 * Usage: HUMAN_DEBUG=true node test-human-methods.js
 */

import { createLogger } from './utils/logger.js';
import { getSettings } from './utils/configLoader.js';
import { HumanInteraction } from './utils/human-interaction.js';
import { AIReplyEngine } from './utils/ai-reply-engine.js';
import { AIQuoteEngine } from './utils/ai-quote-engine.js';

const logger = createLogger('test-human-methods.js');

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('HUMAN-LIKE METHODS DEBUG TEST');
    console.log('='.repeat(70) + '\n');

    // Check debug mode
    const debugMode = process.env.HUMAN_DEBUG === 'true';
    console.log(`Debug Mode: ${debugMode ? 'ON' : 'OFF'}`);
    console.log(`Enable with: set HUMAN_DEBUG=true\n`);

    // Test HumanInteraction utilities
    console.log('-'.repeat(70));
    console.log('TESTING HumanInteraction Utilities');
    console.log('-'.repeat(70));

    const human = new HumanInteraction();
    human.debugMode = true;

    // Test hesitation
    console.log('\n[Test 1] Hesitation (300-500ms):');
    const h1 = await human.hesitation(300, 500);
    console.log(`  Result: ${h1}ms`);

    // Test fixation
    console.log('\n[Test 2] Fixation (200-800ms):');
    const f1 = await human.fixation(200, 800);
    console.log(`  Result: ${f1}ms`);

    // Test reading time
    console.log('\n[Test 3] Reading time (1-2s):');
    const r1 = await human.readingTime(1000, 2000);
    console.log(`  Result: ${r1}ms`);

    // Test method selection
    console.log('\n[Test 4] Method Selection (10 trials):');
    const methods = [
        { name: 'A', weight: 40, fn: () => 'A' },
        { name: 'B', weight: 35, fn: () => 'B' },
        { name: 'C', weight: 15, fn: () => 'C' },
        { name: 'D', weight: 10, fn: () => 'D' }
    ];

    const results = { A: 0, B: 0, C: 0, D: 0 };
    for (let i = 0; i < 10; i++) {
        const selected = human.selectMethod(methods);
        results[selected.name]++;
    }
    console.log('  Distribution:', results);

    // Test reply engine
    console.log('\n' + '-'.repeat(70));
    console.log('TESTING AI Reply Engine');
    console.log('-'.repeat(70));

    const replyEngine = new AIReplyEngine(null, {
        replyProbability: 1.0,
        maxRetries: 1
    });

    console.log('\n[Test 5] Reply Engine Methods:');
    console.log('  replyA - Keyboard (R key)');
    console.log('  replyB - Button click');
    console.log('  replyC - Direct composer focus (focus, click, type, submit)');
    console.log('  executeReply (main entry)');

    console.log('\n[Test 6] Reply Engine Stats:');
    const replyStats = replyEngine.getStats();
    console.log('  Stats:', JSON.stringify(replyStats, null, 2));

    // Test quote engine
    console.log('\n' + '-'.repeat(70));
    console.log('TESTING AI Quote Engine');
    console.log('-'.repeat(70));

    const quoteEngine = new AIQuoteEngine(null, {
        quoteProbability: 1.0,
        maxRetries: 1
    });

    console.log('\n[Test 7] Quote Engine Methods:');
    console.log('  quoteA - Keyboard (T key)');
    console.log('  quoteB - Retweet menu');
    console.log('  quoteC - Quote URL');
    console.log('  quoteD - Copy-paste');
    console.log('  executeQuote (main entry)');

    console.log('\n[Test 8] Quote Engine Stats:');
    const quoteStats = quoteEngine.getStats();
    console.log('  Stats:', JSON.stringify(quoteStats, null, 2));

    // Test composer verification
    console.log('\n' + '-'.repeat(70));
    console.log('TESTING Composer Verification');
    console.log('-'.repeat(70));
    console.log('\n[Test 9] verifyComposerOpen() Method:');
    console.log('  Checks for:');
    console.log('    - [data-testid="tweetTextarea_0"]');
    console.log('    - [contenteditable="true"][role="textbox"]');
    console.log('    - [data-testid="tweetTextarea"]');
    console.log('    - textarea[placeholder*="Post your reply"]');
    console.log('  Returns: { open, selector, locator }');

    console.log('\n[Test 10] typeText() Method:');
    console.log('  Features:');
    console.log('    - Multiple focus strategies');
    console.log('    - Human-like typing delays');
    console.log('    - Punctuation pauses');
    console.log('    - Random thinking breaks');

    console.log('\n' + '='.repeat(70));
    console.log('TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('\nTo test in browser:');
    console.log('  node main.js testHumanMethods targetUrl=https://x.com/user/status/123 method=replyA mode=safe');
    console.log('  node main.js testHumanMethods targetUrl=https://x.com/user/status/123 method=quoteA mode=safe\n');
}

main().catch(console.error);
