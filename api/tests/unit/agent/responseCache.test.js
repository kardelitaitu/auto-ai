/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@api/core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

describe('api/agent/responseCache.js', () => {
    let responseCache;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('@api/agent/responseCache.js');
        responseCache = module.responseCache || module.default;
    });

    describe('responseCache', () => {
        it('should be defined', () => {
            expect(responseCache).toBeDefined();
        });

        it('should have get method', () => {
            expect(typeof responseCache.get).toBe('function');
        });

        it('should have set method', () => {
            expect(typeof responseCache.set).toBe('function');
        });

        it('should have clear method', () => {
            expect(typeof responseCache.clear).toBe('function');
        });

        it('should return null for non-existent key', () => {
            const result = responseCache.get('nonexistent-key-12345');
            expect(result).toBeNull();
        });
    });
});
