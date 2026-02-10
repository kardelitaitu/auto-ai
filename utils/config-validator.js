/**
 * Configuration Validator
 * Validates settings.json on startup
 * @module utils/config-validator
 */

import { createLogger } from './logger.js';

const logger = createLogger('config-validator.js');

export class ConfigValidator {
  constructor() {
    this.warnings = [];
    this.errors = [];
  }

  validate(settings) {
    this.warnings = [];
    this.errors = [];

    this._validateLlmCloud(settings?.llm?.cloud);
    this._validateOpenRouterFreeApi(settings?.open_router_free_api);
    this._validateTwitter(settings?.twitter);
    this._validateHumanization(settings?.humanization);

    return {
      valid: this.errors.length === 0,
      warnings: this.warnings,
      errors: this.errors
    };
  }

  _validateLlmCloud(config) {
    if (!config) {
      return;
    }

    if (config.enabled) {
      const providers = config.providers || [];

      if (providers.length === 0) {
        this.warnings.push('llm.cloud.enabled is true but no providers configured');
      }

      providers.forEach((provider, index) => {
        if (!provider.apiKey) {
          this.errors.push(`Provider ${index + 1}: missing apiKey`);
        } else if (provider.apiKey === 'your_openrouter_api_key_here') {
          this.warnings.push(`Provider ${index + 1}: using placeholder API key`);
        } else if (!this._isValidApiKey(provider.apiKey)) {
          this.warnings.push(`Provider ${index + 1}: API key format looks invalid`);
        }

        if (!provider.model) {
          this.warnings.push(`Provider ${index + 1}: missing model, using default`);
        }
      });

      if (config.timeout && config.timeout < 10000) {
        this.warnings.push('llm.cloud.timeout is very low (<10s), may cause timeouts');
      }
    }
  }

  _validateOpenRouterFreeApi(config) {
    if (!config) {
      return;
    }

    if (!config.enabled) {
      return;
    }

    if (!config.api_keys || config.api_keys.length === 0) {
      this.errors.push('open_router_free_api.enabled is true but no api_keys configured');
    } else {
      config.api_keys.forEach((key, index) => {
        if (!key || key.trim() === '') {
          this.errors.push(`API key ${index + 1}: empty value`);
        } else if (!this._isValidApiKey(key)) {
          this.warnings.push(`API key ${index + 1}: format looks invalid`);
        }
      });
    }

    if (!config.models) {
      this.warnings.push('open_router_free_api: no models configured, using defaults');
    } else {
      if (!config.models.primary) {
        this.warnings.push('open_router_free_api: no primary model configured');
      }

      const fallbacks = config.models.fallbacks || [];
      if (fallbacks.length === 0) {
        this.warnings.push('open_router_free_api: no fallback models configured');
      }
    }

    if (config.proxy?.enabled) {
      if (!config.proxy.list || config.proxy.list.length === 0) {
        this.warnings.push('open_router_free_api.proxy.enabled is true but no proxies in list');
      } else {
        config.proxy.list.forEach((proxy, index) => {
          if (!this._isValidProxyFormat(proxy)) {
            this.warnings.push(`Proxy ${index + 1}: format invalid (host:port:user:pass)`);
          }
        });
      }
    }

    if (config.timeout && config.timeout < 10000) {
      this.warnings.push('open_router_free_api.timeout is very low (<10s)');
    }
  }

  _validateTwitter(config) {
    if (!config) {
      return;
    }

    const engagement = config.engagement || {};

    if (engagement.maxReplies > 50) {
      this.warnings.push('twitter.engagement.maxReplies is very high (>50)');
    }
    if (engagement.maxLikes > 100) {
      this.warnings.push('twitter.engagement.maxLikes is very high (>100)');
    }

    const timing = config.timing || {};

    if (timing.warmupMin > timing.warmupMax) {
      this.errors.push('twitter.timing.warmupMin must be <= warmupMax');
    }
    if (timing.scrollMin > timing.scrollMax) {
      this.errors.push('twitter.timing.scrollMin must be <= scrollMax');
    }
    if (timing.readMin > timing.readMax) {
      this.errors.push('twitter.timing.readMin must be <= readMax');
    }

    if (timing.globalScrollMultiplier < 0.1 || timing.globalScrollMultiplier > 5) {
      this.warnings.push('twitter.timing.globalScrollMultiplier outside normal range (0.1-5)');
    }
  }

  _validateHumanization(config) {
    if (!config) {
      return;
    }

    const mouse = config.mouse || {};

    if (mouse.minDuration > mouse.maxDuration) {
      this.errors.push('humanization.mouse.minDuration must be <= maxDuration');
    }
    if (mouse.baseSpeed < 0.1 || mouse.baseSpeed > 10) {
      this.warnings.push('humanization.mouse.baseSpeed outside normal range (0.1-10)');
    }

    const keystroke = config.keystroke || {};

    if (keystroke.baseDelay < 10 || keystroke.baseDelay > 500) {
      this.warnings.push('humanization.keystroke.baseDelay outside normal range (10-500ms)');
    }
  }

  _isValidApiKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const trimmed = key.trim();

    if (trimmed.length < 10) {
      return false;
    }

    if (trimmed.includes(' ')) {
      return false;
    }

    if (trimmed.startsWith('sk-or-v1-')) {
      return true;
    }

    if (trimmed.startsWith('sk-')) {
      return true;
    }

    return true;
  }

  _isValidProxyFormat(proxy) {
    if (!proxy || typeof proxy !== 'string') {
      return false;
    }

    const parts = proxy.split(':');

    if (parts.length < 2) {
      return false;
    }

    const host = parts[0];
    const port = parts[1];

    if (!host || host.length < 1) {
      return false;
    }

    if (isNaN(parseInt(port))) {
      return false;
    }

    return true;
  }

  logResults() {
    if (this.warnings.length > 0) {
      logger.warn('[ConfigValidator] Warnings:');
      this.warnings.forEach(w => logger.warn(`  - ${w}`));
    }

    if (this.errors.length > 0) {
      logger.error('[ConfigValidator] Errors:');
      this.errors.forEach(e => logger.error(`  - ${e}`));
    }

    if (this.warnings.length === 0 && this.errors.length === 0) {
      logger.success('[ConfigValidator] All checks passed!');
    }
  }
}

export default ConfigValidator;
