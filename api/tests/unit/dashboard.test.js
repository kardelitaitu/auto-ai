/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Prevent IPC code from running during tests
vi.stubGlobal('process', {
    ...process,
    send: vi.fn(),
    on: vi.fn(),
    exit: vi.fn()
});

import { DashboardServer } from '../../ui/electron-dashboard/dashboard.js';

describe('DashboardServer', () => {
    let server;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        if (server?.stop) {
            server.stop();
        }
    });

    describe('constructor', () => {
        it('should create instance with default port', () => {
            server = new DashboardServer();
            expect(server.port).toBe(3001);
            expect(server.BROADCAST_MS).toBe(2000);
        });

        it('should create instance with custom port', () => {
            server = new DashboardServer(4000, 5000);
            expect(server.port).toBe(4000);
            expect(server.BROADCAST_MS).toBe(5000);
        });

        it('should initialize with empty metrics', () => {
            server = new DashboardServer();
            expect(server.latestMetrics.sessions).toEqual([]);
            expect(server.latestMetrics.queue.queueLength).toBe(0);
            expect(server.cumulativeMetrics.completedTasks).toBeDefined();
        });
    });

    describe('getSystemMetrics', () => {
        beforeEach(() => { server = new DashboardServer(); });

        it('should return system metrics object', () => {
            const metrics = server.getSystemMetrics();
            expect(metrics).toHaveProperty('cpu');
            expect(metrics).toHaveProperty('memory');
            expect(metrics).toHaveProperty('platform');
            expect(metrics).toHaveProperty('hostname');
        });

        it('should return CPU with usage and cores', () => {
            const metrics = server.getSystemMetrics();
            expect(metrics.cpu).toHaveProperty('usage');
            expect(metrics.cpu).toHaveProperty('cores');
        });

        it('should return memory with percent', () => {
            const metrics = server.getSystemMetrics();
            expect(metrics.memory.percent).toBeGreaterThanOrEqual(0);
            expect(metrics.memory.percent).toBeLessThanOrEqual(100);
        });
    });

    describe('updateMetrics', () => {
        beforeEach(() => {
            // Delete history file to ensure clean state
            const historyFile = path.join(__dirname, '..', '..', 'ui', 'electron-dashboard', 'data', 'dashboard-history.json');
            try {
                fs.unlinkSync(historyFile);
            } catch (e) {
                // ignore if file doesn't exist
            }
            server = new DashboardServer();
        });

        it('should update latestMetrics with payload', () => {
            const payload = {
                sessions: [{ id: 'session-1' }],
                queue: { queueLength: 5 },
                metrics: { tasks: { executed: 10 } }
            };
            server.updateMetrics(payload);
            expect(server.latestMetrics.sessions).toEqual(payload.sessions);
            expect(server.latestMetrics.queue.queueLength).toBe(5);
        });

        it('should handle null payload gracefully', () => {
            expect(() => server.updateMetrics(null)).not.toThrow();
        });

        it('should handle undefined payload gracefully', () => {
            expect(() => server.updateMetrics(undefined)).not.toThrow();
        });

        it('should increment task counter on new successful tasks', () => {
            // Use real timers to avoid duplicate timestamp issues
            vi.useRealTimers();
            server.dashboardData.tasks = [];
            server.historyManager.completedTasks = 0;
            server.historyManager.tasks = [];
            const now = Date.now();
            server.updateMetrics({
                recentTasks: [
                    { id: 't1', taskName: 'task1', success: true, timestamp: now },
                    { id: 't2', taskName: 'task2', success: false, timestamp: now + 1 }
                ]
            });
            const metrics = server.collectMetrics();
            expect(metrics.cumulative.completedTasks).toBe(1);
        });
    });

    describe('collectMetrics', () => {
        beforeEach(() => { server = new DashboardServer(); });

        it('should return metrics with timestamp', () => {
            server.latestMetrics.sessions = [];
            const collected = server.collectMetrics();
            expect(collected).toHaveProperty('timestamp');
            expect(collected).toHaveProperty('sessions');
            expect(collected).toHaveProperty('system');
            expect(collected).toHaveProperty('cumulative');
        });

        it('should include system metrics', () => {
            server.latestMetrics.sessions = [];
            const collected = server.collectMetrics();
            expect(collected.system).toHaveProperty('cpu');
            expect(collected.system).toHaveProperty('memory');
        });
    });

    describe('calculateCpuUsage', () => {
        beforeEach(() => { server = new DashboardServer(); });

        it('should calculate CPU usage correctly', () => {
            const usage = server.calculateCpuUsage(
                { idle: 100, total: 500 },
                { idle: 150, total: 600 }
            );
            expect(usage).toBeGreaterThanOrEqual(0);
            expect(usage).toBeLessThanOrEqual(100);
        });

        it('should return 0 when total delta is 0', () => {
            const usage = server.calculateCpuUsage(
                { idle: 100, total: 500 },
                { idle: 100, total: 500 }
            );
            expect(usage).toBe(0);
        });
    });

    describe('emit', () => {
        beforeEach(() => { server = new DashboardServer(); });

        it('should emit event to all sockets', () => {
            server.io = { emit: vi.fn() };
            server.emit('test-event', { data: 'test' });
            expect(server.io.emit).toHaveBeenCalledWith('test-event', expect.objectContaining({
                timestamp: expect.any(Number),
                data: 'test'
            }));
        });

        it('should handle missing io gracefully', () => {
            server.io = null;
            expect(() => server.emit('test', {})).not.toThrow();
        });
    });
});
