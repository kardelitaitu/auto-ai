/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('playwright', () => ({
    chromium: {
        launch: vi.fn(),
    },
}));

import { chromium } from 'playwright';
import HealthMonitor from '@api/core/health-monitor.js';

describe('api/core/health-monitor.js', () => {
    let healthMonitor;
    let mockContext;
    let mockPage;

    beforeEach(() => {
        healthMonitor = new HealthMonitor();
        mockPage = {
            isClosed: vi.fn().mockReturnValue(false),
            evaluate: vi.fn(),
            goto: vi.fn().mockResolvedValue(undefined),
        };
        mockContext = {
            newPage: vi.fn().mockResolvedValue(mockPage),
            close: vi.fn().mockResolvedValue(undefined),
        };
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create a HealthMonitor instance', () => {
            expect(healthMonitor).toBeInstanceOf(HealthMonitor);
        });
    });

    describe('checkNetworkConnectivity', () => {
        it('should return healthy true and latency on successful connection', async () => {
            chromium.launch.mockResolvedValue(mockContext);

            const result = await healthMonitor.checkNetworkConnectivity();

            expect(result.healthy).toBe(true);
            expect(result.latency).toBeGreaterThanOrEqual(0);
            expect(chromium.launch).toHaveBeenCalled();
            expect(mockContext.newPage).toHaveBeenCalled();
        });

        it('should return healthy false on connection error', async () => {
            const errorMessage = 'Browser launch failed';
            chromium.launch.mockRejectedValue(new Error(errorMessage));

            const result = await healthMonitor.checkNetworkConnectivity();

            expect(result.healthy).toBe(false);
            expect(result.latency).toBe(0);
            expect(result.error).toBe(errorMessage);
        });

        it('should close context after successful connection', async () => {
            chromium.launch.mockResolvedValue(mockContext);

            await healthMonitor.checkNetworkConnectivity();

            expect(mockContext.close).toHaveBeenCalled();
        });

        it('should close context even on error', async () => {
            chromium.launch.mockResolvedValue(mockContext);
            mockContext.newPage.mockRejectedValue(new Error('Page creation failed'));

            await healthMonitor.checkNetworkConnectivity();

            expect(mockContext.close).toHaveBeenCalled();
        });

        it('should handle close errors gracefully', async () => {
            chromium.launch.mockResolvedValue(mockContext);
            mockPage.goto = vi.fn().mockResolvedValue(undefined);
            mockContext.close.mockRejectedValue(new Error('Close failed'));

            const result = await healthMonitor.checkNetworkConnectivity();

            expect(chromium.launch).toHaveBeenCalled();
            expect(mockContext.close).toHaveBeenCalled();
            expect(result.healthy).toBe(true);
        });

        it('should navigate to about:blank', async () => {
            chromium.launch.mockResolvedValue(mockContext);

            await healthMonitor.checkNetworkConnectivity();

            expect(mockPage.goto).toHaveBeenCalledWith('about:blank');
        });
    });

    describe('checkPageResponsive', () => {
        it('should return healthy true for responsive page', async () => {
            mockPage.evaluate.mockResolvedValue({
                documentReady: 'complete',
                title: 'Test Page',
                bodyExists: true,
            });

            const result = await healthMonitor.checkPageResponsive(mockPage);

            expect(result.healthy).toBe(true);
            expect(result.title).toBe('Test Page');
        });

        it('should return healthy false for closed page', async () => {
            mockPage.isClosed.mockReturnValue(true);

            const result = await healthMonitor.checkPageResponsive(mockPage);

            expect(result.healthy).toBe(false);
            expect(result.error).toBe('Page is closed');
        });

        it('should return healthy false on evaluate error', async () => {
            const errorMessage = 'Evaluation failed';
            mockPage.evaluate.mockRejectedValue(new Error(errorMessage));

            const result = await healthMonitor.checkPageResponsive(mockPage);

            expect(result.healthy).toBe(false);
            expect(result.error).toBe(errorMessage);
        });

        it('should call page.evaluate with correct function', async () => {
            mockPage.evaluate.mockResolvedValue({
                documentReady: 'complete',
                title: 'Test',
                bodyExists: true,
            });

            await healthMonitor.checkPageResponsive(mockPage);

            expect(mockPage.evaluate).toHaveBeenCalled();
            // The evaluate function is called in browser context, not Node.js
            // We just verify the mock was called and returned expected data
            expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('checkBrowserHealth', () => {
        it('should return healthy true when browser is connected', async () => {
            const mockBrowser = {
                isConnected: vi.fn().mockReturnValue(true),
            };

            const result = await healthMonitor.checkBrowserHealth(mockBrowser);

            expect(result.healthy).toBe(true);
            expect(result.checks.browserConnection).toBe(true);
        });

        it('should return healthy false when browser is disconnected', async () => {
            const mockBrowser = {
                isConnected: vi.fn().mockReturnValue(false),
            };

            const result = await healthMonitor.checkBrowserHealth(mockBrowser);

            expect(result.healthy).toBe(false);
            expect(result.checks.browserConnection).toBe(false);
        });

        it('should include page health check when page is provided', async () => {
            const mockBrowser = {
                isConnected: vi.fn().mockReturnValue(true),
            };
            mockPage.evaluate.mockResolvedValue({
                documentReady: 'complete',
                title: 'Test',
                bodyExists: true,
            });

            const result = await healthMonitor.checkBrowserHealth(mockBrowser, mockPage);

            expect(result.checks.page).toBeDefined();
            expect(result.checks.page.healthy).toBe(true);
        });

        it('should return healthy false if page is not healthy', async () => {
            const mockBrowser = {
                isConnected: vi.fn().mockReturnValue(true),
            };
            mockPage.isClosed.mockReturnValue(true);

            const result = await healthMonitor.checkBrowserHealth(mockBrowser, mockPage);

            expect(result.healthy).toBe(false);
            expect(result.checks.page.healthy).toBe(false);
        });

        it('should work without page parameter', async () => {
            const mockBrowser = {
                isConnected: vi.fn().mockReturnValue(true),
            };

            const result = await healthMonitor.checkBrowserHealth(mockBrowser);

            expect(result.healthy).toBe(true);
            expect(result.checks.page).toBeUndefined();
        });
    });
});
