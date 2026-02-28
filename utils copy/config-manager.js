/**
 * @fileoverview Centralized Configuration Manager
 * Provides unified configuration management with caching, validation, and environment overrides
 * @module utils/config-manager
 * 
 * This is a NEW module for Phase 2 improvements. It does not replace existing config loaders
 * but provides a more robust alternative for new code.
 */

import { ConfigError } from './errors.js';
import { createLogger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = createLogger('config-manager.js');

/**
 * Configuration schema for validation
 * Defines expected types and defaults for all config values
 */
const CONFIG_SCHEMA = {
  // Twitter settings
  'twitter.session.minSeconds': { type: 'number', default: 300, min: 60, max: 3600 },
  'twitter.session.maxSeconds': { type: 'number', default: 540, min: 120, max: 7200 },
  'twitter.session.randomProfile': { type: 'boolean', default: true },
  
  'twitter.engagement.maxReplies': { type: 'number', default: 3, min: 0, max: 50 },
  'twitter.engagement.maxRetweets': { type: 'number', default: 1, min: 0, max: 20 },
  'twitter.engagement.maxQuotes': { type: 'number', default: 1, min: 0, max: 20 },
  'twitter.engagement.maxLikes': { type: 'number', default: 5, min: 0, max: 100 },
  'twitter.engagement.maxFollows': { type: 'number', default: 2, min: 0, max: 50 },
  'twitter.engagement.maxBookmarks': { type: 'number', default: 2, min: 0, max: 50 },
  
  'twitter.reply.probability': { type: 'number', default: 0.6, min: 0, max: 1 },
  'twitter.reply.minChars': { type: 'number', default: 10, min: 1, max: 500 },
  'twitter.reply.maxChars': { type: 'number', default: 200, min: 10, max: 1000 },
  'twitter.reply.emojiChance': { type: 'number', default: 0.3, min: 0, max: 1 },
  'twitter.reply.questionChance': { type: 'number', default: 0.2, min: 0, max: 1 },
  
  'twitter.quote.probability': { type: 'number', default: 0.2, min: 0, max: 1 },
  
  'twitter.timing.warmupMin': { type: 'number', default: 2000, min: 100, max: 60000 },
  'twitter.timing.warmupMax': { type: 'number', default: 15000, min: 500, max: 120000 },
  'twitter.timing.scrollMin': { type: 'number', default: 300, min: 50, max: 5000 },
  'twitter.timing.scrollMax': { type: 'number', default: 700, min: 100, max: 10000 },
  'twitter.timing.scrollPauseMin': { type: 'number', default: 1500, min: 100, max: 30000 },
  'twitter.timing.scrollPauseMax': { type: 'number', default: 4000, min: 200, max: 60000 },
  'twitter.timing.readMin': { type: 'number', default: 5000, min: 1000, max: 60000 },
  'twitter.timing.readMax': { type: 'number', default: 15000, min: 2000, max: 120000 },
  'twitter.timing.diveRead': { type: 'number', default: 10000, min: 1000, max: 60000 },
  'twitter.timing.globalScrollMultiplier': { type: 'number', default: 1.0, min: 0.1, max: 5.0 },
  
  'twitter.phases.warmupPercent': { type: 'number', default: 0.1, min: 0, max: 0.5 },
  'twitter.phases.activePercent': { type: 'number', default: 0.7, min: 0.3, max: 0.9 },
  'twitter.phases.cooldownPercent': { type: 'number', default: 0.2, min: 0.1, max: 0.5 },
  
  // LLM settings
  'llm.vllm.enabled': { type: 'boolean', default: false },
  'llm.vllm.endpoint': { type: 'string', default: 'http://localhost:8000/v1' },
  'llm.vllm.timeout': { type: 'number', default: 120000, min: 1000, max: 300000 },
  
  'llm.local.enabled': { type: 'boolean', default: false },
  'llm.local.endpoint': { type: 'string', default: 'http://localhost:11434' },
  'llm.local.timeout': { type: 'number', default: 60000, min: 1000, max: 300000 },
  'llm.local.retryAttempts': { type: 'number', default: 2, min: 0, max: 10 },
  
  'llm.cloud.enabled': { type: 'boolean', default: false },
  'llm.cloud.endpoint': { type: 'string', default: 'https://openrouter.ai/api/v1/chat/completions' },
  'llm.cloud.timeout': { type: 'number', default: 120000, min: 1000, max: 300000 },
  'llm.cloud.retryAttempts': { type: 'number', default: 1, min: 0, max: 10 },
  'llm.cloud.retryDelay': { type: 'number', default: 3000, min: 100, max: 30000 },
  'llm.cloud.requestQueue.enabled': { type: 'boolean', default: false },
  'llm.cloud.requestQueue.interval': { type: 'number', default: 300, min: 0, max: 60000 },
  
  // Open Router Free API
  'open_router_free_api.enabled': { type: 'boolean', default: true },
  'open_router_free_api.proxy.enabled': { type: 'boolean', default: false },
  'open_router_free_api.proxy.fallback_to_direct': { type: 'boolean', default: true },
  
  // Humanization
  'humanization.mouse.minDuration': { type: 'number', default: 300, min: 50, max: 5000 },
  'humanization.mouse.maxDuration': { type: 'number', default: 1500, min: 100, max: 10000 },
  'humanization.keystroke.baseDelay': { type: 'number', default: 120, min: 20, max: 500 },
  'humanization.idle.enabled': { type: 'boolean', default: true },
  
  // System
  'system.environment': { type: 'string', default: 'development', enum: ['development', 'production', 'test'] },
  'system.logLevel': { type: 'string', default: 'info', enum: ['debug', 'info', 'warn', 'error'] },
  'system.sessionTimeoutMs': { type: 'number', default: 1800000, min: 300000, max: 7200000 },
};

/**
 * Configuration Manager Class
 * Centralized configuration management with caching and validation
 */
class ConfigManager {
  constructor() {
    this.config = {};
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.initialized = false;
    this.initPromise = null;
    this.sources = [];
    this.warnings = [];
  }

  /**
   * Initialize the configuration manager
   * Loads configuration from all sources
   * @param {Object} options - Initialization options
   * @param {boolean} options.validate - Whether to validate configuration
   * @param {boolean} options.cache - Whether to enable caching
   * @returns {Promise<ConfigManager>} this
   */
  async init(options = {}) {
    if (this.initialized) {
      logger.debug('[ConfigManager] Already initialized, skipping');
      return this;
    }
    
    if (this.initPromise) return this.initPromise;

    const { validate = true, cache = true } = options;

    this.initPromise = (async () => {
      logger.info('[ConfigManager] Initializing...');
      
      // Load configuration from all sources
      await this._loadAllSources();
      
      // Validate if requested
      if (validate) {
        this._validateAll();
      }
      
      // Enable caching
      if (cache) {
        this._enableCache();
      }

      this.initialized = true;
      this.initPromise = null;
      logger.info(`[ConfigManager] Initialized with ${Object.keys(this.config).length} config values`);
      
      if (this.warnings.length > 0) {
        logger.warn(`[ConfigManager] ${this.warnings.length} configuration warnings`);
        this.warnings.forEach(w => logger.warn(`  - ${w}`));
      }

      return this;
    })();

    return this.initPromise;
  }

  /**
   * Load configuration from all sources
   * @private
   */
  async _loadAllSources() {
    // 1. Load defaults
    this._loadDefaults();
    
    // 2. Load from settings.json
    await this._loadFromSettings();
    
    // 3. Load from environment variables
    this._loadFromEnvironment();
    
    // 4. Record sources
    this.sources = ['defaults', 'settings.json', 'environment'];
  }

  /**
   * Load default configuration values
   * @private
   */
  _loadDefaults() {
    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
      this._set(key, schema.default, 'default');
    }
    logger.debug('[ConfigManager] Loaded default values');
  }

  /**
   * Load configuration from settings.json
   * @private
   */
  async _loadFromSettings() {
    try {
      const settingsPath = path.join(__dirname, '..', 'config', 'settings.json');
      
      if (!fs.existsSync(settingsPath)) {
        logger.warn('[ConfigManager] settings.json not found, using defaults');
        return;
      }

      const content = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(content);
      
      this._flattenAndLoad(settings, 'settings');
      logger.debug('[ConfigManager] Loaded settings.json');
    } catch (error) {
      logger.error(`[ConfigManager] Failed to load settings.json: ${error.message}`);
    }
  }

  /**
   * Load configuration from environment variables
   * @private
   */
  _loadFromEnvironment() {
    const envMappings = {
      'TWITTER_ACTIVITY_CYCLES': 'twitter.activity.cycles',
      'TWITTER_MIN_DURATION': 'twitter.session.minSeconds',
      'TWITTER_MAX_DURATION': 'twitter.session.maxSeconds',
      'TWITTER_REPLY_PROBABILITY': 'twitter.reply.probability',
      'TWITTER_QUOTE_PROBABILITY': 'twitter.quote.probability',
      'GLOBAL_SCROLL_MULTIPLIER': 'twitter.timing.globalScrollMultiplier',
      'OPENROUTER_API_KEY': 'llm.cloud.apiKey',
      'LOCAL_LLM_ENDPOINT': 'llm.local.endpoint',
      'LOCAL_LLM_MODEL': 'llm.local.model',
      'DOCKER_LLM_ENABLED': 'llm.local.enabled',
      'LOG_LEVEL': 'system.logLevel',
      'NODE_ENV': 'system.environment',
    };

    for (const [envVar, configKey] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        const converted = this._convertValue(value, configKey);
        this._set(configKey, converted, 'environment');
        logger.debug(`[ConfigManager] Loaded ${envVar} from environment`);
      }
    }
  }

  /**
   * Flatten nested object and load into config
   * @private
   * @param {Object} obj - Object to flatten
   * @param {string} source - Source name
   * @param {string} prefix - Key prefix
   */
  _flattenAndLoad(obj, source, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this._flattenAndLoad(value, source, fullKey);
      } else {
        this._set(fullKey, value, source);
      }
    }
  }

  /**
   * Set configuration value
   * @private
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @param {string} source - Value source
   */
  _set(key, value, source) {
    // Normalize key (replace dots with actual dot notation)
    const normalizedKey = key.replace(/\./g, '.');
    
    // Store with metadata
    this.config[normalizedKey] = {
      value,
      source,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Convert environment variable value to proper type
   * @private
   * @param {string} value - Environment variable value
   * @param {string} key - Configuration key
   * @returns {*} Converted value
   */
  _convertValue(value, key) {
    const schema = CONFIG_SCHEMA[key];
    
    if (!schema) {
      // No schema, return as-is
      return value;
    }

    switch (schema.type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number': {
        const num = parseFloat(value);
        return isNaN(num) ? schema.default : num;
      }
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Validate all configuration values against schema
   * @private
   */
  _validateAll() {
    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
      const configValue = this.config[key];
      
      if (!configValue) {
        continue; // Not set, will use default
      }

      const value = configValue.value;
      
      // Type validation
      if (schema.type && typeof value !== schema.type) {
        this.warnings.push(`${key}: expected ${schema.type}, got ${typeof value}`);
        continue;
      }

      // Range validation for numbers
      if (schema.type === 'number') {
        if (schema.min !== undefined && value < schema.min) {
          this.warnings.push(`${key}: value ${value} below minimum ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
          this.warnings.push(`${key}: value ${value} above maximum ${schema.max}`);
        }
      }

      // Enum validation
      if (schema.enum && !schema.enum.includes(value)) {
        this.warnings.push(`${key}: value "${value}" not in allowed values [${schema.enum.join(', ')}]`);
      }
    }
  }

  /**
   * Enable caching for get operations
   * @private
   */
  _enableCache() {
    // Cache is enabled by default with the Map
    logger.debug('[ConfigManager] Caching enabled');
  }

  /**
   * Get configuration value
   * @param {string} key - Configuration key (dot notation)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = undefined) {
    this._ensureInitialized();

    // Check cache first
    if (this.cache.has(key)) {
      this.cacheHits++;
      return this.cache.get(key);
    }

    // Get from config
    const configValue = this.config[key];
    
    if (configValue === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      
      // Check if there's a schema default
      const schema = CONFIG_SCHEMA[key];
      if (schema) {
        return schema.default;
      }
      
      throw new ConfigError(`Configuration key not found: ${key}`, { key });
    }

    this.cacheMisses++;
    const value = configValue.value;
    
    // Cache the value
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * Get configuration value with full metadata
   * @param {string} key - Configuration key
   * @returns {Object} Value with metadata
   */
  getWithMeta(key) {
    this._ensureInitialized();
    return this.config[key];
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @param {string} source - Value source
   */
  set(key, value, source = 'runtime') {
    this._ensureInitialized();
    
    this._set(key, value, source);
    
    // Invalidate cache
    this.cache.delete(key);
    
    logger.debug(`[ConfigManager] Set ${key} = ${value} (source: ${source})`);
  }

  /**
   * Check if configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean}
   */
  has(key) {
    this._ensureInitialized();
    return this.config[key] !== undefined;
  }

  /**
   * Get all configuration keys
   * @returns {string[]}
   */
  keys() {
    this._ensureInitialized();
    return Object.keys(this.config);
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
    
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: hitRate.toFixed(2) + '%',
      size: this.cache.size,
    };
  }

  /**
   * Clear the configuration cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.debug('[ConfigManager] Cache cleared');
  }

  /**
   * Get configuration sources
   * @returns {string[]}
   */
  getSources() {
    return [...this.sources];
  }

  /**
   * Reload configuration from all sources
   * @returns {Promise<void>}
   */
  async reload() {
    logger.info('[ConfigManager] Reloading configuration...');
    
    // Clear current config
    this.config = {};
    this.cache.clear();
    this.warnings = [];
    
    // Reload from sources
    await this._loadAllSources();
    this._validateAll();
    
    logger.info('[ConfigManager] Configuration reloaded');
  }

  /**
   * Ensure the manager is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new ConfigError('ConfigManager not initialized. Call init() first.');
    }
  }

  /**
   * Export configuration to JSON
   * @returns {Object}
   */
  toJSON() {
    const result = {};
    for (const [key, configValue] of Object.entries(this.config)) {
      this._setNestedValue(result, key, configValue.value);
    }
    return result;
  }

  /**
   * Set nested value in object
   * @private
   * @param {Object} obj - Target object
   * @param {string} key - Dot-notation key
   * @param {*} value - Value to set
   */
  _setNestedValue(obj, key, value) {
    const parts = key.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

export { ConfigManager, configManager, CONFIG_SCHEMA };
export default configManager;
