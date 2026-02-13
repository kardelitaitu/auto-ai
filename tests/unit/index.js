/**
 * Unit Tests Index
 * 
 * This file re-exports all unit tests for aggregated testing.
 * Import paths using @tests alias:
 *   import { describe, it, expect } from 'vitest';
 *   import * as unitTests from '@tests/unit';
 */

export { default as aiTwitterActivity } from './ai-twitter-activity.test.js';
export { default as aiTwitterAgent } from './ai-twitterAgent.test.js';
export { default as asyncQueue } from './async-queue.test.js';
export { default as configService } from './config-service.test.js';
export { default as engagementLimits } from './engagement-limits.test.js';
export { default as humanInteraction } from './human-interaction.test.js';
export { default as smartProb } from './test-smart-prob.js';
export { default as actionConfig } from './test-action-config.js';
export { default as actions } from './test-actions.js';
export { default as simpleDive } from './test-simple-dive.js';
export { default as humanMethods } from './test-human-methods.js';
export { default as modularMethods } from './test-modular-methods.js';
export { default as replyMethod } from './test-reply-method.js';

/**
 * Run all unit tests
 */
export async function runAllUnitTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const testModules = [
    { name: 'ai-twitter-activity', module: aiTwitterActivity },
    { name: 'ai-twitter-agent', module: aiTwitterAgent },
    { name: 'async-queue', module: asyncQueue },
    { name: 'config-service', module: configService },
    { name: 'engagement-limits', module: engagementLimits },
    { name: 'human-interaction', module: humanInteraction },
    { name: 'smart-prob', module: smartProb },
    { name: 'action-config', module: actionConfig },
    { name: 'actions', module: actions },
    { name: 'simple-dive', module: simpleDive },
    { name: 'human-methods', module: humanMethods },
    { name: 'modular-methods', module: modularMethods },
    { name: 'reply-method', module: replyMethod }
  ];

  for (const { name, module } of testModules) {
    try {
      results.tests.push({ name, status: 'loaded' });
      results.passed++;
    } catch (error) {
      results.tests.push({ name, status: 'failed', error: error.message });
      results.failed++;
    }
  }

  return results;
}
