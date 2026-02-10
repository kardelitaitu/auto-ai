/**
 * @fileoverview Generic Runner for Browser Tasks.
 * Dynamically loads a task file and executes its 'run' function with a Playwright page.
 * Usage: node main-browser-use.js <path/to/task.js> [arg1] [arg2] ...
 */

import Orchestrator from './core/orchestrator.js';
import { createLogger } from './utils/logger.js';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import llmClient from './local-agent/network/llmClient.js';

const logger = createLogger('main-browser-use.js');

// Helper to load settings
function loadSettings() {
    try {
        const settingsPath = path.resolve(process.cwd(), 'config/settings.json');
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (error) {
        logger.warn('Failed to load settings.json, utilizing defaults.', error);
    }
    return {};
}

// Simple concurrency limiter helper
async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }

        const p = Promise.resolve().then(() => task());
        results.push(p);

        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
    }
    return Promise.all(results);
}

async function main() {
    const taskFilesInput = process.argv.slice(2);
    let orchestrator = null;
    const pages = new Set(); // Track all opened pages for cleanup (using Set for O(1) delete)

    // Centralized Cleanup Function
    const cleanup = async (exitCode = 0) => {
        logger.info(`Shutting down... (Exit Code: ${exitCode})`);

        // Close all tracked pages
        if (pages.size > 0) {
            logger.info(`Closing ${pages.size} active pages...`);
            for (const page of pages) {
                await page.close().catch(() => { });
            }
            pages.clear();
        }

        // Shutdown Orchestrator
        if (orchestrator) {
            await orchestrator.shutdown(true).catch(err => logger.error('Error closing orchestrator:', err));
        }

        process.exit(exitCode);
    };

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info("\nReceived SIGINT (Ctrl+C).");
        await cleanup(0);
    });

    // Handle unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        // optional: cleanup(1);
    });

    try {
        if (taskFilesInput.length === 0) {
            console.error('Usage: node main-browser-use.js <taskFile1> [taskFile2] [taskFile3] ...');
            await cleanup(1);
            return;
        }

        const settings = loadSettings();
        const concurrency = settings.concurrencyPerBrowser || 5;
        logger.info(`Configuration: Concurrency per browser = ${concurrency}`);

        logger.info(`Initializing Runner for ${taskFilesInput.length} task(s)`);

        // Initialize orchestrator
        orchestrator = new Orchestrator();

        // 1. Discover & Connect
        await orchestrator.startDiscovery();

        // 2. Get Sessions
        await new Promise(resolve => setTimeout(resolve, 1000));
        const sessions = orchestrator.sessionManager.getAllSessions();
        if (sessions.length === 0) {
            throw new Error('No browsers found or connected.');
        }

        // Global Pre-flight Check for LLM
        await llmClient.ensureModelRunning();

        // 3. Load ALL task modules first
        const loadedTasks = [];
        for (let i = 0; i < taskFilesInput.length; i++) {
            const taskFile = taskFilesInput[i];
            const absolutePath = path.resolve(process.cwd(), taskFile);
            const fileUrl = pathToFileURL(absolutePath).href;

            logger.info(`Loading task module ${i + 1}/${taskFilesInput.length}: ${taskFile}`);
            const taskModule = await import(fileUrl);

            if (!taskModule.run) {
                throw new Error(`Task module ${taskFile} does not export a 'run' function.`);
            }
            loadedTasks.push({ file: taskFile, module: taskModule });
        }

        // 4. Execute Tasks with Concurrency
        const allSessionPromises = sessions.map(async (session) => {
            const context = session.browser.contexts()[0];

            // Prepare the list of async task runners for this session
            const sessionTasks = loadedTasks.map(({ file, module }) => async () => {
                let page = null;
                try {
                    page = await context.newPage();
                    pages.add(page);

                    logger.info(`Launching ${path.basename(file)} on Session ${session.id}`);
                    await module.run(page, [], { sessionId: session.id, taskName: path.basename(file) });
                    logger.info(`✓ [${session.id}] Task completed: ${path.basename(file)}`);

                } catch (error) {
                    logger.error(`✗ [${session.id}] Task failed: ${path.basename(file)} - ${error.message}`);
                    // We don't re-throw here to allow other tasks to continue
                } finally {
                    if (page) {
                        pages.delete(page);
                        await page.close().catch(() => { });
                    }
                }
            });

            // Execute tasks for this specific session with concurrency limit
            await runWithConcurrency(sessionTasks, concurrency);
        });

        logger.info(`🚀 Starting execution across ${sessions.length} browsers...`);

        await Promise.all(allSessionPromises);

        logger.info('✓ All tasks finished.');
        await cleanup(0);

    } catch (error) {
        logger.error('Fatal Error:', error);
        await cleanup(1);
    }
}

main();
