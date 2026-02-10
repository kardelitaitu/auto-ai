/**
 * @fileoverview Unit tests for Agent Connector health monitoring
 * @module tests/agent-connector-health.test
 */

import AgentConnector from '../core/agent-connector.js';

describe('AgentConnector Health Monitoring', () => {
    let connector;

    beforeEach(() => {
        connector = new AgentConnector();
    });

    describe('Stats Tracking', () => {
        it('should initialize with zero stats', () => {
            const stats = connector.getStats();

            expect(stats.requests.total).toBe(0);
            expect(stats.requests.successful).toBe(0);
            expect(stats.requests.failed).toBe(0);
            expect(stats.requests.local).toBe(0);
            expect(stats.requests.cloud).toBe(0);
            expect(stats.requests.vision).toBe(0);
            expect(stats.uptime).toBeGreaterThanOrEqual(0);
        });

        it('should track request counts', () => {
            connector.stats.totalRequests = 5;
            connector.stats.successfulRequests = 4;
            connector.stats.failedRequests = 1;
            connector.stats.localRequests = 2;
            connector.stats.cloudRequests = 3;
            connector.stats.visionRequests = 1;

            const stats = connector.getStats();

            expect(stats.requests.total).toBe(5);
            expect(stats.requests.successful).toBe(4);
            expect(stats.requests.failed).toBe(1);
            expect(stats.requests.local).toBe(2);
            expect(stats.requests.cloud).toBe(3);
            expect(stats.requests.vision).toBe(1);
        });

        it('should calculate success rate', () => {
            connector.stats.totalRequests = 10;
            connector.stats.successfulRequests = 8;
            connector.stats.failedRequests = 2;

            const stats = connector.getStats();

            expect(stats.requests.successRate).toBe(80.00);
        });

        it('should handle zero requests for success rate', () => {
            const stats = connector.getStats();

            expect(stats.requests.successRate).toBe(0);
        });

        it('should calculate average duration', () => {
            connector.stats.totalRequests = 3;
            connector.stats.totalDuration = 300;
            connector.stats.successfulRequests = 3;

            const stats = connector.getStats();

            expect(stats.requests.avgDuration).toBe(100);
        });
    });

    describe('Health Score Calculation', () => {
        it('should return healthy status with high success rate', () => {
            connector.stats.totalRequests = 10;
            connector.stats.successfulRequests = 10;
            connector.stats.failedRequests = 0;

            const health = connector.getHealth();

            expect(health.status).toBe('healthy');
            expect(health.healthScore).toBeGreaterThan(80);
        });

        it('should return degraded status with moderate failures', () => {
            connector.stats.totalRequests = 10;
            connector.stats.successfulRequests = 7;
            connector.stats.failedRequests = 3;

            const health = connector.getHealth();

            expect(health.status).toBe('degraded');
            expect(health.healthScore).toBeLessThanOrEqual(80);
        });

        it('should return unhealthy status with high failures', () => {
            connector.stats.totalRequests = 10;
            connector.stats.successfulRequests = 2;
            connector.stats.failedRequests = 8;

            const health = connector.getHealth();

            expect(health.status).toBe('unhealthy');
            expect(health.healthScore).toBeLessThanOrEqual(50);
        });

        it('should include circuit breaker status in health', () => {
            connector.circuitBreaker.forceOpen('test-model');

            const health = connector.getHealth();

            expect(health.checks.circuitBreaker.status).toBe('degraded');
        });

        it('should include queue status in health', () => {
            connector.stats.totalRequests = 10;
            connector.stats.successfulRequests = 10;

            const health = connector.getHealth();

            expect(health.checks.queue).toBeDefined();
            expect(health.checks.queue.status).toBeDefined();
        });
    });

    describe('Health Report', () => {
        it('should generate valid health object', () => {
            connector.stats.totalRequests = 5;
            connector.stats.successfulRequests = 5;

            const health = connector.getHealth();

            expect(health.status).toBeDefined();
            expect(health.healthScore).toBeDefined();
            expect(health.timestamp).toBeDefined();
            expect(health.checks).toBeDefined();
            expect(health.summary).toBeDefined();
        });

        it('should include summary with uptime and request counts', () => {
            connector.stats.totalRequests = 10;

            const health = connector.getHealth();

            expect(health.summary.totalRequests).toBe(10);
            expect(health.summary.uptime).toBeGreaterThanOrEqual(0);
            expect(health.summary.utilization).toBeDefined();
        });
    });

    describe('Queue Integration', () => {
        it('should include queue stats in getStats', () => {
            const stats = connector.getStats();

            expect(stats.queue).toBeDefined();
            expect(stats.queue.running).toBeDefined();
            expect(stats.queue.queued).toBeDefined();
        });

        it('should include circuit breaker stats in getStats', () => {
            const stats = connector.getStats();

            expect(stats.circuitBreaker).toBeDefined();
        });
    });
});
