/**
 * @fileoverview Action Orchestrator
 * Decouples action sequences and manages high-level behavioral routines.
 * Prevents repetitive loops and machine-like patterns by enforcing constraints
 * and using weighted random selection for next actions.
 */

import { mathUtils } from './mathUtils.js';

export const ACTION_ROUTINES = {
    TIMELINE_BROWSE: 'TIMELINE_BROWSE',
    NOTIFICATION_CHECK: 'NOTIFICATION_CHECK',
    PROFILE_DIVE: 'PROFILE_DIVE',
    TWEET_DIVE: 'TWEET_DIVE',
    IDLE: 'IDLE',
    REFRESH: 'REFRESH'
};

/**
 * ActionOrchestrator Class
 * Create NEW INSTANCE per browser session for parallel safety.
 * 
 * @class ActionOrchestrator
 */
export class ActionOrchestrator {
    constructor(options = {}) {
        this.sessionId = options.sessionId || `orch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.history = [];
        this.maxHistory = 10;

        // Base weights for routines (can be dynamic based on session state)
        this.weights = {
            [ACTION_ROUTINES.TIMELINE_BROWSE]: 0.45,
            [ACTION_ROUTINES.TWEET_DIVE]: 0.25,
            [ACTION_ROUTINES.PROFILE_DIVE]: 0.15,
            [ACTION_ROUTINES.NOTIFICATION_CHECK]: 0.05,
            [ACTION_ROUTINES.REFRESH]: 0.05,
            [ACTION_ROUTINES.IDLE]: 0.05
        };
    }

    /**
     * Determine the next high-level routine to execute.
     * Enforces constraints (e.g., no 3x same routine).
     * @returns {string} One of ACTION_ROUTINES
     */
    getNextRoutine() {
        // Constraint: Prevent 3 consecutive identical actions
        const blocked = this.getConstraintBlockedRoutines();

        // Filter and normalize weights
        const adjustedWeights = { ...this.weights };
        let totalWeight = 0;

        for (const [routine, weight] of Object.entries(this.weights)) {
            if (blocked.includes(routine)) {
                adjustedWeights[routine] = 0;
            } else {
                totalWeight += weight;
            }
        }

        if (totalWeight === 0) {
            // Fallback if everything is somehow blocked (shouldn't happen with standard constraints)
            return ACTION_ROUTINES.TIMELINE_BROWSE;
        }

        // Weighted random selection
        let random = Math.random() * totalWeight;
        for (const [routine, weight] of Object.entries(adjustedWeights)) {
            random -= weight;
            if (random <= 0) {
                this.recordRoutine(routine);
                return routine;
            }
        }

        const fallback = ACTION_ROUTINES.TIMELINE_BROWSE;
        this.recordRoutine(fallback);
        return fallback;
    }

    /**
     * Identify routines that are disallowed based on recent history.
     * @returns {string[]} List of blocked routines
     */
    getConstraintBlockedRoutines() {
        const blocked = [];
        const len = this.history.length;

        // Rule 1: No more than 3 consecutive executions of the same valid routine
        if (len >= 3) {
            const last1 = this.history[len - 1];
            const last2 = this.history[len - 2];
            const last3 = this.history[len - 3];

            if (last1 === last2 && last2 === last3) {
                blocked.push(last1);
            }
        }

        // Rule 2: Don't check notifications too frequently (e.g. if checked recently)
        // Simple heuristic: if checked in last 3 moves, don't check again
        if (this.history.slice(-3).includes(ACTION_ROUTINES.NOTIFICATION_CHECK)) {
            blocked.push(ACTION_ROUTINES.NOTIFICATION_CHECK);
        }

        return blocked;
    }

    /**
     * Record a routine execution to history.
     * @param {string} routine 
     */
    record(routine) {
        this.history.push(routine);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    /**
     * Get the next routine (convenience method)
     */
    getNext() {
        return this.getNextRoutine();
    }

    /**
     * Reset history (e.g. for new session)
     */
    reset() {
        this.history = [];
    }
}

// ============================================================================
// PARALLEL SAFETY NOTE
// ============================================================================
// For parallel browser sessions, create NEW INSTANCES per browser:
// 
// ❌ UNSAFE (shared state):
//   import { actionOrchestrator } from './actionOrchestrator.js';
//   actionOrchestrator.getNextRoutine();
//
// ✅ SAFE (isolated state):
//   import { ActionOrchestrator } from './actionOrchestrator.js';
//   const orchestrator = new ActionOrchestrator({ sessionId: browserId });
//   orchestrator.getNextRoutine();
//
// The singleton below is kept for backward compatibility but should not be
// used when running multiple parallel browser sessions.
// ============================================================================

// Singleton instance for backward compatibility (use with caution in parallel mode)
export const actionOrchestrator = new ActionOrchestrator();
