#!/usr/bin/env node
/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Live Tester for qwen2.5vl:3b Vision Model
 * Interactive testing tool for OWB tile detection with real-time feedback
 * @module qwen-tester
 */

import { createLogger } from './api/core/logger.js';
import { LLMClient } from './api/agent/llmClient.js';
import { api } from './api/index.js';
import { Orchestrator } from './api/core/orchestrator.js';
import { processWithVPrep as _processWithVPrep, VPrepPresets } from './api/utils/vision-preprocessor.js';

const logger = createLogger('qwen-tester.js');

// VPrep preset selection - set via environment or command line
const VPREP_PRESET = process.env.VPREP_PRESET || 'OWB_BLUE_OPTIMIZED';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

/**
 * Create OWB-specific LLM client with qwen2.5vl:3b
 */
async function createOwbClient() {
    const client = new LLMClient();
    await client.init();

    // Override with OWB-specific settings
    client.config = {
        ...client.config,
        model: 'qwen2.5vl:3b',
        maxTokens: 4096,
        contextLength: 8192,
    };

    return client;
}

/**
 * Build the tile detection prompt
 */
function buildPrompt(vprepWidth, vprepHeight) {
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║  IMAGE HAS BEEN PROCESSED: Blue tiles are now BLACK for clarity             ║
╚══════════════════════════════════════════════════════════════════════════════╝

< YOUR JOB > Find ALL grey hex tiles with white numbers that touch BLACK areas.

< MANDATORY: RETURN EXACTLY 3 TARGETS >
You MUST find and return 3 grey tiles with numbers. Scan the ENTIRE map.
If fewer than 3 exist, return all that you find.

< IMAGE SIZE >
This image is ${vprepWidth}x${vprepHeight} pixels.
ALL coordinates must be within this image size.

< VISUAL GUIDE - WHAT YOU SEE IN THIS IMAGE >

⚫ BLACK AREAS (FORBIDDEN - NEVER CLICK):
- Solid black/dark hexagons
- These are YOUR territory (was blue, now masked)
- NO text inside - just pure black

✅ GREY TILES WITH WHITE NUMBER (YOUR TARGETS):
- Grey hexagons with WHITE number: "50", "100", "200", "1200", "Free"
- Must ADJOIN a black area (touch black on at least one edge)
- CLICK THE WHITE NUMBER CENTER

❌ GREY TILES WITHOUT NUMBER:
- Grey hex with NO text
- Not purchasable - skip

❌ GREY TILES NOT TOUCHING BLACK:
- Grey tile with number but isolated
- Can't purchase yet - skip

< WHAT TO RETURN >
Return EXACTLY 3 targets (or all found if fewer):
{"targets": [{"x": <int>, "y": <int>, "price": "<number>"}, {"x": <int>, "y": <int>, "price": "<number>"}, {"x": <int>, "y": <int>, "price": "<number>"}], "found": true}

If fewer found:
{"targets": [{"x": <int>, "y": <int>, "price": "<number>"}, ...], "found": true}

If none found:
{"targets": [], "found": false}

< COORDINATES >
- Target the CENTER of the WHITE NUMBER TEXT
- x must be between 10 and ${vprepWidth - 10}
- y must be between 10 and ${vprepHeight - 10}
- Use whole numbers only

IMPORTANT: Only return the JSON object. RETURN 3 TARGETS.
`.trim();
}

/**
 * Capture and process screenshot
 */
async function captureAndProcess(page, presetName = VPREP_PRESET) {
    const viewport = page.viewportSize();
    const preset = VPrepPresets[presetName] || VPrepPresets.OWB_BLUE_OPTIMIZED;

    logger.info(`${colors.cyan}Capturing screenshot with preset: ${presetName}${colors.reset}`);
    logger.info(`${colors.cyan}Preset config: contrast=${preset.contrast}, quality=${preset.quality}, format=${preset.format || 'jpeg'}${colors.reset}`);

    const state = await api.agent.captureState({
        screenshot: true,
        vprep: true,
        vprepConfig: preset,
    });

    const vprepWidth = state.vprepStats?.outputDimensions?.width || 640;
    const vprepHeight = state.vprepStats?.outputDimensions?.height || 360;

    logger.info(`${colors.cyan}V-PREP: ${vprepWidth}x${vprepHeight}, compression: ${state.vprepStats?.compressionRatio}x${colors.reset}`);

    return {
        screenshot: state.screenshot,
        vprepWidth,
        vprepHeight,
        viewport,
        scale_factor: viewport.width / vprepWidth,
        presetName,
    };
}

/**
 * Query the LLM with screenshot
 */
async function queryLLM(client, screenshot, vprepWidth, vprepHeight) {
    const prompt = buildPrompt(vprepWidth, vprepHeight);

    const messages = [
        {
            role: 'system',
            content: `You are analyzing a hexagonal territory conquest game. The image is ${vprepWidth}x${vprepHeight} pixels. Your job is to find the NUMBER TEXT on purchasable grey tiles. Return the coordinates of the CENTER of the NUMBER TEXT within the ${vprepWidth}x${vprepHeight} image.`
        },
        {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot}` } }
            ]
        }
    ];

    const startTime = Date.now();
    const result = await client.generateCompletion(messages);
    const elapsed = Date.now() - startTime;

    return { result, elapsed };
}

/**
 * Display results in formatted output
 */
function displayResults(llmResult, scale_factor, viewport, presetName) {
    console.log('\n' + colors.bright + colors.cyan + '═══════════════════════════════════════════════════════════════' + colors.reset);
    console.log(colors.bright + '  LLM RESPONSE' + colors.reset);
    console.log(colors.cyan + '═══════════════════════════════════════════════════════════════' + colors.reset);
    console.log(`${colors.yellow}Preset:${colors.reset} ${presetName}`);

    console.log(`\n${colors.green}Raw Response:${colors.reset}`, JSON.stringify(llmResult));

    // Parse targets array or single target
    let targets = [];
    if (llmResult?.targets && Array.isArray(llmResult.targets)) {
        targets = llmResult.targets;
    } else if (llmResult?.found && llmResult?.x !== undefined) {
        targets = [{ x: llmResult.x, y: llmResult.y, price: llmResult.price }];
    }

    if (targets.length > 0) {
        console.log(`\n${colors.bright}${colors.green}✓ ${targets.length} TILE(S) FOUND${colors.reset}`);

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            const browserX = Math.round(t.x * scale_factor);
            const browserY = Math.round(t.y * scale_factor);

            console.log(`\n  ${colors.bright}${colors.cyan}Target ${i + 1}:${colors.reset}`);
            console.log(`    ${colors.yellow}Price:${colors.reset} ${t.price || '?'}`);
            console.log(`    ${colors.yellow}V-PREP coords:${colors.reset} (${t.x}, ${t.y})`);
            console.log(`    ${colors.yellow}Browser coords:${colors.reset} (${browserX}, ${browserY})`);

            // Validate coordinates
            const valid = browserX >= 10 && browserX <= viewport.width - 10 &&
                browserY >= 10 && browserY <= viewport.height - 10;
            console.log(`    ${valid ? colors.green + '✓ Valid' : colors.red + '✗ OUT OF BOUNDS'}${colors.reset}`);
        }

        console.log(`\n  ${colors.yellow}Scale factor:${colors.reset} ${scale_factor.toFixed(3)}`);
    } else {
        console.log(`\n${colors.red}✗ NO TILES FOUND${colors.reset}`);
    }

    console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════════════════' + colors.reset);
}

/**
 * Main test loop
 */
async function runLiveTest() {
    console.log('\n' + colors.bright + colors.magenta +
        '╔═══════════════════════════════════════════════════════════════╗\n' +
        '║         QWEN2.5VL:3B LIVE TESTER - OWB TILE DETECTION        ║\n' +
        '╚═══════════════════════════════════════════════════════════════╝' +
        colors.reset + '\n');

    logger.info('Initializing...');

    // Create OWB-specific LLM client
    const client = await createOwbClient();
    logger.info(`${colors.green}✓ LLM Client: ${client.config.model}${colors.reset}`);

    // Connect to browser
    const orchestrator = new Orchestrator();
    await orchestrator.startDiscovery();

    const sessionManager = orchestrator.sessionManager;
    if (sessionManager.idleSessionsCount === 0) {
        logger.error('No browsers found. Please start a browser first.');
        process.exit(1);
    }

    logger.info(`${colors.green}✓ Connected to ${sessionManager.idleSessionsCount} browser(s)${colors.reset}`);

    const session = sessionManager.getIdleSession();
    const contexts = session.browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await session.browser.newContext();
    const pages = context.pages();
    let page = pages.find(p => !p.isClosed());

    if (!page) {
        page = await context.newPage();
    }

    await api.init(page);
    logger.info(`${colors.green}✓ Page initialized: ${page.url()}${colors.reset}`);

    const viewport = page.viewportSize();
    logger.info(`${colors.green}✓ Viewport: ${viewport.width}x${viewport.height}${colors.reset}`);

    console.log('\n' + colors.bright + colors.yellow +
        '┌─────────────────────────────────────────────────────────────┐\n' +
        '│ Commands:                                                    │\n' +
        '│   [Enter]  - Capture and analyze                             │\n' +
        '│   [c]      - Capture, analyze, and CLICK                     │\n' +
        '│   [1]      - Switch to OWB_GAME preset (contrast 1.1)        │\n' +
        '│   [2]      - Switch to OWB_BLUE_OPTIMIZED preset (PNG)       │\n' +
        '│   [3]      - Switch to OWB_TOKEN_SAVING preset               │\n' +
        '│   [q]      - Quit                                            │\n' +
        '└─────────────────────────────────────────────────────────────┘' +
        colors.reset + '\n');

    // Main loop
    let iteration = 0;
    let currentPreset = VPREP_PRESET;
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const askQuestion = () => new Promise((resolve) => {
        rl.question(`${colors.bright}${colors.blue}[${iteration}] Preset: ${currentPreset} | Enter to capture (c=click, 1/2/3=preset, q=quit): ${colors.reset}`, resolve);
    });

    while (true) {
        const answer = await askQuestion();
        const input = answer.trim().toLowerCase();

        if (input === 'q') {
            console.log(`${colors.yellow}Exiting...${colors.reset}`);
            break;
        }

        // Handle preset switching
        if (input === '1') {
            currentPreset = 'OWB_GAME';
            console.log(`${colors.green}Switched to preset: ${currentPreset}${colors.reset}`);
            continue;
        }
        if (input === '2') {
            currentPreset = 'OWB_BLUE_OPTIMIZED';
            console.log(`${colors.green}Switched to preset: ${currentPreset}${colors.reset}`);
            continue;
        }
        if (input === '3') {
            currentPreset = 'OWB_TOKEN_SAVING';
            console.log(`${colors.green}Switched to preset: ${currentPreset}${colors.reset}`);
            continue;
        }

        const shouldClick = input === 'c';
        iteration++;

        try {
            // Capture and process
            const { screenshot, vprepWidth, vprepHeight, scale_factor, presetName } = await captureAndProcess(page, currentPreset);

            // Query LLM
            console.log(`${colors.cyan}Sending to ${client.config.model}...${colors.reset}`);
            const { result: llmResult, elapsed } = await queryLLM(client, screenshot, vprepWidth, vprepHeight);

            console.log(`${colors.green}Response time: ${elapsed}ms${colors.reset}`);

            // Display results
            displayResults(llmResult, scale_factor, viewport, presetName);

            // Click if requested
            if (shouldClick && llmResult?.found) {
                const browserX = Math.round(llmResult.x * scale_factor);
                const browserY = Math.round(llmResult.y * scale_factor);

                const valid = browserX >= 10 && browserX <= viewport.width - 10 &&
                    browserY >= 10 && browserY <= viewport.height - 10;

                if (valid) {
                    // CRITICAL: Validate NOT blue before clicking
                    try {
                        const pixelColor = await page.evaluate(([px, py]) => {
                            const canvas = document.querySelector('canvas');
                            if (canvas) {
                                const ctx = canvas.getContext('2d');
                                if (ctx) {
                                    const pixel = ctx.getImageData(px, py, 1, 1).data;
                                    return { r: pixel[0], g: pixel[1], b: pixel[2] };
                                }
                            }
                            return null;
                        }, [browserX, browserY]);

                        if (pixelColor) {
                            const { r, g, b } = pixelColor;
                            const isBlue = (b > 100) && (b > r * 1.3) && (b > g * 1.2);
                            console.log(`${colors.cyan}Pixel at (${browserX}, ${browserY}): RGB(${r},${g},${b})${colors.reset}`);

                            if (isBlue) {
                                console.log(`${colors.red}✗ FORBIDDEN: Target is BLUE - cannot click!${colors.reset}`);
                                continue;
                            }
                        }
                    } catch (e) {
                        console.log(`${colors.yellow}⚠ Could not validate pixel color: ${e.message}${colors.reset}`);
                    }

                    console.log(`${colors.magenta}Clicking at (${browserX}, ${browserY})...${colors.reset}`);
                    await api.clickAt(browserX, browserY);
                    console.log(`${colors.green}✓ Clicked!${colors.reset}`);

                    // Wait and take after screenshot
                    await new Promise(r => setTimeout(r, 2000));
                    const afterBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
                    const _afterBase64 = afterBuffer.toString('base64');
                    console.log(`${colors.cyan}After-click screenshot captured${colors.reset}`);
                } else {
                    console.log(`${colors.red}✗ Cannot click - coordinates out of bounds${colors.reset}`);
                }
            }

        } catch (error) {
            console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
        }
    }

    rl.close();
    await orchestrator.shutdown();
    console.log(`${colors.green}Done.${colors.reset}`);
}

// Run if executed directly
const isMain = process.argv[1] && process.argv[1].endsWith('qwen-tester.js');
if (isMain) {
    runLiveTest().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { runLiveTest, createOwbClient, queryLLM };
