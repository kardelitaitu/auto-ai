import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { microInteractions } from '../../utils/micro-interactions.js';

describe('microInteractions', () => {
    let handler;
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        };

        handler = microInteractions.createMicroInteractionHandler();
        
        mockPage = {
            $: vi.fn(),
            evaluate: vi.fn(),
            mouse: {
                move: vi.fn(),
                down: vi.fn(),
                up: vi.fn(),
                click: vi.fn()
            },
            waitForTimeout: vi.fn(),
            click: vi.fn(),
            viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 })
        };
        
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        if (handler.stopFidgetLoop) {
            handler.stopFidgetLoop();
        }
    });

    describe('createMicroInteractionHandler', () => {
        it('should create handler with default config', () => {
            expect(handler.config).toBeDefined();
            expect(handler.config.highlightChance).toBe(0.03);
        });

        it('should merge custom config', () => {
            const customHandler = microInteractions.createMicroInteractionHandler({ highlightChance: 0.5 });
            expect(customHandler.config.highlightChance).toBe(0.5);
        });
    });

    describe('textHighlight', () => {
        it('should highlight text if element found', async () => {
            const mockElement = {
                boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 200, height: 20 })
            };
            mockPage.$.mockResolvedValue(mockElement);

            const result = await handler.textHighlight(mockPage, { logger: mockLogger });

            expect(result.success).toBe(true);
            expect(result.type).toBe('highlight');
            expect(mockPage.mouse.move).toHaveBeenCalled();
            expect(mockPage.mouse.down).toHaveBeenCalled();
            expect(mockPage.mouse.up).toHaveBeenCalled();
        });

        it('should return failure if element not found', async () => {
            mockPage.$.mockResolvedValue(null);
            const result = await handler.textHighlight(mockPage, { logger: mockLogger });
            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_element');
        });

        it('should return failure if no bounding box', async () => {
            const mockElement = {
                boundingBox: vi.fn().mockResolvedValue(null)
            };
            mockPage.$.mockResolvedValue(mockElement);
            const result = await handler.textHighlight(mockPage, { logger: mockLogger });
            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_box');
        });
    });

    describe('randomRightClick', () => {
        it('should perform right click', async () => {
            const result = await handler.randomRightClick(mockPage, { logger: mockLogger });
            
            expect(result.success).toBe(true);
            expect(result.type).toBe('right_click');
            expect(mockPage.mouse.click).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), { button: 'right' });
        });
    });

    describe('logoClick', () => {
        it('should click logo if found', async () => {
            const mockLogo = { click: vi.fn().mockResolvedValue() };
            mockPage.$.mockResolvedValue(mockLogo);

            const result = await handler.logoClick(mockPage, { logger: mockLogger });

            expect(result.success).toBe(true);
            expect(result.type).toBe('logo_click');
            expect(mockLogo.click).toHaveBeenCalled();
        });

        it('should return failure if logo not found', async () => {
            mockPage.$.mockResolvedValue(null);
            const result = await handler.logoClick(mockPage, { logger: mockLogger });
            expect(result.success).toBe(false);
            expect(result.reason).toBe('no_logo');
        });
    });

    describe('whitespaceClick', () => {
        it('should click whitespace', async () => {
            const result = await handler.whitespaceClick(mockPage, { logger: mockLogger });

            expect(result.success).toBe(true);
            expect(result.type).toBe('whitespace_click');
            expect(mockPage.click).toHaveBeenCalled();
        });
    });

    describe('fidget', () => {
        it('should perform a random fidget action', async () => {
            const result = await handler.fidget(mockPage, { logger: mockLogger });
            expect(result.success).toBe(true);
            expect(result.actions).toBeDefined();
        });

        it('should prevent concurrent fidgets', async () => {
            // Mock Math.random to force whitespaceClick
            vi.spyOn(Math, 'random').mockReturnValue(0.1);

            // Create a promise that we can manually resolve
            let resolveAction;
            const actionPromise = new Promise(r => { resolveAction = r; });
            
            // Mock whitespaceClick to hang
            vi.spyOn(handler, 'whitespaceClick').mockReturnValue(actionPromise);

            // Start first fidget - it will wait on whitespaceClick
            const p1 = handler.fidget(mockPage, { logger: mockLogger });
            
            // Start second fidget immediately
            const p2 = await handler.fidget(mockPage, { logger: mockLogger });
            
            expect(p2.success).toBe(false);
            expect(p2.reason).toBe('already_running');
            
            // Resolve the first one
            resolveAction({ success: true, type: 'whitespace_click' });
            const result1 = await p1;
            expect(result1.success).toBe(true);
        });
    });
    
    describe('fidgetLoop', () => {
        it('should start and stop fidget loop', () => {
            const interval = handler.startFidgetLoop(mockPage, { logger: mockLogger });
            expect(interval).toBeDefined();
            
            const stopped = handler.stopFidgetLoop();
            expect(stopped).toBe(true);
        });
    });
});
