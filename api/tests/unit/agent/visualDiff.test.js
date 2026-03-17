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

describe('api/agent/visualDiff.js', () => {
    let visualDiffEngine;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('@api/agent/visualDiff.js');
        visualDiffEngine = module.visualDiffEngine || module.default;
    });

    describe('visualDiffEngine', () => {
        it('should be defined', () => {
            expect(visualDiffEngine).toBeDefined();
        });

        it('should have compareScreenshots method', () => {
            expect(typeof visualDiffEngine.compareScreenshots).toBe('function');
        });

        it('should have identifyChangedRegions method', () => {
            expect(typeof visualDiffEngine.identifyChangedRegions).toBe('function');
        });
    });
});
