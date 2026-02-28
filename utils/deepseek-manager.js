/**
 * @fileoverview DeepSeek API Utility
 * Reads configuration from config/settings.json `llm.deepseek`.
 * @module utils/deepseek-manager
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
 * Loads DeepSeek configuration from settings.json.
 */
async function loadDeepSeekConfig() {
    const settings = await loadSettings();
    const config = settings?.llm?.deepseek || {};
    return {
        apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY,
        endpoint: config.endpoint || 'https://api.deepseek.com/v1',
        model: config.model || 'deepseek-chat',
        timeout: config.timeout || 60000
    };
}

/**
 * Fetch wrapper for DeepSeek.
 *
 * @param {string} path    - e.g. '/chat/completions'
 * @param {object} body    - JSON body
 * @returns {Promise<object>} Parsed JSON response
 */
async function deepseekFetch(path, body) {
    const config = await loadDeepSeekConfig();
    const url = `${config.endpoint}${path}`;

    if (!body.model) {
        body.model = config.model;
    }

    if (!config.apiKey) {
        throw new Error('[DeepSeek] No API key found in settings.json or DEEPSEEK_API_KEY env var.');
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`[DeepSeek] HTTP ${res.status}: ${err}`);
    }

    return await res.json();
}

export { deepseekFetch, loadDeepSeekConfig };
export default deepseekFetch;
