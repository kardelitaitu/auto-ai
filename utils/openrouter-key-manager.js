/**
 * @fileoverview OpenRouter Free API Key Rotation Manager
 * Reads keys and model config from config/settings.json `open_router_free_api`.
 * Round-robin key cycling with per-key cooldown on 429 rate limit errors.
 * @module utils/openrouter-key-manager
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_COOLDOWN_MS = 60_000;
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
 * Loads API keys from settings.json `open_router_free_api.api_keys`,
 * with OR_API_KEYS / OR_API_KEY env var as override.
 */
async function loadKeys() {
    // env override takes priority
    const envMulti = process.env.OR_API_KEYS;
    const envSingle = process.env.OR_API_KEY;
    if (envMulti) return envMulti.split(',').map(k => k.trim()).filter(Boolean);
    if (envSingle) return [envSingle];

    // fall through to settings.json
    const settings = await loadSettings();
    const keys = settings?.open_router_free_api?.api_keys || [];
    return keys.filter(Boolean);
}

/**
 * Loads primary model from settings.json `open_router_free_api.models.primary`.
 * Falls back to OR_MODEL env var or a hardcoded default.
 */
async function loadPrimaryModel() {
    if (process.env.OR_MODEL) return process.env.OR_MODEL;
    const settings = await loadSettings();
    return settings?.open_router_free_api?.models?.primary
        || 'meta-llama/llama-3.1-8b-instruct:free';
}

// ─── KeyManager ─────────────────────────────────────────────────────────────
class KeyManager {
    constructor(keys = []) {
        this._keys = keys;
        this._index = 0;
        this._cooldown = new Map(); // key → cooldown-until timestamp
    }

    /** Masked display label — last 4 chars of key. */
    label(key) {
        return `...${key.slice(-4)}`;
    }

    _available() {
        const now = Date.now();
        return this._keys.filter(k => (this._cooldown.get(k) || 0) <= now);
    }

    _msUntilNextAvailable() {
        if (this._available().length > 0) return 0;
        const soonest = Math.min(...[...this._cooldown.values()]);
        return Math.max(0, soonest - Date.now());
    }

    async getKey() {
        const wait = this._msUntilNextAvailable();
        if (wait > 0) {
            console.warn(`[KeyManager] All keys cooling down. Waiting ${(wait / 1000).toFixed(1)}s...`);
            await new Promise(r => setTimeout(r, wait + 100));
        }

        const available = this._available();
        for (let i = 0; i < this._keys.length; i++) {
            const candidate = this._keys[this._index % this._keys.length];
            this._index++;
            if (available.includes(candidate)) return candidate;
        }
        return available[0];
    }

    markCooldown(key, ms = DEFAULT_COOLDOWN_MS) {
        this._cooldown.set(key, Date.now() + ms);
        console.warn(`[KeyManager] Key ${this.label(key)} on cooldown for ${ms / 1000}s`);
    }

    reportSuccess(key) {
        this._cooldown.delete(key);
    }

    get size() { return this._keys.length; }
}

// ─── Singleton ──────────────────────────────────────────────────────────────
let _manager = null;

async function getManager() {
    if (_manager) return _manager;
    const keys = await loadKeys();
    if (keys.length === 0) throw new Error('[KeyManager] No API keys found in config/settings.json `open_router_free_api.api_keys` or OR_API_KEYS env var.');
    _manager = new KeyManager(keys);
    console.log(`[KeyManager] Loaded ${keys.length} key(s)`);
    return _manager;
}

/**
 * Drop-in fetch wrapper for OpenRouter.
 * Reads keys from settings.json, rotates them, retries on 429.
 *
 * @param {string} path    - e.g. '/chat/completions'
 * @param {object} body    - JSON body (model field optional — loaded from settings if omitted)
 * @returns {Promise<object>} Parsed JSON response
 */
async function openrouterFetch(path, body) {
    const manager = await getManager();
    const url = `${OPENROUTER_BASE_URL}${path}`;

    // fill model & reasoning from settings if caller didn't specify
    const settings = await loadSettings();
    if (!body.model) {
        body.model = settings?.open_router_free_api?.models?.primary || 'meta-llama/llama-3.1-8b-instruct:free';
    }
    if (!body.reasoning && settings?.open_router_free_api?.reasoning) {
        body.reasoning = settings.open_router_free_api.reasoning;
    }

    let lastError = null;

    for (let attempt = 0; attempt < manager.size; attempt++) {
        const key = await manager.getKey();
        const slot = manager._keys.indexOf(key) + 1;
        console.log(`[KeyManager] Using key ${manager.label(key)} (slot ${slot}/${manager.size})`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': 'https://github.com/auto-ai',
                'X-Title': 'auto-ai',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) {
            const err = await res.text();
            lastError = new Error(`HTTP ${res.status}: ${err}`);

            // Retry on Rate Limit (429), Dead/Empty Key (401, 402), or Server Errors (5xx)
            if (res.status === 429 || res.status === 401 || res.status === 402 || res.status >= 500) {
                let cooldownMs = 60_000;
                let reason = `HTTP ${res.status}`;

                if (res.status === 429) {
                    const retryAfterSec = Number(res.headers.get('retry-after') || 60);
                    cooldownMs = retryAfterSec * 1000;
                    reason = '429 Rate Limit';
                } else if (res.status === 401 || res.status === 402) {
                    cooldownMs = 24 * 60 * 60 * 1000; // 24 hours for dead/empty keys
                    reason = `${res.status} Key Invalid/Empty`;
                }

                console.warn(`[KeyManager] Key failed (${reason}). Retrying with next key...`);
                manager.markCooldown(key, cooldownMs);
                continue;
            }

            // Throw immediately for 400 Bad Request, etc.
            throw lastError;
        }

        manager.reportSuccess(key);
        return await res.json();
    }

    throw lastError || new Error('[KeyManager] All keys exhausted');
}

export { KeyManager, openrouterFetch, getManager, loadPrimaryModel };
export default openrouterFetch;
