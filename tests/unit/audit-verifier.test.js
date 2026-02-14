
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditVerifier from '../../core/audit-verifier.js';

// Mock Logger
vi.mock('../../utils/logger.js', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

describe('AuditVerifier', () => {
    let verifier;
    let mockPage;

    beforeEach(() => {
        verifier = new AuditVerifier();
        mockPage = {
            url: vi.fn().mockReturnValue('https://example.com'),
            $: vi.fn(),
            content: vi.fn().mockResolvedValue('<html><body>Example Text</body></html>'),
            viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 })
        };
    });

    describe('preFlightCheck', () => {
        it('should verify valid selector successfully', async () => {
            const mockElement = {
                isVisible: vi.fn().mockResolvedValue(true),
                isEnabled: vi.fn().mockResolvedValue(true)
            };
            mockPage.$.mockResolvedValue(mockElement);

            const result = await verifier.preFlightCheck(mockPage, '#target');

            expect(result.success).toBe(true);
            expect(result.metadata.selector).toBe('#target');
            expect(verifier.totalAttempted).toBe(1);
            expect(verifier.preFlightFailures).toBe(0);
        });

        it('should fail if selector is not found', async () => {
            mockPage.$.mockResolvedValue(null);

            const result = await verifier.preFlightCheck(mockPage, '#non-existent');

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Element not found');
            expect(verifier.preFlightFailures).toBe(1);
        });

        it('should fail if selector is not visible', async () => {
            const mockElement = {
                isVisible: vi.fn().mockResolvedValue(false),
                isEnabled: vi.fn().mockResolvedValue(true)
            };
            mockPage.$.mockResolvedValue(mockElement);

            const result = await verifier.preFlightCheck(mockPage, '#hidden');

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Element not visible');
        });

        it('should fail if selector is not enabled', async () => {
            const mockElement = {
                isVisible: vi.fn().mockResolvedValue(true),
                isEnabled: vi.fn().mockResolvedValue(false)
            };
            mockPage.$.mockResolvedValue(mockElement);

            const result = await verifier.preFlightCheck(mockPage, '#disabled');

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Element not enabled');
        });

        it('should verify valid coordinates successfully', async () => {
            const result = await verifier.preFlightCheck(mockPage, { x: 100, y: 200 });

            expect(result.success).toBe(true);
            expect(result.metadata.coords).toEqual({ x: 100, y: 200 });
        });

        it('should use default viewport if page.viewportSize() returns null', async () => {
            mockPage.viewportSize.mockReturnValue(null);
            const result = await verifier.preFlightCheck(mockPage, { x: 100, y: 200 });

            expect(result.success).toBe(true);
            expect(result.metadata.viewport).toEqual({ width: 1920, height: 1080 });
        });

        it('should fail if coordinates are outside viewport', async () => {
            const result = await verifier.preFlightCheck(mockPage, { x: 2000, y: 3000 });

            expect(result.success).toBe(false);
            expect(result.reason).toContain('outside viewport');
        });

        it('should handle invalid target format', async () => {
            const result = await verifier.preFlightCheck(mockPage, 123);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Invalid target format');
        });

        it('should handle unexpected errors', async () => {
            mockPage.$.mockRejectedValue(new Error('Page crashed'));

            const result = await verifier.preFlightCheck(mockPage, '#target');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Page crashed');
        });
    });

    describe('postFlightCheck', () => {
        it('should verify URL change successfully', async () => {
            mockPage.url.mockReturnValue('https://example.com/success');

            const result = await verifier.postFlightCheck(mockPage, { urlChange: 'success' });

            expect(result.success).toBe(true);
            expect(verifier.totalVerified).toBe(1);
        });

        it('should fail if URL change does not match', async () => {
            mockPage.url.mockReturnValue('https://example.com/fail');

            const result = await verifier.postFlightCheck(mockPage, { urlChange: 'success' });

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Post-flight verification failed: urlChange');
        });

        it('should verify element appearance successfully', async () => {
            mockPage.$.mockResolvedValue({ id: 'new-element' });

            const result = await verifier.postFlightCheck(mockPage, { elementAppears: '#new' });

            expect(result.success).toBe(true);
        });

        it('should verify element disappearance successfully', async () => {
            mockPage.$.mockResolvedValue(null);

            const result = await verifier.postFlightCheck(mockPage, { elementDisappears: '#old' });

            expect(result.success).toBe(true);
        });

        it('should verify text content successfully', async () => {
            mockPage.content.mockResolvedValue('Welcome user!');

            const result = await verifier.postFlightCheck(mockPage, { textContains: 'Welcome' });

            expect(result.success).toBe(true);
        });

        it('should verify multiple expectations successfully', async () => {
            mockPage.url.mockReturnValue('https://example.com/dashboard');
            mockPage.$.mockResolvedValueOnce({ id: 'header' }) // appears
                         .mockResolvedValueOnce(null); // disappears
            mockPage.content.mockResolvedValue('Dashboard loaded');

            const result = await verifier.postFlightCheck(mockPage, {
                urlChange: 'dashboard',
                elementAppears: '#header',
                elementDisappears: '#loader',
                textContains: 'loaded'
            });

            expect(result.success).toBe(true);
        });

        it('should handle multiple failures', async () => {
            mockPage.url.mockReturnValue('https://example.com/home');
            mockPage.$.mockResolvedValue(null); // elementAppears fails
            mockPage.content.mockResolvedValue('Error page'); // textContains fails

            const result = await verifier.postFlightCheck(mockPage, {
                urlChange: 'success',
                elementAppears: '#success-msg',
                textContains: 'Welcome'
            });

            expect(result.success).toBe(false);
            expect(result.reason).toContain('urlChange, elementAppears, textContains');
        });

        it('should handle unexpected errors in post-flight', async () => {
            mockPage.url.mockImplementation(() => { throw new Error('Post-flight crash'); });

            const result = await verifier.postFlightCheck(mockPage, { urlChange: 'success' });

            expect(result.success).toBe(false);
            expect(result.reason).toBe('Post-flight crash');
        });
    });

    describe('waitForState', () => {
        it('should resolve immediately if success', async () => {
            mockPage.url.mockReturnValue('https://example.com/success');

            const result = await verifier.waitForState(mockPage, { urlChange: 'success' });

            expect(result.success).toBe(true);
        });

        it('should retry and eventually succeed', async () => {
            mockPage.url.mockReturnValueOnce('https://example.com/wait')
                         .mockReturnValueOnce('https://example.com/wait')
                         .mockReturnValueOnce('https://example.com/success');

            const result = await verifier.waitForState(mockPage, { urlChange: 'success' }, 1000);

            expect(result.success).toBe(true);
        });

        it('should timeout if state is never reached', async () => {
            mockPage.url.mockReturnValue('https://example.com/stuck');

            const result = await verifier.waitForState(mockPage, { urlChange: 'success' }, 300);

            expect(result.success).toBe(false);
            expect(result.reason).toContain('Timeout waiting for expected state');
        });
    });

    describe('Statistics and Metrics', () => {
        it('should calculate reliability metric correctly', async () => {
            verifier.totalAttempted = 10;
            verifier.totalVerified = 7;

            expect(verifier.calculateReliabilityMetric()).toBe(0.7);
        });

        it('should return 0 reliability if no attempts', () => {
            expect(verifier.calculateReliabilityMetric()).toBe(0);
        });

        it('should return comprehensive stats', async () => {
            verifier.totalAttempted = 5;
            verifier.totalVerified = 3;
            verifier.preFlightFailures = 1;
            verifier.postFlightFailures = 1;

            const stats = verifier.getStats();

            expect(stats.totalAttempted).toBe(5);
            expect(stats.reliabilityMetric).toBe('0.6000');
            expect(stats.successRate).toBe('60.00%');
        });

        it('should log stats without crashing', () => {
            verifier.totalAttempted = 5;
            verifier.logStats();
        });

        it('should reset stats successfully', () => {
            verifier.totalAttempted = 5;
            verifier.totalVerified = 3;
            verifier.resetStats();

            expect(verifier.totalAttempted).toBe(0);
            expect(verifier.totalVerified).toBe(0);
        });
    });
});
