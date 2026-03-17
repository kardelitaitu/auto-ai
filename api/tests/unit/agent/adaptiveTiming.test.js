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

describe('api/agent/adaptiveTiming.js', () => {
    let adaptiveTiming;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('@api/agent/adaptiveTiming.js');
        adaptiveTiming = module.adaptiveTiming || module.default;
    });

    describe('adaptiveTiming object', () => {
        it('should be defined', () => {
            expect(adaptiveTiming).toBeDefined();
        });

        it('should have getAdjustedDelay method', () => {
            expect(typeof adaptiveTiming.getAdjustedDelay).toBe('function');
        });

        it('should have getTimingForSite method', () => {
            expect(typeof adaptiveTiming.getTimingForSite).toBe('function');
        });

        it('should have clearProfiles method', () => {
            expect(typeof adaptiveTiming.clearProfiles).toBe('function');
        });
    });
});
