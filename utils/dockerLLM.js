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
 */
async function startLocalLLM() {
    try {
        const settings = await getSettings();
        const provider = settings.llm?.local?.provider || 'ollama';
        const model = settings.llm?.local?.model || 'llama3.2-vision';

        logger.info(`[LocalLLM] Starting service for provider: ${provider}...`);

        if (provider === 'ollama') {
            // Try starting standard Ollama
            logger.info(`[LocalLLM] Attempting to start Ollama server and load model ${model}...`);
            // 'ollama serve' starts the background service
            // 'ollama run model' ensures the service is running AND the model is loaded/pulled
            exec('start /B ollama serve', { windowsHide: true });
            
            // Give the server a moment to start before asking for the model
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // This will pull if missing and load into memory
            exec(`start /B ollama run ${model} ""`, { windowsHide: true });
        } else {
            // Docker model fallback
            logger.info(`[LocalLLM] Attempting to start docker model: ${model}`);
            exec(`start /B docker model run ${model}`, { windowsHide: true });
        }

        // Wait for spin up
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;

    } catch (error) {
        logger.error('[LocalLLM] Start failed:', error.message);
        return false;
    }
}

/**
 * Main entry point: Check and ensure LLM is running.
 */
export async function ensureDockerLLM() {
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
