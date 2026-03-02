/**
 * @fileoverview Settings Config Loader Bridge for api/ module.
 * Bridges to the full api/utils/configLoader.js for consistency.
 * 
 * @module api/utils/config
 */

import { ConfigLoader } from './configLoader.js';

const configLoader = new ConfigLoader();

/**
 * Load settings.json using the full ConfigLoader.
 * @returns {Promise<object>}
 */
export async function getSettings() {
    return configLoader.getSettings();
}

/**
 * Clear settings cache.
 */
export function clearSettingsCache() {
    configLoader.clearCache();
}
