/**
 * @fileoverview Example task demonstrating the new DAO architecture.
 * This is a simple navigation task that uses the agent-connector for reasoning.
 * @module examples/simpleNavigate
 */

import { createLogger } from '../utils/logger.js';
import AgentConnector from '../core/agent-connector.js';
import VisionPackager from '../core/vision-packager.js';
import SemanticParser from '../core/semantic-parser.js';
import HumanizerEngine from '../core/humanizer-engine.js';
import AuditVerifier from '../core/audit-verifier.js';

const logger = createLogger('simpleNavigate.js');

/**
 * Simple navigation task using the new DAO architecture.
 * @param {playwright.Page} page - The Playwright page object.
 * @param {object} payload - Task payload.
 * @param {string} payload.targetUrl - URL to navigate to.
 * @param {string} [payload.browserInfo] - Browser identifier.
 */
async function simpleNavigate(page, payload) {
    const { targetUrl, browserInfo = 'unknown' } = payload;
    const sessionId = `${browserInfo}-${Date.now()}`;

    logger.info(`[${sessionId}] Starting simple navigation to: ${targetUrl}`);

    try {
        // Initialize modules
        const agentConnector = new AgentConnector();
        const visionPackager = new VisionPackager();
        const semanticParser = new SemanticParser();
        const humanizer = new HumanizerEngine();
        const auditor = new AuditVerifier();

        // Step 1: Navigate to URL
        logger.info(`[${sessionId}] Navigating...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for page to stabilize
        await page.waitForTimeout(2000);

        // Step 2: Capture visual and semantic context
        logger.info(`[${sessionId}] Capturing context...`);

        const screenshot = await visionPackager.captureWithROI(page, sessionId);
        logger.info(`[${sessionId}] Screenshot captured: ${screenshot.metadata.filename}`);

        const semanticTree = await semanticParser.extractSemanticTree(page);
        logger.info(`[${sessionId}] Extracted ${semanticTree.interactiveElements.length} interactive elements`);

        // Generate compact representation for logging
        const compactTree = semanticParser.generateCompactRepresentation(semanticTree, 10);
        logger.debug(`[${sessionId}] Page structure:\n${compactTree}`);

        // Step 3: Use agent-connector to decide next action
        logger.info(`[${sessionId}] Querying agent for next steps...`);

        const instructions = `You are on page: "${semanticTree.pageTitle}"
URL: ${targetUrl}

Interactive Elements:
${compactTree}

What would be the logical next action a human would take on this page?
Respond with a JSON object:
{
  "action": "click|scroll|wait|done",
  "target": "element name or coordinates",
  "reasoning": "brief explanation"
}`;

        const response = await agentConnector.processRequest({
            action: 'analyze_page',
            payload: { instructions },
            sessionId,
            forceCloud: false // Let classifier decide
        });

        if (response.success && response.data) {
            const suggestion = response.data;
            logger.success(`[${sessionId}] Agent suggests: ${suggestion.action}`);
            logger.info(`[${sessionId}] Reasoning: ${suggestion.reasoning}`);

            // Step 4: Execute suggested action (if applicable)
            if (suggestion.action === 'click' && suggestion.target) {
                logger.info(`[${sessionId}] Attempting to click: ${suggestion.target}`);

                // Find element by name
                const element = semanticParser.findElementByName(semanticTree, suggestion.target);

                if (element) {
                    // Pre-flight check
                    const preCheck = await auditor.preFlightCheck(page, element.coordinates);

                    if (preCheck.success) {
                        // Generate humanized path
                        const viewport = page.viewportSize();
                        const startPos = { x: viewport.width / 2, y: viewport.height / 2 };
                        const path = humanizer.generateMousePath(startPos, element.coordinates);

                        logger.debug(`[${sessionId}] Moving cursor along ${path.points.length}-point path...`);

                        // Move along path
                        for (const point of path.points) {
                            await page.mouse.move(point.x, point.y);
                            await page.waitForTimeout(path.duration / path.points.length);
                        }

                        // Click
                        await page.mouse.click(element.coordinates.x, element.coordinates.y);
                        logger.success(`[${sessionId}] Clicked at (${element.coordinates.x}, ${element.coordinates.y})`);

                        // Post-flight check (wait for potential navigation)
                        await page.waitForTimeout(1000);

                        const postCheck = await auditor.waitForState(page, {
                            // Simple check: verify page didn't crash
                            textContains: 'html'
                        }, 3000);

                        if (postCheck.success) {
                            logger.success(`[${sessionId}] Post-flight verification passed`);
                        } else {
                            logger.warn(`[${sessionId}] Post-flight verification inconclusive`);
                        }
                    } else {
                        logger.warn(`[${sessionId}] Pre-flight check failed: ${preCheck.reason}`);
                    }
                } else {
                    logger.warn(`[${sessionId}] Element "${suggestion.target}" not found in semantic tree`);
                }
            } else if (suggestion.action === 'done') {
                logger.info(`[${sessionId}] Agent indicates no further action needed`);
            }
        } else {
            logger.warn(`[${sessionId}] Agent query failed: ${response.error || 'Unknown error'}`);
        }

        // Step 5: Log statistics
        logger.info(`[${sessionId}] Task complete. Logging statistics...`);
        agentConnector.logStats();
        auditor.logStats();

        // Cleanup
        await agentConnector.clearSession(sessionId);
        await visionPackager.cleanupOldScreenshots();

        logger.success(`[${sessionId}] Simple navigation completed successfully`);

    } catch (error) {
        logger.error(`[${sessionId}] Task failed:`, error.message);
        throw error;
    }
}

export default simpleNavigate;
