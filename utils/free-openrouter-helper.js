/**
  * Free OpenRouter Helper - Singleton for shared model testing
  * All CloudClient instances share the same helper to avoid redundant tests
  * @module utils/free-openrouter-helper
  */

import { createLogger } from './logger.js';
import { createProxyAgent } from './proxy-agent.js';

const logger = createLogger('free-openrouter-helper.js');

let sharedInstance = null;

export class FreeOpenRouterHelper {
  static getInstance(options = {}) {
    if (!sharedInstance) {
      sharedInstance = new FreeOpenRouterHelper(options);
    }
    return sharedInstance;
  }

  static resetInstance() {
    sharedInstance = null;
  }

  constructor(options = {}) {
    this.apiKeys = options.apiKeys || [];
    this.models = options.models || [];
    this.proxy = options.proxy || null;
    this.endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.testTimeout = options.testTimeout || 15000;
    this.currentKeyIndex = 0;
    this.results = null;
    this.testing = false;
    this.testStartTime = null;
    
    // Cache TTL: 5 minutes (300000 ms)
    this.CACHE_TTL = 300000;
    this.cacheTimestamp = null;
  }

  _maskKey(key) {
    if (!key) return 'null';
    if (key.length < 8) return '***';
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
  }

  _getNextApiKey() {
    if (this.apiKeys.length === 0) {
      return null;
    }
    const key = this.apiKeys[this.currentKeyIndex % this.apiKeys.length];
    this.currentKeyIndex++;
    return key;
  }

  _selectProxy() {
    if (!this.proxy || this.proxy.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * this.proxy.length);
    return this.proxy[index];
  }

  _parseProxy(proxyString) {
    if (!proxyString) return null;
    
    const parts = proxyString.split(':');
    if (parts.length !== 4) {
      logger.warn(`[FreeRouterHelper] Invalid proxy format: ${proxyString}`);
      return null;
    }
    
    return {
      host: parts[0],
      port: parts[1],
      username: parts[2],
      password: parts[3]
    };
  }

  async _testModel(model, apiKey) {
    const startTime = Date.now();
    
    const testPrompt = [
      { role: 'user', content: 'Reply with exactly one word: "ok"' }
    ];

    const payload = {
      model,
      messages: testPrompt,
      max_tokens: 10,
      temperature: 0.1,
      stream: false,
      exclude_reasoning: true
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.testTimeout);

      try {
        // Select and setup proxy if available
        const proxyString = this._selectProxy();
        const proxy = this._parseProxy(proxyString);
        
        let fetchOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/auto-ai',
            'X-Title': 'Auto-AI Model Tester'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        };

        // Add proxy agent if proxy is configured
        if (proxy) {
          const proxyUrl = proxy.username
            ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
            : `http://${proxy.host}:${proxy.port}`;
          
          try {
            const agent = await createProxyAgent(proxyUrl);
            const httpAgent = await agent.getAgent();
            if (httpAgent) {
              fetchOptions.agent = httpAgent;
              logger.debug(`[FreeRouterHelper] Using proxy: ${proxy.host}:${proxy.port}`);
            }
          } catch (proxyError) {
            logger.warn(`[FreeRouterHelper] Failed to create proxy agent: ${proxyError.message}`);
          }
        }

        const response = await fetch(this.endpoint, fetchOptions);

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        const duration = Date.now() - startTime;

        if (content.toLowerCase().includes('ok')) {
          return { success: true, duration, error: null };
        } else {
          return { success: false, duration, error: 'Unexpected response' };
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      return { success: false, duration: Date.now() - startTime, error: error.message };
    }
  }

  async testAllModelsInBackground() {
    if (this.testing) {
      logger.warn('[FreeRouterHelper] Test already in progress, returning cached results');
      return this.results || { working: [], failed: [], total: 0, testDuration: 0 };
    }

    if (this.results && this.results.testDuration > 0) {
      const cacheAge = this.cacheTimestamp ? Math.round((Date.now() - this.cacheTimestamp) / 1000) : 'unknown';
      const cacheStatus = this.isCacheValid() ? 'valid' : 'stale';
      logger.info(`[FreeRouterHelper] Tests already completed, using cached results (${cacheAge}s old, ${cacheStatus})`);
      return this.results;
    }

    if (this.models.length === 0) {
      logger.warn('[FreeRouterHelper] No models configured');
      this.results = { working: [], failed: [], total: 0, testDuration: 0 };
      return this.results;
    }

    if (this.apiKeys.length === 0) {
      logger.warn('[FreeRouterHelper] No API keys configured');
      this.results = { working: [], failed: [], total: 0, testDuration: 0 };
      return this.results;
    }

    logger.info(`[FreeRouterHelper] Starting background model tests (${this.models.length} models)...`);

    this.testing = true;
    this.results = {
      working: [],
      failed: [],
      total: this.models.length,
      testDuration: 0
    };

    this.testStartTime = Date.now();

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.models.length; i++) {
      if (!this.testing) {
        logger.warn('[FreeRouterHelper] Test interrupted, returning partial results');
        this.results.testDuration = Date.now() - this.testStartTime;
        this.testing = false;
        this.testStartTime = null;
        logger.info(`[FreeRouterHelper] Partial results: ${successCount}/${i} working`);
        return this.results;
      }

      const model = this.models[i];
      const apiKey = this._getNextApiKey();

      logger.debug(`[FreeRouterHelper] Testing ${i + 1}/${this.models.length}: ${model} (key: ${this._maskKey(apiKey)})`);

      try {
        const result = await this._testModel(model, apiKey);

        if (!this.results) {
          this.results = { working: [], failed: [], total: this.models.length, testDuration: 0 };
        }

        if (result.success) {
          this.results.working.push(model);
          successCount++;
          logger.info(`[FreeRouterHelper] ${model} (${result.duration}ms)`);
        } else {
          this.results.failed.push({ model, error: result.error?.substring(0, 40) || 'Unknown error', duration: result.duration });
          failCount++;
          logger.warn(`[FreeRouterHelper] ${model}: ${result.error?.substring(0, 40)}`);
        }
      } catch (error) {
        if (!this.results) {
          this.results = { working: [], failed: [], total: this.models.length, testDuration: 0 };
        }
        this.results.failed.push({ model, error: error.message, duration: 0 });
        failCount++;
        logger.warn(`[FreeRouterHelper] ${model}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.results.testDuration = Date.now() - this.testStartTime;
    this.testing = false;
    this.testStartTime = null;
    
    // Set cache timestamp when tests complete
    this.cacheTimestamp = Date.now();
    logger.debug(`[FreeRouterHelper] Cache timestamp set: ${new Date(this.cacheTimestamp).toISOString()}`);

    logger.info(`[FreeRouterHelper] Model Test Complete: ${successCount}/${this.models.length} working (${this.results.testDuration}ms)`);
    
    if (this.results.working.length > 0) {
      logger.info(`[FreeRouterHelper] Working: ${this.results.working.join(', ')}`);
    }
    
    if (this.results.failed.length > 0) {
      const failedModels = this.results.failed.map(f => f.model).join(', ');
      logger.warn(`[FreeRouterHelper] Failed: ${failedModels}`);
    }

    return this.results;
  }

  async waitForTests(maxWait = 60000) {
    const startWait = Date.now();
    while (this.testing && (Date.now() - startWait) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (this.testing) {
      logger.warn('[FreeRouterHelper] Wait timeout, tests still in progress');
    }
    return this.results;
  }

  updateConfig(apiKeys, models) {
    if (apiKeys && apiKeys.length > 0) {
      this.apiKeys = apiKeys;
    }
    if (models && models.length > 0) {
      this.models = models;
      this.results = null;
    }
  }

  getResults() {
    // Check if cache is expired
    if (this.results && this.cacheTimestamp) {
      const age = Date.now() - this.cacheTimestamp;
      if (age > this.CACHE_TTL) {
        logger.info(`[FreeRouterHelper] Cache expired (${Math.round(age / 1000)}s old), will refresh on next request`);
        // Don't clear immediately, just mark as stale
        return { ...this.results, stale: true, cacheAge: age };
      }
    }
    return this.results;
  }

  /**
   * Check if cached results are still valid
   * @returns {boolean}
   */
  isCacheValid() {
    if (!this.results || !this.cacheTimestamp) return false;
    const age = Date.now() - this.cacheTimestamp;
    return age <= this.CACHE_TTL;
  }

  /**
   * Get cache age in milliseconds
   * @returns {number|null}
   */
  getCacheAge() {
    if (!this.cacheTimestamp) return null;
    return Date.now() - this.cacheTimestamp;
  }

  isTesting() {
    return this.testing;
  }

  getOptimizedModelList(primary = null) {
    const working = this.results?.working || [];

    if (working.length === 0) {
      return { primary: null, fallbacks: [] };
    }

    let primaryModel = primary;
    if (!primaryModel || !working.includes(primaryModel)) {
      primaryModel = working[0];
    }

    const fallbacks = working.filter(m => m !== primaryModel);

    return { primary: primaryModel, fallbacks };
  }
}

export default FreeOpenRouterHelper;
