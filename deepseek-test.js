/**
 * deepseek-test.js
 * Quick test for DeepSeek integration.
 */

import deepseekFetch from './utils/deepseek-manager.js';

async function main() {
    console.log('\n🚀 Testing DeepSeek API...');

    try {
        const data = await deepseekFetch('/chat/completions', {
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Hello! Who are you?' }
            ],
            max_tokens: 50
        });

        console.log('\n📥 RECEIVED FROM DEEPSEEK:');
        console.log('──────────────────────────────────────────────────────────────────────');
        console.log(data.choices?.[0]?.message?.content || '(empty content)');
        console.log('──────────────────────────────────────────────────────────────────────');
        console.log(`\nModel: ${data.model}`);
        console.log(`Usage: ${JSON.stringify(data.usage)}`);

    } catch (err) {
        console.error('\n❌ DeepSeek test failed:', err.message);
    }
}

main();
