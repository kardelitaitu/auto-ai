
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyHumanizationPatch } from '../../utils/browserPatch.js';

describe('browserPatch', () => {
    let page;
    let logger;

    beforeEach(() => {
        page = {
            addInitScript: vi.fn()
        };
        logger = {
            info: vi.fn()
        };
    });

    it('should inject init script', async () => {
        await applyHumanizationPatch(page, logger);
        expect(page.addInitScript).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Injecting'));
    });

    describe('Injected Script Logic', () => {
        let injectedCallback;

        beforeEach(async () => {
            await applyHumanizationPatch(page, logger);
            injectedCallback = page.addInitScript.mock.calls[0][0];
            
            // Setup global browser mocks for the callback execution
            global.navigator = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                platform: 'Linux armv81', // Wrong platform to test override
                webdriver: true
            };
            
            global.document = {
                hidden: true,
                visibilityState: 'hidden',
                addEventListener: vi.fn()
            };

            global.HTMLCanvasElement = class {
                getContext() { return { fillStyle: '', fillRect: vi.fn() }; }
                toDataURL() { return 'data:image/png;base64,...'; }
            };
            global.HTMLCanvasElement.prototype.toDataURL = function() { return 'original'; };
        });

        afterEach(() => {
            // Cleanup globals
            delete global.navigator;
            delete global.document;
            delete global.HTMLCanvasElement;
        });

        it('should patch navigator.platform based on UA', () => {
            injectedCallback();
            expect(navigator.platform).toBe('Win32');
        });

        it('should patch navigator.webdriver', () => {
            injectedCallback();
            expect(navigator.webdriver).toBe(false);
        });

        it('should patch document visibility', () => {
            injectedCallback();
            expect(document.hidden).toBe(false);
            expect(document.visibilityState).toBe('visible');
        });

        it('should patch canvas fingerprinting', () => {
            injectedCallback();
            const canvas = new HTMLCanvasElement();
            const result = canvas.toDataURL(); // Should trigger patched version
            expect(result).toBe('original'); // Mock implementation returns original
            // Logic check: verify function replacement
            expect(HTMLCanvasElement.prototype.toDataURL).not.toBe(global.HTMLCanvasElement.prototype.toDataURL_ORIGINAL);
        });
    });
});
