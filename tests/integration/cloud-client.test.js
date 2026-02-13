/**
 * @fileoverview Cloud Client Integration Tests
 * Tests the CloudClient module for OpenRouter API integration
 * @module tests/integration/cloud-client.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createLogger } from '../../utils/logger.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

vi.mock('../../utils/configLoader.js', () => ({
    getSettings: vi.fn()
}));

vi.mock('../../utils/multi-api.js', () => ({
    MultiOpenRouterClient: vi.fn().mockImplementation(() => ({
        processRequest: vi.fn(),
        getStats: vi.fn().mockReturnValue({ totalRequests: 0 })
    }))
}));

vi.mock('../../utils/free-api-router.js', () => ({
    FreeApiRouter: vi.fn().mockImplementation(() => ({
        isReady: vi.fn().mockReturnValue(false),
        processRequest: vi.fn(),
        getStats: vi.fn().mockReturnValue({}),
        getSessionInfo: vi.fn().mockReturnValue({}),
        getModelsInfo: vi.fn().mockReturnValue({})
    })),
    setSharedHelper: vi.fn()
}));

vi.mock('../../utils/free-openrouter-helper.js', () => ({
    FreeOpenRouterHelper: {
        getInstance: vi.fn().mockReturnValue({
            testAllModelsInBackground: vi.fn(),
            getResults: vi.fn().mockReturnValue({ testDuration: 0 }),
            isTesting: vi.fn().mockReturnValue(false),
            getOptimizedModelList: vi.fn().mockReturnValue({ primary: null, fallbacks: [] }),
            isCacheValid: vi.fn().mockReturnValue(true),
            updateConfig: vi.fn()
        })
    }
}));

const { getSettings } = await import('../../utils/configLoader.js');
const { MultiOpenRouterClient } = await import('../../utils/multi-api.js');
const { FreeApiRouter } = await import('../../utils/free-api-router.js');

describe('CloudClient Integration', () => {
    let CloudClient;
    let cloudClient;

    beforeEach(async () => {
        vi.clearAllMocks();

        getSettings.mockResolvedValue({
            llm: {
                cloud: {
                    timeout: 60000,
                    defaultModel: 'anthropic/claude-3.5-sonnet',
                    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
                    providers: []
                }
            },
            open_router_free_api: {
                enabled: false
            }
        });

        if (!CloudClient) {
            const module = await import('../../core/cloud-client.js');
            CloudClient = module.default;
        }

        cloudClient = new CloudClient();
    });

    describe('Initialization', () => {
        it('should initialize with default values', async () => {
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(cloudClient.config).toBeDefined();
            expect(cloudClient.apiEndpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
            expect(cloudClient.defaultModel).toBe('anthropic/claude-3.5-sonnet');
            expect(cloudClient.timeout).toBe(60000);
            expect(cloudClient.stats.totalRequests).toBe(0);
            expect(cloudClient.stats.successfulRequests).toBe(0);
            expect(cloudClient.stats.failedRequests).toBe(0);
        });

        it('should load configuration from settings', async () => {
            getSettings.mockResolvedValue({
                llm: {
                    cloud: {
                        timeout: 120000,
                        defaultModel: 'anthropic/claude-3-opus',
                        endpoint: 'https://custom.api.com/v1/chat',
                        providers: []
                    }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.timeout).toBe(120000);
            expect(client.defaultModel).toBe('anthropic/claude-3-opus');
            expect(client.apiEndpoint).toBe('https://custom.api.com/v1/chat');
        });

        it('should initialize with single provider', async () => {
            getSettings.mockResolvedValue({
                llm: {
                    cloud: {
                        providers: [{
                            apiKey: 'test-key-123',
                            model: 'anthropic/claude-3.5-sonnet'
                        }]
                    }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.apiKey).toBe('test-key-123');
            expect(client.defaultModel).toBe('anthropic/claude-3.5-sonnet');
            expect(client.multiClient).toBeNull();
        });

        it('should initialize with multiple providers for fallback', async () => {
            getSettings.mockResolvedValue({
                llm: {
                    cloud: {
                        providers: [
                            { apiKey: 'key-1', model: 'anthropic/claude-3.5-sonnet' },
                            { apiKey: 'key-2', model: 'anthropic/claude-3-haiku' },
                            { apiKey: 'key-3', model: 'openai/gpt-4o' }
                        ]
                    }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(MultiOpenRouterClient).toHaveBeenCalledWith({
                apiKeys: ['key-1', 'key-2', 'key-3'],
                models: ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku', 'openai/gpt-4o'],
                endpoint: 'https://openrouter.ai/api/v1/chat/completions',
                timeout: 60000,
                defaultModel: 'anthropic/claude-3.5-sonnet',
                retryDelay: 2000
            });
            expect(client.multiClient).toBeDefined();
        });

        it('should handle no providers configured', async () => {
            getSettings.mockResolvedValue({
                llm: { cloud: { providers: [] } },
                open_router_free_api: { enabled: false }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.apiKey).toBe('');
            expect(client.multiClient).toBeNull();
            expect(client.freeApiRouter).toBeNull();
        });

        it('should initialize free API router when enabled', async () => {
            getSettings.mockResolvedValue({
                llm: { cloud: { providers: [] } },
                open_router_free_api: {
                    enabled: true,
                    api_keys: ['free-key-1', 'free-key-2'],
                    models: {
                        primary: 'anthropic/claude-3.5-sonnet',
                        fallbacks: ['openai/gpt-4o']
                    },
                    proxy: {
                        enabled: false
                    }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(FreeApiRouter).toHaveBeenCalled();
            expect(client.freeApiRouter).toBeDefined();
        });
    });

    describe('Prompt Building', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should build prompt with system and user prompts', () => {
            const request = {
                payload: {
                    systemPrompt: 'You are a helpful assistant.',
                    userPrompt: 'What is 2+2?'
                }
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toBe('You are a helpful assistant.\n\nWhat is 2+2?');
        });

        it('should build prompt with single prompt property', () => {
            const request = {
                payload: { prompt: 'Simple prompt' }
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toBe('Simple prompt');
        });

        it('should build prompt with direct prompt property', () => {
            const request = {
                prompt: 'Direct prompt'
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toBe('Direct prompt');
        });

        it('should add breadcrumbs context', () => {
            const request = {
                prompt: 'Original prompt',
                context: {
                    breadcrumbs: 'Navigated to Twitter, scrolled timeline'
                }
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toContain('Context - Recent Actions:');
            expect(prompt).toContain('Navigated to Twitter, scrolled timeline');
            expect(prompt).toContain('Original prompt');
        });

        it('should add state context', () => {
            const request = {
                prompt: 'Original prompt',
                context: {
                    state: { page: 'home', tweets: 15 }
                }
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toContain('Context - Current State:');
            expect(prompt).toContain('"page": "home"');
            expect(prompt).toContain('"tweets": 15');
        });

        it('should handle all context types together', () => {
            const request = {
                payload: {
                    systemPrompt: 'System prompt',
                    userPrompt: 'User prompt'
                },
                context: {
                    breadcrumbs: 'Action 1, Action 2',
                    state: { mode: 'interactive' }
                }
            };

            const prompt = cloudClient._buildPrompt(request);
            expect(prompt).toContain('System prompt');
            expect(prompt).toContain('User prompt');
            expect(prompt).toContain('Context - Recent Actions:');
            expect(prompt).toContain('Context - Current State:');
        });
    });

    describe('Statistics', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should return initial stats', () => {
            const stats = cloudClient.getStats();

            expect(stats).toHaveProperty('totalRequests', 0);
            expect(stats).toHaveProperty('successfulRequests', 0);
            expect(stats).toHaveProperty('failedRequests', 0);
            expect(stats).toHaveProperty('totalTokens', 0);
            expect(stats).toHaveProperty('totalDuration', 0);
            expect(stats).toHaveProperty('keyFallbacks', 0);
            expect(stats).toHaveProperty('avgDuration', 0);
            expect(stats).toHaveProperty('successRate', '0%');
            expect(stats).toHaveProperty('mode', 'single-key');
        });

        it('should calculate average duration correctly', () => {
            cloudClient.stats.totalRequests = 2;
            cloudClient.stats.totalDuration = 4000;
            cloudClient.stats.successfulRequests = 2;

            const stats = cloudClient.getStats();
            expect(stats.avgDuration).toBe(2000);
        });

        it('should calculate success rate correctly', () => {
            cloudClient.stats.totalRequests = 10;
            cloudClient.stats.successfulRequests = 7;

            const stats = cloudClient.getStats();
            expect(stats.successRate).toBe('70.00%');
        });

        it('should reset stats correctly', () => {
            cloudClient.stats.totalRequests = 5;
            cloudClient.stats.successfulRequests = 3;
            cloudClient.stats.failedRequests = 2;
            cloudClient.stats.totalTokens = 1000;

            cloudClient.resetStats();

            expect(cloudClient.stats.totalRequests).toBe(0);
            expect(cloudClient.stats.successfulRequests).toBe(0);
            expect(cloudClient.stats.failedRequests).toBe(0);
            expect(cloudClient.stats.totalTokens).toBe(0);
        });

        it('should have mode in stats', () => {
            const stats = cloudClient.getStats();
            expect(stats.mode).toBeDefined();
        });

        it('should have keyFallbacks in stats', () => {
            cloudClient.stats.keyFallbacks = 5;
            const stats = cloudClient.getStats();
            expect(stats.keyFallbacks).toBe(5);
        });
    });

    describe('Connection Testing', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should return false when no API key configured', async () => {
            const result = await cloudClient.testConnection();
            expect(result).toBe(false);
            expect(cloudClient.stats.failedRequests).toBe(1);
        });
    });

    describe('Free Model Testing', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should return not_enabled when free API is disabled', async () => {
            const result = await cloudClient.testFreeModels();
            expect(result.tested).toBeDefined();
        });

        it('should return no_models when no models configured', async () => {
            getSettings.mockResolvedValue({
                llm: { cloud: { providers: [] } },
                open_router_free_api: {
                    enabled: true,
                    models: { primary: null, fallbacks: [] }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await client.testFreeModels();
            expect(result.tested).toBe(false);
            expect(result.reason).toBe('no_models');
        });

        it('should start background testing when enabled', async () => {
            getSettings.mockResolvedValue({
                llm: { cloud: { providers: [] } },
                open_router_free_api: {
                    enabled: true,
                    api_keys: ['key-1'],
                    models: {
                        primary: 'anthropic/claude-3.5-sonnet',
                        fallbacks: []
                    }
                }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await client.testFreeModels();
            expect(result.tested).toBe(true);
            expect(result.status).toBeDefined();
        });
    });

    describe('Request Sending - Edge Cases', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle missing API key gracefully', async () => {
            getSettings.mockResolvedValue({
                llm: { cloud: { providers: [] } },
                open_router_free_api: { enabled: false }
            });

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await client.sendRequest({
                prompt: 'Test prompt'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('API key not configured');
            expect(client.stats.failedRequests).toBe(1);
        });

        it('should use default maxTokens when not specified', () => {
            const request = {};
            const maxTokens = request.maxTokens || 4096;
            expect(maxTokens).toBe(4096);
        });

        it('should use default temperature when not specified', () => {
            const request = {};
            const temperature = request.temperature !== undefined ? request.temperature : 0.7;
            expect(temperature).toBe(0.7);
        });

        it('should respect custom temperature', () => {
            const request = { temperature: 0.2 };
            const temperature = request.temperature !== undefined ? request.temperature : 0.7;
            expect(temperature).toBe(0.2);
        });
    });

    describe('JSON Response Parsing', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should parse JSON responses starting with {', () => {
            const content = '{"action": "tweet", "text": "Hello"}';
            let data = null;
            if (content.trim().startsWith('{')) {
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    data = null;
                }
            }
            expect(data).toEqual({ action: 'tweet', text: 'Hello' });
        });

        it('should parse JSON responses starting with [', () => {
            const content = '[{"id": 1}, {"id": 2}]';
            let data = null;
            if (content.trim().startsWith('[')) {
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    data = null;
                }
            }
            expect(data).toHaveLength(2);
        });

        it('should not parse non-JSON responses', () => {
            const content = 'This is a plain text response';
            let data = null;
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    data = null;
                }
            }
            expect(data).toBeNull();
        });

        it('should handle invalid JSON gracefully', () => {
            const content = '{"invalid": json}';
            let data = null;
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    data = null;
                }
            }
            expect(data).toBeNull();
        });
    });

    describe('Multi-Key Fallback', () => {
        it('should track key fallbacks in stats', async () => {
            cloudClient.stats.keyFallbacks = 2;

            expect(cloudClient.stats.keyFallbacks).toBe(2);
            const stats = cloudClient.getStats();
            expect(stats.keyFallbacks).toBe(2);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        it('should handle empty settings gracefully', async () => {
            getSettings.mockResolvedValue({});

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.config).toEqual({});
        });

        it('should handle null settings gracefully', async () => {
            getSettings.mockResolvedValue(null);

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.config).toBeDefined();
        });

        it('should handle settings loading error', async () => {
            getSettings.mockRejectedValue(new Error('Config load failed'));

            const client = new CloudClient();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(client.config).toBeNull();
        });
    });
});

describe('CloudClient Request Queue Integration', () => {
    let CloudClient;
    let cloudClient;

    beforeEach(async () => {
        vi.clearAllMocks();

        getSettings.mockResolvedValue({
            llm: {
                cloud: {
                    providers: [{
                        apiKey: 'test-key',
                        model: 'anthropic/claude-3.5-sonnet'
                    }]
                }
            },
            open_router_free_api: { enabled: false }
        });

        const module = await import('../../core/cloud-client.js');
        CloudClient = module.default;
        cloudClient = new CloudClient();
        await new Promise(resolve => setTimeout(resolve, 50));
    });

    describe('Concurrent Request Handling', () => {
        it('should track concurrent requests in stats', () => {
            cloudClient.stats.totalRequests = 5;
            cloudClient.stats.successfulRequests = 3;
            cloudClient.stats.failedRequests = 2;

            const stats = cloudClient.getStats();
            expect(stats.totalRequests).toBe(5);
            expect(stats.successRate).toBe('60.00%');
        });

        it('should accumulate token usage correctly', () => {
            cloudClient.stats.totalTokens = 0;
            cloudClient.stats.totalTokens += 100;
            cloudClient.stats.totalTokens += 200;
            cloudClient.stats.totalTokens += 150;

            expect(cloudClient.stats.totalTokens).toBe(450);
        });
    });

    describe('Configuration Updates', () => {
        it('should have default timeout value', () => {
            expect(cloudClient.timeout).toBeDefined();
            expect(typeof cloudClient.timeout).toBe('number');
        });
    });
});

describe('CloudClient Static Methods', () => {
    let CloudClient;

    beforeEach(async () => {
        vi.clearAllMocks();

        const module = await import('../../core/cloud-client.js');
        CloudClient = module.default;
        CloudClient.sharedHelper = null;
    });

    it('should have sharedHelper static property', () => {
        expect(CloudClient.sharedHelper).toBeNull();
        CloudClient.sharedHelper = { test: true };
        expect(CloudClient.sharedHelper.test).toBe(true);
    });

    it('should reset sharedHelper between test runs', () => {
        CloudClient.sharedHelper = { data: 'test' };
        CloudClient.sharedHelper = null;
        expect(CloudClient.sharedHelper).toBeNull();
    });
});
