import { describe, it, expect, vi } from 'vitest';

describe('utils/utils.js re-exports', () => {
    it('should export createRandomScroller', async () => {
        const mod = await import('../../utils/utils.js');
        expect(mod.createRandomScroller).toBeDefined();
        expect(typeof mod.createRandomScroller).toBe('function');
    });

    it('should export createRandomZoomer', async () => {
        const mod = await import('../../utils/utils.js');
        expect(mod.createRandomZoomer).toBeDefined();
        expect(typeof mod.createRandomZoomer).toBe('function');
    });

    it('should export createLogger', async () => {
        const { createLogger } = await import('../../utils/utils.js');
        expect(createLogger).toBeDefined();
        expect(typeof createLogger).toBe('function');
    });

    it('should export ApiHandler', async () => {
        const { ApiHandler } = await import('../../utils/utils.js');
        expect(ApiHandler).toBeDefined();
        expect(typeof ApiHandler).toBe('function');
    });

    it('should export metricsCollector', async () => {
        const mod = await import('../../utils/utils.js');
        expect(mod.metricsCollector).toBeDefined();
    });

    it('should export MetricsCollector', async () => {
        const { MetricsCollector } = await import('../../utils/utils.js');
        expect(MetricsCollector).toBeDefined();
        expect(typeof MetricsCollector).toBe('function');
    });

    it('should export env functions', async () => {
        const { getEnv, isDevelopment, isProduction } = await import('../../utils/utils.js');
        expect(getEnv).toBeDefined();
        expect(typeof getEnv).toBe('function');
        expect(isDevelopment).toBeDefined();
        expect(typeof isDevelopment).toBe('function');
        expect(isProduction).toBeDefined();
        expect(typeof isProduction).toBe('function');
    });
});
