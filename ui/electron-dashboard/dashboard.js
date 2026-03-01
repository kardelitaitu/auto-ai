import { Server } from 'socket.io';
import express from 'express';
import { createLogger } from '../../utils/logger.js';
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
    this.orchestrator = null;
    this.broadcastInterval = null;
    this.BROADCAST_MS = broadcastIntervalMs;
    this.isShuttingDown = false;
    this.lastCpuInfo = null;
  }

  getSystemMetrics() {
    try {
      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;

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

      const platformName = os.platform() === 'win32' ? 'Windows'
        : os.platform() === 'darwin' ? 'macOS'
          : os.platform() === 'linux' ? 'Linux'
            : os.platform();

      return {
        cpu: {
          usage: cpuUsage,
          cores: cpus.length
        },
        memory: {
          total: Math.round(totalMem / (1024 * 1024 * 1024) * 100) / 100,
          used: Math.round(usedMem / (1024 * 1024 * 1024) * 100) / 100,
          free: Math.round(freeMem / (1024 * 1024 * 1024) * 100) / 100,
          percent: memPercent
        },
        platform: platformName,
        hostname: os.hostname(),
        uptime: os.uptime()
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error.message);
      return {
        cpu: { usage: 0, cores: 0 },
        memory: { total: 0, used: 0, free: 0, percent: 0 },
        platform: 'Unknown',
        hostname: 'Unknown',
        uptime: 0
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

  async start(orchestrator) {
    this.orchestrator = orchestrator;

    try {
      const expressApp = express();

      this.server = createServer(expressApp);
      this.io = new Server(this.server, {
        cors: { origin: "*" },
        maxHttpBufferSize: 1e6,
        pingTimeout: 60000,
        pingInterval: 25000
      });

      logger.info(`Dashboard server starting on port ${this.port} (${this.BROADCAST_MS}ms broadcast)`);

      // Health check - critical for dashboard-first scenario
      expressApp.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          timestamp: Date.now(),
          clients: this.io?.sockets?.sockets?.size || 0
        });
      });

      // Status endpoint - tells dashboard if orchestrator is ready
      expressApp.get('/api/status', (req, res) => {
        try {
          const hasOrchestrator = !!this.orchestrator;
          let sessionCount = 0;
          let queueLength = 0;

          if (hasOrchestrator && this.orchestrator.sessionManager) {
            sessionCount = this.orchestrator.sessionManager.getAllSessions().length;
            queueLength = this.orchestrator.taskQueue?.length || 0;
          }

          res.json({
            ready: hasOrchestrator,
            sessions: sessionCount,
            queue: queueLength,
            timestamp: Date.now()
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // REST API endpoints
      expressApp.get('/api/sessions', (req, res) => {
        try {
          if (!this.orchestrator) {
            return res.status(503).json({ error: 'Orchestrator not ready' });
          }
          res.json(this.orchestrator.getSessionMetrics());
        } catch (error) {
          logger.error('Error fetching sessions:', error);
          res.status(500).json({ error: error.message });
        }
      });

      expressApp.get('/api/queue', (req, res) => {
        try {
          if (!this.orchestrator) {
            return res.status(503).json({ error: 'Orchestrator not ready' });
          }
          res.json(this.orchestrator.getQueueStatus());
        } catch (error) {
          logger.error('Error fetching queue:', error);
          res.status(500).json({ error: error.message });
        }
      });

      expressApp.get('/api/metrics', (req, res) => {
        try {
          if (!this.orchestrator) {
            return res.status(503).json({ error: 'Orchestrator not ready' });
          }
          res.json(this.orchestrator.getMetrics());
        } catch (error) {
          logger.error('Error fetching metrics:', error);
          res.status(500).json({ error: error.message });
        }
      });

      expressApp.get('/api/tasks/recent', (req, res) => {
        try {
          if (!this.orchestrator) {
            return res.status(503).json({ error: 'Orchestrator not ready' });
          }
          const limit = parseInt(req.query.limit) || 20;
          res.json(this.orchestrator.getRecentTasks(limit));
        } catch (error) {
          logger.error('Error fetching recent tasks:', error);
          res.status(500).json({ error: error.message });
        }
      });

      expressApp.get('/api/tasks/breakdown', (req, res) => {
        try {
          if (!this.orchestrator) {
            return res.status(503).json({ error: 'Orchestrator not ready' });
          }
          res.json(this.orchestrator.getTaskBreakdown());
        } catch (error) {
          logger.error('Error fetching task breakdown:', error);
          res.status(500).json({ error: error.message });
        }
      });

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
        logger.info(`Dashboard client connected (total: ${this.io?.sockets?.sockets?.size || 0})`);

        // Send initial data immediately
        this.sendMetrics(socket);

        socket.on('disconnect', () => {
          logger.info(`Dashboard client disconnected (remaining: ${this.io?.sockets?.sockets?.size || 0})`);
        });

        socket.on('requestUpdate', () => {
          this.sendMetrics(socket);
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
      if (!this.orchestrator) {
        return {
          error: 'Orchestrator not ready',
          timestamp: Date.now(),
          sessions: [],
          queue: { queueLength: 0, isProcessing: false, maxQueueSize: 500 },
          metrics: {},
          recentTasks: [],
          taskBreakdown: {},
          system: this.getSystemMetrics()
        };
      }

      return {
        timestamp: Date.now(),
        sessions: this.orchestrator.getSessionMetrics(),
        queue: this.orchestrator.getQueueStatus(),
        metrics: this.orchestrator.getMetrics(),
        recentTasks: this.orchestrator.getRecentTasks(20),
        taskBreakdown: this.orchestrator.getTaskBreakdown(),
        system: this.getSystemMetrics()
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
