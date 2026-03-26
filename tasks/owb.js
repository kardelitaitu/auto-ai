/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Open World Browser Task
 * Uses the autonomous vision-based game agent to complete goals on any website.
 * This task wraps api.gameAgent.run() for use with the orchestrator.
 * @module tasks/owb
 */

import { api } from "../api/index.js";
import { createLogger } from "../api/core/logger.js";

/**
 * Open World Browser - Autonomous Agent Task
 *
 * Executes an autonomous AI agent to complete a goal on the current page.
 * The agent uses vision to understand the page and can perform actions like:
 * - Click, type, drag, scroll
 * - Wait for elements
 * - Verify actions worked
 *
 * @param {Page} page - Playwright page object
 * @param {object} payload - Task payload
 * @param {string} payload.goal - The goal to accomplish (e.g., "Click login and enter credentials")
 * @param {number} [payload.maxSteps=30] - Maximum agent steps
 * @param {number} [payload.stepDelay=500] - Delay between steps (ms)
 * @param {boolean} [payload.stuckDetection=true] - Enable stuck detection
 * @param {number} [payload.maxAttempts=5] - Max attempts without progress
 * @param {boolean} [payload.verifyAction=true] - Verify actions worked
 * @returns {Promise<object>} Result from gameAgent
 *
 * @example
 * // Via CLI:
 * node main.js owb="Click the Start button"
 * node main.js owb="Fill in the form with test data"
 * node main.js owb="Build a barracks" --maxSteps=50
 *
 * // Via payload:
 * { task: 'owb', payload: { goal: 'Click login', maxSteps: 20 } }
 */
export default async function owb(page, payload) {
  const startTime = process.hrtime.bigint();
  const logger = createLogger("owb.js");
  const browserInfo = payload?.browserInfo || "unknown";

  logger.info("Starting Open World Browser task...");

  const goal = payload?.goal || payload?.value || payload;

  // Input validation
  if (!goal || typeof goal !== "string") {
    throw new Error(
      'OWB task requires a string goal. Usage: owb="Your goal here"',
    );
  }

  if (goal.length < 3) {
    throw new Error("Goal must be at least 3 characters long");
  }

  if (goal.length > 500) {
    throw new Error("Goal must be under 500 characters");
  }

  const config = {
    maxSteps: payload?.maxSteps || 30,
    stepDelay: payload?.stepDelay || 500,
    stuckDetection: payload?.stuckDetection !== false,
    maxAttemptsWithoutChange: payload?.maxAttempts || 5,
    verifyAction: payload?.verifyAction !== false,
    sessionId: browserInfo,
  };

  logger.info(`Goal: "${goal}"`);
  logger.info(
    `Config: maxSteps=${config.maxSteps}, stepDelay=${config.stepDelay}, stuckDetection=${config.stuckDetection}`,
  );

  let result;

  try {
    await api.init(page, { logger });

    logger.info("Running autonomous agent...");

    result = await api.gameAgent.run(goal, config);

    logger.info("=== OWB RESULT ===");
    logger.info(`Success: ${result.success}`);
    logger.info(`Done: ${result.done}`);
    logger.info(`Steps: ${result.steps}`);
    logger.info(`Reason: ${result.reason || "N/A"}`);

    if (result.success) {
      logger.info("Agent completed the goal successfully!");
    } else {
      logger.warn(`Agent did not complete: ${result.reason}`);
    }

    return result;
  } catch (error) {
    logger.error(`OWB task failed: ${error.message}`);
    throw error;
  } finally {
    const endTime = process.hrtime.bigint();
    const durationInSeconds = (
      Number(endTime - startTime) / 1_000_000_000
    ).toFixed(2);
    logger.info(`Total task duration: ${durationInSeconds} seconds`);
  }
}
