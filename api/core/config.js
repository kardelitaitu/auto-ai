/**
 * @fileoverview Centralized Configuration Manager
 * Manages global settings, environment variables, timeouts, and LLM configs.
 * 
 * @module api/core/config
 */

import { getSettings as getRawSettings } from '../utils/config.js';
import { createLogger } from './logger.js';

const logger = createLogger('api/core/config.js');

class ConfigurationManager {
    constructor() {
        this._config = null;
        this._overrides = {};
    }

    /**
     * Initialize and merge configurations.
     */
    async init() {
        if (this._config) return this._config;

        try {
            const raw = await getRawSettings();

            // Merge defaults with raw settings
            this._config = {
                agent: {
                    llm: {
                        baseUrl: 'http://localhost:11434',
                        model: 'qwen2.5:7b',
                        temperature: 0.7,
                        maxTokens: 2048,
                        contextLength: 4096,
                        timeoutMs: 120000,
                        useVision: true,
                        serverType: 'ollama',
                        bypassHealthCheck: false,
                        ...(raw.agent?.llm || {})
                    },
                    runner: {
                        maxSteps: 20,
                        stepDelay: 2000,
                        adaptiveDelay: true, // Use network idle instead of static delay
                        ...(raw.agent?.runner || {})
                    }
                },
                timeouts: {
                    navigation: 30000,
                    element: 10000,
                    ...raw.timeouts
                },
                ...raw
            };
        } catch (_e) {
            logger.warn('Failed to load raw settings, using defaults');
            this._config = this._getDefaults();
        }

        return this._config;
    }

    /**
     * Get a configuration value by dot-notation path (e.g., 'agent.llm.model')
     * @param {string} path 
     * @param {*} defaultValue 
     */
    get(path, defaultValue = undefined) {
        if (!this._config) {
            logger.warn('ConfigurationManager not initialized, returning default');
            return defaultValue;
        }

        // Apply temporary override if exists
        if (this._overrides[path] !== undefined) {
            return this._overrides[path];
        }

        const keys = path.split('.');
        let current = this._config;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return defaultValue;
            }
            current = current[key];
        }

        return current !== undefined ? current : defaultValue;
    }

    /**
     * Temporary overrides for a specific run/persona.
     * @param {string} path 
     * @param {*} value 
     */
    setOverride(path, value) {
        this._overrides[path] = value;
    }

    /**
     * Clear all current overrides.
     */
    clearOverrides() {
        this._overrides = {};
    }

    /**
     * Get full materialized config
     */
    getFullConfig() {
        return this._config || this._getDefaults();
    }

    _getDefaults() {
        return {
            agent: {
                llm: {
                    baseUrl: 'http://localhost:11434',
                    model: 'qwen2.5:7b',
                    temperature: 0.7,
                    maxTokens: 2048,
                    contextLength: 4096,
                    timeoutMs: 120000,
                    useVision: true,
                    serverType: 'ollama',
                    bypassHealthCheck: false
                },
                runner: {
                    maxSteps: 20,
                    stepDelay: 2000,
                    adaptiveDelay: true
                }
            },
            timeouts: {
                navigation: 30000,
                element: 10000
            }
        };
    }
}

export const configManager = new ConfigurationManager();
export default configManager;
