/**
 * Auto-AI Framework - Proprietary Software
 * Copyright (c) 2025 gantengmaksimal - All Rights Reserved
 * Unauthorized copying, distribution, or modification prohibited
 */

import { createHash } from 'crypto';
import { Server } from 'socket.io';
import express from 'express';
import { createLogger } from './lib/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import os from 'os';
import { HistoryManager } from './lib/history-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('dashboard.js');
const HISTORY_FILE = path.join(__dirname, 'data', 'dashboard-history.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        // Logger not yet initialized, use console with consistent prefix
        console.warn('[Dashboard] Failed to load config:', err.message);
    }
    return {};
}

const config = loadConfig();
const DEFAULT_BROADCAST_MS = config?.broadcast?.intervalMs || 2000;
const DEFAULT_PING_TIMEOUT = config?.broadcast?.pingTimeout || 60000;
const DEFAULT_PING_INTERVAL = config?.broadcast?.pingInterval || 25000;
const DEFAULT_HISTORY_MAX_ITEMS = config?.history?.maxItems || 9999;
const DEFAULT_HISTORY_SAVE_DEBOUNCE = config?.history?.saveDebounceMs || 5000;

const CORS_ENABLED = config?.security?.cors?.enabled ?? true;
const CORS_ORIGINS = config?.security?.cors?.origins || ['http://localhost:5173', 'http://localhost:3001'];
const RATE_LIMIT_ENABLED = config?.security?.rateLimit?.enabled ?? true;
const RATE_LIMIT_WINDOW_MS = config?.security?.rateLimit?.windowMs || 60000;
const RATE_LIMIT_MAX_REQUESTS = config?.security?.rateLimit?.maxRequests || 100;
const SESSION_TTL_MS = config?.security?.sessionTTL || 300000;

// Authentication configuration
const AUTH_ENABLED = config?.security?.auth?.enabled ?? false;
const AUTH_TOKEN = config?.security?.auth?.token || '';
const PROTECTED_EVENTS = config?.security?.auth?.protectedEvents || ['clear-history', 'send-notification', 'push_metrics', 'task-update'];

/**
 * Authenticate a socket event handler.
 * Returns true if auth is disabled, token matches, or no token is configured.
 * @param {Object} data - The event payload (may contain token)
 * @returns {boolean} - Whether the request is authenticated
 */
function isAuthenticated(data) {
    if (!AUTH_ENABLED) return true;
    if (!AUTH_TOKEN || AUTH_TOKEN.length === 0) {
        logger.warn('Auth enabled but no token configured - blocking all requests');
        return false;
    }

    const providedToken = data?.token || data?.authToken;
    return providedToken === AUTH_TOKEN;
}

/**
 * Wraps a socket event handler with authentication.
 * @param {string} eventName - The event name for logging
 * @param {Function} handler - The actual handler function
 * @returns {Function} - Wrapped handler with auth check
 */
function withAuth(eventName, handler) {
    return (data) => {
        if (!isAuthenticated(data)) {
            logger.warn(`Unauthorized ${eventName} attempt from socket`);
            return;
        }
        // Strip auth fields before passing to handler
        const { token, authToken, ...cleanData } = data || {};
        handler(cleanData);
    };
}

/**
 * Generate a quick hash for change detection.
 * Uses a simple DJB2-like hash for performance (not cryptographic).
 * @param {any} obj - Object to hash
 * @returns {string} - Hash string
 */
function quickHash(obj) {
    const str = JSON.stringify(obj);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

function sanitizeLogString(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/[\x00-\x1F\x7F]/g, '')
        .slice(0, 1000);
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeLogString(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

const VALID_TASK_FIELDS = ['id', 'taskName', 'name', 'command', 'sessionId', 'session', 'timestamp', 'status', 'success', 'error', 'duration'];
const VALID_SESSION_FIELDS = ['id', 'status', 'browser', 'profile', 'port', 'ws', 'lastSeen', 'firstSeen'];
const VALID_METRIC_FIELDS = ['twitter', 'api', 'browsers'];
const MAX_ERRORS = 1000; // Maximum number of errors to keep in memory

function validateTask(task) {
    if (!task || typeof task !== 'object') return null;
    const validated = {};
    for (const key of VALID_TASK_FIELDS) {
        if (task[key] !== undefined) validated[key] = task[key];
    }
    return Object.keys(validated).length > 0 ? validated : null;
}

function validateSession(session) {
    if (!session || typeof session !== 'object') return null;
    const validated = {};
    for (const key of VALID_SESSION_FIELDS) {
        if (session[key] !== undefined) validated[key] = session[key];
    }
    return Object.keys(validated).length > 0 ? validated : null;
}

function validateMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') return null;
    const validated = {};
    if (metrics.twitter && typeof metrics.twitter === 'object') {
        validated.twitter = metrics.twitter;
    }
    if (metrics.api && typeof metrics.api === 'object') {
        validated.api = metrics.api;
    }
    if (metrics.browsers && typeof metrics.browsers === 'object') {
        validated.browsers = metrics.browsers;
    }
    return Object.keys(validated).length > 0 ? validated : null;
}

function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const validated = {};
    if (Array.isArray(payload.sessions) && payload.sessions.length > 0) {
        validated.sessions = payload.sessions.map(validateSession).filter(Boolean);
    }
    if (Array.isArray(payload.recentTasks) && payload.recentTasks.length > 0) {
        validated.recentTasks = payload.recentTasks.map(validateTask).filter(Boolean);
    }
    if (payload.metrics) {
        validated.metrics = validateMetrics(payload.metrics);
    }
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        validated.errors = payload.errors.filter(e => typeof e === 'string');
    }
    return Object.keys(validated).length > 0 ? validated : null;
}

export class DashboardServer {
    constructor(port = 3001, broadcastIntervalMs = DEFAULT_BROADCAST_MS) {
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

        this.historyManager = new HistoryManager(HISTORY_FILE, DEFAULT_HISTORY_MAX_ITEMS, DEFAULT_HISTORY_SAVE_DEBOUNCE);

        // Independent dashboard data stores (persist across orchestrator restarts)
        this.dashboardData = {
            sessions: [],
            sessionHistory: [],
            tasks: this.historyManager.getTasks(),
            queue: { queueLength: 0, activeTaskCount: 0 },
            metrics: {},
            recentTasks: this.historyManager.getTasks().slice(-40),
            twitterActions: this.historyManager.getTwitterActions(),
            apiMetrics: this.historyManager.getApiMetrics(),
            browserMetrics: { discovered: 0, connected: 0 },
            queueHistory: [],
            errors: [],
            firstDataTime: Date.now()
        };

        // Initialize latestMetrics with loaded history data
        this.latestMetrics = {
            sessions: [],
            queue: { queueLength: 0, maxQueueSize: 500 },
            metrics: { system: { uptime: 0 } },
            recentTasks: this.historyManager.getTasks().slice(-40),
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
            completedTasks: this.historyManager.getCompletedTasksCount(),
            startTime: Date.now()
        };

        // Track last seen metrics to calculate deltas from cumulative engine data
        this.lastSeenMetrics = {
            twitter: { actions: {} },
            api: { calls: 0, failures: 0 },
            tasks: { executed: 0, failed: 0 }
        };

        this.broadcastInterval = null;
        this.BROADCAST_MS = broadcastIntervalMs;
        this.isShuttingDown = false;

        // Error tracking for broadcast circuit breaker
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 5;  // Stop broadcast after 5 consecutive errors
        this.broadcastPaused = false;

        // Initialize lastCpuInfo with current CPU state for accurate first calculation
        const initialCpus = os.cpus();
        let initialIdle = 0, initialTotal = 0;
        for (const cpu of initialCpus) {
            for (const type in cpu.times) {
                initialTotal += cpu.times[type];
            }
            initialIdle += cpu.times.idle;
        }
        this.lastCpuInfo = { idle: initialIdle, total: initialTotal };

        this.lastActiveCheck = Date.now();
        this.firstClientConnected = false;
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

            // Platform detection using map for better readability
            const platformMap = {
                'win32': 'Windows',
                'darwin': 'macOS',
                'linux': 'Linux'
            };
            const platformName = platformMap[os.platform()] || os.platform();

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

        // Merge with independent dashboard data store
        this.mergeDashboardData(payload);

        // Debug: log recentTasks count
        logger.info(`[updateMetrics] dashboardData.tasks count: ${this.dashboardData.tasks.length}, recentTasks: ${payload.recentTasks?.length}`);

        this.latestMetrics = {
            ...payload,
            recentTasks: this.dashboardData.tasks.slice(-40),
            metrics: {
                ...payload.metrics,
                // Use incoming Twitter metrics directly, don't overwrite with stored data
                // The stored dashboardData.twitterActions is for persistence only
                twitter: payload.metrics?.twitter || { actions: this.dashboardData.twitterActions },
                api: this.dashboardData.apiMetrics,
                browsers: this.dashboardData.browserMetrics
            }
        };
    }

    mergeTaskData(task) {
        this.dashboardData.tasks = this.historyManager.addOrUpdateTask(task);
    }

    mergeDashboardData(payload) {
        // Merge sessions
        if (payload.sessions?.length > 0) {
            for (const session of payload.sessions) {
                const existing = this.dashboardData.sessions.find(s => s.id === session.id);
                if (!existing) {
                    this.dashboardData.sessions.push({ ...session, firstSeen: Date.now() });
                } else {
                    Object.assign(existing, session);
                }
            }
        }

        // Merge tasks - append and persist
        if (payload.recentTasks?.length > 0) {
            for (const task of payload.recentTasks) {
                this.mergeTaskData(task);
            }
        }

        // Merge Twitter actions (accumulate via deltas)
        if (payload.metrics?.twitter?.actions) {
            const actions = payload.metrics.twitter.actions;
            const last = this.lastSeenMetrics.twitter.actions;

            const getDelta = (curr, prev) => {
                const c = curr || 0;
                const p = prev || 0;
                return c >= p ? c - p : c;
            };

            const deltaLikes = getDelta(actions.likes, last.likes);
            const deltaRetweets = getDelta(actions.retweets, last.retweets);
            const deltaReplies = getDelta(actions.replies, last.replies);
            const deltaQuotes = getDelta(actions.quotes, last.quotes);
            const deltaFollows = getDelta(actions.follows, last.follows);
            const deltaBookmarks = getDelta(actions.bookmarks, last.bookmarks);

            this.dashboardData.twitterActions.likes += deltaLikes;
            this.dashboardData.twitterActions.retweets += deltaRetweets;
            this.dashboardData.twitterActions.replies += deltaReplies;
            this.dashboardData.twitterActions.quotes += deltaQuotes;
            this.dashboardData.twitterActions.follows += deltaFollows;
            this.dashboardData.twitterActions.bookmarks += deltaBookmarks;

            this.dashboardData.twitterActions.total =
                this.dashboardData.twitterActions.likes +
                this.dashboardData.twitterActions.retweets +
                this.dashboardData.twitterActions.replies +
                this.dashboardData.twitterActions.quotes +
                this.dashboardData.twitterActions.follows +
                this.dashboardData.twitterActions.bookmarks;

            // Persist
            this.historyManager.setTwitterActions(this.dashboardData.twitterActions);

            // Store for next tick
            this.lastSeenMetrics.twitter.actions = { ...actions };
        }

        // Merge API metrics (accumulate via deltas)
        if (payload.metrics?.api) {
            const api = payload.metrics.api;
            const last = this.lastSeenMetrics.api;

            const getDelta = (curr, prev) => {
                const c = curr || 0;
                const p = prev || 0;
                return c >= p ? c - p : c;
            };

            const deltaCalls = getDelta(api.calls, last.calls);
            const deltaFailures = getDelta(api.failures, last.failures);

            this.dashboardData.apiMetrics.calls += deltaCalls;
            this.dashboardData.apiMetrics.failures += deltaFailures;

            // Recalculate success rate
            const total = this.dashboardData.apiMetrics.calls;
            const fails = this.dashboardData.apiMetrics.failures;
            this.dashboardData.apiMetrics.successRate = total > 0 ? Math.round(((total - fails) / total) * 100) : 100;

            this.dashboardData.apiMetrics.avgResponseTime = api.avgResponseTime || 0;

            // Persist
            this.historyManager.setApiMetrics(this.dashboardData.apiMetrics);

            // Store for next tick
            this.lastSeenMetrics.api = { calls: api.calls, failures: api.failures };
        }

        // Browser metrics
        if (payload.metrics?.browsers) {
            this.dashboardData.browserMetrics = { ...payload.metrics.browsers };
        }

        // Errors - enforce max size to prevent unbounded growth
        if (payload.errors?.length > 0) {
            this.dashboardData.errors.push(...payload.errors);
            if (this.dashboardData.errors.length > MAX_ERRORS) {
                this.dashboardData.errors = this.dashboardData.errors.slice(-MAX_ERRORS);
            }
        }
    }

    async start() {
        // Check if port is available
        const net = await import("net");
        const isPortAvailable = await new Promise((resolve) => {
            const testServer = net.createServer();
            testServer.once("error", () => resolve(false));
            testServer.once("listening", () => { testServer.close(); resolve(true); });
            testServer.listen(this.port);
        });
        if (!isPortAvailable) {
            const err = new Error("Port already in use");
            err.code = "EADDRINUSE";
            throw err;
        }

        try {
            const expressApp = express();

            if (RATE_LIMIT_ENABLED) {
                const rateLimit = (() => {
                    const requests = new Map();

                    // Periodic cleanup to prevent memory leak
                    const cleanupInterval = setInterval(() => {
                        const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
                        for (const [key, timestamps] of requests.entries()) {
                            const filtered = timestamps.filter(t => t > cutoff);
                            if (filtered.length === 0) {
                                requests.delete(key);
                            } else {
                                requests.set(key, filtered);
                            }
                        }
                    }, RATE_LIMIT_WINDOW_MS);

                    // Allow cleanup interval to be cleared on process exit
                    if (cleanupInterval.unref) {
                        cleanupInterval.unref();
                    }

                    return (req, res, next) => {
                        const key = req.ip || req.connection.remoteAddress;
                        const now = Date.now();
                        const windowStart = now - RATE_LIMIT_WINDOW_MS;

                        let clientRequests = requests.get(key) || [];
                        clientRequests = clientRequests.filter(t => t > windowStart);

                        if (clientRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
                            logger.warn(`Rate limit exceeded for ${key}`);
                            return res.status(429).json({ error: 'Too many requests' });
                        }

                        clientRequests.push(now);
                        requests.set(key, clientRequests);
                        next();
                    };
                })();
                expressApp.use(rateLimit);
            }

            this.server = createServer(expressApp);
            // Always restrict origins - never use wildcard '*' for security
            const corsOrigin = CORS_ENABLED ? CORS_ORIGINS : ['http://localhost:3001'];
            this.io = new Server(this.server, {
                cors: {
                    origin: corsOrigin,
                    methods: ['GET', 'POST']
                },
                maxHttpBufferSize: 1e6,
                pingTimeout: DEFAULT_PING_TIMEOUT,
                pingInterval: DEFAULT_PING_INTERVAL,
            });

            logger.info(
                `Dashboard server starting on port ${this.port} (${this.BROADCAST_MS}ms broadcast)`
            );

            // Authentication middleware for sensitive HTTP endpoints
            const requireAuth = (req, res, next) => {
                if (!AUTH_ENABLED) return next();
                const token = req.headers['x-auth-token'] || req.query.token;
                if (!token || token !== AUTH_TOKEN) {
                    logger.warn(`Unauthorized HTTP request to ${req.path} from ${req.ip}`);
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                next();
            };

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
            // Protected endpoints - require authentication when enabled
            expressApp.get('/api/dashboard/data', requireAuth, (req, res) => res.json(this.dashboardData || {}));

            // Export endpoints - require authentication
            expressApp.get('/api/export/json', requireAuth, (req, res) => {
                const data = {
                    sessions: this.dashboardData.sessions,
                    tasks: this.dashboardData.tasks,
                    twitterActions: this.dashboardData.twitterActions,
                    apiMetrics: this.dashboardData.apiMetrics,
                    exportedAt: new Date().toISOString()
                };
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=dashboard-export.json');
                res.json(data);
            });

            expressApp.get('/api/export/csv', requireAuth, (req, res) => {
                const tasks = this.dashboardData.tasks || [];
                const headers = ['id', 'taskName', 'sessionId', 'timestamp', 'status', 'success', 'duration'];
                const csvRows = [headers.join(',')];

                for (const task of tasks) {
                    const row = headers.map(h => {
                        const val = task[h] ?? '';
                        const str = String(val).replace(/"/g, '""');
                        return `"${str}"`;
                    });
                    csvRows.push(row.join(','));
                }

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=tasks-export.csv');
                res.send(csvRows.join('\n'));
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
                // Reset session uptime when Electron first connects
                if (!this.firstClientConnected) {
                    this.firstClientConnected = true;
                    this.cumulativeMetrics.sessionUptimeMs = 0;
                    logger.info("Dashboard session started (Electron connected)");
                }

                // Resume broadcast if it was paused due to errors
                this.resumeBroadcast();

                // Start broadcast if this is the first client
                if (!this.broadcastInterval) {
                    this.startBroadcast();
                }

                logger.info(
                    `Dashboard client connected (total: ${this.io?.sockets?.sockets?.size || 0})`
                );

                // Send initial data immediately
                this.sendMetrics(socket);

                socket.on('disconnect', () => {
                    const remainingClients = (this.io?.sockets?.sockets?.size || 0) - 1;
                    logger.info(
                        `Dashboard client disconnected (remaining: ${remainingClients})`
                    );
                    // Stop broadcast if no clients remain
                    if (remainingClients <= 0) {
                        this.stopBroadcast();
                    }
                });

                socket.on('requestUpdate', () => {
                    this.sendMetrics(socket);
                });

                // Support metrics push from Orchestrator via Socket (protected)
                socket.on('push_metrics', withAuth('push_metrics', (payload) => {
                    const sanitized = sanitizeObject(payload);
                    const validated = validatePayload(sanitized);
                    if (validated) {
                        this.updateMetrics(validated);
                    } else {
                        logger.warn('Received invalid metrics payload, ignoring');
                    }
                }));

                // Task updates (protected)
                socket.on('task-update', withAuth('task-update', (data) => {
                    const sanitized = sanitizeObject(data);
                    const validated = validateTask(sanitized);
                    if (validated) {
                        this.mergeTaskData(validated);
                        this.latestMetrics.recentTasks = this.dashboardData.tasks.slice(-40);
                        this.io.emit('metrics', this.collectMetrics());
                    } else {
                        logger.warn('Received invalid task-update payload, ignoring');
                    }
                }));

                // Clear history (protected - requires auth when enabled)
                socket.on('clear-history', withAuth('clear-history', () => {
                    logger.info('Clearing dashboard history per client request');
                    this.historyManager.clearHistory();

                    // Reset all data stores to zeros
                    this.dashboardData.tasks = [];
                    this.dashboardData.twitterActions = { likes: 0, retweets: 0, replies: 0, quotes: 0, follows: 0, bookmarks: 0, total: 0 };
                    this.dashboardData.apiMetrics = { calls: 0, failures: 0, successRate: 100, avgResponseTime: 0 };
                    this.dashboardData.errors = [];
                    this.cumulativeMetrics.completedTasks = 0;

                    // Also reset latestMetrics to show zeros
                    this.latestMetrics.recentTasks = [];
                    if (this.latestMetrics.metrics) {
                        this.latestMetrics.metrics.twitter = { actions: { likes: 0, retweets: 0, replies: 0, quotes: 0, follows: 0, bookmarks: 0, total: 0 } };
                        this.latestMetrics.metrics.api = { calls: 0, failures: 0, successRate: 100, avgResponseTime: 0 };
                    }

                    // Reset lastSeenMetrics so new incoming data starts from zero
                    this.lastSeenMetrics = {
                        twitter: { actions: { likes: 0, retweets: 0, replies: 0, quotes: 0, follows: 0, bookmarks: 0 } },
                        api: { calls: 0, failures: 0 },
                        tasks: { executed: 0, failed: 0 }
                    };

                    logger.info('History cleared, broadcasting zeros...');
                    // Broadcast cleared data immediately
                    this.io.emit('metrics', this.collectMetrics());
                }));

                // Notification API - send notification to all clients (protected)
                socket.on('send-notification', withAuth('send-notification', (data) => {
                    if (data && data.message) {
                        const notification = {
                            type: data.type || 'info',
                            title: data.title || 'Dashboard',
                            message: sanitizeLogString(data.message),
                            timestamp: Date.now()
                        };
                        this.io.emit('notification', notification);
                    }
                }));
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

        // Reset error tracking on fresh start
        this.consecutiveErrors = 0;
        this.broadcastPaused = false;
        this.lastBroadcastHashes = null;

        this.broadcastInterval = setInterval(() => {
            // Circuit breaker: stop if too many consecutive errors
            if (this.broadcastPaused) {
                return;
            }

            const clientCount = this.io?.sockets?.sockets?.size || 0;
            if (clientCount > 0) {
                try {
                    const metrics = this.collectMetrics();

                    // Check for error in metrics
                    if (metrics.error) {
                        this.consecutiveErrors++;
                        logger.warn(`Broadcast error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}): ${metrics.error}`);

                        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                            this.broadcastPaused = true;
                            logger.error('Broadcast paused due to repeated errors. Will resume on next client connection.');
                        }
                        return;
                    }

                    // Reset error counter on success
                    this.consecutiveErrors = 0;

                    // Efficient change detection using hashes
                    const currentHash = {
                        sessions: quickHash(metrics.sessions),
                        queue: quickHash(metrics.queue),
                        recentTasks: quickHash(metrics.recentTasks)
                    };

                    const hasChanged = !this.lastBroadcastHashes || (
                        currentHash.sessions !== this.lastBroadcastHashes.sessions ||
                        currentHash.queue !== this.lastBroadcastHashes.queue ||
                        currentHash.recentTasks !== this.lastBroadcastHashes.recentTasks
                    );

                    if (hasChanged) {
                        this.io.emit('metrics', metrics);
                        this.lastBroadcastHashes = currentHash;
                    }
                } catch (err) {
                    this.consecutiveErrors++;
                    logger.error(`Broadcast exception (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, err.message);

                    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                        this.broadcastPaused = true;
                        logger.error('Broadcast paused due to repeated exceptions.');
                    }
                }
            } else {
                clearInterval(this.broadcastInterval);
                this.broadcastInterval = null;
            }
        }, this.BROADCAST_MS);

        logger.info(`Broadcast interval set to ${this.BROADCAST_MS}ms`);
    }

    /**
     * Resume broadcast after it was paused due to errors.
     * Called when a new client connects.
     */
    resumeBroadcast() {
        if (this.broadcastPaused) {
            this.broadcastPaused = false;
            this.consecutiveErrors = 0;
            logger.info('Broadcast resumed after error recovery');
        }
    }

    stopBroadcast() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
            logger.info('Broadcast stopped (no clients connected)');
        }
    }

    collectMetrics() {
        try {
            const now = Date.now();

            if (SESSION_TTL_MS > 0 && this.dashboardData.sessions.length > 0) {
                const cutoff = now - SESSION_TTL_MS;
                const beforeCount = this.dashboardData.sessions.length;
                this.dashboardData.sessions = this.dashboardData.sessions.filter(s => {
                    const lastSeen = s.lastSeen || s.firstSeen || 0;
                    return lastSeen > cutoff;
                });
                if (this.dashboardData.sessions.length < beforeCount) {
                    logger.debug(`Cleaned up ${beforeCount - this.dashboardData.sessions.length} stale sessions`);
                }
            }

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

            const result = {
                timestamp: now,
                ...this.latestMetrics,
                cumulative: {
                    ...this.cumulativeMetrics,
                    completedTasks: this.historyManager.getCompletedTasksCount()
                },
                system: this.getSystemMetrics(),
            };

            return result;
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

// Helper to start the server standalone (e.g., from Electron main process)
export async function startStandaloneServer(port = 3001) {
    const server = new DashboardServer(port);
    try {
        await server.start();
        logger.info(`Standalone Dashboard Server started on port ${port}`);
        return server;
    } catch (err) {
        if (err.code === 'EADDRINUSE') {
            logger.warn(`Port ${port} already in use. Dashboard server likely already running.`);
            return null;
        }
        throw err;
    }
}

// If started as an IPC child process from the Orchestrator
if (process.send && !process.env.ELECTRON_RUN_AS_NODE) {
    const port = parseInt(process.env.PORT) || config?.server?.port || 3001;
    const interval = parseInt(process.env.BROADCAST_MS) || DEFAULT_BROADCAST_MS;

    const server = new DashboardServer(port, interval);
    server.start().catch(err => {
        logger.error('Fatal error starting IPC dashboard server:', err);
        process.exit(1);
    });

    process.on('message', msg => {
        if (!msg || !msg.type) {
            logger.warn('Received invalid IPC message (missing type):', msg);
            return;
        }

        switch (msg.type) {
            case 'metrics_tick':
                const validated = validatePayload(msg.payload);
                if (validated) {
                    server.updateMetrics(validated);
                }
                break;
            case 'task-update':
                const validatedTask = validateTask(msg.payload);
                if (validatedTask) {
                    server.mergeTaskData(validatedTask);
                    if (server.latestMetrics) server.latestMetrics.recentTasks = server.historyManager.getTasks().slice(-40);
                    server.io.emit('metrics', server.collectMetrics());
                }
                break;
            case 'shutdown':
                server.stop().then(() => {
                    process.exit(0);
                });
                break;
            default:
                logger.debug('Received unknown IPC message type:', msg.type);
        }
    });

    // DO NOT exit on disconnect - this allows the dashboard to persist when Orchestrator restarts
    process.on('disconnect', () => {
        logger.info('Orchestrator disconnected, but dashboard server will persist.');
        // Clear activity-dependent metrics so they show as 0/idle until reconnect
        if (server.latestMetrics) {
            server.latestMetrics.sessions = [];
            if (server.latestMetrics.queue) {
                server.latestMetrics.queue.queueLength = 0;
            }
        }
    });
}
