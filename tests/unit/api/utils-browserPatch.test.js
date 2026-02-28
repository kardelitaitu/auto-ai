import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyHumanizationPatch } from '../../../api/utils/browserPatch.js';

describe('api/utils/browserPatch.js', () => {
    let mockPage;
    let mockLogger;

    beforeEach(() => {
        vi.clearAllMocks();

        mockLogger = {
            info: vi.fn()
        };

        mockPage = {
            addInitScript: vi.fn().mockImplementation(async (fn) => {
                if (typeof fn === 'function') {
                    const originalNavigator = global.navigator;
                    const originalDocument = global.document;
                    const originalCanvas = global.HTMLCanvasElement;
                    const originalMedia = global.HTMLMediaElement;

                    global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' };
                    global.document = { hidden: true, addEventListener: vi.fn() };
                    global.HTMLCanvasElement = { prototype: { toDataURL: vi.fn() } };
                    global.HTMLMediaElement = { prototype: { canPlayType: vi.fn() } };
                    global.window = global;

                    try {
                        await fn();
                    } catch (e) {
                        // ignore
                    } finally {
                        global.navigator = originalNavigator;
                        global.document = originalDocument;
                        global.HTMLCanvasElement = originalCanvas;
                        global.HTMLMediaElement = originalMedia;
                        delete global.window;
                    }
                }
            })
        };
    });

    describe('applyHumanizationPatch', () => {
        it('should add init script to page', async () => {
            await applyHumanizationPatch(mockPage);
            expect(mockPage.addInitScript).toHaveBeenCalled();
        });

        it('should add init script with function', async () => {
            await applyHumanizationPatch(mockPage);
            const call = mockPage.addInitScript.mock.calls[0][0];
            expect(typeof call).toBe('function');
        });

        it('should call logger info when logger provided', async () => {
            await applyHumanizationPatch(mockPage, mockLogger);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it('should not call logger info when no logger provided', async () => {
            await applyHumanizationPatch(mockPage);
            expect(mockLogger.info).not.toHaveBeenCalled();
        });

        it('should work without logger parameter', async () => {
            await expect(applyHumanizationPatch(mockPage)).resolves.not.toThrow();
        });

        it('should handle page without addInitScript gracefully', async () => {
            const badPage = {};
            await expect(applyHumanizationPatch(badPage)).rejects.toThrow();
        });

        it('should inject platform spoofing for Windows UA', async () => {
            mockPage.addInitScript.mockImplementation(async (fn) => {
                if (typeof fn === 'function') {
                    const originalNavigator = global.navigator;
                    global.navigator = {
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        platform: 'Win32'
                    };
                    global.window = global;
                    global.document = { hidden: true, addEventListener: vi.fn() };
                    global.HTMLCanvasElement = { prototype: { toDataURL: vi.fn() } };
                    global.HTMLMediaElement = { prototype: { canPlayType: vi.fn() } };

                    try {
                        await fn();
                    } catch (e) {
                        // ignore
                    } finally {
                        global.navigator = originalNavigator;
                        delete global.window;
                        delete global.document;
                        delete global.HTMLCanvasElement;
                        delete global.HTMLMediaElement;
                    }
                }
            });
            await applyHumanizationPatch(mockPage);
            expect(mockPage.addInitScript).toHaveBeenCalled();
        });

        it('should inject platform spoofing for Mac UA', async () => {
            mockPage.addInitScript.mockImplementation(async (fn) => {
                if (typeof fn === 'function') {
                    const originalNavigator = global.navigator;
                    global.navigator = {
                        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                        platform: 'MacIntel'
                    };
                    global.window = global;
                    global.document = { hidden: true, addEventListener: vi.fn() };
                    global.HTMLCanvasElement = { prototype: { toDataURL: vi.fn() } };
                    global.HTMLMediaElement = { prototype: { canPlayType: vi.fn() } };
                    try {
                        await fn();
                    } catch (e) {
                        // ignore
                    } finally {
                        global.navigator = originalNavigator;
                        delete global.window;
                        delete global.document;
                        delete global.HTMLCanvasElement;
                        delete global.HTMLMediaElement;
                    }
                }
            });
            await applyHumanizationPatch(mockPage);
            expect(mockPage.addInitScript).toHaveBeenCalled();
        });

        it('should inject platform spoofing for Linux UA', async () => {
            mockPage.addInitScript.mockImplementation(async (fn) => {
                if (typeof fn === 'function') {
                    const originalNavigator = global.navigator;
                    global.navigator = {
                        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
                        platform: 'Linux x86_64'
                    };
                    global.window = global;
                    global.document = { hidden: true, addEventListener: vi.fn() };
                    global.HTMLCanvasElement = { prototype: { toDataURL: vi.fn() } };
                    global.HTMLMediaElement = { prototype: { canPlayType: vi.fn() } };
                    try {
                        await fn();
                    } catch (e) {
                        // ignore
                    } finally {
                        global.navigator = originalNavigator;
                        delete global.window;
                        delete global.document;
                        delete global.HTMLCanvasElement;
                        delete global.HTMLMediaElement;
                    }
                }
            });
            await applyHumanizationPatch(mockPage);
            expect(mockPage.addInitScript).toHaveBeenCalled();
        });
    });
});
