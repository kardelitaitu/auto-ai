/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import Orchestrator from './api/core/orchestrator.js';
import { createLogger } from './api/core/logger.js';
import { getSettings } from './api/utils/configLoader.js';

const logger = createLogger('verify-timeout.js');

async function run() {
    logger.info('Starting timeout verification...');

    const orchestrator = new Orchestrator();
    // Force a short timeout for the test
    orchestrator.taskMaxDurationMs = 3000;

    const task = {
        taskName: 'hanging-test-task',
        modulePath: './tasks/hanging-test-task.js',
        payload: { hangTime: 10000 },
    };

    logger.info('Adding hanging task to orchestrator...');

    try {
        const mockSession = {
            id: 'test-session',
            browserInfo: 'test-browser',
            currentTaskName: '',
            currentProcessing: '',
        };

        const mockContext = {
            on: () => {},
            grantPermissions: async () => {},
            clearPermissions: async () => {},
            addInitScript: async () => {},
            cookies: async () => [],
            setCookies: async () => {},
            clearCookies: async () => {},
        };

        const mockPage = {
            close: async () => logger.info('Mock page closed'),
            isClosed: () => false,
            on: () => {},
            once: () => {},
            off: () => {},
            removeAllListeners: () => {},
            url: () => 'about:blank',
            context: () => mockContext,
            evaluate: async () => 'test-ua',
            emulateMedia: async () => {},
            route: async () => {},
            setMuted: async () => {},
            waitForLoadState: async () => {},
            mouse: {
                move: async () => {},
                click: async () => {},
                down: async () => {},
                up: async () => {},
            },
            keyboard: {
                type: async () => {},
                press: async () => {},
                down: async () => {},
                up: async () => {},
            },
        };

        // Mock sessionManager methods
        orchestrator.sessionManager.acquireWorker = async () => 1;
        orchestrator.sessionManager.releaseWorker = (sid, wid) =>
            logger.info(`Worker ${wid} released for session ${sid}`);
        orchestrator.sessionManager.getSession = () => mockSession;

        logger.info('Executing task (should timeout in 3s)...');
        // We wrap executeTask to see if it catches the timeout internally
        await orchestrator.executeTask(task, mockPage, mockSession);

        // Orchestrator logs the error but doesn't rethrow.
        // We can check the recorded outcome if we want, or just rely on console output.
        logger.info('executeTask call finished. Check logs above for "TaskTimeoutError".');
    } catch (error) {
        logger.error(`FAILED: Caught unexpected error in verify script: ${error.stack}`);
    } finally {
        setTimeout(() => process.exit(0), 1000);
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
