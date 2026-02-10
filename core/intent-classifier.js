/**
 * @fileoverview Intent Classifier - Determines task complexity and routing destination.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/intent-classifier
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('intent-classifier.js');

/**
 * @typedef {object} ClassificationResult
 * @property {string} destination - 'local' or 'cloud'
 * @property {number} confidenceScore - 0-100 confidence in classification
 * @property {string} reason - Human-readable reason for classification
 * @property {number} complexityScore - 0-10 complexity rating
 */

/**
 * @class IntentClassifier
 * @description Analyzes tasks and context to determine optimal routing (local vs cloud).
 */
class IntentClassifier {
    constructor() {
        /** @type {Set<string>} Routine actions suitable for local processing */
        this.routineActions = new Set([
            'navigate',
            'scroll',
            'click',
            'type',
            'wait',
            'screenshot',
            'extract_text'
        ]);

        /** @type {Set<string>} Complex actions requiring cloud reasoning */
        this.complexActions = new Set([
            'captcha_solve',
            'visual_puzzle',
            'form_analysis',
            'content_generation',
            'decision_making',
            'error_recovery'
        ]);

        /** @type {Array<string>} Error keywords that trigger cloud routing */
        this.errorKeywords = [
            'rate limit',
            'access denied',
            'blocked',
            'captcha',
            'verification required',
            'unusual activity'
        ];

        logger.info('IntentClassifier initialized');
    }

    /**
     * Classify a task based on action type, context, and execution history.
     * @param {object} params - Classification parameters.
     * @param {string} params.action - The action type (e.g., 'navigate', 'click').
     * @param {object} [params.payload={}] - Task payload with additional context.
     * @param {object} [params.context={}] - Execution context (breadcrumbs, state).
     * @param {number} [params.complexityScore=0] - Complexity score from state manager.
     * @returns {ClassificationResult} Classification result with routing decision.
     */
    classify({ action, payload = {}, context = {}, complexityScore = 0 }) {
        logger.debug(`Classifying action: ${action}, complexity: ${complexityScore}`);

        // Priority 1: Check for explicit error conditions
        if (this._hasErrorIndicators(context, payload)) {
            return {
                destination: 'cloud',
                confidenceScore: 95,
                reason: 'Error condition detected, requires advanced reasoning',
                complexityScore: 9
            };
        }

        // Priority 2: Check if action is explicitly complex
        if (this.complexActions.has(action)) {
            return {
                destination: 'cloud',
                confidenceScore: 90,
                reason: `Action '${action}' requires cloud-level reasoning`,
                complexityScore: 8
            };
        }

        // Priority 3: Check complexity score from state manager
        if (complexityScore >= 7) {
            return {
                destination: 'cloud',
                confidenceScore: 85,
                reason: 'High complexity score from recent failures',
                complexityScore
            };
        }

        // Priority 4: Check if action is routine
        if (this.routineActions.has(action)) {
            return {
                destination: 'local',
                confidenceScore: 80,
                reason: `Routine action '${action}' suitable for local processing`,
                complexityScore: 2
            };
        }

        // Priority 5: Analyze payload complexity
        const payloadComplexity = this._analyzePayloadComplexity(payload);
        if (payloadComplexity > 6) {
            return {
                destination: 'cloud',
                confidenceScore: 75,
                reason: 'Complex payload requires cloud processing',
                complexityScore: payloadComplexity
            };
        }

        // Default: Route to local for simplicity
        return {
            destination: 'local',
            confidenceScore: 60,
            reason: 'Default routing to local for unclassified action',
            complexityScore: 3
        };
    }

    /**
     * Check for error indicators in context or payload.
     * @param {object} context - Execution context.
     * @param {object} payload - Task payload.
     * @returns {boolean} True if errors detected.
     * @private
     */
    _hasErrorIndicators(context, payload) {
        // Check context for error messages
        if (context.lastError) {
            const errorLower = context.lastError.toLowerCase();
            const hasKeyword = this.errorKeywords.some(keyword =>
                errorLower.includes(keyword)
            );

            if (hasKeyword) {
                logger.info(`Error keyword detected in context: ${context.lastError}`);
                return true;
            }
        }

        // Check payload for error flags
        if (payload.errorRecovery || payload.requiresReasoning) {
            return true;
        }

        return false;
    }

    /**
     * Analyze payload complexity based on properties.
     * @param {object} payload - Task payload.
     * @returns {number} Complexity score (0-10).
     * @private
     */
    _analyzePayloadComplexity(payload) {
        let score = 0;

        // Check for vision-related tasks
        if (payload.requiresVision || payload.screenshot) {
            score += 3;
        }

        // Check for multi-step sequences
        if (Array.isArray(payload.steps) && payload.steps.length > 3) {
            score += 2;
        }

        // Check for dynamic targets (not simple selectors)
        if (payload.dynamicTarget || payload.fuzzyMatch) {
            score += 2;
        }

        // Check for conditional logic
        if (payload.conditions || payload.branches) {
            score += 3;
        }

        return Math.min(score, 10);
    }

    /**
     * Force cloud routing (override classifier).
     * Used for critical tasks or when local server is unavailable.
     * @returns {ClassificationResult} Cloud routing result.
     */
    forceCloud() {
        return {
            destination: 'cloud',
            confidenceScore: 100,
            reason: 'Forced cloud routing',
            complexityScore: 10
        };
    }

    /**
     * Force local routing (override classifier).
     * Used for testing or when cloud is unavailable.
     * @returns {ClassificationResult} Local routing result.
     */
    forceLocal() {
        return {
            destination: 'local',
            confidenceScore: 100,
            reason: 'Forced local routing',
            complexityScore: 1
        };
    }

    /**
     * Get classification statistics.
     * @returns {object} Statistics object.
     */
    getStats() {
        return {
            routineActionsCount: this.routineActions.size,
            complexActionsCount: this.complexActions.size,
            errorKeywordsCount: this.errorKeywords.length
        };
    }
}

export default IntentClassifier;
