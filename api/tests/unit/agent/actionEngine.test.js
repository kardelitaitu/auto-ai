/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import actionEngine, { actionEngine as namedActionEngine } from '@api/agent/actionEngine.js';

vi.mock('@api/core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@api/core/context-state.js', () => ({
    getStateAgentElementMap: vi.fn().mockReturnValue([]),
}));

vi.mock('@api/utils/ghostCursor.js', () => ({
    GhostCursor: vi.fn().mockImplementation(function() {
        return {
            moveWithHesitation: vi.fn().mockResolvedValue(undefined),
        };
    }),
}));

vi.mock('@api/utils/math.js', () => ({
    mathUtils: {
        gaussian: vi.fn().mockImplementation((mean, dev) => mean),
        randomInRange: vi.fn().mockImplementation((min, max) => Math.floor((min + max) / 2)),
    },
}));

describe('api/agent/actionEngine.js', () => {
    let mockPage;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPage = {
            bringToFront: vi.fn().mockResolvedValue(undefined),
            keyboard: {
                press: vi.fn().mockResolvedValue(undefined),
                type: vi.fn().mockResolvedValue(undefined),
                down: vi.fn().mockResolvedValue(undefined),
                up: vi.fn().mockResolvedValue(undefined),
            },
            mouse: {
                click: vi.fn().mockResolvedValue(undefined),
                dblclick: vi.fn().mockResolvedValue(undefined),
                down: vi.fn().mockResolvedValue(undefined),
                up: vi.fn().mockResolvedValue(undefined),
                move: vi.fn().mockResolvedValue(undefined),
            },
            evaluate: vi.fn().mockResolvedValue(undefined),
            waitForTimeout: vi.fn().mockResolvedValue(undefined),
            goto: vi.fn().mockResolvedValue(undefined),
            screenshot: vi.fn().mockResolvedValue(undefined),
            locator: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnValue({
                    waitFor: vi.fn().mockResolvedValue(undefined),
                    click: vi.fn().mockResolvedValue(undefined),
                    boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 50, height: 50 }),
                    fill: vi.fn().mockResolvedValue(undefined),
                }),
            }),
            getByRole: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnValue({
                    waitFor: vi.fn().mockResolvedValue(undefined),
                    click: vi.fn().mockResolvedValue(undefined),
                }),
            }),
            getByText: vi.fn().mockReturnValue({
                first: vi.fn().mockReturnValue({
                    waitFor: vi.fn().mockResolvedValue(undefined),
                    click: vi.fn().mockResolvedValue(undefined),
                }),
            }),
        };
    });

    describe('execute()', () => {
        it('should return error when no action is specified', async () => {
            const result = await actionEngine.execute(mockPage, null);
            expect(result.success).toBe(false);
            expect(result.error).toBe('No action specified');
        });

        it('should return error when action.action is missing', async () => {
            const result = await actionEngine.execute(mockPage, { selector: '#test' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('No action specified');
        });

        it('should handle done action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'done' });
            expect(result.success).toBe(true);
            expect(result.done).toBe(true);
        });

        it('should handle unknown action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'unknownAction' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown action');
        });

        it('should handle action with rationale logging', async () => {
            const result = await actionEngine.execute(mockPage, { 
                action: 'done',
                rationale: 'Task is complete' 
            });
            expect(result.success).toBe(true);
        });

        it('should execute press action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'press', key: 'Enter' });
            expect(result.success).toBe(true);
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        });

        it('should execute scroll down action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'scroll', value: 'down' });
            expect(result.success).toBe(true);
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should execute scroll up action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'scroll', value: 'up' });
            expect(result.success).toBe(true);
        });

        it('should execute wait action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'wait', value: '1000' });
            expect(result.success).toBe(true);
            expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
        });

        it('should execute delay action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'delay', value: '500' });
            expect(result.success).toBe(true);
        });

        it('should execute navigate action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'navigate', value: 'https://example.com' });
            expect(result.success).toBe(true);
        });

        it('should execute goto action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'goto', value: 'example.com' });
            expect(result.success).toBe(true);
        });

        it('should execute screenshot action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'screenshot' }, 'test-session');
            expect(result.success).toBe(true);
        });

        it('should execute verify action', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'verify', description: 'Check element' });
            expect(result.success).toBe(true);
        });

        it('should handle clickAt with array coordinates', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'clickAt', x: [100, 200] });
            expect(result.success).toBe(true);
        });

        it('should handle clickAt with separate x,y coordinates', async () => {
            const result = await actionEngine.execute(mockPage, { action: 'clickAt', x: 100, y: 200 });
            expect(result.success).toBe(true);
        });
    });

    describe('getLocator()', () => {
        it('should throw for empty selector', () => {
            expect(() => actionEngine.getLocator(mockPage, '')).toThrow('Invalid selector');
        });

        it('should throw for placeholder selectors', () => {
            expect(() => actionEngine.getLocator(mockPage, '...')).toThrow('placeholder');
            expect(() => actionEngine.getLocator(mockPage, 'N/A')).toThrow('placeholder');
            expect(() => actionEngine.getLocator(mockPage, 'placeholder')).toThrow('placeholder');
        });

        it('should throw for null selector', () => {
            expect(() => actionEngine.getLocator(mockPage, null)).toThrow('Invalid selector');
        });

        it('should throw for non-string selector', () => {
            expect(() => actionEngine.getLocator(mockPage, 123)).toThrow('Invalid selector');
        });

        it('should handle CSS selector', () => {
            const locator = actionEngine.getLocator(mockPage, '.btn');
            expect(mockPage.locator).toHaveBeenCalledWith('.btn');
        });

        it('should handle role selector', () => {
            actionEngine.getLocator(mockPage, 'role=button,name=Click');
            expect(mockPage.getByRole).toHaveBeenCalled();
        });

        it('should handle text selector', () => {
            actionEngine.getLocator(mockPage, 'text=Hello');
            expect(mockPage.getByText).toHaveBeenCalledWith('Hello');
        });

        it('should throw for placeholder with dashes', () => {
            expect(() => actionEngine.getLocator(mockPage, 'element-id')).toThrow('placeholder');
        });
    });

    describe('performPress()', () => {
        it('should press a key', async () => {
            await actionEngine.performPress(mockPage, 'Escape');
            expect(mockPage.keyboard.press).toHaveBeenCalledWith('Escape');
        });

        it('should throw if no key provided', async () => {
            await expect(actionEngine.performPress(mockPage, null)).rejects.toThrow('Key is required');
        });
    });

    describe('performScroll()', () => {
        it('should scroll down', async () => {
            await actionEngine.performScroll(mockPage, 'down');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should scroll up', async () => {
            await actionEngine.performScroll(mockPage, 'up');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should scroll to top', async () => {
            await actionEngine.performScroll(mockPage, 'top');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should scroll to bottom', async () => {
            await actionEngine.performScroll(mockPage, 'bottom');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });

        it('should scroll to bottom for done value', async () => {
            await actionEngine.performScroll(mockPage, 'done');
            expect(mockPage.evaluate).toHaveBeenCalled();
        });
    });

    describe('performNavigate()', () => {
        it('should navigate to URL', async () => {
            await actionEngine.performNavigate(mockPage, 'https://example.com');
            expect(mockPage.goto).toHaveBeenCalled();
        });

        it('should add https if missing', async () => {
            await actionEngine.performNavigate(mockPage, 'example.com');
            expect(mockPage.goto).toHaveBeenCalledWith(
                'https://example.com',
                expect.any(Object)
            );
        });

        it('should throw if no URL provided', async () => {
            await expect(actionEngine.performNavigate(mockPage, null)).rejects.toThrow('URL is required');
        });
    });

    describe('performWait()', () => {
        it('should wait for specified time', async () => {
            await actionEngine.performWait(mockPage, '500');
            expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
        });

        it('should throw for invalid wait time', async () => {
            await expect(actionEngine.performWait(mockPage, 'abc')).rejects.toThrow('Invalid wait time');
        });
    });

    describe('performClickAt()', () => {
        it('should click at coordinates', async () => {
            await actionEngine.performClickAt(mockPage, 100, 200);
            expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 200);
        });

        it('should handle array coordinates', async () => {
            await actionEngine.performClickAt(mockPage, [100, 200], [300, 400]);
            expect(mockPage.mouse.click).toHaveBeenCalledWith(100, 300);
        });

        it('should throw if x coordinate missing', async () => {
            await expect(actionEngine.performClickAt(mockPage, undefined, 200)).rejects.toThrow('requires x and y');
        });

        it('should throw if y coordinate missing', async () => {
            await expect(actionEngine.performClickAt(mockPage, 100, undefined)).rejects.toThrow('requires x and y');
        });

        it('should throw for non-numeric coordinates', async () => {
            await expect(actionEngine.performClickAt(mockPage, 'a', 'b')).rejects.toThrow('numeric coordinates');
        });

        it('should perform double click', async () => {
            await actionEngine.performClickAt(mockPage, 100, 200, 'double');
            expect(mockPage.mouse.dblclick).toHaveBeenCalledWith(100, 200);
        });

        it('should perform long click', async () => {
            await actionEngine.performClickAt(mockPage, 100, 200, 'long', 1000);
            expect(mockPage.mouse.down).toHaveBeenCalled();
            expect(mockPage.mouse.up).toHaveBeenCalled();
        });
    });

    describe('performMultiSelect()', () => {
        it('should throw for non-array items', async () => {
            await expect(actionEngine.performMultiSelect(mockPage, null)).rejects.toThrow('requires an array');
        });

        it('should handle empty items array', async () => {
            await expect(actionEngine.performMultiSelect(mockPage, [])).resolves.not.toThrow();
        });
    });

    describe('exports', () => {
        it('should export actionEngine as default', () => {
            expect(actionEngine).toBeDefined();
            expect(typeof actionEngine.execute).toBe('function');
        });

        it('should export actionEngine as named export', () => {
            expect(namedActionEngine).toBe(actionEngine);
        });
    });
});
