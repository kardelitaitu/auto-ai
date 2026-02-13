/**
 * Test with realistic Twitter prompt
 */

import { FreeApiRouter } from './utils/free-api-router.js';

const apiKey = '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';
const model = 'arcee-ai/trinity-large-preview:free';

async function testTwitterPrompt() {
  console.log(`Testing with realistic Twitter prompt...\n`);

  const router = new FreeApiRouter({
    enabled: true,
    apiKeys: [apiKey],
    primaryModel: model,
    fallbackModels: [],
    proxyEnabled: false
  });

  // This is similar to the actual prompt used in ai-reply-engine.js
  const systemPrompt = `You are a smart, very chill person who scrolls Twitter.
You see a lot of content, and you have authentic reactions.
You don't need to be profound - just natural and real.
Keep your reactions short and casual.

You will see tweet content and replies from other users.
Your task: Reply with a casual reaction or thought.
Keep it SHORT - one sentence max. Be natural.

Examples of good replies:
- "This is so real"
- "Exactly"
- "Can't argue with that"
- "This hits different"
- "ngl this is true"
- "Post made"
- "Real recognize real`;

  const userPrompt = `Tweet from @example:
"This is the tweet text"

Tweet URL: https://twitter.com/example/status/123

Language detected: English

IMPORTANT: Keep it SHORT. Maximum 1 short sentence. No paragraphs.

Tweet Analysis:
- Sentiment: neutral
- Conversation Type: general

TONE GUIDANCE: Show genuine excitement and energy. Be warm and encouraging.
LENGTH: MAXIMUM 1 SHORT SENTENCE

Write ONE short reply (1 sentence max):`;

  const request = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 50,
    temperature: 0.7
  };

  try {
    const startTime = Date.now();
    const result = await router.processRequest(request);
    const duration = Date.now() - startTime;

    console.log(`Duration: ${duration}ms`);
    console.log(`Success: ${result.success}`);

    if (result.success) {
      const content = result.content || '';
      console.log(`Content length: ${content.length} chars`);
      console.log(`Content: "${content}"`);
    } else {
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.log(`Exception: ${error.message}`);
  }
}

testTwitterPrompt().catch(console.error);
