/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { identifyROI } from '@api/utils/roi-detector.js';

describe('api/utils/roi-detector.js', () => {
    let mockPage;

    beforeEach(() => {
        mockPage = {
            isClosed: vi.fn(),
            $: vi.fn(),
            boundingBox: vi.fn(),
            viewportSize: vi.fn(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('identifyROI', () => {
        it('should return null if page is closed', async () => {
            mockPage.isClosed.mockReturnValue(true);
            const result = await identifyROI(mockPage);
            expect(result).toBeNull();
        });

        it('should return null if page is null', async () => {
            const result = await identifyROI(null);
            expect(result).toBeNull();
        });

        it('should return null if no matching element found', async () => {
            mockPage.isClosed.mockReturnValue(false);
            mockPage.$.mockResolvedValue(null);
            mockPage.viewportSize.mockReturnValue({ width: 1280, height: 720 });

            const result = await identifyROI(mockPage);
            expect(result).toBeNull();
        });

        it('should return null for elements too small', async () => {
            mockPage.isClosed.mockReturnValue(false);
            mockPage.$.mockResolvedValueOnce({}).mockResolvedValue(null);
            mockPage.boundingBox.mockResolvedValue({ x: 100, y: 100, width: 30, height: 30 });
            mockPage.viewportSize.mockReturnValue({ width: 1280, height: 720 });

            const result = await identifyROI(mockPage);
            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            mockPage.isClosed.mockReturnValue(false);
            mockPage.$.mockRejectedValue(new Error('Selector error'));

            const result = await identifyROI(mockPage);
            expect(result).toBeNull();
        });
    });
});
