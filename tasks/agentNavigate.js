/**
 * @fileoverview Agent-Driven Navigation Task - Uses LLM with vision for intelligent browsing.
 * Demonstrates the complete DAO architecture with vision processing.
 * @module tasks/agentNavigate
 */

import { createLogger } from '../utils/logger.js';
import { takeScreenshot } from '../utils/screenshot.js';
import VisionPackager from '../core/vision-packager.js';
import SemanticParser from '../core/semantic-parser.js';
import AgentConnector from '../core/agent-connector.js';
import HumanizerEngine from '../core/humanizer-engine.js';
import path from 'path';

const logger = createLogger('agentNavigate.js');

/**
 * Agent-driven navigation task.
 * The LLM analyzes the page visually and decides what to do next.
 * 
 * @param {playwright.Page} page - The Playwright page object.
 * @param {object} payload - Task payload.
 * @param {string} payload.targetUrl - URL to navigate to.
 * @param {string} payload.goal - What the agent should accomplish (e.g., "Find the search box and search for 'AI'").
 * @param {string} [payload.browserInfo] - Browser identifier.
 */
async function agentNavigate(page, payload) {
    const targetUrl = payload.targetUrl || payload.url;
    const goal = payload.goal;
    const browserInfo = payload.browserInfo || 'unknown';
    const sessionId = `${browserInfo}-${Date.now()}`;

    if (!targetUrl || !goal) {
        throw new Error('agentNavigate requires targetUrl and goal parameters');
    }

    logger.info(`[${sessionId}] Starting agent-driven navigation`);
    logger.info(`[${sessionId}] Target: ${targetUrl}`);
    logger.info(`[${sessionId}] Goal: ${goal}`);

    try {
        // Initialize DAO modules
        const visionPackager = new VisionPackager();
        const semanticParser = new SemanticParser();
        const agentConnector = new AgentConnector();
        const humanizer = new HumanizerEngine();

        // Step 1: Navigate to target URL
        logger.info(`[${sessionId}] Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await page.waitForTimeout(2000); // Wait for page to stabilize

        // Step 2: Capture vision packet (screenshot + ROI + base64)
        logger.info(`[${sessionId}] Capturing vision packet...`);
        const visionPacket = await visionPackager.captureWithROI(page, sessionId);
        logger.success(`[${sessionId}] Vision packet created: ${visionPacket.metadata.sizeBytes} bytes, base64 length: ${visionPacket.base64.length}`);

        // Step 3: Extract semantic tree for context
        logger.info(`[${sessionId}] Extracting semantic tree...`);
        const semanticTree = await semanticParser.extractSemanticTree(page);
        logger.info(`[${sessionId}] Found ${semanticTree.interactiveElements.length} interactive elements`);

        // Step 4: Prepare compact semantic context (send only relevant elements to reduce tokens)
        const compactSemanticTree = semanticTree.interactiveElements
            .filter(el => el.role && el.name) // Only elements with role and name
            .slice(0, 20) // Limit to top 20
            .map(el => ({
                role: el.role,
                name: el.name,
                coords: el.coordinates
            }));

        // Step 5: Send to agent-connector for analysis
        logger.info(`[${sessionId}] Sending to agent (vision + semantic tree)...`);

        const agentResponse = await agentConnector.processRequest({
            action: 'analyze_page_with_vision',
            payload: {
                goal,
                vision: visionPacket.base64,  // ← Vision data sent here!
                semanticTree: compactSemanticTree,
                pageTitle: semanticTree.pageTitle,
                url: targetUrl
            },
            context: {
                state: {
                    currentUrl: targetUrl,
                    goal
                }
            },
            sessionId
        });

        logger.info(`[${sessionId}] Agent response received:`, {
            success: agentResponse.success,
            routedTo: agentResponse.metadata?.routedTo || 'unknown',
            duration: agentResponse.metadata?.duration || 0
        });

        if (agentResponse.success) {
            logger.success(`[${sessionId}] Agent analysis:\n${agentResponse.content}`);

            // Try to parse JSON response for structured actions
            if (agentResponse.data) {
                logger.info(`[${sessionId}] Structured action plan received`);

                // Execute actions if provided
                if (agentResponse.data.actions && Array.isArray(agentResponse.data.actions)) {
                    for (const action of agentResponse.data.actions) {
                        logger.info(`[${sessionId}] Executing action: ${action.type}`);

                        if (action.type === 'click' && action.coordinates) {
                            // Generate humanized mouse movement
                            const viewport = page.viewportSize() || { width: 1920, height: 1080 };
                            const startPos = { x: viewport.width / 2, y: viewport.height / 2 };
                            const path = humanizer.generateMousePath(startPos, action.coordinates);

                            // Move mouse
                            for (const point of path.points) {
                                await page.mouse.move(point.x, point.y);
                                await page.waitForTimeout(path.duration / path.points.length);
                            }

                            // Click
                            await page.mouse.click(action.coordinates.x, action.coordinates.y);
                            logger.success(`[${sessionId}] Clicked at (${action.coordinates.x}, ${action.coordinates.y})`);
                        }
                    }
                }
            }
        } else {
            logger.error(`[${sessionId}] Agent request failed: ${agentResponse.error}`);
        }

        // Step 6: Take final screenshot
        logger.info(`[${sessionId}] Taking screenshot...`);
        const screenshotPath = await takeScreenshot(page, sessionId, '-AgentResult');
        if (screenshotPath) {
            logger.success(`[${sessionId}] Screenshot saved: ${path.basename(screenshotPath)}`);
        }

        logger.success(`[${sessionId}] Agent navigation task completed!`);

    } catch (error) {
        logger.error(`[${sessionId}] Task failed:`, error.message);

        // Error screenshot
        try {
            await takeScreenshot(page, sessionId, '-Error');
            logger.info(`[${sessionId}] Error screenshot captured`);
        } catch (_screenshotError) {
            logger.warn(`[${sessionId}] Could not capture error screenshot`);
        }

        throw error;
    }
}

export default agentNavigate;
