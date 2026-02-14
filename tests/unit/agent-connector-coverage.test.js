
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentConnector from '../../core/agent-connector.js';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        success: vi.fn()
    }
}));

vi.mock('../../utils/logger.js', () => ({
    createLogger: () => mocks.logger
}));

vi.mock('../../core/local-client.js', () => ({
    default: vi.fn(function() {
        return {
            sendRequest: vi.fn().mockResolvedValue({ success: true }),
            getStats: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('../../core/cloud-client.js', () => ({
    default: vi.fn(function() {
        return {
            sendRequest: vi.fn().mockResolvedValue({ success: true }),
            getStats: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('../../core/vision-interpreter.js', () => ({
    default: vi.fn(function() {
        return {
            buildPrompt: vi.fn(),
            parseResponse: vi.fn(),
            getStats: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('../../core/request-queue.js', () => ({
    default: vi.fn(function() {
        return {
            enqueue: vi.fn(async (fn) => ({ success: true, data: await fn() })),
            getStats: vi.fn().mockReturnValue({ running: 0, queued: 0 })
        };
    })
}));

vi.mock('../../core/circuit-breaker.js', () => ({
    default: vi.fn(function() {
        return {
            execute: vi.fn(async (id, fn) => await fn()),
            getAllStatus: vi.fn().mockReturnValue({}),
            getStats: vi.fn().mockReturnValue({})
        };
    })
}));

vi.mock('../../utils/configLoader.js', () => ({
    getSettings: vi.fn().mockResolvedValue({
        llm: { local: { enabled: true }, cloud: { enabled: true } }
    })
}));

describe('AgentConnector Coverage Extensions', () => {
    let connector;

    beforeEach(async () => {
        vi.clearAllMocks();
        const AgentConnector = (await import('../../core/agent-connector.js')).default;
        connector = new AgentConnector();
    });

    describe('getHealth and Health Score', () => {
        it('should calculate health score correctly when healthy', () => {
            // Mock stats
            connector.stats = {
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 0, queued: 0 },
                circuitBreaker: { 'model-1': { state: 'CLOSED' } },
                uptime: 1000
            };
            // Mock internal method if needed, but we can test public getHealth
            // We need to mock getStats return value if we can't set stats directly
            // AgentConnector uses this.stats and this.requestQueue.getStats() etc.
            
            // Override getStats to control inputs to _calculateHealthScore
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 0, queued: 0 },
                circuitBreaker: { 'model-1': { state: 'CLOSED' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            expect(health.status).toBe('healthy');
            expect(health.healthScore).toBe(100);
        });

        it('should penalize score for low success rate', () => {
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 50, avgDuration: 100 },
                queue: { running: 0, queued: 0 },
                circuitBreaker: { 'model-1': { state: 'CLOSED' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            // Penalty: (100 - 50) * 0.5 = 25. Score = 75.
            expect(health.healthScore).toBe(75);
            expect(health.status).toBe('degraded');
        });

        it('should penalize score for high queue utilization', () => {
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 3, queued: 0 }, // 3/3 = 100% utilization
                circuitBreaker: { 'model-1': { state: 'CLOSED' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            // Utilization > 0.8 -> -20. Score = 80.
            expect(health.healthScore).toBe(80);
        });

        it('should penalize score for medium queue utilization', () => {
             vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 2, queued: 0 }, // 2/3 = 66% utilization (> 0.6)
                circuitBreaker: { 'model-1': { state: 'CLOSED' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            // Utilization > 0.6 -> -10. Score = 90.
            expect(health.healthScore).toBe(90);
        });

        it('should penalize score for OPEN circuit breaker', () => {
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 0, queued: 0 },
                circuitBreaker: { 'model-1': { state: 'OPEN' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            // OPEN -> -30. Score = 70.
            expect(health.healthScore).toBe(70);
            expect(health.checks.circuitBreaker.status).toBe('degraded');
        });

        it('should penalize score for HALF_OPEN circuit breaker', () => {
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 100, avgDuration: 100 },
                queue: { running: 0, queued: 0 },
                circuitBreaker: { 'model-1': { state: 'HALF_OPEN' } },
                uptime: 1000
            });

            const health = connector.getHealth();
            // HALF_OPEN -> -15. Score = 85.
            expect(health.healthScore).toBe(85);
            expect(health.checks.circuitBreaker.status).toBe('recovering');
        });
    it('should report unhealthy status for very low score', () => {
            vi.spyOn(connector, 'getStats').mockReturnValue({
                requests: { total: 100, successRate: 0, avgDuration: 100 }, // -50 penalty
                queue: { running: 3, queued: 0 }, // -20 penalty
                circuitBreaker: { 'model-1': { state: 'OPEN' } }, // -30 penalty
                uptime: 1000
            });

            const health = connector.getHealth();
            // Score = 100 - 50 - 20 - 30 = 0.
            expect(health.healthScore).toBe(0);
            expect(health.status).toBe('unhealthy');
        });
    });

    describe('logHealth', () => {
        it('should log health stats to console', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            vi.spyOn(connector, 'getHealth').mockReturnValue({
                status: 'healthy',
                healthScore: 100,
                summary: { totalRequests: 10, uptime: 1000 },
                checks: {
                    requests: { successRate: 100 },
                    queue: { running: 0, queued: 0 },
                    circuitBreaker: { status: 'healthy' }
                }
            });

            connector.logHealth();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('_sendToCloud Exception Handling', () => {
        it('should catch and return error on cloud exception', async () => {
            // Force _callCloudWithBreaker to throw
            vi.spyOn(connector, '_callCloudWithBreaker').mockRejectedValue(new Error('Cloud Fatal Error'));
            
            const request = {
                action: 'generate_reply',
                payload: {},
                sessionId: 'test-session'
            };

            const result = await connector._sendToCloud(request, Date.now());
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cloud Fatal Error');
            expect(result.metadata.providersTried).toContain('cloud');
        });
    });
    
    it('should handle non-Error object exception in vision request', async () => {
        // Mock visionInterpreter.buildPrompt to throw a string
        vi.spyOn(connector.visionInterpreter, 'buildPrompt').mockImplementation(() => {
            throw 'Vision String Error';
        });

        const request = {
            action: 'analyze_page_with_vision',
            payload: { goal: 'test', semanticTree: {}, vision: 'base64' },
            sessionId: 'test-session'
        };

        const result = await connector.handleVisionRequest(request);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown Error: Vision String Error');
    });

    describe('Vision Fallback Placeholder', () => {
        it('should handle local vision failure when fallback is not implemented', async () => {
            // Setup vision interpreter mock
            connector.visionInterpreter.buildPrompt.mockReturnValue('prompt');
            
            // Local client failure
            connector.localClient.sendRequest.mockResolvedValue({ success: false, error: 'Vision failed' });
            
            const request = {
                action: 'analyze_page_with_vision',
                payload: { goal: 'test', vision: 'base64' },
                sessionId: 'test-session'
            };
            
            // Bypass routeRequest and call handleVisionRequest directly
            const result = await connector.handleVisionRequest(request);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Vision failed');
        });

        it('should catch and return error on vision exception', async () => {
            // Mock visionInterpreter.buildPrompt to throw
            vi.spyOn(connector.visionInterpreter, 'buildPrompt').mockImplementation(() => {
                throw new Error('Vision Build Error');
            });

            const request = {
                action: 'analyze_page_with_vision',
                payload: {
                    goal: 'test',
                    semanticTree: {},
                    vision: 'base64'
                },
                sessionId: 'test-session'
            };

            const result = await connector.handleVisionRequest(request);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Vision Build Error');
            expect(result.metadata.routedTo).toBe('local');
        });
    });
});
