/**
 * Health check route
 */

import express from 'express';

/**
 * Create health check router.
 * @param {Object} options - Router options
 * @param {Object} options.io - Socket.io server instance
 * @returns {express.Router}
 */
export function createHealthRouter(options = {}) {
    const router = express.Router();
    const { io } = options;

    // Health check - critical for dashboard-first scenario
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: Date.now(),
            clients: io?.sockets?.sockets?.size || 0,
        });
    });

    return router;
}
