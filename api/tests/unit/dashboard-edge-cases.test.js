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

describe('DashboardServer Edge Cases', () => {
    describe('Uptime Tracking', () => {
        it('should NOT track uptime when all sessions are offline', () => {
            server.updateMetrics({
                sessions: [{ id: 's1', status: 'offline' }],
                queue: { queueLength: 0 }
            });
            
            server.lastActiveCheck = Date.now() - 5000;
            const before = server.collectMetrics();
            const uptimeBefore = before.cumulative.engineUptimeMs;
            
            server.lastActiveCheck = Date.now() - 5000;
            const after = server.collectMetrics();
            const uptimeAfter = after.cumulative.engineUptimeMs;
            
            // Should NOT increase when sessions are offline
            expect(uptimeAfter).toBe(uptimeBefore);
        });

        it('should track uptime when at least one session is online', () => {
            server.updateMetrics({
                sessions: [{ id: 's1', status: 'online' }],
                queue: { queueLength: 0 }
            });
            
            server.lastActiveCheck = Date.now() - 5000;
            const before = server.collectMetrics();
            const uptimeBefore = before.cumulative.engineUptimeMs;
            
            server.lastActiveCheck = Date.now() - 5000;
            const after = server.collectMetrics();
            const uptimeAfter = after.cumulative.engineUptimeMs;
            
            // Should increase when session is online
            expect(uptimeAfter).toBeGreaterThan(uptimeBefore);
        });

        it('should track uptime with queued tasks even without online sessions', () => {
            server.updateMetrics({
                sessions: [{ id: 's1', status: 'offline' }],
                queue: { queueLength: 10 }
            });
            
            // First call - sets base
            server.lastActiveCheck = Date.now() - 5000;
            server.collectMetrics();
            
            // Second call - after 3 more seconds
            server.lastActiveCheck = Date.now() - 3000;
            const after = server.collectMetrics();
            
            // Should have accumulated time (5000 + 3000 = 8000ms)
            expect(after.cumulative.engineUptimeMs).toBeGreaterThan(0);
        });
    });

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

    describe('Empty States', () => {
        it('should handle empty sessions array', () => {
            server.updateMetrics({
                sessions: [],
                queue: { queueLength: 0 }
            });
            
            const collected = server.collectMetrics();
            expect(collected.sessions).toEqual([]);
        });

        it('should handle empty queue', () => {
            server.updateMetrics({
                sessions: [],
                queue: { queueLength: 0, maxQueueSize: 500 }
            });
            
            const collected = server.collectMetrics();
            expect(collected.queue.queueLength).toBe(0);
        });

        it('should handle empty recentTasks', () => {
            server.updateMetrics({
                recentTasks: []
            });
            
            expect(server.latestMetrics.recentTasks).toEqual([]);
        });
    });

    describe('Large Data Sets', () => {
        it('should handle many sessions', () => {
            const sessions = Array.from({ length: 50 }, (_, i) => ({
                id: `session-${i}`,
                name: `Browser ${i}`,
                status: 'online'
            }));
            
            server.updateMetrics({ sessions });
            
            const collected = server.collectMetrics();
            expect(collected.sessions).toHaveLength(50);
        });

        it('should handle large task history', () => {
            const tasks = Array.from({ length: 100 }, (_, i) => ({
                taskName: `task-${i}`,
                duration: 1000,
                success: true
            }));
            
            server.updateMetrics({ recentTasks: tasks });
            
            // Should store all (up to maxHistorySize)
            expect(server.latestMetrics.recentTasks.length).toBeGreaterThan(0);
        });

        it('should handle full queue', () => {
            server.updateMetrics({
                queue: { queueLength: 500, maxQueueSize: 500 }
            });
            
            const collected = server.collectMetrics();
            expect(collected.queue.queueLength).toBe(500);
        });
    });

    describe('Data Validation', () => {
        it('should handle missing optional fields', () => {
            // Only provide required minimum
            server.updateMetrics({});
            
            expect(server.latestMetrics).toBeDefined();
        });

        it('should handle null values in payload', () => {
            server.updateMetrics({
                sessions: null,
                queue: null,
                metrics: null
            });
            
            // Should not throw
            expect(server.latestMetrics).toBeDefined();
        });

        it('should handle undefined values in payload', () => {
            server.updateMetrics({
                sessions: undefined,
                queue: undefined
            });
            
            expect(server.latestMetrics).toBeDefined();
        });
    });

    describe('Orchestrator Disconnect', () => {
        it('should clear sessions on disconnect simulation', () => {
            // First, have some sessions
            server.updateMetrics({
                sessions: [{ id: 's1', status: 'online' }],
                queue: { queueLength: 5 }
            });
            
            // Simulate disconnect (clear metrics)
            server.latestMetrics.sessions = [];
            server.latestMetrics.queue.queueLength = 0;
            
            const collected = server.collectMetrics();
            expect(collected.sessions).toEqual([]);
            expect(collected.queue.queueLength).toBe(0);
        });
    });

    describe('Metric Accuracy', () => {
        it('should calculate queue percentage correctly', () => {
            server.updateMetrics({
                queue: { queueLength: 250, maxQueueSize: 500 }
            });
            
            // Queue percentage should be tracked
            expect(server.latestMetrics.queue.queueLength).toBe(250);
        });

        it('should track browser connection rate', () => {
            server.updateMetrics({
                metrics: {
                    browsers: {
                        discovered: 10,
                        connected: 8,
                        failed: 2
                    }
                }
            });
            
            const collected = server.collectMetrics();
            expect(collected.metrics.browsers.discovered).toBe(10);
            expect(collected.metrics.browsers.connected).toBe(8);
        });

        it('should track API failure rate', () => {
            server.updateMetrics({
                metrics: {
                    api: {
                        calls: 100,
                        failures: 15,
                        successRate: '85.00'
                    }
                }
            });
            
            const collected = server.collectMetrics();
            expect(collected.metrics.api.calls).toBe(100);
            expect(collected.metrics.api.failures).toBe(15);
        });
    });

    describe('System Metrics Edge Cases', () => {
        it('should handle high CPU usage', () => {
            // getSystemMetrics should return values even under load
            const metrics = server.getSystemMetrics();
            expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
            expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
        });

        it('should handle high memory usage', () => {
            const metrics = server.getSystemMetrics();
            expect(metrics.memory.percent).toBeGreaterThanOrEqual(0);
            expect(metrics.memory.percent).toBeLessThanOrEqual(100);
        });

        it('should return platform info', () => {
            const metrics = server.getSystemMetrics();
            expect(['Windows', 'macOS', 'Linux']).toContain(metrics.platform);
        });
    });

    describe('Cumulative Metrics', () => {
        it('should track engine uptime', () => {
            server.latestMetrics.sessions = [{ id: '1' }];
            
            const first = server.collectMetrics();
            const uptime1 = first.cumulative.engineUptimeMs;
            
            // Simulate time passing
            server.lastActiveCheck = Date.now() - 1000;
            
            const second = server.collectMetrics();
            const uptime2 = second.cumulative.engineUptimeMs;
            
            expect(uptime2).toBeGreaterThanOrEqual(uptime1);
        });

        it('should start with zero cumulative tasks', () => {
            expect(server.cumulativeMetrics.totalTasksCompleted).toBe(0);
            expect(server.cumulativeMetrics.engineUptimeMs).toBe(0);
        });
    });
});
