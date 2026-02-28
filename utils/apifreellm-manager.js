/**
 * @fileoverview ApiFreeLLM API Utility
 * Reads configuration from config/settings.json `llm.apifreellm`.
 * @module utils/apifreellm-manager
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

const SETTINGS_PATH = resolve(process.cwd(), 'config/settings.json');

// ─── Settings loader ────────────────────────────────────────────────────────
let _settingsCache = null;
async function loadSettings() {
    if (_settingsCache) return _settingsCache;
    const raw = await readFile(SETTINGS_PATH, 'utf8');
    _settingsCache = JSON.parse(raw);
    return _settingsCache;
}

/**
 * Loads ApiFreeLLM configuration from settings.json.
 */
async function loadApiFreeLLMConfig() {
    const settings = await loadSettings();
    const config = settings?.llm?.apifreellm || {};
    return {
        apiKey: config.apiKey || process.env.APIFREELLM_API_KEY,
        endpoint: config.endpoint || 'https://apifreellm.com/api/v1',
        timeout: config.timeout || 60000
    };
}

/**
 * Fetch wrapper for ApiFreeLLM.
 *
 * @param {string} path       - e.g. '/chat'
 * @param {string} message    - The message string (API-specific body format)
 * @returns {Promise<object>} Parsed JSON response
 */
async function apifreellmFetch(path, message) {
    const config = await loadApiFreeLLMConfig();
    const url = `${config.endpoint}${path}`;

    if (!config.apiKey) {
        throw new Error('[ApiFreeLLM] No API key found in settings.json or APIFREELLM_API_KEY env var.');
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[ApiFreeLLM] HTTP ${res.status}: ${err}`);
    }

    return await res.json();
}

export { apifreellmFetch, loadApiFreeLLMConfig };
export default apifreellmFetch;
