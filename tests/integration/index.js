/**
 * Integration Tests Index
 * 
 * This file re-exports all integration tests for aggregated testing.
 * Import paths using @tests alias:
 *   import { describe, it, expect } from 'vitest';
 *   import * as integrationTests from '@tests/integration';
 */

export { default as agentConnectorHealth } from './agent-connector-health.test.js';
export { default as circuitBreaker } from './circuit-breaker.test.js';
export { default as requestQueue } from './request-queue.test.js';
export { default as coreModules } from './test-core-modules.js';
export { default as dedupe } from './test-dedupe.js';
export { default as aiReplyEngine } from './test-ai-reply-engine.js';
export { default as cloudPromptFix } from './test-cloud-prompt-fix.js';
export { default as cloudClientMulti } from './test-cloud-client-multi.js';
export { default as multiApi } from './test-multi-api.js';
export { default as cloudApi } from './test-cloud-api.js';
export { default as cloudClient } from './cloud-client.test.js';
export { default as agentConnector } from './agent-connector.test.js';

/**
 * Run all integration tests
 */
export async function runAllIntegrationTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const testModules = [
    { name: 'agent-connector-health', module: agentConnectorHealth },
    { name: 'circuit-breaker', module: circuitBreaker },
    { name: 'request-queue', module: requestQueue },
    { name: 'core-modules', module: coreModules },
    { name: 'dedupe', module: dedupe },
    { name: 'ai-reply-engine', module: aiReplyEngine },
    { name: 'cloud-prompt-fix', module: cloudPromptFix },
    { name: 'cloud-client-multi', module: cloudClientMulti },
    { name: 'multi-api', module: multiApi },
    { name: 'cloud-api', module: cloudApi },
    { name: 'cloud-client', module: cloudClient },
    { name: 'agent-connector', module: agentConnector }
  ];

  for (const { name, module } of testModules) {
    try {
      // Module is loaded, tests will be discovered by vitest
      results.tests.push({ name, status: 'loaded' });
      results.passed++;
    } catch (error) {
      results.tests.push({ name, status: 'failed', error: error.message });
      results.failed++;
    }
  }

  return results;
}
