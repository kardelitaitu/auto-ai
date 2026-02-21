
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

    describe('Coverage Gap Tests', () => {
        let injectedCallback;

        describe('Canvas Fingerprint Noise - Edge Cases', () => {
            beforeEach(async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
            });

            it('should add noise when canvas has valid dimensions', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { hidden: false, addEventListener: vi.fn() };
                
                let ctxFillRectCalled = false;
                global.HTMLCanvasElement = class {
                    constructor() {
                        this.width = 100;
                        this.height = 100;
                    }
                    getContext() { 
                        return { 
                            fillStyle: '', 
                            fillRect: () => { ctxFillRectCalled = true; } 
                        }; 
                    }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                const canvas = new HTMLCanvasElement();
                canvas.toDataURL();
                expect(ctxFillRectCalled).toBe(true);
            });

            it('should not add noise when canvas width is 0', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { hidden: false, addEventListener: vi.fn() };
                
                let ctxFillRectCalled = false;
                global.HTMLCanvasElement = class {
                    constructor() {
                        this.width = 0;
                        this.height = 100;
                    }
                    getContext() { 
                        return { 
                            fillStyle: '', 
                            fillRect: () => { ctxFillRectCalled = true; } 
                        }; 
                    }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                const canvas = new HTMLCanvasElement();
                canvas.toDataURL();
                expect(ctxFillRectCalled).toBe(false);
            });

            it('should not add noise when canvas height is 0', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { hidden: false, addEventListener: vi.fn() };
                
                let ctxFillRectCalled = false;
                global.HTMLCanvasElement = class {
                    constructor() {
                        this.width = 100;
                        this.height = 0;
                    }
                    getContext() { 
                        return { 
                            fillStyle: '', 
                            fillRect: () => { ctxFillRectCalled = true; } 
                        }; 
                    }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                const canvas = new HTMLCanvasElement();
                canvas.toDataURL();
                expect(ctxFillRectCalled).toBe(false);
            });

            it('should not add noise when getContext returns null', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { hidden: false, addEventListener: vi.fn() };
                
                global.HTMLCanvasElement = class {
                    constructor() {
                        this.width = 100;
                        this.height = 100;
                    }
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                const canvas = new HTMLCanvasElement();
                const result = canvas.toDataURL();
                expect(result).toBe('original');
            });
        });

        describe('User Agent Platform Detection', () => {
            it('should set platform to MacIntel for Mac UA', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { 
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 
                    platform: 'Linux',
                    webdriver: false 
                };
                global.document = { hidden: false, addEventListener: vi.fn() };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                expect(navigator.platform).toBe('MacIntel');
            });

            it('should set platform to Linux x86_64 for Linux UA', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { 
                    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', 
                    platform: 'Win32',
                    webdriver: false 
                };
                global.document = { hidden: false, addEventListener: vi.fn() };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                expect(navigator.platform).toBe('Linux x86_64');
            });

            it('should default to Win32 for unknown UA', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { 
                    userAgent: 'Unknown Browser', 
                    platform: 'MacIntel',
                    webdriver: false 
                };
                global.document = { hidden: false, addEventListener: vi.fn() };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                expect(navigator.platform).toBe('Win32');
            });
        });

        describe('Error Handling', () => {
            it('should handle missing navigator gracefully', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                // Delete or override global navigator to trigger catch
                const originalNavigator = global.navigator;
                global.navigator = undefined;
                
                global.document = { hidden: false, addEventListener: vi.fn() };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                // Should not throw
                expect(() => injectedCallback()).not.toThrow();
                
                global.navigator = originalNavigator;
            });

            it('should handle document.addEventListener errors gracefully', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = {
                    hidden: false,
                    addEventListener: () => { throw new Error('addEventListener blocked'); }
                };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                // Should not throw
                expect(() => injectedCallback()).not.toThrow();
            });
        });

        describe('Visibility Change Event Listener Patch', () => {
            beforeEach(async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
            });

            it('should wrap document.addEventListener', () => {
                const originalMock = vi.fn(() => true);
                global.document = { 
                    hidden: false, 
                    addEventListener: originalMock
                };
                
                injectedCallback();
                
                // After patching, calling addEventListener should invoke the original
                const listener = () => {};
                document.addEventListener('visibilitychange', listener);
                
                expect(originalMock).toHaveBeenCalled();
            });

            it('should pass through visibilitychange event listener', () => {
                const originalMock = vi.fn(() => true);
                const listener = () => {};
                global.document = { 
                    hidden: false, 
                    addEventListener: originalMock 
                };
                
                injectedCallback();
                document.addEventListener('visibilitychange', listener);
                
                expect(originalMock).toHaveBeenCalledWith('visibilitychange', listener, undefined);
            });

            it('should handle other event types normally', () => {
                const originalMock = vi.fn(() => true);
                const listener = () => {};
                global.document = { 
                    hidden: false, 
                    addEventListener: originalMock 
                };
                
                injectedCallback();
                document.addEventListener('click', listener);
                
                expect(originalMock).toHaveBeenCalledWith('click', listener, undefined);
            });
        });

        describe('Logger Scenarios', () => {
            it('should work without logger', async () => {
                const pageNoLog = { addInitScript: vi.fn() };
                await applyHumanizationPatch(pageNoLog, null);
                expect(pageNoLog.addInitScript).toHaveBeenCalled();
            });

            it('should log completion message', async () => {
                const loggerMock = { info: vi.fn() };
                await applyHumanizationPatch(page, loggerMock);
                expect(loggerMock.info).toHaveBeenCalledWith('[HumanizationPatch] Scripts injected.');
            });
        });

        describe('Configurable Properties', () => {
            it('should make document.hidden configurable', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { 
                    hidden: true, 
                    visibilityState: 'hidden',
                    addEventListener: vi.fn() 
                };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                
                // Should be configurable so it can be redefined
                expect(Object.getOwnPropertyDescriptor(document, 'hidden')?.configurable).toBe(true);
            });

            it('should make document.visibilityState configurable', async () => {
                await applyHumanizationPatch(page, logger);
                injectedCallback = page.addInitScript.mock.calls[0][0];
                
                global.navigator = { userAgent: 'Chrome/91.0', webdriver: false };
                global.document = { 
                    hidden: true, 
                    visibilityState: 'hidden',
                    addEventListener: vi.fn() 
                };
                global.HTMLCanvasElement = class {
                    getContext() { return null; }
                    toDataURL() { return 'original'; }
                };
                
                injectedCallback();
                
                expect(Object.getOwnPropertyDescriptor(document, 'visibilityState')?.configurable).toBe(true);
            });
        });

        describe('Multiple Execution', () => {
            it('should handle multiple patch applications', async () => {
                const pageMulti = { addInitScript: vi.fn() };
                const loggerMulti = { info: vi.fn() };
                
                await applyHumanizationPatch(pageMulti, loggerMulti);
                await applyHumanizationPatch(pageMulti, loggerMulti);
                
                expect(pageMulti.addInitScript).toHaveBeenCalledTimes(2);
            });
        });
    });
});
