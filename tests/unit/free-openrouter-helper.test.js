/**
 * @fileoverview Unit Tests for FreeOpenRouterHelper
 * @module tests/unit/free-openrouter-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('../../utils/proxy-agent.js', () => ({
    createProxyAgent: vi.fn().mockReturnValue({
        getAgent: vi.fn().mockResolvedValue(null)
    })
}));

global.fetch = vi.fn();

const { FreeOpenRouterHelper } = await import('../../utils/free-openrouter-helper.js');

describe('FreeOpenRouterHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        FreeOpenRouterHelper.resetInstance();
    });

    afterEach(() => {
        FreeOpenRouterHelper.resetInstance();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = FreeOpenRouterHelper.getInstance();
            const instance2 = FreeOpenRouterHelper.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should pass options to constructor', () => {
            const instance = FreeOpenRouterHelper.getInstance({
                apiKeys: ['key1'],
                models: ['model1']
            });
            expect(instance.apiKeys).toEqual(['key1']);
            expect(instance.models).toEqual(['model1']);
        });
    });

    describe('resetInstance', () => {
        it('should reset singleton to null', () => {
            const instance1 = FreeOpenRouterHelper.getInstance();
            FreeOpenRouterHelper.resetInstance();
            const instance2 = FreeOpenRouterHelper.getInstance();
            expect(instance1).not.toBe(instance2);
        });
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.apiKeys).toEqual([]);
            expect(helper.models).toEqual([]);
            expect(helper.proxy).toBeNull();
            expect(helper.testTimeout).toBe(15000);
            expect(helper.currentKeyIndex).toBe(0);
            expect(helper.results).toBeNull();
            expect(helper.testing).toBe(false);
        });

        it('should accept custom options', () => {
            const helper = new FreeOpenRouterHelper({
                apiKeys: ['key1', 'key2'],
                models: ['model1', 'model2'],
                proxy: ['proxy1:8080:user:pass'],
                testTimeout: 20000,
                batchSize: 3
            });
            expect(helper.apiKeys).toEqual(['key1', 'key2']);
            expect(helper.models).toEqual(['model1', 'model2']);
            expect(helper.proxy).toEqual(['proxy1:8080:user:pass']);
            expect(helper.testTimeout).toBe(20000);
            expect(helper.batchSize).toBe(3);
        });
    });

    describe('_maskKey', () => {
        it('should mask long keys', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._maskKey('longkey123')).toBe('longke...y123');
        });

        it('should return null for null key', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._maskKey(null)).toBe('null');
        });

        it('should return *** for short keys', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._maskKey('short')).toBe('***');
        });
    });

    describe('_getNextApiKey', () => {
        it('should return null for empty apiKeys', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._getNextApiKey()).toBeNull();
        });

        it('should return first key and increment index', () => {
            const helper = new FreeOpenRouterHelper({ apiKeys: ['key1', 'key2'] });
            expect(helper._getNextApiKey()).toBe('key1');
            expect(helper.currentKeyIndex).toBe(1);
        });

        it('should rotate through keys', () => {
            const helper = new FreeOpenRouterHelper({ apiKeys: ['key1', 'key2'] });
            expect(helper._getNextApiKey()).toBe('key1');
            expect(helper._getNextApiKey()).toBe('key2');
            expect(helper._getNextApiKey()).toBe('key1');
        });
    });

    describe('_selectProxy', () => {
        it('should return null when proxy is empty', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._selectProxy()).toBeNull();
        });

        it('should return null when proxy is null', () => {
            const helper = new FreeOpenRouterHelper({ proxy: null });
            expect(helper._selectProxy()).toBeNull();
        });

        it('should return proxy from list', () => {
            const helper = new FreeOpenRouterHelper({ proxy: ['proxy1:8080', 'proxy2:9090'] });
            const result = helper._selectProxy();
            expect(['proxy1:8080', 'proxy2:9090']).toContain(result);
        });
    });

    describe('_parseProxy', () => {
        it('should parse valid proxy string', () => {
            const helper = new FreeOpenRouterHelper();
            const result = helper._parseProxy('host:port:user:pass');
            expect(result).toEqual({
                host: 'host',
                port: 'port',
                username: 'user',
                password: 'pass'
            });
        });

        it('should return null for invalid format', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._parseProxy('invalid')).toBeNull();
        });

        it('should return null for null input', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper._parseProxy(null)).toBeNull();
        });
    });

    describe('updateConfig', () => {
        it('should update apiKeys', () => {
            const helper = new FreeOpenRouterHelper();
            helper.updateConfig(['newKey'], null);
            expect(helper.apiKeys).toEqual(['newKey']);
        });

        it('should update models and reset results', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['model1'] };
            helper.updateConfig(null, ['newModel']);
            expect(helper.models).toEqual(['newModel']);
            expect(helper.results).toBeNull();
        });
    });

    describe('getResults', () => {
        it('should return null when no results', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.getResults()).toBeNull();
        });

        it('should return results when available', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['model1'] };
            expect(helper.getResults()).toEqual({ working: ['model1'] });
        });

        it('should mark stale cache results', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['model1'], testDuration: 100 };
            helper.cacheTimestamp = Date.now() - 400000;
            const result = helper.getResults();
            expect(result.stale).toBe(true);
        });
    });

    describe('isCacheValid', () => {
        it('should return false when no results', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.isCacheValid()).toBe(false);
        });

        it('should return true when cache is valid', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['model1'] };
            helper.cacheTimestamp = Date.now();
            expect(helper.isCacheValid()).toBe(true);
        });

        it('should return false when cache is expired', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['model1'] };
            helper.cacheTimestamp = Date.now() - 400000;
            expect(helper.isCacheValid()).toBe(false);
        });
    });

    describe('getCacheAge', () => {
        it('should return null when no timestamp', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.getCacheAge()).toBeNull();
        });

        it('should return age in ms', () => {
            const helper = new FreeOpenRouterHelper();
            helper.cacheTimestamp = Date.now() - 5000;
            const age = helper.getCacheAge();
            expect(age).toBeGreaterThanOrEqual(5000);
        });
    });

    describe('isTesting', () => {
        it('should return false initially', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.isTesting()).toBe(false);
        });

        it('should return true when testing', () => {
            const helper = new FreeOpenRouterHelper();
            helper.testing = true;
            expect(helper.isTesting()).toBe(true);
        });
    });

    describe('getQuickStatus', () => {
        it('should return idle when not testing and no results', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.getQuickStatus()).toEqual({ status: 'idle' });
        });

        it('should return testing status when testing', () => {
            const helper = new FreeOpenRouterHelper();
            helper.testing = true;
            helper.models = ['m1', 'm2'];
            helper.results = { working: ['m1'] };
            const status = helper.getQuickStatus();
            expect(status.status).toBe('testing');
        });

        it('should return done status when results available', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = {
                working: ['m1'],
                failed: ['m2'],
                total: 2,
                testDuration: 1000
            };
            const status = helper.getQuickStatus();
            expect(status.status).toBe('done');
            expect(status.working).toBe(1);
            expect(status.failed).toBe(1);
        });
    });

    describe('getOptimizedModelList', () => {
        it('should return empty when no results', () => {
            const helper = new FreeOpenRouterHelper();
            expect(helper.getOptimizedModelList()).toEqual({ primary: null, fallbacks: [] });
        });

        it('should return first working as primary', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['m1', 'm2'] };
            const result = helper.getOptimizedModelList();
            expect(result.primary).toBe('m1');
            expect(result.fallbacks).toEqual(['m2']);
        });

        it('should use specified primary if in working list', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['m1', 'm2'] };
            const result = helper.getOptimizedModelList('m2');
            expect(result.primary).toBe('m2');
            expect(result.fallbacks).toEqual(['m1']);
        });

        it('should use first working if specified primary not in list', () => {
            const helper = new FreeOpenRouterHelper();
            helper.results = { working: ['m1', 'm2'] };
            const result = helper.getOptimizedModelList('m3');
            expect(result.primary).toBe('m1');
        });
    });

    describe('waitForTests', () => {
        it('should return immediately if not testing', async () => {
            const helper = new FreeOpenRouterHelper();
            const result = await helper.waitForTests(100);
            expect(result).toBeNull();
        });

        it('should wait for tests to complete', async () => {
            const helper = new FreeOpenRouterHelper();
            helper.testing = true;
            helper.results = { working: ['m1'] };
            
            setTimeout(() => {
                helper.testing = false;
            }, 10);

            const result = await helper.waitForTests(100);
            expect(result).toEqual({ working: ['m1'] });
        });
    });
});
