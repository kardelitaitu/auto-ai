/**
 * @fileoverview A minimal task for coverage testing that always returns success
 * @module tasks/coverage_valid_task
 */

/**
 * @returns {{success: boolean}} A success object
 */
export default async function coverageValidTask() {
  return { success: true };
}
