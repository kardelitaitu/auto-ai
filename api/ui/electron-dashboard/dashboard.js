/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { Server } from 'socket.io';
import express from 'express';
import { createLogger } from '../../core/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('dashboard.js');

export class DashboardServer {
    constructor(port = 3001, broadcastIntervalMs = 2000) {
        this.port = port;
        this.server = null;
        this.io = null;
        this.latestMetrics = {
            sessions: [],
            queue: { queueLength: 0, maxQueueSize: 500 },
            metrics: { system: { uptime: 0 } },
            recentTasks: [],
            taskBreakdown: {},
            system: {
                cpu: { usage: 0, cores: 0 },
                memory: { total: 0, used: 0, free: 0, percent: 0 },
                platform: 'Unknown',
                hostname: 'Unknown',
                uptime: 0
            }
        };
        this.cumulativeMetrics = {
            engineUptimeMs: 0,
            sessionUptimeMs: 0,  // Time since dashboard server started
            clientConnectTime: 0,  // Time when Electron first connected
            totalTasksCompleted: 0,
            startTime: Date.now()
        };
        this.broadcastInterval = null;
        this.BROADCAST_MS = broadcastIntervalMs;
        this.isShuttingDown = false;
        this.lastCpuInfo = null;
        this.lastActiveCheck = Date.now();
    }

    getSystemMetrics() {
        try {
            const cpus = os.cpus();
            let totalIdle = 0,
                totalTick = 0;

            for (const cpu of cpus) {
                for (const type in cpu.times) {
                    totalTick += cpu.times[type];
                }
                totalIdle += cpu.times.idle;
            }

            const cpuUsage = this.lastCpuInfo
                ? this.calculateCpuUsage(this.lastCpuInfo, { idle: totalIdle, total: totalTick })
                : 0;

            this.lastCpuInfo = { idle: totalIdle, total: totalTick };

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memPercent = Math.round((usedMem / totalMem) * 100);

            const platformName =
                os.platform() === 'win32'
                    ? 'Windows'
                    : os.platform() === 'darwin'
                        ? 'macOS'
                        : os.platform() === 'linux'
                            ? 'Linux'
                            : os.platform();

            return {
                cpu: {
                    usage: cpuUsage,
                    cores: cpus.length,
                },
                memory: {
                    total: Math.round((totalMem / (1024 * 1024 * 1024)) * 100) / 100,
                    used: Math.round((usedMem / (1024 * 1024 * 1024)) * 100) / 100,
                    free: Math.round((freeMem / (1024 * 1024 * 1024)) * 100) / 100,
                    percent: memPercent,
                },
                platform: platformName,
                hostname: os.hostname(),
                uptime: os.uptime(),
            };
        } catch (error) {
            logger.error('Error getting system metrics:', error.message);
            return {
                cpu: { usage: 0, cores: 0 },
                memory: { total: 0, used: 0, free: 0, percent: 0 },
                platform: 'Unknown',
                hostname: 'Unknown',
                uptime: 0,
            };
        }
    }

    calculateCpuUsage(prev, current) {
        const prevIdle = prev.idle;
        const prevTotal = prev.total;
        const idle = current.idle - prevIdle;
        const total = current.total - prevTotal;
        if (total === 0) return 0;
        return Math.round((1 - idle / total) * 100);
    }

    updateMetrics(payload) {
        if (!payload) return;

        const oldRecentLen = this.latestMetrics?.recentTasks?.length || 0;
        const newRecentLen = payload.recentTasks?.length || 0;

        // If new tasks were added, increment total counter
        if (newRecentLen > oldRecentLen) {
            this.cumulativeMetrics.totalTasksCompleted += (newRecentLen - oldRecentLen);
        }

        this.latestMetrics = payload;
    }

    async start() {

        try {
            const expressApp = express();

            this.server = createServer(expressApp);
            this.io = new Server(this.server, {
                cors: { origin: '*' },
                maxHttpBufferSize: 1e6,
                pingTimeout: 60000,
                pingInterval: 25000,
            });

            logger.info(
                `Dashboard server starting on port ${this.port} (${this.BROADCAST_MS}ms broadcast)`
            );

            // Health check - critical for dashboard-first scenario
            expressApp.get('/health', (req, res) => {
                res.json({
                    status: 'ok',
                    timestamp: Date.now(),
                    clients: this.io?.sockets?.sockets?.size || 0,
                });
            });

            // Status endpoint
            expressApp.get('/api/status', (req, res) => {
                res.json({ ready: true, sessions: this.latestMetrics?.sessions?.length || 0, queue: this.latestMetrics?.queue?.queueLength || 0, timestamp: Date.now() });
            });
            expressApp.get('/api/sessions', (req, res) => res.json(this.latestMetrics?.sessions || []));
            expressApp.get('/api/queue', (req, res) => res.json(this.latestMetrics?.queue || {}));
            expressApp.get('/api/metrics', (req, res) => res.json(this.latestMetrics?.metrics || {}));
            expressApp.get('/api/tasks/recent', (req, res) => res.json(this.latestMetrics?.recentTasks || []));
            expressApp.get('/api/tasks/breakdown', (req, res) => res.json(this.latestMetrics?.taskBreakdown || {}));

            // Serve static React build if exists
            const rendererPath = path.join(__dirname, 'renderer');
            const distPath = path.join(rendererPath, 'dist');

            if (fs.existsSync(distPath)) {
                expressApp.use(express.static(distPath));
                expressApp.get('*', (req, res) => {
                    res.sendFile(path.join(distPath, 'index.html'));
                });
            }

            // Socket.io for real-time updates
            this.io.on('connection', (socket) => {
                // Reset session uptime when Electron first connects
                if (!this.firstClientConnected) {
                    this.firstClientConnected = true;
                    this.cumulativeMetrics.sessionUptimeMs = 0;
                    logger.info("Dashboard session started (Electron connected)");
                }
                logger.info(
                    `Dashboard client connected (total: ${this.io?.sockets?.sockets?.size || 0})`
                );

                // Send initial data immediately
                this.sendMetrics(socket);

                socket.on('disconnect', () => {
                    logger.info(
                        `Dashboard client disconnected (remaining: ${this.io?.sockets?.sockets?.size || 0})`
                    );
                });

                socket.on('requestUpdate', () => {
                    this.sendMetrics(socket);
                });

                // Support metrics push from Orchestrator via Socket
                socket.on('push_metrics', (payload) => {
                    this.updateMetrics(payload);
                });
            });

            this.startBroadcast();

            return new Promise((resolve, reject) => {
                this.server.listen(this.port, () => {
                    logger.info(`Dashboard server listening on port ${this.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    logger.error('Dashboard server error:', error);
                    reject(error);
                });
            });
        } catch (error) {
            logger.error('Failed to start dashboard server:', error);
            throw error;
        }
    }

    startBroadcast() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
        }

        this.broadcastInterval = setInterval(() => {
            if (this.io?.sockets?.sockets?.size > 0) {
                const metrics = this.collectMetrics();
                this.io.emit('metrics', metrics);
            }
        }, this.BROADCAST_MS);

        logger.info(`Broadcast interval set to ${this.BROADCAST_MS}ms`);
    }
    collectMetrics() {
        try {
            const now = Date.now();
            const elapsed = now - this.lastActiveCheck;
            this.lastActiveCheck = now;

            // Only increment uptime if there's an active session or queue
            // Only count online sessions (not offline/idle)
            const hasOnlineSession = this.latestMetrics?.sessions?.some(s => s?.status === 'online') || false;
            const hasActivity = hasOnlineSession ||
                (this.latestMetrics?.queue?.queueLength > 0);

            if (hasActivity) {
                this.cumulativeMetrics.engineUptimeMs += elapsed;
            this.cumulativeMetrics.sessionUptimeMs += elapsed;  // Always track session time
            }

            return {
                timestamp: now,
                ...this.latestMetrics,
                cumulative: this.cumulativeMetrics,
                system: this.getSystemMetrics(),
            };
        } catch (error) {
            logger.error('Error collecting metrics:', error);
            return { error: error.message, timestamp: Date.now() };
        }
    }

    sendMetrics(socket) {
        try {
            socket.emit('metrics', this.collectMetrics());
        } catch (error) {
            logger.error('Error sending metrics:', error);
        }
    }

    emit(event, data) {
        if (this.io) {
            this.io.emit(event, { timestamp: Date.now(), ...data });
        }
    }

    async stop() {
        this.isShuttingDown = true;
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }

        // Close socket.io first to disconnect clients and clear internal timers
        if (this.io) {
            try {
                this.io.close();
                logger.info('Socket.io closed');
            } catch (error) {
                logger.warn('Error closing Socket.io:', error.message);
            }
            this.io = null;
        }

        // Await server closure
        if (this.server) {
            try {
                await new Promise((resolve, reject) => {
                    this.server.close((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                logger.info('Dashboard server stopped');
            } catch (error) {
                logger.error('Error stopping dashboard server:', error.message);
            }
            this.server = null;
        }
    }
}


// If started as an IPC child process from the Orchestrator
if (process.send) {
    const port = parseInt(process.env.PORT) || 3001;
    const interval = parseInt(process.env.BROADCAST_MS) || 2000;

    const server = new DashboardServer(port, interval);
    server.start().catch(err => {
        console.error('Fatal error starting IPC dashboard server:', err);
        process.exit(1);
    });

    process.on('message', msg => {
        if (msg && msg.type === 'metrics_tick') {
            server.updateMetrics(msg.payload);
        } else if (msg && msg.type === 'shutdown') {
            server.stop().then(() => process.exit(0));
        }
    });

    // DO NOT exit on disconnect - this allows the dashboard to persist when Orchestrator restarts
    process.on('disconnect', () => {
        logger.info('Orchestrator disconnected, but dashboard server will persist.');
        // Clear activity-dependent metrics so they show as 0/idle until reconnect
        server.latestMetrics.sessions = [];
        server.latestMetrics.queue.queueLength = 0;
    });
}
