import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GhostCursor, TWITTER_CLICK_PROFILES } from '../../../api/utils/ghostCursor.js';

vi.mock('../../../api/core/logger.js', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    })
}));

vi.mock('../../../api/interactions/queries.js', () => ({
    visible: vi.fn().mockResolvedValue(true)
}));

describe('api/utils/ghostCursor.js', () => {
    let mockPage;
    let ghostCursor;

    beforeEach(() => {
        vi.clearAllMocks();

        mockPage = {
            mouse: {
                move: vi.fn().mockResolvedValue(),
                down: vi.fn().mockResolvedValue(),
                up: vi.fn().mockResolvedValue()
            },
            locator: vi.fn().mockReturnValue({
                boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 }),
                isVisible: true,
                click: vi.fn().mockResolvedValue()
            }),
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
        };

        ghostCursor = new GhostCursor(mockPage);
    });

    describe('GhostCursor constructor', () => {
        it('should create GhostCursor instance with page', () => {
            expect(ghostCursor.page).toBe(mockPage);
        });

        it('should initialize previousPos', () => {
            expect(ghostCursor.previousPos).toBeDefined();
            expect(ghostCursor.previousPos.x).toBeDefined();
            expect(ghostCursor.previousPos.y).toBeDefined();
        });

        it('should use provided logger', () => {
            const customLogger = { info: vi.fn() };
            const gc = new GhostCursor(mockPage, customLogger);
            expect(gc.logger).toBe(customLogger);
        });
    });

    describe('TWITTER_CLICK_PROFILES', () => {
        it('should have like profile', () => {
            expect(TWITTER_CLICK_PROFILES.like).toBeDefined();
            expect(TWITTER_CLICK_PROFILES.like.hoverMin).toBe(800);
            expect(TWITTER_CLICK_PROFILES.like.hoverMax).toBe(2000);
        });

        it('should have reply profile', () => {
            expect(TWITTER_CLICK_PROFILES.reply).toBeDefined();
            expect(TWITTER_CLICK_PROFILES.reply.hoverMin).toBe(1500);
        });

        it('should have retweet profile', () => {
            expect(TWITTER_CLICK_PROFILES.retweet).toBeDefined();
        });

        it('should have follow profile', () => {
            expect(TWITTER_CLICK_PROFILES.follow).toBeDefined();
        });

        it('should have bookmark profile', () => {
            expect(TWITTER_CLICK_PROFILES.bookmark).toBeDefined();
        });

        it('should have nav profile', () => {
            expect(TWITTER_CLICK_PROFILES.nav).toBeDefined();
        });
    });

    describe('vector helpers', () => {
        it('should add vectors correctly', () => {
            const result = ghostCursor.vecAdd({ x: 1, y: 2 }, { x: 3, y: 4 });
            expect(result).toEqual({ x: 4, y: 6 });
        });

        it('should subtract vectors correctly', () => {
            const result = ghostCursor.vecSub({ x: 3, y: 4 }, { x: 1, y: 2 });
            expect(result).toEqual({ x: 2, y: 2 });
        });

        it('should multiply vector by scalar', () => {
            const result = ghostCursor.vecMult({ x: 2, y: 3 }, 2);
            expect(result).toEqual({ x: 4, y: 6 });
        });

        it('should calculate vector length', () => {
            const result = ghostCursor.vecLen({ x: 3, y: 4 });
            expect(result).toBe(5);
        });
    });

    describe('bezier', () => {
        it('should calculate bezier point at t=0', () => {
            const result = ghostCursor.bezier(0, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 });
            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(0);
        });

        it('should calculate bezier point at t=1', () => {
            const result = ghostCursor.bezier(1, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 });
            expect(result.x).toBeCloseTo(3);
            expect(result.y).toBeCloseTo(3);
        });

        it('should calculate bezier point at t=0.5', () => {
            const result = ghostCursor.bezier(0.5, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 });
            expect(result.x).toBeCloseTo(1.5);
            expect(result.y).toBeCloseTo(1.5);
        });
    });

    describe('easeOutCubic', () => {
        it('should return 0 at t=0', () => {
            expect(ghostCursor.easeOutCubic(0)).toBe(0);
        });

        it('should return 1 at t=1', () => {
            expect(ghostCursor.easeOutCubic(1)).toBe(1);
        });

        it('should be between 0 and 1 for t in (0,1)', () => {
            const result = ghostCursor.easeOutCubic(0.5);
            expect(result).toBeGreaterThan(0);
            expect(result).toBeLessThan(1);
        });
    });

    describe('performMove', () => {
        it('should handle invalid start position', async () => {
            await expect(ghostCursor.performMove(null, { x: 100, y: 100 }, 100)).resolves.toBeUndefined();
        });

        it('should handle invalid end position', async () => {
            await expect(ghostCursor.performMove({ x: 0, y: 0 }, null, 100)).resolves.toBeUndefined();
        });

        it('should handle NaN coordinates', async () => {
            await expect(ghostCursor.performMove({ x: NaN, y: 0 }, { x: 100, y: 100 }, 100)).resolves.toBeUndefined();
        });

        it('should handle Infinity coordinates', async () => {
            await expect(ghostCursor.performMove({ x: Infinity, y: 0 }, { x: 100, y: 100 }, 100)).resolves.toBeUndefined();
        });
    });

    describe('move', () => {
        it('should handle invalid target coordinates', async () => {
            await expect(ghostCursor.move(NaN, 100)).resolves.toBeUndefined();
            await expect(ghostCursor.move(100, NaN)).resolves.toBeUndefined();
            await expect(ghostCursor.move(Infinity, 100)).resolves.toBeUndefined();
        });
    });

    describe('moveWithHesitation', () => {
        it('should handle NaN coordinates', async () => {
            await expect(ghostCursor.moveWithHesitation(NaN, 100)).resolves.toBeUndefined();
        });
    });

    describe('park', () => {
        it('should handle missing viewport', async () => {
            mockPage.viewportSize.mockReturnValue(null);
            await expect(ghostCursor.park()).resolves.toBeUndefined();
        });
    });

    describe('click', () => {
        it('should return success false when no bounding box and no fallback', async () => {
            const mockLocator = {
                boundingBox: vi.fn().mockResolvedValue(null)
            };

            const result = await ghostCursor.click(mockLocator, { allowNativeFallback: false });
            expect(result.success).toBe(false);
        });

        it('should use native fallback when allowed and no bbox', async () => {
            const mockLocator = {
                boundingBox: vi.fn().mockResolvedValue(null),
                click: vi.fn().mockResolvedValue()
            };

            const result = await ghostCursor.click(mockLocator, { allowNativeFallback: true });
            expect(result.usedFallback).toBe(true);
        });
    });
});
