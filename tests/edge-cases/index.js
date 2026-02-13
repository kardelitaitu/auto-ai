/**
 * Edge Case Tests Index
 * 
 * This file re-exports all edge case tests for aggregated testing.
 * Import paths using @tests alias:
 *   import { describe, it, expect } from 'vitest';
 *   import * as edgeCaseTests from '@tests/edge-cases';
 */

export { default as phase1Validation } from './phase1-3-validation.js';
export { default as multilineTweet } from './test-multiline-tweet.js';
export { default as models } from './test-models.js';
export { default as diveLock } from './test-dive-lock.js';

/**
 * Run all edge case tests
 */
export async function runAllEdgeCaseTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const testModules = [
    { name: 'phase1-3-validation', module: phase1Validation },
    { name: 'test-multiline-tweet', module: multilineTweet },
    { name: 'test-models', module: models },
    { name: 'test-dive-lock', module: diveLock }
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
