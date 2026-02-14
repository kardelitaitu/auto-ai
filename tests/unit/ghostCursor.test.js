
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GhostCursor } from '../../utils/ghostCursor.js';
import { mathUtils } from '../../utils/mathUtils.js';

// Mock mathUtils
vi.mock('../../utils/mathUtils.js', () => ({
    mathUtils: {
        randomInRange: vi.fn((min, max) => (min + max) / 2),
        gaussian: vi.fn((mean) => mean),
        roll: vi.fn(() => false) // Default to false
    }
}));

describe('GhostCursor', () => {
    let page;
    let cursor;

    beforeEach(() => {
        page = {
            mouse: {
                move: vi.fn(),
                down: vi.fn(),
                up: vi.fn()
            },
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
        };
        
        // Mock randomInRange for init
        vi.mocked(mathUtils.randomInRange).mockReturnValue(100);
        
        cursor = new GhostCursor(page);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('Initialization', () => {
        it('should initialize with random start position', () => {
            expect(cursor.previousPos).toEqual({ x: 100, y: 100 });
        });
    });

    describe('Vector Helpers', () => {
        it('should add vectors', () => {
            expect(cursor.vecAdd({x:1, y:2}, {x:3, y:4})).toEqual({x:4, y:6});
        });
        it('should sub vectors', () => {
            expect(cursor.vecSub({x:4, y:6}, {x:1, y:2})).toEqual({x:3, y:4});
        });
        it('should mult vector', () => {
            expect(cursor.vecMult({x:2, y:3}, 2)).toEqual({x:4, y:6});
        });
        it('should calc length', () => {
            expect(cursor.vecLen({x:3, y:4})).toBe(5);
        });
    });

    describe('Movement', () => {
        it('should perform move using bezier curve', async () => {
            const start = { x: 0, y: 0 };
            const end = { x: 100, y: 100 };
            
            await cursor.performMove(start, end, 50, 5); // Short duration/steps
            
            expect(page.mouse.move).toHaveBeenCalled();
            expect(cursor.previousPos).toEqual(end);
        });

        it('should move with overshoot when triggered', async () => {
            // Mock roll to true for overshoot
            vi.mocked(mathUtils.roll).mockReturnValueOnce(true);
            vi.mocked(mathUtils.randomInRange).mockReturnValue(1.1); // Scale
            
            await cursor.move(600, 600); // > 500px to trigger logic
            
            // Should call performMove multiple times (start->overshoot, overshoot->end)
            // We can't easily spy on performMove since it's an instance method and we're testing the instance.
            // But we can check if page.mouse.move was called many times
            expect(page.mouse.move).toHaveBeenCalled();
        });
    });

    describe('Twitter Click', () => {
        it('should perform complex click sequence', async () => {
            const locator = {
                boundingBox: vi.fn()
                    .mockResolvedValue({ x: 100, y: 100, width: 50, height: 20 }), // Always returns stable box
                click: vi.fn().mockResolvedValue()
            };

            // Mock internal movement methods to skip delays
            vi.spyOn(cursor, 'moveWithHesitation').mockResolvedValue();
            vi.spyOn(cursor, 'hoverWithDrift').mockResolvedValue();
            vi.spyOn(cursor, 'move').mockResolvedValue();
            
            // Mock setTimeout to resolve immediately
            vi.stubGlobal('setTimeout', (fn) => fn());

            await cursor.twitterClick(locator, 'like');

            expect(locator.boundingBox).toHaveBeenCalled();
            // expect(page.mouse.move).toHaveBeenCalled(); // might not be called if we mock move methods
            expect(page.mouse.down).toHaveBeenCalled();
            expect(page.mouse.up).toHaveBeenCalled();
            expect(locator.click).not.toHaveBeenCalled(); // Native click fallback shouldn't run
        });

        it('should fallback to native click if no bbox found', async () => {
            const locator = {
                boundingBox: vi.fn().mockResolvedValue(null),
                click: vi.fn().mockResolvedValue()
            };

            await cursor.twitterClick(locator);

            expect(locator.click).toHaveBeenCalled();
        });
    });

    describe('Stable Element Wait', () => {
        it('should return bbox when element is stable', async () => {
            const locator = {
                boundingBox: vi.fn()
                    .mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 })
            };
            
            const bbox = await cursor.waitForStableElement(locator, 1000);
            expect(bbox).toBeDefined();
        });

        it('should return null if element disappears', async () => {
            const locator = {
                boundingBox: vi.fn().mockResolvedValue(null)
            };
            
            const bbox = await cursor.waitForStableElement(locator, 500);
            expect(bbox).toBeNull();
        });
    });

    describe('General Click', () => {
        it('should track and click element', async () => {
            const locator = {
                boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 }),
                isVisible: vi.fn().mockResolvedValue(true)
            };
            
            // Set current pos inside the box to trigger immediate click logic in the loop
            cursor.previousPos = { x: 110, y: 110 };
            
            await cursor.click(locator);
            
            expect(page.mouse.down).toHaveBeenCalled();
            expect(page.mouse.up).toHaveBeenCalled();
        });
    });
});
