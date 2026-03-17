/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview OWB Agent Runner
 * Auto-play strategy games with predefined rules.
 * Usage: node agent-main.js owb
 * @module agent-main
 */

import 'dotenv/config';
import { createLogger } from './api/core/logger.js';
import { showBanner } from './api/utils/banner.js';
import Orchestrator from './api/core/orchestrator.js';
import { ensureDockerLLM } from './api/utils/dockerLLM.js';
import { api } from './api/index.js';
import { llmClient } from './api/agent/index.js';
import owbAgents from './owb-agents.js';
import { STRATEGIES as _STRATEGIES, GAME_CONFIG, LLM_CONFIG } from './owb-config.js';
import { configManager } from './api/core/config.js';

const logger = createLogger('agent-main.js');

// Global reference for signal handlers to access
let globalOrchestrator = null;
let isShuttingDown = false;

/**
 * Graceful shutdown handler - closes all browsers before exit
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.info(`[Shutdown] Already shutting down, ignoring ${signal}...`);
        return;
    }
    isShuttingDown = true;
    logger.info(`[Shutdown] Received ${signal}. Closing browsers and cleaning up...`);

    try {
        if (globalOrchestrator) {
            await globalOrchestrator.shutdown();
            logger.info('[Shutdown] Orchestrator shutdown complete.');
        }
    } catch (error) {
        logger.error('[Shutdown] Error during shutdown:', error.message);
    }

    process.exit(0);
}

/**
 * Set the LLM model to use
 * @param {string} modelName - Model name (e.g., 'qwen3.5:4b')
 */
async function setLLMModel(modelName) {
    const modelToUse = modelName || LLM_CONFIG.defaultModel;

    try {
        await configManager.init();
        const _currentConfig = configManager.get('agent.llm') || {};

        configManager.setOverride('agent.llm.model', modelToUse);
        configManager.setOverride('agent.llm.textModel', modelToUse);
        configManager.setOverride('agent.llm.think', false);

        llmClient.config = null;

        logger.info(`LLM model set to: ${modelToUse} (from owb-config: ${LLM_CONFIG.defaultModel})`);
    } catch (e) {
        logger.warn(`Could not set model: ${e.message}`);
    }
}

function showHelp() {
    console.log(`
OWB - Open World Browser Agent Runner
=====================================

Usage:
  node agent-main.js owb [mode] [options]

Modes (auto-play strategies):
  owb rush      - Aggressive early game
  owb turtle   - Defensive: build walls, grow economy, counter
  owb economy  - Focus on resources first
  owb balanced - Mix of economy and military
  
  owb play     - Auto-play with default strategy (finite loops)
  owb play=rush - Auto-play with rush strategy

  owb build=X   - Build structure X
  owb train=X   - Train X units
  owb attack    - Attack enemy
  owb gather    - Gather resources

Options:
  --loops=N     - Number of loops (default: infinite)
  --model=NAME  - LLM model to use (default: ${LLM_CONFIG.defaultModel})
  --exit        - Auto-exit when done (close browser and process)
  --help        - Show this help

 Default Behavior:
   node agent-main.js owb    - Runs INFINITE auto-play loop (Ctrl+C to stop)

 Examples:
   node agent-main.js owb                    # Infinite loop (default)
   node agent-main.js owb play --loops=10    # Finite loops
   node agent-main.js owb play=rush          # Infinite with rush strategy
   node agent-main.js owb rush --loops=5     # 5 loops with rush
   node agent-main.js owb state-a            # Run state A once
   node agent-main.js owb state-a --exit     # Run state A and exit
   node agent-main.js owb state-c            # Run state C once
   node agent-main.js owb state-d            # Run state D once
   node agent-main.js owb state-e            # Run state E once
   node agent-main.js owb balanced --model=qwen3.5:4b
`);
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
    const result = {
        mode: 'playInfinite',  // Default to infinite loop
        strategy: GAME_CONFIG.defaultStrategy,
        target: null,
        model: LLM_CONFIG.defaultModel,
        config: {
            maxSteps: 30,
            stepDelay: 500,
            stuckDetection: true,
            maxAttemptsWithoutChange: 5,
            verifyAction: true,
        },
        browsers: [],
        loops: GAME_CONFIG.maxLoops,
        exitOnComplete: false,  // Don't exit by default for infinite loop
        repeat: 1,  // Number of times to repeat the action
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }

        if (arg.startsWith('--')) {
            if (arg.startsWith('--browsers=')) {
                result.browsers = arg.split('=')[1].split(',');
            } else if (arg.startsWith('--loops=')) {
                result.loops = parseInt(arg.split('=')[1], 10);
            } else if (arg.startsWith('--model=')) {
                result.model = arg.split('=')[1].trim();
            } else if (arg === '--debug' || arg === '-d') {
                process.env.DEBUG = 'true';
                logger.info('[DEBUG] Debug mode enabled - visual overlay will be active');
            }
            continue;
        }

        if (arg === 'owb') {
            // Default: infinite loop
            result.mode = 'playInfinite';
            continue;
        }

        if (arg === 'owb play') {
            // Explicit play mode - check if loops specified
            if (result.loops !== GAME_CONFIG.maxLoops) {
                result.mode = 'play';  // Finite loops if --loops specified
            } else {
                result.mode = 'playInfinite';  // Default to infinite
            }
            continue;
        }

        if (arg.startsWith('owb play=')) {
            result.mode = 'playInfinite';
            result.strategy = arg.split('=')[1].trim() || result.strategy;
            continue;
        }

        if (arg === 'play') {
            result.mode = 'playInfinite';
            continue;
        }

        if (arg === 'owb rush' || arg === 'rush') {
            result.mode = 'play';
            result.strategy = 'rush';
            continue;
        }

        if (arg === 'owb turtle' || arg === 'turtle') {
            result.mode = 'play';
            result.strategy = 'turtle';
            continue;
        }

        if (arg === 'owb economy' || arg === 'economy') {
            result.mode = 'play';
            result.strategy = 'economy';
            continue;
        }

        if (arg === 'owb balanced' || arg === 'balanced') {
            result.mode = 'play';
            result.strategy = 'balanced';
            continue;
        }

        if (arg.startsWith('owb state-') || arg.startsWith('state-')) {
            result.mode = 'state';
            result.target = arg.replace('owb ', '').replace('state-', '').toUpperCase();
            continue;
        }

        // Parse repeat count: x20, x5, etc.
        if (arg.startsWith('x') && /^\d+$/.test(arg.substring(1))) {
            result.repeat = parseInt(arg.substring(1), 10);
            continue;
        }

        if (arg.startsWith('owb build=') || arg.startsWith('build=')) {
            result.mode = 'build';
            result.target = arg.split('=')[1].trim();
            continue;
        }

        if (arg.startsWith('owb train=') || arg.startsWith('train=')) {
            result.mode = 'train';
            result.target = arg.split('=')[1].trim();
            continue;
        }

        if (arg === 'owb attack' || arg === 'attack') {
            result.mode = 'attack';
            continue;
        }

        if (arg === 'owb gather' || arg === 'gather') {
            result.mode = 'gather';
            continue;
        }
    }

    return result;
}

/**
 * Main entry point
 */
(async () => {
    showBanner();

    logger.info('OWB Agent Runner - Starting...');

    const args = parseArgs(process.argv.slice(2));

    logger.info(`Mode: ${args.mode}`);
    logger.info(`Strategy: ${args.strategy}`);
    logger.info(`Model: ${args.model}`);

    try {
        // Set the LLM model before initializing
        await setLLMModel(args.model);

        logger.info('Checking Docker LLM status...');
        const dockerReady = await ensureDockerLLM();
        if (!dockerReady) {
            logger.warn('Docker LLM not ready. Will use cloud fallback.');
        }

        const orchestrator = new Orchestrator();
        globalOrchestrator = orchestrator; // Expose for signal handlers

        logger.info('Discovering browsers...');
        await orchestrator.startDiscovery({ browsers: args.browsers });

        const sessionManager = orchestrator.sessionManager;

        if (sessionManager.idleSessionsCount === 0) {
            logger.error('No browsers found. Please start a browser first.');
            process.exit(1);
        }

        logger.info(`Connected to ${sessionManager.idleSessionsCount} browser(s).`);

        const session = sessionManager.getIdleSession();
        if (!session) {
            logger.error('No available session.');
            process.exit(1);
        }

        logger.info(`Using session: ${session.id}`);

        const contexts = session.browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await session.browser.newContext();
        const pages = context.pages();
        let page = pages.find(p => !p.isClosed());

        if (!page) {
            logger.info('No existing tab found. Creating new page...');
            page = await context.newPage();
        } else {
            logger.info(`Using existing tab: ${page.url()}`);
        }

        const viewport = page.viewportSize();
        logger.info(`[Browser] Viewport size: ${viewport?.width}x${viewport?.height}`);

        if (!page) {
            logger.error('No page available in session.');
            process.exit(1);
        }

        logger.info(`Current URL: ${page.url()}`);

        logger.info('Initializing API context...');
        await api.init(page);

        logger.info('========================================');

        let result;

        await api.withPage(page, async () => {
            switch (args.mode) {
                case 'play':
                    logger.info(`Starting Auto-Play: ${args.strategy.toUpperCase()}`);
                    logger.info(`Loops: ${args.loops}`);
                    result = await owbAgents.autoPlay(args.strategy, { maxLoops: args.loops });
                    break;

                case 'playInfinite':
                    logger.info(`Starting Infinite Auto-Play: ${args.strategy.toUpperCase()}`);
                    logger.info('Press Ctrl+C to stop');
                    await owbAgents.autoPlayInfinite(args.strategy);
                    result = { success: true };
                    break;

                case 'build':
                    logger.info(`Building: ${args.target}`);
                    result = await owbAgents.buildStructure(args.target);
                    break;

                case 'state': {
                    const stateKey = args.target || 'A';
                    logger.info(`Running State: ${stateKey} - ${owbAgents.STATES[stateKey]?.desc || 'unknown'}`);
                    logger.info(`Repeat count: ${args.repeat}`);

                    for (let i = 0; i < args.repeat; i++) {
                        logger.info(`\n--- Iteration ${i + 1}/${args.repeat} ---`);
                        await owbAgents.debugScreenshot(`state-${stateKey}-before-${i + 1}`);

                        result = await owbAgents.executeState({ key: stateKey, ...owbAgents.STATES[stateKey] });

                        // Verify the action completed successfully
                        if (result?.success) {
                            logger.info(`✅ Iteration ${i + 1} completed successfully`);
                            await owbAgents.debugScreenshot(`state-${stateKey}-success-${i + 1}`);
                        } else {
                            logger.warn(`❌ Iteration ${i + 1} failed - no valid action taken`);
                            await owbAgents.debugScreenshot(`state-${stateKey}-failed-${i + 1}`);
                            // Continue to next iteration instead of stopping
                            // This allows retrying on failure
                        }

                        // Delay between iterations to let game settle
                        if (i < args.repeat - 1) {
                            logger.info(`Waiting 2s before next iteration...`);
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                    break;
                }

                case 'train': {
                    logger.info(`Training: ${args.target}`);
                    const trainCount = parseInt(args.target) || 1;
                    result = await owbAgents.trainUnits('footman', trainCount);
                    break;
                }

                case 'attack':
                    logger.info('Attacking enemy...');
                    result = await owbAgents.attack('enemy');
                    break;

                case 'gather':
                    logger.info('Gathering resources...');
                    result = await owbAgents.gatherResources('gold', 30000);
                    break;

                default:
                    logger.info('Starting default auto-play...');
                    result = await owbAgents.autoPlay(args.strategy, { maxLoops: args.loops });
            }
        });

        logger.info('========================================');
        logger.info('RESULT:', result);
        logger.info('========================================');

        if (args.exitOnComplete) {
            logger.info('Stopping orchestrator...');
            await orchestrator.shutdown();
            logger.info('Done. Browser left open for manual use.');
            process.exit(0);
        } else {
            logger.info('Keeping browser open...');
            logger.info('Press Ctrl+C to exit.');
            await new Promise(() => { });
        }

    } catch (error) {
        logger.error('Agent execution failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error.message);
    console.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
    logger.error('Unhandled Promise Rejection:', reason);
    process.exit(1);
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
