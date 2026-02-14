
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReferrerEngine } from '../../utils/urlReferrer.js';
import fs from 'fs';
import path from 'path';

// Mock fs and path
vi.mock('fs');
vi.mock('path');

describe('ReferrerEngine', () => {
    let engine;

    beforeEach(() => {
        vi.resetAllMocks();
        // Default mocks for fs/path to simulate missing files (fallback mode)
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));
        
        engine = new ReferrerEngine({ addUTM: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('PrivacyEngine (Naturalization)', () => {
        // Accessing the private/internal class via the instance method that uses it, 
        // or we can test generateContext which calls it.
        // Since PrivacyEngine is not exported, we test its effects via generateContext.

        it('should return origin-only for non-whitelisted strategies (e.g., reddit)', () => {
            // Force strategy to reddit_thread by mocking Math.random
            // _selectStrategy logic: 
            // < 0.10: direct
            // < 0.25: google
            // < 0.35: bing
            // < 0.40: duckduckgo
            // < 0.55: twitter_tco
            // < 0.65: reddit_thread
            
            // We need to control Math.random to hit between 0.55 and 0.65.
            // Let's try to mock Math.random globally for specific tests.
            const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.60); // reddit_thread

            const ctx = engine.generateContext('https://target.com');
            expect(ctx.strategy).toBe('reddit_thread');
            
            // Reddit generates a deep link: https://www.reddit.com/r/...
            // PrivacyEngine should truncate it to https://www.reddit.com/
            expect(ctx.referrer).toBe('https://www.reddit.com/');
            expect(ctx.referrer.endsWith('/')).toBe(true);
            expect(ctx.referrer).not.toContain('/r/');
        });

        it('should preserve full path for whitelisted strategies (e.g., twitter_tco)', () => {
            // Force twitter_tco (0.40 - 0.55)
            vi.spyOn(Math, 'random').mockReturnValue(0.50);

            const ctx = engine.generateContext('https://target.com');
            expect(ctx.strategy).toBe('twitter_tco');
            
            // twitter_tco generates https://t.co/xxxx
            // Should NOT be truncated
            expect(ctx.referrer).toMatch(/^https:\/\/t\.co\/.+/);
        });

        it('should preserve full path for search engines (e.g., google)', () => {
            // Force google_search (0.10 - 0.25)
            vi.spyOn(Math, 'random').mockReturnValue(0.20);

            const ctx = engine.generateContext('https://target.com');
            expect(ctx.strategy).toBe('google_search');
            expect(ctx.referrer).toContain('/search?q=');
        });
    });

    describe('Context Generation', () => {
        it('should generate direct traffic correctly', () => {
            // Force direct (0.0 - 0.10)
            vi.spyOn(Math, 'random').mockReturnValue(0.05);

            const ctx = engine.generateContext('https://target.com');
            expect(ctx.strategy).toBe('direct');
            expect(ctx.referrer).toBe('');
            expect(ctx.headers['Referer']).toBeUndefined();
            expect(ctx.headers['Sec-Fetch-Site']).toBe('none');
        });

        it('should add UTM parameters when configured', () => {
            // Force google_search (0.10 - 0.25)
            vi.spyOn(Math, 'random').mockReturnValue(0.20);

            const ctx = engine.generateContext('https://target.com');
            expect(ctx.targetWithParams).toContain('utm_source=google');
            expect(ctx.targetWithParams).toContain('utm_medium=organic');
        });

        it('should NOT add UTM parameters when disabled', () => {
            const noUtmEngine = new ReferrerEngine({ addUTM: false });
            vi.spyOn(Math, 'random').mockReturnValue(0.20); // google

            const ctx = noUtmEngine.generateContext('https://target.com');
            expect(ctx.targetWithParams).toBe('https://target.com');
            expect(ctx.targetWithParams).not.toContain('utm_source');
        });
    });

    describe('Trampoline Navigation', () => {
        let mockPage;

        beforeEach(() => {
            mockPage = {
                setExtraHTTPHeaders: vi.fn(),
                goto: vi.fn(),
                route: vi.fn(),
                unroute: vi.fn(),
                click: vi.fn(),
                waitForURL: vi.fn(),
                url: vi.fn().mockReturnValue('about:blank')
            };
        });

        it('should use simple goto for direct traffic', async () => {
            // Force direct
            vi.spyOn(Math, 'random').mockReturnValue(0.05);
            
            await engine.navigate(mockPage, 'https://target.com');
            
            expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('https://target.com'));
            expect(mockPage.route).not.toHaveBeenCalled();
        });

        it('should use trampoline for complex traffic', async () => {
            // Force google
            vi.spyOn(Math, 'random').mockReturnValue(0.20);
            
            // Mock route implementation to immediately fulfill
            mockPage.route.mockImplementation((pattern, handler) => {
                if (typeof handler === 'function') {
                    // Just simulate a call? 
                    // The code calls route.fulfill, so we need to pass a mock route object
                }
            });

            await engine.navigate(mockPage, 'https://target.com');
            
            expect(mockPage.route).toHaveBeenCalledWith('**/favicon.ico', expect.any(Function));
            // Should route the referrer URL
            expect(mockPage.route).toHaveBeenCalledWith(expect.stringContaining('google.com'), expect.any(Function));
            
            // Should goto the referrer
            expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('google.com'), { waitUntil: 'commit' });
            
            // Should wait for URL
            expect(mockPage.waitForURL).toHaveBeenCalled();
        });

        it('should fallback to direct goto on trampoline error', async () => {
            // Force google
            vi.spyOn(Math, 'random').mockReturnValue(0.20);
            
            // Simulate error in route setup
            mockPage.route.mockRejectedValue(new Error('Route failed'));
            
            await engine.navigate(mockPage, 'https://target.com');
            
            // Should catch error and fallback
            expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('https://target.com'), expect.objectContaining({ referer: expect.any(String) }));
        });
    });
});
