/**
 * apifreellm-test.js
 * Quick test for ApiFreeLLM integration.
 */

import apifreellmFetch from './utils/apifreellm-manager.js';

async function main() {
    console.log('\n🚀 Testing ApiFreeLLM API...');

    try {
        const data = await apifreellmFetch('/chat', 'Hello, how are you?');

        console.log('\n📥 RECEIVED FROM APIFREELLM:');
        console.log('──────────────────────────────────────────────────────────────────────');
        console.log(data.response || '(empty content)');
        console.log('──────────────────────────────────────────────────────────────────────');
        console.log(`\nSuccess: ${data.success}`);
        console.log(`Tier: ${data.tier}`);
        console.log(`Features: ${JSON.stringify(data.features)}`);

    } catch (err) {
        console.error('\n❌ ApiFreeLLM test failed:', err.message);
    }
}

main();
