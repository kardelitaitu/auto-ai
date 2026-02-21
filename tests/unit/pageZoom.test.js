/**
 * @fileoverview Unit tests for Page Zoom utilities
 * @module tests/unit/pageZoom.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pageZoomIn, pageZoomOut, pageZoomReset, getPageZoom } from '../../utils/pageZoom.js';

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min, _max) => min)
    }
}));

describe('pageZoom.js', () => {
    let mockPage;

    beforeEach(() => {
        mockPage = {
            keyboard: {
                press: vi.fn().mockResolvedValue(undefined)
            },
            mouse: {
                move: vi.fn().mockResolvedValue(undefined),
                wheel: vi.fn().mockResolvedValue(undefined)
            },
            evaluate: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
            waitForTimeout: vi.fn().mockImplementation((_ms) => Promise.resolve())
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('pageZoomIn', () => {
        it('should zoom in using keyboard shortcut', async () => {
            const result = await pageZoomIn(mockPage, 1);

            expect(result.success).toBe(true);
            expect(result.method).toBe('keyboard');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+=');
        });

        it('should zoom in multiple times', async () => {
            const result = await pageZoomIn(mockPage, 3);

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(3);
        });

        it('should cap zoom times at 5', async () => {
            const result = await pageZoomIn(mockPage, 10);

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(5);
        });

        it('should ensure minimum zoom times of 1', async () => {
            const result = await pageZoomIn(mockPage, 0);

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(1);
        });

        it('should fallback to mouse wheel when keyboard fails', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));

            const result = await pageZoomIn(mockPage, 1);

            expect(result.success).toBe(true);
            expect(result.method).toBe('mouse_wheel');
            expect(mockPage.mouse.wheel).toHaveBeenCalled();
        });

        it('should return failure when both methods fail', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            mockPage.mouse.wheel = vi.fn().mockRejectedValue(new Error('wheel fail'));

            const result = await pageZoomIn(mockPage, 1);

            expect(result.success).toBe(false);
            expect(result.method).toBe('none');
            expect(result.reason).toBe('wheel fail');
        });

        it('should zoom in using mouse wheel multiple times', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));

            const result = await pageZoomIn(mockPage, 3);

            expect(result.success).toBe(true);
            expect(result.method).toBe('mouse_wheel');
            expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(3);
        });

        it('should execute the viewport callback correctly', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
                return { width: 1000, height: 800 };
            });

            await pageZoomIn(mockPage, 1);

            // Mock window
            const originalWindow = global.window;
            global.window = { innerWidth: 1024, innerHeight: 768 };

            try {
                const result = capturedCallback();
                expect(result).toEqual({ width: 1024, height: 768 });
            } finally {
                if (originalWindow) global.window = originalWindow;
                else delete global.window;
            }
        });
    });

    describe('pageZoomOut', () => {
        it('should zoom out using keyboard shortcut', async () => {
            const result = await pageZoomOut(mockPage, 1);

            expect(result.success).toBe(true);
            expect(result.method).toBe('keyboard');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+-');
        });

        it('should zoom out multiple times', async () => {
            const result = await pageZoomOut(mockPage, 3);

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(3);
        });

        it('should cap zoom times at 5', async () => {
            const result = await pageZoomOut(mockPage, 10);

            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledTimes(5);
        });

        it('should fallback to mouse wheel when keyboard fails', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));

            const result = await pageZoomOut(mockPage, 1);

            expect(result.success).toBe(true);
            expect(result.method).toBe('mouse_wheel');
            expect(mockPage.mouse.wheel).toHaveBeenCalled();
        });

        it('should return failure when both methods fail', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            mockPage.mouse.wheel = vi.fn().mockRejectedValue(new Error('wheel fail'));

            const result = await pageZoomOut(mockPage, 1);

            expect(result.success).toBe(false);
            expect(result.method).toBe('none');
            expect(result.reason).toBe('wheel fail');
        });

        it('should zoom out using mouse wheel multiple times', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));

            const result = await pageZoomOut(mockPage, 3);

            expect(result.success).toBe(true);
            expect(result.method).toBe('mouse_wheel');
            expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(3);
        });

        it('should execute the viewport callback correctly', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
                return { width: 1000, height: 800 };
            });

            await pageZoomOut(mockPage, 1);

            // Mock window
            const originalWindow = global.window;
            global.window = { innerWidth: 1024, innerHeight: 768 };

            try {
                const result = capturedCallback();
                expect(result).toEqual({ width: 1024, height: 768 });
            } finally {
                if (originalWindow) global.window = originalWindow;
                else delete global.window;
            }
        });
    });

    describe('pageZoomReset', () => {
        it('should reset zoom using keyboard shortcut', async () => {
            const result = await pageZoomReset(mockPage);

            expect(result.success).toBe(true);
            expect(result.method).toBe('keyboard');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Control+0');
        });

        it('should fallback to JavaScript when keyboard fails', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            
            const result = await pageZoomReset(mockPage);

            expect(result.success).toBe(true);
            expect(result.method).toBe('javascript');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should execute the reset callback correctly', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
            });

            await pageZoomReset(mockPage);

            // Mock browser globals for the callback
            const mockStyle = { zoom: '', transform: '', transformOrigin: '' };
            const originalDocument = global.document;
            global.document = { body: { style: mockStyle } };

            try {
                capturedCallback();
                expect(mockStyle.zoom).toBe('100%');
                expect(mockStyle.transform).toBe('scale(1)');
                expect(mockStyle.transformOrigin).toBe('top left');
            } finally {
                if (originalDocument) global.document = originalDocument;
                else delete global.document;
            }
        });

        it('should return failure when both methods fail', async () => {
            mockPage.keyboard.press = vi.fn().mockRejectedValue(new Error('keyboard fail'));
            mockPage.evaluate = vi.fn().mockRejectedValue(new Error('js fail'));

            const result = await pageZoomReset(mockPage);

            expect(result.success).toBe(false);
            expect(result.method).toBe('none');
            expect(result.reason).toBe('js fail');
        });
    });

    describe('getPageZoom', () => {
        it('should return zoom level from computed style', async () => {
            mockPage.evaluate = vi.fn().mockResolvedValue(110);

            const result = await getPageZoom(mockPage);

            expect(result).toBe(110);
        });

        it('should execute the get zoom callback correctly', async () => {
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
                return 100;
            });

            await getPageZoom(mockPage);

            // Mock browser globals
            const originalWindow = global.window;
            const originalDocument = global.document;

            global.window = {
                getComputedStyle: vi.fn().mockReturnValue({ zoom: '1.2' })
            };
            global.document = { body: { style: { zoom: '' } } };

            try {
                const result = capturedCallback();
                expect(result).toBe(1.2);
            } finally {
                if (originalWindow) global.window = originalWindow;
                else delete global.window;
                if (originalDocument) global.document = originalDocument;
                else delete global.document;
            }
        });

        it('should execute the get zoom callback with body style fallback', async () => {
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
                return 100;
            });

            await getPageZoom(mockPage);

            // Mock browser globals
            const originalWindow = global.window;
            const originalDocument = global.document;

            global.window = {
                getComputedStyle: vi.fn().mockReturnValue({ zoom: '' })
            };
            global.document = { body: { style: { zoom: '1.5' } } };

            try {
                const result = capturedCallback();
                expect(result).toBe(1.5);
            } finally {
                if (originalWindow) global.window = originalWindow;
                else delete global.window;
                if (originalDocument) global.document = originalDocument;
                else delete global.document;
            }
        });

        it('should execute the get zoom callback with default fallback', async () => {
            let capturedCallback;
            mockPage.evaluate = vi.fn().mockImplementation((fn) => {
                capturedCallback = fn;
                return 100;
            });

            await getPageZoom(mockPage);

            // Mock browser globals
            const originalWindow = global.window;
            const originalDocument = global.document;

            global.window = {
                getComputedStyle: vi.fn().mockReturnValue({ zoom: '' })
            };
            global.document = { body: { style: { zoom: '' } } };

            try {
                const result = capturedCallback();
                expect(result).toBe(100);
            } finally {
                if (originalWindow) global.window = originalWindow;
                else delete global.window;
                if (originalDocument) global.document = originalDocument;
                else delete global.document;
            }
        });

        it('should return 100 when body style zoom is set', async () => {
            mockPage.evaluate = vi.fn().mockResolvedValue(100);

            const result = await getPageZoom(mockPage);

            expect(result).toBe(100);
        });

        it('should return 100 when evaluation fails', async () => {
            mockPage.evaluate = vi.fn().mockRejectedValue(new Error('eval fail'));

            const result = await getPageZoom(mockPage);

            expect(result).toBe(100);
        });

        it('should handle zoom value of 0 from evaluation', async () => {
            mockPage.evaluate = vi.fn().mockResolvedValue(0);

            const result = await getPageZoom(mockPage);

            expect(result).toBe(0);
        });
    });
});
