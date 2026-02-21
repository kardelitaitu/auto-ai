
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ReferrerEngine Initialization', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('should load dictionary values when file exists', async () => {
        const mockData = {
            TOPICS: ['mock_tech'],
            ACTIONS: ['mock_read'],
            CONTEXT: ['mock_thread'],
            SUBREDDITS: ['mock_sub']
        };
        
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p) => p.includes('referrer_dict.json')),
                readFileSync: vi.fn().mockImplementation((p) => {
                    if (p.includes('referrer_dict.json')) return JSON.stringify(mockData);
                    return '{}';
                }),
            },
            existsSync: vi.fn().mockImplementation((p) => p.includes('referrer_dict.json')),
            readFileSync: vi.fn().mockImplementation((p) => {
                if (p.includes('referrer_dict.json')) return JSON.stringify(mockData);
                return '{}';
            }),
        }));

        const module = await import('../../utils/urlReferrer.js?update=' + Date.now());
        const ReferrerEngine = module.ReferrerEngine;
        const engine = new ReferrerEngine();

        // We can verify loaded data by generating strategies that use them.
        // Generic fallback uses DICT.TOPICS (if not context aware)
        // google_search calls generateQuery -> generic fallback if no context.
        
        // Mock random to hit google_search (0.20) and no context (empty url)
        // Wait, generateQuery(targetUrl) with empty url -> _extractContext returns null -> generic fallback.
        
        vi.spyOn(Math, 'random').mockReturnValue(0.20); // google_search
        
        const ctx = engine.generateContext('https://target.com');
        expect(ctx.strategy).toBe('google_search');
        const decoded = decodeURIComponent(ctx.referrer);
        
        // Should contain one of the mock topics/actions
        // "mock_tech mock_read mock_thread" (or subset)
        expect(decoded).toMatch(/mock_tech|mock_read/);
    });

    it('should use emergency VEDs when VED dictionary fails to load', async () => {
        // Force VED load failure
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockReturnValue(false),
                readFileSync: vi.fn(),
            },
            existsSync: vi.fn().mockReturnValue(false),
            readFileSync: vi.fn(),
        }));

        const module = await import('../../utils/urlReferrer.js?update=' + Date.now());
        const ReferrerEngine = module.ReferrerEngine;
        const engine = new ReferrerEngine();

        // Select google_search strategy (r < 0.25)
        vi.spyOn(Math, 'random').mockReturnValue(0.20);
        
        const ctx = engine.generateContext('https://target.com');
        expect(ctx.strategy).toBe('google_search');
        
        // Extract VED from referrer
        const vedMatch = ctx.referrer.match(/ved=([^&]+)/);
        expect(vedMatch).not.toBeNull();
        const ved = vedMatch[1];
        
        // Check if it looks like an emergency VED (starts with specific prefix)
        expect(ved).toMatch(/^0ahUKEwidhIC1qL2RAxWY1zgGHToAHtsQ/);
    });

    it('should warn when VED dictionary loading fails', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p) => p.includes('ved_data.json')),
                readFileSync: vi.fn().mockImplementation((p) => {
                    if (p.includes('ved_data.json')) throw new Error('Read error');
                    return '{}';
                }),
            },
            existsSync: vi.fn().mockImplementation((p) => p.includes('ved_data.json')),
            readFileSync: vi.fn().mockImplementation((p) => {
                if (p.includes('ved_data.json')) throw new Error('Read error');
                return '{}';
            }),
        }));

        await import('../../utils/urlReferrer.js?update=' + Date.now());
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('VED Dictionary not loaded'));
    });

    it('should error when Dictionary loading fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p) => p.includes('referrer_dict.json')),
                readFileSync: vi.fn().mockImplementation((p) => {
                    if (p.includes('referrer_dict.json')) throw new Error('Read error');
                    return '{}';
                }),
            },
            existsSync: vi.fn().mockImplementation((p) => p.includes('referrer_dict.json')),
            readFileSync: vi.fn().mockImplementation((p) => {
                if (p.includes('referrer_dict.json')) throw new Error('Read error');
                return '{}';
            }),
        }));

        await import('../../utils/urlReferrer.js?update=' + Date.now());
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading dictionary'), expect.any(Error));
    });

    it('should warn when t.co dictionary loading fails', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        vi.doMock('fs', () => ({
            default: {
                existsSync: vi.fn().mockImplementation((p) => p.includes('tco_links.json')),
                readFileSync: vi.fn().mockImplementation((p) => {
                    if (p.includes('tco_links.json')) throw new Error('Read error');
                    return '{}';
                }),
            },
            existsSync: vi.fn().mockImplementation((p) => p.includes('tco_links.json')),
            readFileSync: vi.fn().mockImplementation((p) => {
                if (p.includes('tco_links.json')) throw new Error('Read error');
                return '{}';
            }),
        }));

        await import('../../utils/urlReferrer.js?update=' + Date.now());
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('t.co Dictionary not loaded'));
    });
});
