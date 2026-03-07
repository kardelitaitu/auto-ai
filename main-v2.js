/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Main entry point V2 - Robust orchestrator with timeout handling.
 * Usage: node main-v2.js pageview=cookiebot then api-twitteractivity
 * Flags: --task-timeout=600000 --group-timeout=600000 --force-shutdown
 * @module main-v2
 */

import 'dotenv/config';
import { createLogger } from './api/core/logger.js';
import { showBanner } from './api/utils/banner.js';
import Orchestrator from './api/core/orchestrator.js';
import { ensureDockerLLM } from './api/utils/dockerLLM.js';
import { getSettings } from './api/utils/configLoader.js';

const logger = createLogger('main-v2.js');

const DEFAULT_TASK_TIMEOUT = 600000; // 10 min per task
const DEFAULT_GROUP_TIMEOUT = 600000; // 10 min per group
const MAX_PROCESS_TIMEOUT = 1800000; // 30 min max for entire process

(async () => {
    showBanner();
    logger.info('[V2] MultiBrowseAutomation - Starting (Robust Mode)...');

    const args = process.argv.slice(2);
    let orchestrator;

    let taskTimeoutMs = DEFAULT_TASK_TIMEOUT;
    let groupTimeoutMs = DEFAULT_GROUP_TIMEOUT;
    let forceShutdown = false;

    const parsedArgs = [];
    for (const arg of args) {
        if (arg.startsWith('--task-timeout=')) {
            taskTimeoutMs = parseInt(arg.split('=')[1], 10) || DEFAULT_TASK_TIMEOUT;
        } else if (arg.startsWith('--group-timeout=')) {
            groupTimeoutMs = parseInt(arg.split('=')[1], 10) || DEFAULT_GROUP_TIMEOUT;
        } else if (arg === '--force-shutdown') {
            forceShutdown = true;
        } else if (arg.startsWith('--browsers=')) {
            // Skip --browsers, handled in orchestrator
        } else {
            parsedArgs.push(arg);
        }
    }

    logger.info(`[V2] Timeouts - Task: ${taskTimeoutMs}ms, Group: ${groupTimeoutMs}ms`);
    logger.info(`[V2] Force shutdown: ${forceShutdown}`);

    try {
        logger.info('[V2] Checking Docker LLM...');
        const dockerReady = await ensureDockerLLM();
        if (!dockerReady) {
            logger.warn('[V2] Docker LLM not ready, will fallback to cloud');
        }

        orchestrator = new Orchestrator({
            taskTimeoutMs,
            groupTimeoutMs,
            workerWaitTimeoutMs: 30000,
        });

        const browsersArg = parsedArgs.find((arg) => arg.startsWith('--browsers='));
        const browserList = browsersArg ? browsersArg.split('=')[1].split(',') : [];

        const tasksToRun = parsedArgs.filter((arg) => !arg.startsWith('--'));

        const settings = await getSettings();
        if (settings?.ui?.dashboard?.enabled) {
            await orchestrator.startDashboard(settings.ui.dashboard.port || 3001);
        }

        const maxRetries = 3;
        let attempt = 1;
        let connectedCount = 0;

        while (attempt <= maxRetries) {
            if (attempt > 1) logger.info(`[V2] Discovery attempt ${attempt}/${maxRetries}...`);

            await orchestrator.startDiscovery({ browsers: browserList });
            connectedCount = orchestrator.sessionManager.activeSessionsCount;

            if (connectedCount > 0) break;

            if (attempt < maxRetries) {
                logger.warn(`[V2] No browsers on attempt ${attempt}, retrying in 5s...`);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
            attempt++;
        }

        const sessionManager = orchestrator.sessionManager;

        if (sessionManager.idleSessionsCount === 0) {
            logger.warn('[V2] No browsers discovered. Tasks may fail.');
        } else {
            logger.info(`[V2] Connected to ${sessionManager.idleSessionsCount} browser(s)`);
        }

        if (tasksToRun.length === 0) {
            logger.info('[V2] No tasks specified. Idle mode.');
        } else {
            const taskGroups = [];
            let currentGroup = [];

            tasksToRun.forEach((arg) => {
                if (arg.toLowerCase() === 'then') {
                    if (currentGroup.length > 0) {
                        taskGroups.push(currentGroup);
                        currentGroup = [];
                    }
                } else {
                    currentGroup.push(arg);
                }
            });
            if (currentGroup.length > 0) {
                taskGroups.push(currentGroup);
            }

            logger.info(`[V2] Processing ${taskGroups.length} sequential task groups`);

            const overallStartTime = Date.now();

            for (let i = 0; i < taskGroups.length; i++) {
                if (MAX_PROCESS_TIMEOUT && Date.now() - overallStartTime >= MAX_PROCESS_TIMEOUT) {
                    logger.error(
                        `[V2] Overall process timeout (${MAX_PROCESS_TIMEOUT}ms) exceeded`
                    );
                    break;
                }

                const group = taskGroups[i];
                const groupStartTime = Date.now();

                logger.info(`[V2] Group ${i + 1}/${taskGroups.length}: ${JSON.stringify(group)}`);

                let currentTask = null;
                let currentPayload = {};

                group.forEach((arg) => {
                    const firstEqualIndex = arg.indexOf('=');

                    if (firstEqualIndex > 0) {
                        const key = arg.substring(0, firstEqualIndex);
                        let value = arg.substring(firstEqualIndex + 1);
                        if (value.startsWith('"') && value.endsWith('"'))
                            value = value.slice(1, -1);

                        const isNewTaskShorthand = currentTask && key === currentTask;

                        if (!currentTask || isNewTaskShorthand) {
                            if (isNewTaskShorthand) {
                                orchestrator.addTask(currentTask, currentPayload);
                            }
                            currentTask = key.endsWith('.js') ? key.slice(0, -3) : key;

                            let urlValue = value;
                            if (
                                urlValue &&
                                !urlValue.includes('://') &&
                                (urlValue.includes('.') || urlValue === 'localhost')
                            ) {
                                urlValue = 'https://' + urlValue;
                            }
                            currentPayload = { url: urlValue };
                        } else {
                            let paramValue = value;
                            if (
                                key === 'url' &&
                                paramValue &&
                                !paramValue.includes('://') &&
                                (paramValue.includes('.') || paramValue === 'localhost')
                            ) {
                                paramValue = 'https://' + paramValue;
                            }
                            currentPayload[key] = paramValue;
                        }
                    } else {
                        if (currentTask) {
                            orchestrator.addTask(currentTask, currentPayload);
                        }
                        currentTask = arg.endsWith('.js') ? arg.slice(0, -3) : arg;
                        currentPayload = {};
                    }
                });

                if (currentTask) {
                    orchestrator.addTask(currentTask, currentPayload);
                }

                logger.info(
                    `[V2] Group ${i + 1} tasks queued. Waiting (timeout: ${groupTimeoutMs}ms)...`
                );

                const result = await orchestrator.waitForTasksToComplete({
                    timeoutMs: groupTimeoutMs,
                });

                const groupDuration = Date.now() - groupStartTime;

                if (result.timedOut) {
                    logger.error(`[V2] Group ${i + 1} TIMED OUT after ${groupDuration}ms`);
                    const activeTasks = orchestrator.getActiveTasks();
                    if (activeTasks.length > 0) {
                        logger.warn(`[V2] Active tasks that were cancelled:`);
                        activeTasks.forEach((t) =>
                            logger.warn(`  - ${t.taskName} (elapsed: ${t.elapsed}ms)`)
                        );
                    }
                } else {
                    logger.info(`[V2] Group ${i + 1} completed in ${groupDuration}ms`);
                }
            }
        }
    } catch (error) {
        logger.error('[V2] Unexpected error:', error);
        console.error(error.stack);
    } finally {
        logger.info('[V2] Shutting down...');
        if (orchestrator) {
            await orchestrator.shutdown(forceShutdown);
        }
        process.exit(0);
    }
})();

process.on('uncaughtException', (error) => {
    logger.error('[V2] Uncaught Exception:', error.message);
    console.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
    logger.error('[V2] Unhandled Promise Rejection:', reason);
    process.exit(1);
});

process.on('SIGINT', async () => {
    logger.info('[V2] Received SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('[V2] Received SIGTERM, shutting down...');
    process.exit(0);
});
