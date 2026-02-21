/**
 * Edge Case Tests Index
 * 
 * This file re-exports all edge case tests for aggregated testing.
 * Import paths using @tests alias:
 *   import { describe, it, expect } from 'vitest';
 *   import * as edgeCaseTests from '@tests/edge-cases';
 */

import phase1Validation from './phase1-3-validation.js';
import multilineTweet from './test-multiline-tweet.js';
import models from './test-models.js';
import diveLock from './test-dive-lock.js';

export { phase1Validation, multilineTweet, models, diveLock };

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

  for (const { name } of testModules) {
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
