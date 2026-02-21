/**
 * @fileoverview Local Ollama Manager - Dedicated utility to manage Ollama service.
 * Handles checking status and starting the Ollama server and models.
 * @module utils/local-ollama-manager
 */

import { exec, execSync } from 'child_process';
import { createLogger } from './logger.js';
import { getSettings } from './configLoader.js';

const logger = createLogger('ollama-manager.js');
let hasTestWarning = false;

const CACHE_TTL_MS = 30000; // 30s cache
let _cachedIsRunning = null;
let _cacheTimestamp = 0;
const PENALTY_TTL_MS = 30000; // 30s penalty
let _penaltyTimestamp = 0;
let _ongoingCheckPromise = null;
let _ongoingEnsurePromise = null;

const EXEC_TIMEOUT_MS = 5000;

function execWithTimeout(command, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Command timed out after ${EXEC_TIMEOUT_MS}ms: ${command}`));
        }, EXEC_TIMEOUT_MS);

        exec(command, { ...options, windowsHide: true }, (error, stdout, stderr) => {
            clearTimeout(timeout);
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

/**
 * Check if the Ollama process is running in Windows.
 * @returns {boolean}
 */
function isOllamaProcessRunning() {
    try {
        const output = execSync('tasklist /FI "IMAGENAME eq ollama.exe" /NH', {
            encoding: 'utf8',
            timeout: EXEC_TIMEOUT_MS
        });
        return output.toLowerCase().includes('ollama.exe');
    } catch {
        return false;
    }
}

function resolveOllamaCommand() {
    if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
        return 'ollama';
    }

    try {
        const output = execSync('where ollama', { encoding: 'utf8', timeout: EXEC_TIMEOUT_MS });
        const firstPath = output.split('\n').map(line => line.trim()).find(Boolean);
        if (firstPath) {
            return `"${firstPath}"`;
        }
    } catch {
        null;
    }

    if (process.env.LOCALAPPDATA) {
        return `"${process.env.LOCALAPPDATA}\\Programs\\Ollama\\ollama.exe"`;
    }

    return 'ollama';
}

function isLocalBaseUrl(baseUrl) {
    try {
        const url = new URL(baseUrl);
        const host = url.hostname.toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
        return true;
    }
}

async function getOllamaBaseUrl() {
    const settings = await getSettings();
    const endpoint = settings.llm?.local?.endpoint || 'http://localhost:11434';
    return endpoint.replace(/\/api\/.*$/, '').replace(/\/$/, '');
}

async function isOllamaEndpointReady(baseUrl) {
    try {
        const rootResponse = await fetch(`${baseUrl}/`, {
            signal: AbortSignal.timeout(1500)
        });
        if (rootResponse.ok) {
            return true;
        }
    } catch {
        null;
    }

    try {
        const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(1500)
        });
        return tagsResponse.ok;
    } catch {
        return false;
    }
}

async function waitForOllamaReady(baseUrl, attempts = 12, delayMs = 2000) {
    for (let i = 0; i < attempts; i++) {
        if (await isOllamaEndpointReady(baseUrl)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
}

/**
 * Check if the Ollama service is reachable at the configured endpoint.
 * Uses caching to avoid repeated expensive checks.
 * @param {boolean} forceRefresh - Bypass cache and force fresh check
 * @returns {Promise<boolean>}
 */
export async function isOllamaRunning(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && (now - _penaltyTimestamp) < PENALTY_TTL_MS) {
        return false;
    }

    if (!forceRefresh && _cachedIsRunning !== null && (now - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cachedIsRunning;
    }

    if (_ongoingCheckPromise && !forceRefresh) {
        return _ongoingCheckPromise;
    }

    _ongoingCheckPromise = (async () => {
        try {
            const baseUrl = await getOllamaBaseUrl();
            const isLocal = isLocalBaseUrl(baseUrl);

            // Check HTTP endpoint FIRST (fast)
            const isReady = await isOllamaEndpointReady(baseUrl);
            if (isReady) {
                _cachedIsRunning = true;
                _cacheTimestamp = Date.now();
                return true;
            }

            if (!isLocal) {
                _cachedIsRunning = false;
                _cacheTimestamp = Date.now();
                return false;
            }

            // HTTP down and it's local. Check process (slow)
            const processRunning = isOllamaProcessRunning();
            if (!processRunning) {
                _cachedIsRunning = false;
                _cacheTimestamp = Date.now();
                return false;
            }

            _cachedIsRunning = false;
            _cacheTimestamp = Date.now();
            return false;
        } catch {
            _cachedIsRunning = false;
            _cacheTimestamp = Date.now();
            return false;
        } finally {
            _ongoingCheckPromise = null;
        }
    })();

    return _ongoingCheckPromise;
}

export function clearOllamaCache() {
    _cachedIsRunning = null;
    _cacheTimestamp = 0;
    _penaltyTimestamp = 0;
    _ongoingCheckPromise = null;
    _ongoingEnsurePromise = null;
}

/**
 * Check if a specific model exists in Ollama.
 * @param {string} modelName 
 * @returns {Promise<boolean>}
 */
async function doesModelExist(modelName) {
    try {
        const { stdout } = await execWithTimeout('ollama list', { encoding: 'utf8' });
        const lines = stdout.split('\n').map(l => l.trim().split(/\s+/)[0]);
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
    clearOllamaCache();

    try {
        const settings = await getSettings();
        const model = settings.llm?.local?.model || 'hermes3:8b';
        const skipModelOps = (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')
            && process.env.ALLOW_OLLAMA_MODEL_OPS !== 'true';
        const baseUrl = await getOllamaBaseUrl();
        const ollamaCmd = resolveOllamaCommand();

        if (!isOllamaProcessRunning()) {
            logger.info(`[OllamaManager] Process not found. Triggering via 'ollama list'...`);

            exec(`${ollamaCmd} list`, (err) => {
                if (err) {
                    logger.debug(`[OllamaManager] 'ollama list' trigger result: ${err.message}`);
                }
            });

            await new Promise(resolve => setTimeout(resolve, 2000));

            if (!isOllamaProcessRunning()) {
                logger.info(`[OllamaManager] 'ollama list' didn't start process. Trying "ollama app.exe"...`);
                exec('start "" "ollama app.exe"', (err) => {
                    if (err) {
                        logger.debug('[OllamaManager] Failed to start via "ollama app.exe", trying "ollama serve"');
                        exec(`start /B "" ${ollamaCmd} serve`, { windowsHide: true });
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 6000));
            }
        }

        const apiReady = await waitForOllamaReady(baseUrl, 12, 2000);
        if (!apiReady) {
            logger.error('[OllamaManager] API failed to respond after start.');
            return false;
        }

        // 3. Ensure Model exists (Pull if missing)
        if (!await doesModelExist(model)) {
            logger.warn(`[OllamaManager] Model '${model}' not found in local library. Pulling...`);
            if (!skipModelOps) {
                await new Promise((resolve, reject) => {
                    const child = exec(`${ollamaCmd} pull ${model}`);
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
        }

        // 4. Load model into memory
        if (!skipModelOps) {
            logger.info(`[OllamaManager] Loading model into memory: ${model}...`);
            exec(`${ollamaCmd} run ${model} ""`, { windowsHide: true });
        }

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
export function ensureOllama() {
    if (_ongoingEnsurePromise) {
        return _ongoingEnsurePromise;
    }

    _ongoingEnsurePromise = (async () => {
        try {
            if ((process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')
                && process.env.ALLOW_OLLAMA_MODEL_OPS !== 'true') {
                if (!hasTestWarning) {
                    logger.warn('[OllamaManager] Ollama checks are disabled in test mode.');
                    hasTestWarning = true;
                }
                return false;
            }

            if (await isOllamaRunning()) {
                logger.debug('[OllamaManager] Ollama is already running.');
                return true;
            }

            logger.warn('[OllamaManager] Ollama not detected. Attempting to start...');
            await startOllama();

            // Verification loop - reduced from 10 to 4 attempts
            let attempts = 0;
            while (attempts < 4) {
                attempts++;
                if (await isOllamaRunning(true)) {
                    logger.success('[OllamaManager] Ollama is now ready.');
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            logger.error('[OllamaManager] Could not start Ollama service automatically.');
            _penaltyTimestamp = Date.now();
            return false;
        } finally {
            _ongoingEnsurePromise = null;
        }
    })();

    return _ongoingEnsurePromise;
}
