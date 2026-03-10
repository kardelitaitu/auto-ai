/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('process', {
    ...process,
    send: vi.fn(),
    on: vi.fn(),
    exit: vi.fn()
});

import { DashboardServer } from '../../ui/electron-dashboard/dashboard.js';

describe('DashboardServer Integration', () => {
    let server;

    beforeEach(() => {
        vi.restoreAllMocks();
        server = new DashboardServer();
    });

    afterEach(async () => {
        if (server?.stop) {
            await server.stop();
        }
    });

    describe('Metrics Flow', () => {
        it('should store and broadcast metrics correctly', () => {
            const payload = {
                sessions: [{ id: 'session-1', name: 'Browser 1', status: 'online', activeWorkers: 2, totalWorkers: 3 }],
                queue: { queueLength: 10, maxQueueSize: 500 },
                metrics: { tasks: { executed: 100, failed: 5 }, api: { calls: 500, failures: 10 }, browsers: { discovered: 5, connected: 3 } },
                recentTasks: [{ taskName: 'twitter-follow', duration: 5000, success: true }]
            };
            server.updateMetrics(payload);
            expect(server.latestMetrics.sessions).toHaveLength(1);
            expect(server.latestMetrics.queue.queueLength).toBe(10);
            expect(server.latestMetrics.metrics.tasks.executed).toBe(100);
            const collected = server.collectMetrics();
            expect(collected.sessions).toHaveLength(1);
            expect(collected.system).toHaveProperty('cpu');
            expect(collected.cumulative).toHaveProperty('totalTasksCompleted');
        });

        it('should track cumulative tasks across updates', () => {
            server.latestMetrics.recentTasks = [];
            server.updateMetrics({ recentTasks: [{ taskName: 'task1' }] });
            const count1 = server.cumulativeMetrics.totalTasksCompleted;
            server.updateMetrics({ recentTasks: [{ taskName: 'task1' }, { taskName: 'task2' }] });
            const count2 = server.cumulativeMetrics.totalTasksCompleted;
            expect(count2).toBeGreaterThan(count1);
        });
    });

    describe('System Metrics Integration', () => {
        it('should return consistent system metrics', () => {
            const metrics1 = server.getSystemMetrics();
            const metrics2 = server.getSystemMetrics();
            expect(metrics1.cpu.cores).toBe(metrics2.cpu.cores);
            expect(metrics1.memory.total).toBe(metrics2.memory.total);
            expect(metrics1.platform).toBeDefined();
        });
    });

    describe('Metrics Update Behavior', () => {
        it('should replace entire metrics object on update', () => {
            server.updateMetrics({ sessions: [{ id: 's1' }], queue: { queueLength: 5 } });
            server.updateMetrics({ sessions: [{ id: 's1' }, { id: 's2' }] });
            expect(server.latestMetrics.sessions).toHaveLength(2);
            expect(server.latestMetrics.queue).toBeUndefined();
        });

        it('should completely replace on empty update', () => {
            server.updateMetrics({});
            expect(server.latestMetrics.sessions).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed metrics data without throwing', () => {
            expect(() => server.updateMetrics({ sessions: 'invalid' })).not.toThrow();
            expect(() => server.updateMetrics({ metrics: null })).not.toThrow();
        });
    });
});
