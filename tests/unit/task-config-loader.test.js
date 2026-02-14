import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskConfigLoader } from '../../utils/task-config-loader.js';
import { config } from '../../utils/config-service.js';
import { getSettings } from '../../utils/configLoader.js';
import { EnvironmentConfig } from '../../utils/environment-config.js';
import { ConfigValidator } from '../../utils/config-validator.js';

vi.mock('../../utils/config-service.js', () => ({
  config: {
    getTwitterActivity: vi.fn(),
    getTiming: vi.fn(),
    getEngagementLimits: vi.fn(),
    getHumanization: vi.fn(),
  },
}));

vi.mock('../../utils/configLoader.js', () => ({
  getSettings: vi.fn(),
}));

vi.mock('../../utils/config-validator.js', () => {
    class MockConfigValidator {
      validateConfig = vi.fn(() => ({ valid: true }));
    }
    return { ConfigValidator: MockConfigValidator };
});

vi.mock('../../utils/config-cache.js', () => {
    class MockConfigCache {
        constructor() {
            this.cache = new Map();
        }
        get = vi.fn(key => this.cache.get(key));
        set = vi.fn((key, value) => this.cache.set(key, value));
    }
    return { ConfigCache: MockConfigCache };
});

vi.mock('../../utils/environment-config.js', () => {
    class MockEnvironmentConfig {
        static applyEnvOverrides = vi.fn(config => config);
    }
    return { EnvironmentConfig: MockEnvironmentConfig };
});


describe('TaskConfigLoader', () => {
  let loader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new TaskConfigLoader();
  });

  describe('loadAiTwitterActivityConfig', () => {
    it('should load, build, and validate the config', async () => {
        getSettings.mockResolvedValue({ settings: 'data' });
        config.getTwitterActivity.mockResolvedValue({ defaultCycles: 1 });
        config.getTiming.mockResolvedValue({});
        config.getEngagementLimits.mockResolvedValue({});
        config.getHumanization.mockResolvedValue({});

      const payload = { cycles: 1 };
      const result = await loader.loadAiTwitterActivityConfig(payload);

      expect(getSettings).toHaveBeenCalled();
      expect(config.getTwitterActivity).toHaveBeenCalled();
      expect(EnvironmentConfig.applyEnvOverrides).toHaveBeenCalled();
      
      const validatorInstance = loader.validator;
      expect(validatorInstance.validateConfig).toHaveBeenCalled();

      expect(result.session.cycles).toBe(1);
    });

    it('should use the cache on subsequent calls with the same payload', async () => {
        getSettings.mockResolvedValue({});
        config.getTwitterActivity.mockResolvedValue({ defaultCycles: 1 });
        config.getTiming.mockResolvedValue({});
        config.getEngagementLimits.mockResolvedValue({});
        config.getHumanization.mockResolvedValue({});

      const payload = { cycles: 1 };
      await loader.loadAiTwitterActivityConfig(payload);
      await loader.loadAiTwitterActivityConfig(payload);

      expect(getSettings).toHaveBeenCalledTimes(1);
      expect(config.getTwitterActivity).toHaveBeenCalledTimes(1);
      expect(loader.hitCount).toBe(1);
    });

    it('should not use cache for different payloads', async () => {
        getSettings.mockResolvedValue({});
        config.getTwitterActivity.mockResolvedValue({ defaultCycles: 1 });
        config.getTiming.mockResolvedValue({});
        config.getEngagementLimits.mockResolvedValue({});
        config.getHumanization.mockResolvedValue({});

        await loader.loadAiTwitterActivityConfig({ cycles: 1 });
        await loader.loadAiTwitterActivityConfig({ cycles: 2 });

        expect(getSettings).toHaveBeenCalledTimes(2);
        expect(loader.hitCount).toBe(0);
        expect(loader.loadCount).toBe(2);
    });

    it('should throw an error if validation fails', async () => {
        getSettings.mockResolvedValue({});
        config.getTwitterActivity.mockResolvedValue({ defaultCycles: 1 });
        config.getTiming.mockResolvedValue({});
        config.getEngagementLimits.mockResolvedValue({});
        config.getHumanization.mockResolvedValue({});

        const validatorInstance = loader.validator;
        validatorInstance.validateConfig.mockReturnValue({ valid: false, errors: ['test error'] });

        await expect(loader.loadAiTwitterActivityConfig({})).rejects.toThrow('Configuration validation failed: test error');
    });
  });
});
