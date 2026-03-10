/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * 
 * @fileoverview Tests for dashboard data pipeline
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('process', {
    ...process,
    send: vi.fn(),
    on: vi.fn(),
    exit: vi.fn()
});

import { DashboardServer } from '../../ui/electron-dashboard/dashboard.js';

describe('Dashboard Data Pipeline', () => {
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

    describe('Orchestrator to Dashboard Flow', () => {
        it('should receive full metrics from orchestrator', () => {
            const payload = {
                sessions: [{ id: 's1', name: 'Test', status: 'online', activeWorkers: 2, totalWorkers: 3 }],
                queue: { queueLength: 15, maxQueueSize: 500 },
                metrics: {
                    tasks: { executed: 50, failed: 2, successRate: '96.00' },
                    api: { calls: 200, failures: 5, successRate: '97.50' },
                    browsers: { discovered: 5, connected: 3 },
                    twitter: { actions: { likes: 100, total: 235 } }
                },
                recentTasks: [{ taskName: 'test', duration: 5000, success: true, timestamp: Date.now() }]
            };
            
            server.updateMetrics(payload);
            
            expect(server.latestMetrics.sessions).toHaveLength(1);
            expect(server.latestMetrics.queue.queueLength).toBe(15);
            expect(server.latestMetrics.metrics.tasks.executed).toBe(50);
            expect(server.latestMetrics.metrics.api.calls).toBe(200);
            expect(server.latestMetrics.metrics.browsers.discovered).toBe(5);
            expect(server.latestMetrics.metrics.twitter.actions.total).toBe(235);
        });
    });

    describe('Dashboard to WebSocket Flow', () => {
        it('should collect metrics with correct UI structure', () => {
            server.updateMetrics({
                sessions: [{ id: 's1', name: 'Browser 1', status: 'online' }],
                queue: { queueLength: 10 },
                metrics: { tasks: { executed: 100 }, api: { calls: 500 }, browsers: { discovered: 3 } }
            });
            
            const collected = server.collectMetrics();
            
            expect(collected).toHaveProperty('timestamp');
            expect(collected).toHaveProperty('sessions');
            expect(collected).toHaveProperty('queue');
            expect(collected).toHaveProperty('metrics');
            expect(collected).toHaveProperty('system');
            expect(collected).toHaveProperty('cumulative');
        });

        it('should include system metrics', () => {
            server.updateMetrics({ sessions: [] });
            const collected = server.collectMetrics();
            
            expect(collected.system.cpu).toHaveProperty('usage');
            expect(collected.system.memory).toHaveProperty('percent');
        });
    });

    describe('UI Data Mapping Compatibility', () => {
        it('should provide Recent Tasks data', () => {
            server.updateMetrics({
                recentTasks: [{ taskName: 'follow', duration: 5000, success: true, timestamp: 1234567890 }]
            });
            
            const task = server.latestMetrics.recentTasks[0];
            expect(task.taskName).toBe('follow');
            expect(task.success).toBe(true);
            expect(task.duration).toBe(5000);
        });

        it('should provide Sessions data', () => {
            server.updateMetrics({
                sessions: [{ id: 's1', name: 'Browser 1', status: 'online', activeWorkers: 2, totalWorkers: 3, taskName: 'test' }]
            });
            
            const session = server.latestMetrics.sessions[0];
            expect(session.name).toBe('Browser 1');
            expect(session.status).toBe('online');
            expect(session.activeWorkers).toBe(2);
            expect(session.totalWorkers).toBe(3);
        });

        it('should provide API metrics data', () => {
            server.updateMetrics({
                metrics: { api: { calls: 1000, failures: 50, successRate: '95.00', avgResponseTime: '350' } }
            });
            
            const api = server.latestMetrics.metrics.api;
            expect(api.calls).toBe(1000);
            expect(api.failures).toBe(50);
            expect(api.successRate).toBe('95.00');
        });

        it('should provide Browser stats data', () => {
            server.updateMetrics({
                metrics: { browsers: { discovered: 10, connected: 7 } }
            });
            
            expect(server.latestMetrics.metrics.browsers.discovered).toBe(10);
            expect(server.latestMetrics.metrics.browsers.connected).toBe(7);
        });

        it('should provide Twitter actions data', () => {
            server.updateMetrics({
                metrics: { twitter: { actions: { likes: 100, retweets: 50, follows: 30, total: 180 } } }
            });
            
            const twitter = server.latestMetrics.metrics.twitter.actions;
            expect(twitter.likes).toBe(100);
            expect(twitter.retweets).toBe(50);
            expect(twitter.follows).toBe(30);
            expect(twitter.total).toBe(180);
        });
    });

    describe('Real-time Updates', () => {
        it('should handle rapid updates', () => {
            for (let i = 0; i < 10; i++) {
                server.updateMetrics({
                    sessions: [{ id: 's' + i }],
                    queue: { queueLength: i * 10 },
                    metrics: { tasks: { executed: i * 10 } }
                });
            }
            
            expect(server.latestMetrics.queue.queueLength).toBe(90);
        });

        it('should preserve cumulative across updates', () => {
            server.latestMetrics.recentTasks = [];
            server.updateMetrics({ recentTasks: [{ taskName: 't1' }] });
            const afterFirst = server.cumulativeMetrics.totalTasksCompleted;
            
            server.updateMetrics({ recentTasks: [{ taskName: 't1' }, { taskName: 't2' }] });
            const afterSecond = server.cumulativeMetrics.totalTasksCompleted;
            
            expect(afterSecond).toBeGreaterThan(afterFirst);
        });
    });
});
