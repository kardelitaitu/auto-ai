/**
 * @fileoverview Unit Tests for FreeApiRouter
 * Tests the free API router with API key rotation, model cascading, and proxy routing
 * @module tests/unit/free-api-router.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/logger.js', () => {
    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        success: vi.fn()
    };
    return {
        createLogger: () => mockLogger
    };
});

vi.mock('../../utils/proxy-agent.js', () => ({
    createProxyAgent: vi.fn().mockReturnValue({ agent: 'mock-agent' })
}));

vi.mock('../../utils/circuit-breaker.js', () => {
    class CircuitBreaker {
        constructor() {}
        check() { return { allowed: true }; }
        recordSuccess() {}
        recordFailure() {}
    }
    return { CircuitBreaker };
});

vi.mock('../../utils/rate-limit-tracker.js', () => {
    class RateLimitTracker {
        constructor() {}
        getWarningStatus() { return 'ok'; }
        trackRequest() {}
    }
    return { RateLimitTracker };
});

vi.mock('../../utils/request-dedupe.js', () => {
    class RequestDedupe {
        constructor() {}
        check() { return { hit: false }; }
        set() {}
    }
    return { RequestDedupe };
});

vi.mock('../../utils/model-perf-tracker.js', () => {
    class ModelPerfTracker {
        constructor() {}
        trackSuccess() {}
        trackFailure() {}
    }
    return { ModelPerfTracker };
});

vi.mock('../../utils/api-key-timeout-tracker.js', () => {
    class ApiKeyTimeoutTracker {
        constructor() {}
        getTimeoutForKey() { return 60000; }
        trackRequest() {}
    }
    return { ApiKeyTimeoutTracker };
});

vi.mock('../../utils/config-validator.js', () => {
    class ConfigValidator {
        validate() { return { valid: true }; }
    }
    return { ConfigValidator };
});

vi.mock('../../utils/errors.js', () => ({
    RouterError: class RouterError extends Error {
        constructor(message, options) {
            super(message);
            this.code = options?.code;
            this.metadata = options?.metadata;
        }
    },
    ProxyError: class ProxyError extends Error {},
    classifyHttpError: vi.fn((status, text, metadata) => {
        if (status >= 400) {
            const error = new Error(`HTTP ${status}: ${text || 'Error'}`);
            error.code = 'ROUTER_ERROR';
            error.metadata = { ...metadata, statusCode: status, retryable: status >= 500 || status === 429 };
            throw error;
        }
        return null;
    })
}));

const { CircuitBreaker } = await import('../../utils/circuit-breaker.js');
const { RateLimitTracker } = await import('../../utils/rate-limit-tracker.js');
const { RequestDedupe } = await import('../../utils/request-dedupe.js');
const { ModelPerfTracker } = await import('../../utils/model-perf-tracker.js');
const { ApiKeyTimeoutTracker } = await import('../../utils/api-key-timeout-tracker.js');
const { ConfigValidator } = await import('../../utils/config-validator.js');

describe('FreeApiRouter', () => {
    let router;
    let originalFetch;
    
    beforeEach(() => {
        vi.clearAllMocks();
        originalFetch = global.fetch;
        global.fetch = vi.fn();
    });
    
    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('Constructor', () => {
        it('should initialize with default values when disabled', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            expect(router.config.enabled).toBe(false);
            expect(router.config.apiKeys).toEqual([]);
            expect(router.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
            expect(router.defaultTimeout).toBe(60000);
            expect(router.quickTimeout).toBe(20000);
            expect(router.sessionApiKey).toBeNull();
            expect(router.stats.totalRequests).toBe(0);
        });

        it('should initialize with custom options', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({
                enabled: true,
                apiKeys: ['key1', 'key2'],
                primaryModel: 'test/model',
                fallbackModels: ['fallback/model'],
                proxyEnabled: true,
                proxyList: ['proxy1:8080', 'proxy2:9090'],
                timeout: 30000,
                quickTimeout: 10000,
                browserId: 'browser1',
                taskId: 'task1'
            });
            
            expect(router.config.enabled).toBe(true);
            expect(router.config.apiKeys).toEqual(['key1', 'key2']);
            expect(router.config.models.primary).toBe('test/model');
            expect(router.config.models.fallbacks).toEqual(['fallback/model']);
            expect(router.config.proxy.enabled).toBe(true);
            expect(router.config.proxy.list).toEqual(['proxy1:8080', 'proxy2:9090']);
            expect(router.defaultTimeout).toBe(30000);
            expect(router.quickTimeout).toBe(10000);
            expect(router.browserId).toBe('browser1');
            expect(router.taskId).toBe('task1');
            expect(router.sessionId).toBe('browser1:task1');
        });

        it('should select API key based on session hash', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({
                enabled: true,
                apiKeys: ['key1', 'key2', 'key3'],
                browserId: 'browser1',
                taskId: 'task1'
            });
            
            expect(router.sessionApiKeyIndex).toBeGreaterThanOrEqual(0);
            expect(router.sessionApiKeyIndex).toBeLessThan(3);
            expect(router.sessionApiKey).toBeDefined();
        });

        it('should initialize modules when enabled', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: true, apiKeys: ['key1'] });
            
            expect(router.circuitBreaker).toBeDefined();
            expect(router.rateLimitTracker).toBeDefined();
            expect(router.requestDedupe).toBeDefined();
            expect(router.modelPerfTracker).toBeDefined();
            expect(router.apiKeyTimeoutTracker).toBeDefined();
            expect(router.configValidator).toBeDefined();
        });
    });

    describe('_hash', () => {
        it('should return consistent hash for same string', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const hash1 = router._hash('test');
            const hash2 = router._hash('test');
            expect(hash1).toBe(hash2);
        });

        it('should return different hash for different strings', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const hash1 = router._hash('test1');
            const hash2 = router._hash('test2');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('setTask', () => {
        it('should update browserId and taskId', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ 
                enabled: false, 
                browserId: 'old-browser', 
                taskId: 'old-task' 
            });
            
            router.setTask('new-browser', 'new-task');
            
            expect(router.browserId).toBe('new-browser');
            expect(router.taskId).toBe('new-task');
            expect(router.sessionId).toBe('new-browser:new-task');
        });

        it('should not change session if values are same', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ 
                enabled: false, 
                browserId: 'browser', 
                taskId: 'task' 
            });
            
            const originalSessionId = router.sessionId;
            router.setTask('browser', 'task');
            
            expect(router.sessionId).toBe(originalSessionId);
        });
    });

    describe('_selectRequestProxy', () => {
        it('should return null when proxy is disabled', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ 
                enabled: false, 
                proxyEnabled: false 
            });
            
            const proxy = router._selectRequestProxy();
            expect(proxy).toBeNull();
        });

        it('should return null when proxy list is empty', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ 
                enabled: false, 
                proxyEnabled: true,
                proxyList: []
            });
            
            const proxy = router._selectRequestProxy();
            expect(proxy).toBeNull();
        });

        it('should return a proxy from the list when enabled', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ 
                enabled: false, 
                proxyEnabled: true,
                proxyList: ['proxy1:8080', 'proxy2:9090']
            });
            
            const proxy = router._selectRequestProxy();
            expect(['proxy1:8080', 'proxy2:9090']).toContain(proxy);
        });
    });

    describe('_parseProxy', () => {
        it('should return null for empty string', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = router._parseProxy('');
            expect(result).toBeNull();
        });

        it('should return null for null input', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = router._parseProxy(null);
            expect(result).toBeNull();
        });

        it('should parse proxy with host and port only', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = router._parseProxy('proxy.example.com:8080');
            expect(result).toEqual({
                host: 'proxy.example.com',
                port: '8080',
                username: null,
                password: null
            });
        });

        it('should parse proxy with credentials', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = router._parseProxy('proxy.example.com:8080:user:pass');
            expect(result).toEqual({
                host: 'proxy.example.com',
                port: '8080',
                username: 'user',
                password: 'pass'
            });
        });

        it('should return null for invalid format', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = router._parseProxy('invalid');
            expect(result).toBeNull();
        });
    });

    describe('_maskKey', () => {
        it('should return null for null key', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            expect(router._maskKey(null)).toBe('null');
        });

        it('should return *** for short key', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            expect(router._maskKey('short')).toBe('***');
        });

        it('should mask long key properly', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const masked = router._maskKey('abcdefgh12345678');
            expect(masked).toBe('abcdef...5678');
            expect(masked.length).toBeLessThan('abcdefgh12345678'.length);
        });
    });

    describe('processRequest', () => {
        it('should return error when not enabled', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            router = new FreeApiRouter({ enabled: false });
            
            const result = await router.processRequest({ messages: [{ role: 'user', content: 'hello' }] });
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Free API router not enabled');
            expect(router.stats.totalRequests).toBe(1);
        });

        it('should return cached response on dedupe hit', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            const { setSharedHelper } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model'
            });
            
            router.requestDedupe.check = vi.fn().mockReturnValue({
                hit: true,
                response: 'cached response'
            });
            
            const result = await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }],
                maxTokens: 100,
                temperature: 0.7
            });
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('cached response');
            expect(result.fromCache).toBe(true);
            expect(router.stats.dedupeHits).toBe(1);
            expect(router.stats.successes).toBe(1);
        });

        it('should make successful API call', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model',
                fallbackModels: []
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'test response' } }]
                })
            });
            
            const result = await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }],
                maxTokens: 100,
                temperature: 0.7
            });
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('test response');
            expect(result.model).toBe('test/model');
            expect(router.stats.successes).toBe(1);
        });

        it('should handle API error with rate limiting', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model',
                fallbackModels: []
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 429,
                text: async () => 'Rate limited'
            });
            
            let result;
            try {
                result = await router._tryModelWithKey('test/model', [{ role: 'user', content: 'hello' }], 100, 0.7, Date.now());
            } catch (e) {
                result = { success: false, error: e.message };
            }
            
            expect(result.success).toBe(false);
        });

        it('should handle network error gracefully', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model',
                fallbackModels: []
            });
            
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            
            let result;
            try {
                result = await router._tryModelWithKey('test/model', [{ role: 'user', content: 'hello' }], 100, 0.7, Date.now());
            } catch (e) {
                result = { success: false, error: e.message };
            }
            
            expect(result.success).toBe(false);
        });

        it('should track stats correctly', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model',
                fallbackModels: []
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'response' } }],
                    model: 'test/model',
                    usage: { total_tokens: 10 }
                })
            });
            
            await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }]
            });
            
            expect(router.stats.totalRequests).toBe(1);
            expect(router.stats.successes).toBe(1);
            expect(router.stats.failures).toBe(0);
        });
    });

    describe('_tryModelWithKey', () => {
        it('should select proxy and call appropriate method', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model',
                proxyEnabled: true,
                proxyList: ['proxy:8080']
            });
            
            router._parseProxy = vi.fn().mockReturnValue({ host: 'proxy', port: '8080' });
            router._callThroughProxy = vi.fn().mockResolvedValue({ success: true, content: 'response' });
            
            const result = await router._tryModelWithKey(
                'test/model',
                [{ role: 'user', content: 'hello' }],
                100,
                0.7,
                Date.now()
            );
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('response');
        });
    });

    describe('_callDirect', () => {
        it('should make direct API call', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key']
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'direct response' } }]
                })
            });
            
            const result = await router._callDirect(
                { model: 'test', messages: [] },
                60000
            );
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('direct response');
        });

        it('should handle timeout', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key']
            });
            
            global.fetch = vi.fn().mockImplementation(() => 
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AbortError')), 10)
                )
            );
            
            let errorThrown = false;
            try {
                await router._callDirect(
                    { model: 'test', messages: [] },
                    5
                );
            } catch (e) {
                errorThrown = true;
            }
            
            expect(errorThrown).toBe(true);
        });

        it('should handle non-ok response', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key']
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error'
            });
            
            let errorThrown = false;
            try {
                await router._callDirect(
                    { model: 'test', messages: [] },
                    60000
                );
            } catch (e) {
                errorThrown = true;
            }
            
            expect(errorThrown).toBe(true);
        });
    });

    describe('Error handling', () => {
        it('should handle empty messages array', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model'
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'response' } }]
                })
            });
            
            const result = await router.processRequest({ messages: [] });
            
            expect(result.success).toBe(true);
        });

        it('should use default values for optional params', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model'
            });
            
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: 'response' } }]
                })
            });
            
            await router.processRequest({ messages: [{ role: 'user', content: 'hello' }] });
            
            expect(global.fetch).toHaveBeenCalled();
            const callArgs = global.fetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.max_tokens).toBe(100);
            expect(body.temperature).toBe(0.7);
        });
    });

    describe('getStats', () => {
        it('should return stats object', () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ enabled: false });
            
            expect(router.stats).toBeDefined();
            expect(router.stats.totalRequests).toBe(0);
            expect(router.stats.successes).toBe(0);
            expect(router.stats.failures).toBe(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle missing API keys gracefully', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: []
            });
            
            const result = await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }]
            });
            
            expect(result.success).toBe(false);
        });

        it('should handle fallback models when primary fails', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'primary/model',
                fallbackModels: ['fallback/model']
            });
            
            let callCount = 0;
            global.fetch = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: false,
                        status: 500,
                        text: async () => 'Error'
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: 'fallback response' } }]
                    })
                });
            });
            
            const result = await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }]
            });
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('fallback response');
        });

        it('should track circuit breaker state', async () => {
            const { FreeApiRouter } = require('../../utils/free-api-router.js');
            
            router = new FreeApiRouter({ 
                enabled: true, 
                apiKeys: ['test-key'],
                primaryModel: 'test/model'
            });
            
            router.circuitBreaker.check = vi.fn().mockReturnValue({ allowed: false });
            
            const result = await router.processRequest({ 
                messages: [{ role: 'user', content: 'hello' }]
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('exhausted');
        });
    });
});
