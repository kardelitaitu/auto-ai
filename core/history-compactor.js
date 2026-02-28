/**
 * @fileoverview History Compactor - Condenses action logs to prevent context bloat.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/history-compactor
 */

import { createLogger } from '../utils/logger.js';
import { getTimeoutValue } from '../utils/configLoader.js';

const logger = createLogger('history-compactor.js');

/**
 * @typedef {object} ActionLog
 * @property {string} action - Action type
 * @property {string} target - Target element/URL
 * @property {boolean} success - Success status
 * @property {number} timestamp - Unix timestamp
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {object} CompactedHistory
 * @property {string} summary - Human-readable summary
 * @property {number} originalCount - Original action count
 * @property {number} compactedCount - Compacted action count
 * @property {number} compressionRatio - Compression ratio
 */

/**
 * @class HistoryCompactor
 * @description Recursively condenses long chains of actions into goal-oriented summaries.
 */
class HistoryCompactor {
    constructor() {
        this._configLoaded = false;
        
        this.compactionThreshold = 20;
        this.targetLength = 5;
        
        this._loadConfig();
    }

    async _loadConfig() {
        if (this._configLoaded) return;

        const histConfig = await getTimeoutValue('history', {});
        this.compactionThreshold = histConfig.compactionThreshold ?? 20;
        this.targetLength = histConfig.targetLength ?? 5;

        logger.info('HistoryCompactor initialized');
        this._configLoaded = true;
    }

    /**
     * Compact a history of actions.
     * @param {Array<ActionLog>} actions - Array of action logs.
     * @returns {CompactedHistory} Compacted history.
     */
    compactHistory(actions) {
        const originalCount = actions.length;

        if (originalCount <= this.compactionThreshold) {
            // No compaction needed
            const summary = this._generateSimpleSummary(actions);

            return {
                summary,
                originalCount,
                compactedCount: originalCount,
                compressionRatio: 1.0
            };
        }

        // Perform intelligent compaction
        logger.debug(`[HistoryCompactor] Compacting ${originalCount} actions...`);

        const compacted = this._performCompaction(actions);
        const summary = this._generateSimpleSummary(compacted);

        const compressionRatio = compacted.length / originalCount;

        logger.info(`[HistoryCompactor] Compacted ${originalCount} → ${compacted.length} actions (${(compressionRatio * 100).toFixed(1)}%)`);

        return {
            summary,
            originalCount,
            compactedCount: compacted.length,
            compressionRatio
        };
    }

    /**
     * Perform intelligent compaction of action logs.
     * Groups consecutive similar actions and summarizes them.
     * @param {Array<ActionLog>} actions - Original actions.
     * @returns {Array<ActionLog>} Compacted actions.
     * @private
     */
    _performCompaction(actions) {
        const compacted = [];
        let currentGroup = [];
        let lastActionType = null;

        for (const action of actions) {
            // Group consecutive actions of the same type
            if (action.action === lastActionType) {
                currentGroup.push(action);
            } else {
                // Finalize previous group
                if (currentGroup.length > 0) {
                    compacted.push(this._summarizeGroup(currentGroup));
                }

                // Start new group
                currentGroup = [action];
                lastActionType = action.action;
            }
        }

        // Finalize last group
        if (currentGroup.length > 0) {
            compacted.push(this._summarizeGroup(currentGroup));
        }

        // If still too long, take recent actions only
        if (compacted.length > this.targetLength) {
            return compacted.slice(-this.targetLength);
        }

        return compacted;
    }

    /**
     * Summarize a group of similar actions.
     * @param {Array<ActionLog>} group - Group of actions.
     * @returns {ActionLog} Summarized action.
     * @private
     */
    _summarizeGroup(group) {
        if (group.length === 1) {
            return group[0];
        }

        // Count successes and failures
        const successes = group.filter(a => a.success).length;
        const failures = group.length - successes;

        // Get unique targets
        const targets = [...new Set(group.map(a => a.target))];
        const targetSummary = targets.length === 1
            ? targets[0]
            : `${targets.length} different targets`;

        // Determine overall success
        const overallSuccess = successes > failures;

        return {
            action: `${group[0].action} (×${group.length})`,
            target: targetSummary,
            success: overallSuccess,
            timestamp: group[group.length - 1].timestamp, // Most recent
            meta: {
                grouped: true,
                count: group.length,
                successes,
                failures
            }
        };
    }

    /**
     * Generate simple text summary from actions.
     * @param {Array<ActionLog>} actions - Actions to summarize.
     * @returns {string} Text summary.
     * @private
     */
    _generateSimpleSummary(actions) {
        if (actions.length === 0) {
            return 'No actions recorded.';
        }

        const lines = actions.map((action, idx) => {
            const status = action.success ? '✓' : '✗';
            const meta = action.meta ? ` [${action.meta.successes}/${action.meta.count} succeeded]` : '';
            return `${idx + 1}. ${status} ${action.action} → ${action.target}${meta}`;
        });

        return lines.join('\n');
    }

    /**
     * Generate narrative summary using patterns.
     * @param {Array<ActionLog>} actions - Actions to summarize.
     * @returns {string} Narrative summary.
     */
    generateNarrativeSummary(actions) {
        if (actions.length === 0) {
            return 'No actions performed.';
        }

        // Identify patterns
        const navigations = actions.filter(a => a.action === 'navigate');
        const clicks = actions.filter(a => a.action === 'click');
        const types = actions.filter(a => a.action === 'type');
        const failures = actions.filter(a => !a.success);

        let narrative = `Session involved ${actions.length} actions. `;

        if (navigations.length > 0) {
            narrative += `Navigated to ${navigations.length} page(s). `;
        }

        if (clicks.length > 0) {
            narrative += `Performed ${clicks.length} click(s). `;
        }

        if (types.length > 0) {
            narrative += `Typed into ${types.length} field(s). `;
        }

        if (failures.length > 0) {
            narrative += `Encountered ${failures.length} failure(s). `;

            // List specific failures
            const failureReasons = [...new Set(failures.map(f => f.error).filter(Boolean))];
            if (failureReasons.length > 0) {
                narrative += `Errors: ${failureReasons.join(', ')}. `;
            }
        } else {
            narrative += `All actions succeeded.`;
        }

        return narrative;
    }

    /**
     * Get compaction statistics.
     * @param {Array<ActionLog>} original - Original actions.
     * @param {Array<ActionLog>} compacted - Compacted actions.
     * @returns {object} Statistics.
     */
    getStats(original, compacted) {
        return {
            originalCount: original.length,
            compactedCount: compacted.length,
            compressionRatio: compacted.length / original.length,
            tokenSavingsEstimate: this._estimateTokenSavings(original, compacted)
        };
    }

    /**
     * Estimate token savings from compaction.
     * Rough estimate: ~10 tokens per action log.
     * @param {Array<ActionLog>} original - Original actions.
     * @param {Array<ActionLog>} compacted - Compacted actions.
     * @returns {number} Estimated token savings.
     * @private
     */
    _estimateTokenSavings(original, compacted) {
        const tokensPerAction = 10;
        return (original.length - compacted.length) * tokensPerAction;
    }
}

export default HistoryCompactor;
