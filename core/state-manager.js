/**
 * @fileoverview State Manager - Maintains task breadcrumbs and execution context.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/state-manager
 */

import { createLogger } from '../utils/logger.js';
import { getTimeoutValue } from '../utils/configLoader.js';

const logger = createLogger('state-manager.js');

/**
 * @class StateManager
 * @description Manages short-term memory (breadcrumbs) and execution state across sessions.
 * Provides context to agent-connector for intelligent routing decisions.
 */
class StateManager {
    constructor() {
        /** @type {Map<string, Array<object>>} Task breadcrumbs per session */
        this.breadcrumbs = new Map();

        /** @type {Map<string, object>} Current execution state per session */
        this.executionState = new Map();

        /** @type {number} Maximum breadcrumb history per session */
        this.maxBreadcrumbs = 50;
        
        this._configLoaded = false;
        this._loadConfig();
    }

    async _loadConfig() {
        if (this._configLoaded) return;

        const stateConfig = await getTimeoutValue('state', {});

        this.maxBreadcrumbs = stateConfig.maxBreadcrumbs ?? 50;

        logger.info('StateManager initialized');
        this._configLoaded = true;
    }

    /**
     * Add a breadcrumb (action record) to a session's history.
     * @param {string} sessionId - The session identifier.
     * @param {object} breadcrumb - The breadcrumb object containing action details.
     * @param {string} breadcrumb.action - The action type (e.g., 'navigate', 'click', 'type').
     * @param {string} breadcrumb.target - The target element or URL.
     * @param {boolean} breadcrumb.success - Whether the action succeeded.
     * @param {number} breadcrumb.timestamp - Unix timestamp of the action.
     * @param {string} [breadcrumb.error] - Error message if action failed.
     */
    addBreadcrumb(sessionId, breadcrumb) {
        if (!this.breadcrumbs.has(sessionId)) {
            this.breadcrumbs.set(sessionId, []);
        }

        const crumbs = this.breadcrumbs.get(sessionId);

        // Add timestamp if not provided
        if (!breadcrumb.timestamp) {
            breadcrumb.timestamp = Date.now();
        }

        crumbs.push(breadcrumb);

        // Maintain maximum breadcrumb limit (sliding window)
        if (crumbs.length > this.maxBreadcrumbs) {
            crumbs.shift(); // Remove oldest
        }

        logger.debug(`[${sessionId}] Breadcrumb added: ${breadcrumb.action} on ${breadcrumb.target} (${breadcrumb.success ? 'SUCCESS' : 'FAILED'})`);
    }

    /**
     * Get breadcrumbs for a session.
     * @param {string} sessionId - The session identifier.
     * @param {number} [limit] - Optional limit on number of breadcrumbs to return (most recent).
     * @returns {Array<object>} Array of breadcrumb objects.
     */
    getBreadcrumbs(sessionId, limit = null) {
        const crumbs = this.breadcrumbs.get(sessionId) || [];

        if (limit && limit > 0) {
            return crumbs.slice(-limit); // Return last N breadcrumbs
        }

        return [...crumbs]; // Return copy
    }

    /**
     * Get a condensed summary of breadcrumbs for context injection.
     * This creates a compact narrative suitable for LLM context.
     * @param {string} sessionId - The session identifier.
     * @param {number} [maxActions=10] - Maximum actions to include in summary.
     * @returns {string} Condensed summary string.
     */
    getBreadcrumbSummary(sessionId, maxActions = 10) {
        const crumbs = this.getBreadcrumbs(sessionId, maxActions);

        if (crumbs.length === 0) {
            return 'No prior actions in this session.';
        }

        const summary = crumbs.map((crumb, idx) => {
            const status = crumb.success ? '✓' : '✗';
            return `${idx + 1}. ${status} ${crumb.action} → ${crumb.target}`;
        }).join('\n');

        return `Recent actions (last ${crumbs.length}):\n${summary}`;
    }

    /**
     * Update execution state for a session.
     * @param {string} sessionId - The session identifier.
     * @param {object} state - The state object to merge/update.
     */
    updateExecutionState(sessionId, state) {
        const currentState = this.executionState.get(sessionId) || {};
        const newState = { ...currentState, ...state, updatedAt: Date.now() };
        this.executionState.set(sessionId, newState);

        logger.debug(`[${sessionId}] Execution state updated: ${JSON.stringify(state)}`);
    }

    /**
     * Get current execution state for a session.
     * @param {string} sessionId - The session identifier.
     * @returns {object} The execution state object.
     */
    getExecutionState(sessionId) {
        return this.executionState.get(sessionId) || {};
    }

    /**
     * Clear breadcrumbs and state for a session.
     * @param {string} sessionId - The session identifier.
     */
    clearSession(sessionId) {
        this.breadcrumbs.delete(sessionId);
        this.executionState.delete(sessionId);
        logger.info(`[${sessionId}] Session state cleared`);
    }

    /**
     * Get statistics about the state manager.
     * @returns {object} Statistics object.
     */
    getStats() {
        const activeSessions = this.breadcrumbs.size;
        let totalBreadcrumbs = 0;

        for (const crumbs of this.breadcrumbs.values()) {
            totalBreadcrumbs += crumbs.length;
        }

        return {
            activeSessions,
            totalBreadcrumbs,
            avgBreadcrumbsPerSession: activeSessions > 0 ? (totalBreadcrumbs / activeSessions).toFixed(2) : 0
        };
    }

    /**
     * Calculate task complexity score based on recent breadcrumbs.
     * Used by intent-classifier for routing decisions.
     * @param {string} sessionId - The session identifier.
     * @returns {number} Complexity score (0-10).
     */
    calculateComplexityScore(sessionId) {
        const recentCrumbs = this.getBreadcrumbs(sessionId, 5);

        if (recentCrumbs.length === 0) {
            return 0; // No history, assume simple
        }

        // Calculate failure rate
        const failures = recentCrumbs.filter(c => !c.success).length;
        const failureRate = failures / recentCrumbs.length;

        // High failure rate indicates complexity or errors requiring cloud reasoning
        let score = Math.min(failureRate * 10, 10);

        // Check for error patterns
        const hasErrors = recentCrumbs.some(c => c.error && c.error.includes('Rate Limit'));
        if (hasErrors) {
            score = Math.min(score + 3, 10); // Boost complexity
        }

        return Math.round(score);
    }

    /**
     * Shutdown and cleanup.
     */
    shutdown() {
        logger.info(`StateManager shutting down. Tracked ${this.breadcrumbs.size} sessions.`);
        this.breadcrumbs.clear();
        this.executionState.clear();
    }
}

export default StateManager;
