/**
 * @fileoverview Enhanced Google Search Test
 * Demonstrates the full DAO architecture:
 * 1. SemanticParser: Extracts real DOM elements
 * 2. VisionPackager: Captures screenshot
 * 3. VisionInterpreter: Plans actions via LLM
 * 4. HumanizerEngine: Executes organic interactions
 * @module tasks/testGoogleSearch
 */

import { createLogger } from '../utils/logger.js';
import { takeScreenshot } from '../utils/screenshot.js';
import LocalClient from '../core/local-client.js';
import VisionInterpreter from '../core/vision-interpreter.js';
import SemanticParser from '../core/semantic-parser.js';
import HumanizerEngine from '../core/humanizer-engine.js';
import VisionPackager from '../core/vision-packager.js';
import { scrollRandom } from '../utils/scroll-helper.js';

const logger = createLogger('testGoogleSearch.js');

/**
 * Task: Full Agent Capability Demo
 * @param {object} page - Playwright page object
 * @param {string} sessionId - Session ID
 */
async function testGoogleSearch(page, payload) {
    const { browserInfo = 'unknown-session' } = payload;
    const sessionId = browserInfo;

    logger.info(`[${sessionId}] === FULL AGENT CAPABILITY DEMO ===`);

    try {
        // Initialize Modules
        const localClient = new LocalClient();
        const interpreter = new VisionInterpreter();
        const semanticParser = new SemanticParser();
        const humanizer = new HumanizerEngine();
        const visionPackager = new VisionPackager();

        // 1. Navigate
        logger.info(`[${sessionId}] Step 1: Navigating to Google...`);
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        // 2. Parse Semantics (Real DOM)
        logger.info(`[${sessionId}] Step 2: Extracting Semantic Tree (DOM Analysis)...`);
        const semanticTree = await semanticParser.extractSemanticTree(page);
        logger.success(`[${sessionId}] ✓ Found ${semanticTree.interactiveElements.length} interactive elements`);

        // Log top elements to show we found them
        semanticTree.interactiveElements.slice(0, 5).forEach((el, i) => {
            logger.debug(`   - [${i}] ${el.role}: "${el.name}" @ (${el.coordinates.x},${el.coordinates.y})`);
        });

        // 3. Capture Vision
        logger.info(`[${sessionId}] Step 3: Capturing Vision Packet...`);
        const visionPacket = await visionPackager.captureWithROI(page, sessionId);
        logger.success(`[${sessionId}] ✓ Screenshot captured (${Math.round(visionPacket.base64.length / 1024)}KB)`);

        // 4. Plan Action (LLM)
        const goal = "Find the search bar, click it, type 'semangka merah', and press Enter";
        logger.info(`[${sessionId}] Step 4: Planning Action (Goal: "${goal}")...`);

        const prompt = interpreter.buildPrompt({
            goal: goal,
            semanticTree: semanticTree.interactiveElements
        });

        const response = await localClient.sendRequest({
            prompt: prompt,
            vision: visionPacket.base64,
            maxTokens: 1024,
            temperature: 0.1
        });

        // 5. Interpret & Execute
        logger.info(`[${sessionId}] Step 5: Interpretation & Execution...`);

        if (!response.success) {
            throw new Error(`LLM Request Failed: ${response.error}`);
        }

        const plan = interpreter.parseResponse(response.content);

        if (plan.success && plan.data.actions) {
            logger.info(`[${sessionId}] 🧠 AGENT THOUGHT: "${plan.data.thought}"`);

            for (const action of plan.data.actions) {

                // 1. Coordinate Correction (Critical: LLM often hallucinates coords or uses examples)
                if (typeof action.elementId === 'number' && semanticTree && semanticTree.interactiveElements) {
                    const realElement = semanticTree.interactiveElements[action.elementId];
                    if (realElement && realElement.coordinates) {
                        const oldX = action.coordinates ? action.coordinates.x : 'null';
                        const oldY = action.coordinates ? action.coordinates.y : 'null';

                        // Override with ground truth
                        action.coordinates = realElement.coordinates;

                        logger.debug(`[${sessionId}] 🎯 Corrected coordinates for Element ${action.elementId} from (${oldX},${oldY}) to (${action.coordinates.x},${action.coordinates.y})`);
                    }
                }

                logger.info(`[${sessionId}] ▶ EXECUTE: ${action.type} -> ${action.description}`);

                // Move mouse to target first (if coords exist)
                if (action.coordinates) {
                    const viewport = page.viewportSize() || { width: 1280, height: 720 };
                    const startPos = { x: viewport.width / 2, y: viewport.height / 2 };

                    logger.info(`[${sessionId}] 🖱️ Generating humanized mouse path...`);
                    const path = humanizer.generateMousePath(startPos, action.coordinates);

                    // Execute movement
                    // (Simulated speed for demo visibility, normally faster)
                    for (const pt of path.points) {
                        await page.mouse.move(pt.x, pt.y);
                        // No wait here for speed, or tiny wait
                    }
                    logger.success(`[${sessionId}] ✓ Moved to (${action.coordinates.x}, ${action.coordinates.y})`);
                }

                // Perform Action
                if (action.type === 'click') {
                    await page.mouse.down();
                    await page.waitForTimeout(humanizer.generatePause({ min: 50, max: 150 }));
                    await page.mouse.up();
                    logger.success(`[${sessionId}] ✓ Clicked`);

                } else if (action.type === 'type') {
                    // Click to focus first just in case
                    await page.mouse.click(action.coordinates.x, action.coordinates.y);

                    const text = action.text || action.value;
                    logger.info(`[${sessionId}] ⌨️ Typing "${text}" with human timing...`);

                    const timings = humanizer.generateKeystrokeTiming(text);
                    for (const t of timings) {
                        await page.keyboard.press(t.char);
                        await page.waitForTimeout(t.delay);
                    }
                    // Press Enter to search
                    await page.waitForTimeout(500);
                    await page.keyboard.press('Enter');
                    logger.success(`[${sessionId}] ✓ Typed and pressed Enter`);

                } else if (action.type === 'scroll') {
                    const amount = action.amount || 300;
                    const direction = action.direction === 'up' ? -1 : 1;
                    logger.info(`[${sessionId}] 📜 Scrolling ${action.direction} by ${amount}px...`);

                    // Smooth scroll simulation
                    const steps = 5;
                    const stepAmount = (amount * direction) / steps;
                    for (let i = 0; i < steps; i++) {
                        await scrollRandom(page, stepAmount, stepAmount);
                        await page.waitForTimeout(50);
                    }
                    logger.success(`[${sessionId}] ✓ Scrolled`);

                } else if (action.type === 'move') {
                    // Already handled by the initial movement block, just log it
                    logger.success(`[${sessionId}] ✓ Moved to target (Hover)`);

                } else if (action.type === 'read') {
                    const duration = action.duration || 2000;
                    logger.info(`[${sessionId}] 👀 Reading/Thinking for ${duration}ms...`);

                    const startTime = Date.now();
                    const viewport = page.viewportSize() || { width: 1280, height: 720 };

                    while (Date.now() - startTime < duration) {
                        // Move to random point
                        const x = Math.floor(Math.random() * viewport.width);
                        const y = Math.floor(Math.random() * viewport.height);

                        const path = humanizer.generateMousePath(
                            { x: viewport.width / 2, y: viewport.height / 2 }, // current pos approximation
                            { x, y },
                            { steps: 10 }
                        );

                        for (const pt of path.points) {
                            await page.mouse.move(pt.x, pt.y);
                        }
                        await page.waitForTimeout(Math.random() * 500);
                    }
                    logger.success(`[${sessionId}] ✓ Finished reading`);
                }
            }

        } else {
            logger.warn(`[${sessionId}] ⚠ Failed to parse plan. Raw output:\n${response.content}`);
        }

        // 6. Verification Screenshot
        logger.info(`[${sessionId}] Step 6: Waiting 5 seconds...`);
        await page.waitForTimeout(5000); // Requested wait

        logger.info(`[${sessionId}] Step 7: Verifying Result...`);
        await takeScreenshot(page, sessionId, '-Result');
        logger.success(`[${sessionId}] 🎉 DEMO COMPLETE`);

    } catch (error) {
        logger.error(`[${sessionId}] Demo failed:`, error.message);
        throw error;
    }
}

export default testGoogleSearch;
