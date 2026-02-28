/**
 * @fileoverview Minimal Settings Config Loader for api/ module.
 * Internal replacement for utils/configLoader.js getSettings().
 * Reads config/settings.json from the project root. Falls back to {}.
 * 
 * @module api/utils/config
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Project root is api/utils/../../ = 2 levels up
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SETTINGS_PATH = path.join(PROJECT_ROOT, 'config', 'settings.json');

let _settingsCache = null;

/**
 * Load settings.json from config/. Returns {} if file is not found.
 * Result is cached after first load.
 * @returns {Promise<object>}
 */
export async function getSettings() {
    if (_settingsCache !== null) return _settingsCache;

    try {
        const data = await fs.readFile(SETTINGS_PATH, 'utf8');
        _settingsCache = JSON.parse(data);
    } catch {
        _settingsCache = {};
    }

    return _settingsCache;
}

/**
 * Clear settings cache (useful for testing).
 */
export function clearSettingsCache() {
    _settingsCache = null;
}
