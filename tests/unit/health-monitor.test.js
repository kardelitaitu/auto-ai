import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealthMonitor from '../../core/health-monitor.js';
import { chromium } from 'playwright';

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn()
    }
}));

describe('HealthMonitor', () => {
    let monitor;
    let mockBrowser;
    let mockPage;
    let mockContext;

    beforeEach(() => {
        monitor = new HealthMonitor();
        mockBrowser = {
            isConnected: vi.fn(),
            close: vi.fn()
        };
        mockPage = {
            isClosed: vi.fn(),
            evaluate: vi.fn(),
            goto: vi.fn()
        };
        mockContext = {
            newPage: vi.fn(),
            close: vi.fn().mockResolvedValue()
        };

        chromium.launch.mockResolvedValue(mockContext);
        mockContext.newPage.mockResolvedValue(mockPage);
    });

    describe('checkNetworkConnectivity', () => {
        it('should return healthy if navigation succeeds', async () => {
            const result = await monitor.checkNetworkConnectivity();

            expect(chromium.launch).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalled();
            expect(result.healthy).toBe(true);
            expect(result.latency).toBeDefined();
        });

        it('should return unhealthy if navigation fails', async () => {
            mockPage.goto.mockRejectedValue(new Error('Network error'));

            const result = await monitor.checkNetworkConnectivity();

            expect(result.healthy).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should return unhealthy if launch fails', async () => {
            chromium.launch.mockRejectedValue(new Error('Launch failed'));

            const result = await monitor.checkNetworkConnectivity();

            expect(result.healthy).toBe(false);
            expect(result.error).toBe('Launch failed');
            expect(mockContext.close).not.toHaveBeenCalled();
        });

        it('should close context in finally block', async () => {
            await monitor.checkNetworkConnectivity();
            expect(mockContext.close).toHaveBeenCalled();
        });
        it('should handle close errors gracefully', async () => {
            mockContext.close.mockRejectedValue(new Error('Close failed'));
            
            // Should not throw
            await monitor.checkNetworkConnectivity();
            
            expect(mockContext.close).toHaveBeenCalled();
        });
    });

    describe('checkPageResponsive', () => {
        it('should return healthy if page evaluates successfully', async () => {
            // Mock evaluate to actually run the function (or simulate it)
            // Since we can't easily run browser code in node, we'll keep the mockResolvedValue for simplicity
            // But to cover the function body, we might need to extract it or test it separately.
            // Alternatively, we can use a mock implementation that executes the callback if we provide a simple DOM mock.
            
            // Let's stick to behavioral testing. The line 61 is inside evaluate callback which is passed to browser.
            // Vitest coverage might not see it if it's never called.
            // We can manually call the callback in a test to ensure it's valid JS, even if we mock the return.
            
            const evalResult = {
                documentReady: 'complete',
                title: 'Test',
                bodyExists: true
            };
            mockPage.evaluate.mockResolvedValue(evalResult);

            const result = await monitor.checkPageResponsive(mockPage);

            expect(result.healthy).toBe(true);
            expect(result.title).toBe('Test');
        });

        it('should have valid evaluate callback', async () => {
            // This test is specifically to cover lines 61-65
            vi.stubGlobal('document', {
                readyState: 'complete',
                title: 'Test',
                body: true
            });
            
            // We need to capture the function passed to evaluate
            let capturedFn;
            mockPage.evaluate.mockImplementation((fn) => {
                capturedFn = fn;
                return Promise.resolve(fn());
            });

            await monitor.checkPageResponsive(mockPage);
            
            expect(capturedFn).toBeDefined();
            const result = capturedFn();
            expect(result.documentReady).toBe('complete');
            
            vi.unstubAllGlobals();
        });

        it('should return unhealthy if page is closed', async () => {
            mockPage.isClosed.mockReturnValue(true);
            const result = await monitor.checkPageResponsive(mockPage);
            expect(result.healthy).toBe(false);
            expect(result.error).toContain('closed');
        });

        it('should return unhealthy if evaluation fails', async () => {
            mockPage.evaluate.mockRejectedValue(new Error('Eval failed'));
            const result = await monitor.checkPageResponsive(mockPage);
            expect(result.healthy).toBe(false);
            expect(result.error).toBe('Eval failed');
        });
    });

    describe('checkBrowserHealth', () => {
        it('should return healthy if browser is connected', async () => {
            mockBrowser.isConnected.mockReturnValue(true);
            const result = await monitor.checkBrowserHealth(mockBrowser);
            expect(result.healthy).toBe(true);
            expect(result.checks.browserConnection).toBe(true);
        });

        it('should return unhealthy if browser is disconnected', async () => {
            mockBrowser.isConnected.mockReturnValue(false);
            const result = await monitor.checkBrowserHealth(mockBrowser);
            expect(result.healthy).toBe(false);
        });

        it('should include page health if page provided', async () => {
            mockBrowser.isConnected.mockReturnValue(true);
            mockPage.evaluate.mockResolvedValue({ documentReady: 'complete' });

            const result = await monitor.checkBrowserHealth(mockBrowser, mockPage);

            expect(result.healthy).toBe(true);
            expect(result.checks.page).toBeDefined();
        });

        it('should return unhealthy if page is unhealthy', async () => {
            mockBrowser.isConnected.mockReturnValue(true);
            mockPage.isClosed.mockReturnValue(true); // Forces page to be unhealthy

            const result = await monitor.checkBrowserHealth(mockBrowser, mockPage);

            expect(result.healthy).toBe(false);
            expect(result.checks.page.healthy).toBe(false);
        });
    });
});
