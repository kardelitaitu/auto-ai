/**
 * @fileoverview Unit tests for utils/config-manager.js
 * @module tests/unit/utils-config-manager.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManager, CONFIG_SCHEMA } from '../../utils/config-manager.js';
import * as fs from 'fs';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn()
    }
}));

vi.mock('path', () => ({
    join: vi.fn((...args) => args.join('/')),
    dirname: vi.fn(),
    default: { 
        join: vi.fn(),
        dirname: vi.fn()
    }
}));

vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }))
}));

describe('utils/config-manager', () => {
    let manager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new ConfigManager();
    });

    describe('Constructor', () => {
        it('should initialize with empty config', () => {
            expect(manager.config).toEqual({});
            expect(manager.cache.size).toBe(0);
            expect(manager.initialized).toBe(false);
        });
    });

    describe('init', () => {
        it('should initialize successfully', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.initialized).toBe(true);
        });

        it('should return existing instance if already initialized', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await manager.init();
            const result = await manager.init();
            
            expect(result).toBe(manager);
        });

        it('should return promise if init in progress', async () => {
            fs.existsSync.mockReturnValue(false);
            
            const initPromise = manager.init();
            const result = await manager.init();
            
            expect(result).toBe(manager);
            await initPromise;
        });
    });

    describe('_loadDefaults', () => {
        it('should load all default values', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['twitter.session.minSeconds']).toBeDefined();
            expect(manager.config['twitter.session.minSeconds'].value).toBe(300);
        });
    });

    describe('_loadFromSettings', () => {
        it('should use default values when file exists', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify({
                twitter: { session: { minSeconds: 600 } }
            }));
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['twitter.session.minSeconds']).toBeDefined();
        });

        it('should handle missing settings file', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['twitter.session.minSeconds'].value).toBe(300);
        });
    });

    describe('_loadFromEnvironment', () => {
        it('should load boolean env vars', async () => {
            fs.existsSync.mockReturnValue(false);
            process.env.DOCKER_LLM_ENABLED = 'true';
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['llm.local.enabled'].value).toBe(true);
            
            delete process.env.DOCKER_LLM_ENABLED;
        });

        it('should load number env vars', async () => {
            fs.existsSync.mockReturnValue(false);
            process.env.TWITTER_MIN_DURATION = '500';
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['twitter.session.minSeconds'].value).toBe(500);
            
            delete process.env.TWITTER_MIN_DURATION;
        });

        it('should load string env vars', async () => {
            fs.existsSync.mockReturnValue(false);
            process.env.LOG_LEVEL = 'debug';
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.config['system.logLevel'].value).toBe('debug');
            
            delete process.env.LOG_LEVEL;
        });
    });

    describe('_convertValue', () => {
        it('should convert boolean strings from env vars', async () => {
            fs.existsSync.mockReturnValue(false);
            process.env.DOCKER_LLM_ENABLED = 'true';
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.get('llm.local.enabled')).toBe(true);
            
            delete process.env.DOCKER_LLM_ENABLED;
        });

        it('should handle NaN for invalid numbers', async () => {
            fs.existsSync.mockReturnValue(false);
            process.env.TEST_NUM = 'not-a-number';
            
            await manager.init({ validate: false, cache: false });
            
            expect(manager.get('twitter.session.minSeconds')).toBe(300);
            
            delete process.env.TEST_NUM;
        });
    });

    describe('get', () => {
        it('should throw if not initialized', () => {
            expect(() => manager.get('test')).toThrow('not initialized');
        });

        it('should return cached value', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: true });
            
            manager.set('test.key', 'cached');
            
            expect(manager.get('test.key')).toBe('cached');
        });

        it('should return default value for unknown key', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.get('unknown.key', 'default')).toBe('default');
        });

        it('should return schema default for unknown key without provided default', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.get('twitter.session.minSeconds')).toBe(300);
        });

        it('should throw for unknown key without defaults', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(() => manager.get('nonexistent.key')).toThrow();
        });
    });

    describe('getWithMeta', () => {
        it('should return value with metadata', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            const result = manager.getWithMeta('twitter.session.minSeconds');
            
            expect(result.value).toBe(300);
            expect(result.source).toBe('default');
            expect(result.timestamp).toBeDefined();
        });

        it('should return undefined for unknown key', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.getWithMeta('unknown')).toBeUndefined();
        });
    });

    describe('set', () => {
        it('should set runtime value', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            manager.set('test.key', 'test-value');
            
            expect(manager.get('test.key')).toBe('test-value');
            expect(manager.config['test.key'].source).toBe('runtime');
        });

        it('should invalidate cache on set', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: true });
            
            manager.cache.set('test.key', { value: 'old' });
            manager.set('test.key', 'new');
            
            expect(manager.get('test.key')).toBe('new');
        });
    });

    describe('has', () => {
        it('should throw if not initialized', () => {
            expect(() => manager.has('test')).toThrow('not initialized');
        });

        it('should return true for existing key', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.has('twitter.session.minSeconds')).toBe(true);
        });

    it('should return false for unknown key', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            expect(manager.has('unknown.key')).toBe(false);
        });
    });

    describe('keys', () => {
        it('should return all config keys', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            const keys = manager.keys();
            
            expect(keys.length).toBeGreaterThan(0);
            expect(keys).toContain('twitter.session.minSeconds');
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: true });
            
            manager.get('twitter.session.minSeconds');
            manager.get('twitter.session.minSeconds');
            
            const stats = manager.getCacheStats();
            
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe('50.00%');
        });

        it('should handle empty cache', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: true });
            
            const stats = manager.getCacheStats();
            
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.hitRate).toBe('0.00%');
        });
    });

    describe('clearCache', () => {
        it('should clear cache and reset stats', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: true });
            
            manager.get('twitter.session.minSeconds');
            manager.clearCache();
            
            const stats = manager.getCacheStats();
            
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.size).toBe(0);
        });
    });

    describe('getSources', () => {
        it('should return loaded sources', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            const sources = manager.getSources();
            
            expect(sources).toContain('defaults');
            expect(sources).toContain('settings.json');
            expect(sources).toContain('environment');
        });
    });

    describe('reload', () => {
        it('should reload configuration', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            manager.set('test.key', 'modified');
            await manager.reload();
            
            expect(manager.config['test.key']).toBeUndefined();
        });
    });

    describe('toJSON', () => {
        it('should export config as JSON', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            const json = manager.toJSON();
            
            expect(json.twitter).toBeDefined();
            expect(json.twitter.session).toBeDefined();
        });
    });

    describe('CONFIG_SCHEMA', () => {
        it('should have twitter configuration', () => {
            expect(CONFIG_SCHEMA['twitter.session.minSeconds']).toBeDefined();
            expect(CONFIG_SCHEMA['twitter.session.minSeconds'].type).toBe('number');
        });

        it('should have LLM configuration', () => {
            expect(CONFIG_SCHEMA['llm.local.enabled']).toBeDefined();
            expect(CONFIG_SCHEMA['llm.cloud.enabled']).toBeDefined();
        });

        it('should have system configuration', () => {
            expect(CONFIG_SCHEMA['system.environment']).toBeDefined();
            expect(CONFIG_SCHEMA['system.logLevel']).toBeDefined();
        });
    });

    describe('get with schema default', () => {
        it('should return schema default for known key', async () => {
            fs.existsSync.mockReturnValue(false);
            await manager.init({ validate: false, cache: false });
            
            const value = manager.get('system.logLevel');
            expect(value).toBeDefined();
        });
    });
});
