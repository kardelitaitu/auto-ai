/**
 * @fileoverview Local Ollama Manager - Dedicated utility to manage Ollama service.
 * Handles checking status and starting the Ollama server and models.
 * @module utils/local-ollama-manager
 */

import { exec, execSync } from 'child_process';
import { createLogger } from './logger.js';
import { getSettings } from './configLoader.js';

const logger = createLogger('ollama-manager.js');

/**
 * Check if the Ollama process is running in Windows.
 * @returns {boolean}
 */
function isOllamaProcessRunning() {
    try {
        const output = execSync('tasklist /FI "IMAGENAME eq ollama.exe" /NH', { encoding: 'utf8' });
        return output.toLowerCase().includes('ollama.exe');
    } catch {
        return false;
    }
}

/**
 * Check if the Ollama service is reachable at the configured endpoint.
 * @returns {Promise<boolean>}
 */
export async function isOllamaRunning() {
    // First check process
    if (!isOllamaProcessRunning()) {
        return false;
    }

    try {
        const settings = await getSettings();
        const endpoint = settings.llm?.local?.endpoint || 'http://localhost:11434';
        const baseUrl = endpoint.replace(/\/api\/.*$/, '');

        const response = await fetch(`${baseUrl}/`, {
            signal: AbortSignal.timeout(1000)
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Check if a specific model exists in Ollama.
 * @param {string} modelName 
 * @returns {boolean}
 */
function doesModelExist(modelName) {
    try {
        const output = execSync('ollama list', { encoding: 'utf8' });
        // Check for exact match or model:tag match
        const lines = output.split('\n').map(l => l.trim().split(/\s+/)[0]);
        return lines.some(l => l === modelName || l.startsWith(`${modelName}:`));
    } catch {
        return false;
    }
}

/**
 * Start the Ollama service and ensure the model is loaded.
 * @returns {Promise<boolean>}
 */
export async function startOllama() {
    try {
        const settings = await getSettings();
        const model = settings.llm?.local?.model || 'hermes3:8b';

        // 1. Ensure Process is running
        if (!isOllamaProcessRunning()) {
            logger.info(`[OllamaManager] Process not found. Triggering via 'ollama list'...`);
            
            // Attempt to start service using 'ollama list' (effective on Windows)
            exec('ollama list', (err) => {
                if (err) {
                    // It might fail if service is just starting, which is fine, we just want to trigger it
                    logger.debug(`[OllamaManager] 'ollama list' trigger result: ${err.message}`);
                }
            });

            // Give it a moment to register
            await new Promise(resolve => setTimeout(resolve, 2000));

            // If still not running, try explicit launch
            if (!isOllamaProcessRunning()) {
                logger.info(`[OllamaManager] 'ollama list' didn't start process. Trying "ollama app.exe"...`);
                exec('start "" "ollama app.exe"', (err) => {
                    if (err) {
                        logger.debug('[OllamaManager] Failed to start via "ollama app.exe", trying "ollama serve"');
                        exec('start /B ollama serve', { windowsHide: true });
                    }
                });
                // Wait for process to appear and tray to settle
                await new Promise(resolve => setTimeout(resolve, 6000));
            }
        }
        
        // 2. Wait for API to be ready
        let apiReady = false;
        for (let i = 0; i < 10; i++) {
            if (await isOllamaRunning()) {
                apiReady = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!apiReady) {
            logger.error('[OllamaManager] API failed to respond after start.');
            return false;
        }

        // 3. Ensure Model exists (Pull if missing)
        if (!doesModelExist(model)) {
            logger.warn(`[OllamaManager] Model '${model}' not found in local library. Pulling...`);
            // Using execSync for pull to ensure it finishes or at least starts properly
            // but since pull can be large, we'll use a promise-wrapped exec
            await new Promise((resolve, reject) => {
                const child = exec(`ollama pull ${model}`);
                child.on('exit', (code) => {
                    if (code === 0) {
                        logger.success(`[OllamaManager] Successfully pulled ${model}`);
                        resolve();
                    } else {
                        reject(new Error(`Pull failed with code ${code}`));
                    }
                });
            });
        }

        // 4. Load model into memory
        logger.info(`[OllamaManager] Loading model into memory: ${model}...`);
        exec(`ollama run ${model} ""`, { windowsHide: true });
        
        return true;
    } catch (error) {
        logger.error(`[OllamaManager] Failed to start/prepare Ollama: ${error.message}`);
        return false;
    }
}

/**
 * Main entry point: Ensure Ollama is running and ready for use.
 * @returns {Promise<boolean>}
 */
export async function ensureOllama() {
    if (await isOllamaRunning()) {
        logger.debug('[OllamaManager] Ollama is already running.');
        return true;
    }

    logger.warn('[OllamaManager] Ollama not detected. Attempting to start...');
    await startOllama();

    // Verification loop
    let attempts = 0;
    while (attempts < 10) {
        attempts++;
        if (await isOllamaRunning()) {
            logger.success('[OllamaManager] Ollama is now ready.');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.error('[OllamaManager] Could not start Ollama service automatically.');
    return false;
}
