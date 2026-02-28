/**
 * @fileoverview LLM Service Manager - Checks and starts Local LLM service.
 * Supports: 'docker model' (legacy) and 'ollama' (standard).
 * @module utils/dockerLLM
 */

import { createLogger } from './logger.js';
import { getSettings } from './configLoader.js';
import { exec } from 'child_process';
// import { promisify } from 'util';

// const execAsync = promisify(exec);
const logger = createLogger('localLLM.js');

/**
 * Check if Local LLM is ready (hitting the API).
 * @returns {Promise<boolean>} True if API responds.
 */
async function isLocalLLMReady() {
    try {
        const settings = await getSettings();
        const endpoint = settings.llm?.local?.endpoint || 'http://localhost:11434';

        // Base URL adjustment
        const baseUrl = endpoint.replace(/\/api\/.*$/, '');

        logger.debug(`[LocalLLM] Checking API at ${baseUrl}...`);

        // Try simple health check
        const response = await fetch(`${baseUrl}/`, {
            signal: AbortSignal.timeout(2000)
        });

        if (response.ok) {
            logger.success(`[LocalLLM] ✓ Service is ready at ${baseUrl}`);
            return true;
        }
        return false;
    } catch (e) {
        logger.debug(`[LocalLLM] API check failed: ${e.message}`);
        return false;
    }
}

/**
 * Start the Local LLM service based on provider.
 * Simplified: Just check if already running, don't try to start.
 */
async function startLocalLLM() {
    try {
        const settings = await getSettings();
        const provider = settings.llm?.local?.provider || 'ollama';
        const model = settings.llm?.local?.model || 'llama3.2-vision';
        
        // Just check if already running - don't try to start
        logger.info(`[LocalLLM] Checking if ${provider} is already running...`);
        
        if (provider === 'ollama') {
            return await new Promise((resolve) => {
                exec('ollama serve', () => resolve(true));
            });
        }
        
        if (provider === 'docker') {
            return await new Promise((resolve) => {
                exec(`docker model run ${model}`, () => resolve(true));
            });
        }
        
        return false;
    } catch (e) {
        logger.warn(`[LocalLLM] Check failed: ${e.message}`);
        return false;
    }
}

/**
 * Main entry point: Check and ensure LLM is running.
 */
export async function ensureDockerLLM() {
    // Check if local LLM is disabled in config
    const settings = await getSettings();
    if (settings.llm?.local?.enabled === false) {
        logger.info('[LocalLLM] Local LLM is disabled in config, skipping initialization');
        return false;
    }
    
    // Renamed internally but keeping export name for main.js compatibility
    logger.info('[LocalLLM] Checking local LLM status...');

    if (await isLocalLLMReady()) {
        return true;
    }

    logger.warn('[LocalLLM] Service not responding. Attempting to start...');
    await startLocalLLM();

    // Verify again
    let attempts = 0;
    while (attempts < 5) {
        attempts++;
        if (await isLocalLLMReady()) return true;
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    logger.error('[LocalLLM] Failed to start local LLM service.');
    return false;
}

export default {
    ensureDockerLLM
};
