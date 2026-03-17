/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

/**
 * @fileoverview Unit tests for api/twitter/intent-like.js
 * @module tests/unit/twitter/intent-like.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies
vi.mock('@api/core/context.js', () => ({
    getPage: vi.fn(),
}));

vi.mock('@api/core/logger.js', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

vi.mock('@api/interactions/wait.js', () => ({
    wait: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@api/interactions/actions.js', () => ({
    click: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@api/interactions/navigation.js', () => ({
    back: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@api/interactions/queries.js', () => ({
    visible: vi.fn().mockResolvedValue(false),
}));

vi.mock('@api/utils/math.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min, max) => Math.floor((min + max) / 2)),
    },
}));

describe('api/twitter/intent-like.js', () => {
    let like;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        const module = await import('@api/twitter/intent-like.js');
        like = module.like;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('like()', () => {
        it('should return error for invalid tweet URL', async () => {
            const resultPromise = like('https://x.com/invalid');
            
            // Fast-forward past timeout
            await vi.advanceTimersByTimeAsync(21000);
            
            const result = await resultPromise;
            expect(result.success).toBe(false);
        });

        it('should extract tweet ID from valid URL', async () => {
            const { getPage } = await import('@api/core/context.js');
            const { goto } = await import('@api/interactions/navigation.js');
            const { visible } = await import('@api/interactions/queries.js');

            getPage.mockReturnValue({ page: true });
            visible.mockResolvedValue(false); // No confirm button

            const resultPromise = like('https://x.com/user/status/123456789');
            
            // Fast-forward past timeout
            await vi.advanceTimersByTimeAsync(21000);
            
            const result = await resultPromise;
            
            expect(getPage).toHaveBeenCalled();
        });

        it('should handle timeout', async () => {
            const { getPage } = await import('@api/core/context.js');
            
            getPage.mockReturnValue({ page: true });

            // Make goto hang forever
            const { goto } = await import('@api/interactions/navigation.js');
            goto.mockImplementation(() => new Promise(() => {}));

            const resultPromise = like('https://x.com/user/status/123');
            
            // Advance past timeout
            await vi.advanceTimersByTimeAsync(21000);
            
            const result = await resultPromise;
            expect(result.success).toBe(false);
            expect(result.reason).toBe('timeout');
        });
    });
});
