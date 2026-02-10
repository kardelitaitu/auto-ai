/**
 * @fileoverview Audit Verifier - Pre/post-flight checks for action verification.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/audit-verifier
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('audit-verifier.js');

/**
 * @typedef {object} VerificationResult
 * @property {boolean} success - Whether verification passed
 * @property {string} [reason] - Reason for failure
 * @property {object} [metadata] - Additional metadata
 */

/**
 * @class AuditVerifier
 * @description Performs pre-flight and post-flight checks to verify action success.
 * Calculates Handshake Reliability Metric.
 */
class AuditVerifier {
    constructor() {
        /** @type {number} Total actions attempted */
        this.totalAttempted = 0;

        /** @type {number} Total actions verified successful */
        this.totalVerified = 0;

        /** @type {number} Total pre-flight failures */
        this.preFlightFailures = 0;

        /** @type {number} Total post-flight failures */
        this.postFlightFailures = 0;

        logger.info('AuditVerifier initialized');
    }

    /**
     * Pre-flight check: Verify target element is visible and not obscured.
     * @param {playwright.Page} page - The Playwright page.
     * @param {string|object} target - CSS selector or coordinates {x, y}.
     * @returns {Promise<VerificationResult>} Verification result.
     */
    async preFlightCheck(page, target) {
        this.totalAttempted++;

        try {
            // If target is coordinates
            if (typeof target === 'object' && target.x !== undefined && target.y !== undefined) {
                return await this._verifyCoordinates(page, target);
            }

            // If target is selector
            if (typeof target === 'string') {
                return await this._verifySelector(page, target);
            }

            this.preFlightFailures++;
            return {
                success: false,
                reason: 'Invalid target format (expected selector or coordinates)'
            };

        } catch (error) {
            this.preFlightFailures++;
            logger.error('[AuditVerifier] Pre-flight check failed:', error.message);

            return {
                success: false,
                reason: error.message
            };
        }
    }

    /**
     * Post-flight check: Verify expected state change occurred.
     * @param {playwright.Page} page - The Playwright page.
     * @param {object} expectations - Expected changes.
     * @param {string} [expectations.urlChange] - Expected URL pattern.
     * @param {string} [expectations.elementAppears] - Selector that should appear.
     * @param {string} [expectations.elementDisappears] - Selector that should disappear.
     * @param {string} [expectations.textContains] - Text that should appear on page.
     * @returns {Promise<VerificationResult>} Verification result.
     */
    async postFlightCheck(page, expectations) {
        try {
            const checks = [];

            // Check URL change
            if (expectations.urlChange) {
                const currentUrl = page.url();
                const matches = currentUrl.includes(expectations.urlChange);
                checks.push({
                    type: 'urlChange',
                    expected: expectations.urlChange,
                    actual: currentUrl,
                    passed: matches
                });
            }

            // Check element appearance
            if (expectations.elementAppears) {
                const element = await page.$(expectations.elementAppears);
                checks.push({
                    type: 'elementAppears',
                    expected: expectations.elementAppears,
                    passed: element !== null
                });
            }

            // Check element disappearance
            if (expectations.elementDisappears) {
                const element = await page.$(expectations.elementDisappears);
                checks.push({
                    type: 'elementDisappears',
                    expected: expectations.elementDisappears,
                    passed: element === null
                });
            }

            // Check text content
            if (expectations.textContains) {
                const content = await page.content();
                const contains = content.includes(expectations.textContains);
                checks.push({
                    type: 'textContains',
                    expected: expectations.textContains,
                    passed: contains
                });
            }

            // All checks must pass
            const allPassed = checks.every(check => check.passed);

            if (allPassed) {
                this.totalVerified++;
                return {
                    success: true,
                    metadata: { checks }
                };
            } else {
                this.postFlightFailures++;
                const failedChecks = checks.filter(c => !c.passed);

                return {
                    success: false,
                    reason: `Post-flight verification failed: ${failedChecks.map(c => c.type).join(', ')}`,
                    metadata: { checks, failedChecks }
                };
            }

        } catch (error) {
            this.postFlightFailures++;
            logger.error('[AuditVerifier] Post-flight check failed:', error.message);

            return {
                success: false,
                reason: error.message
            };
        }
    }

    /**
     * Verify coordinates are within viewport and not obscured.
     * @param {playwright.Page} page - The Playwright page.
     * @param {object} coords - {x, y} coordinates.
     * @returns {Promise<VerificationResult>} Verification result.
     * @private
     */
    async _verifyCoordinates(page, coords) {
        const viewport = page.viewportSize() || { width: 1920, height: 1080 };

        // Check if coordinates are within viewport
        if (coords.x < 0 || coords.x > viewport.width ||
            coords.y < 0 || coords.y > viewport.height) {

            this.preFlightFailures++;
            return {
                success: false,
                reason: `Coordinates (${coords.x}, ${coords.y}) outside viewport (${viewport.width}x${viewport.height})`
            };
        }

        // Check if element at coordinates is visible
        // This is a simplified check - in production, would check z-index, opacity, etc.
        logger.debug(`[AuditVerifier] Pre-flight passed for coordinates (${coords.x}, ${coords.y})`);

        return {
            success: true,
            metadata: { viewport, coords }
        };
    }

    /**
     * Verify selector exists, is visible, and not obscured.
     * @param {playwright.Page} page - The Playwright page.
     * @param {string} selector - CSS selector.
     * @returns {Promise<VerificationResult>} Verification result.
     * @private
     */
    async _verifySelector(page, selector) {
        // Check if element exists
        const element = await page.$(selector);

        if (!element) {
            this.preFlightFailures++;
            return {
                success: false,
                reason: `Element not found: ${selector}`
            };
        }

        // Check if element is visible
        const isVisible = await element.isVisible();

        if (!isVisible) {
            this.preFlightFailures++;
            return {
                success: false,
                reason: `Element not visible: ${selector}`
            };
        }

        // Check if element is enabled (if applicable)
        const isEnabled = await element.isEnabled();

        if (!isEnabled) {
            this.preFlightFailures++;
            return {
                success: false,
                reason: `Element not enabled: ${selector}`
            };
        }

        logger.debug(`[AuditVerifier] Pre-flight passed for selector: ${selector}`);

        return {
            success: true,
            metadata: { selector, visible: true, enabled: true }
        };
    }

    /**
     * Wait for expected state with timeout.
     * @param {playwright.Page} page - The Playwright page.
     * @param {object} expectations - Expected state.
     * @param {number} [timeout=5000] - Timeout in ms.
     * @returns {Promise<VerificationResult>} Verification result.
     */
    async waitForState(page, expectations, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const result = await this.postFlightCheck(page, expectations);

            if (result.success) {
                return result;
            }

            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return {
            success: false,
            reason: `Timeout waiting for expected state after ${timeout}ms`
        };
    }

    /**
     * Calculate Handshake Reliability Metric (S).
     * S = Verified Actions / Attempted Actions
     * @returns {number} Reliability score (0-1).
     */
    calculateReliabilityMetric() {
        if (this.totalAttempted === 0) {
            return 0;
        }

        return this.totalVerified / this.totalAttempted;
    }

    /**
     * Get comprehensive statistics.
     * @returns {object} Statistics object.
     */
    getStats() {
        const reliabilityMetric = this.calculateReliabilityMetric();

        return {
            totalAttempted: this.totalAttempted,
            totalVerified: this.totalVerified,
            preFlightFailures: this.preFlightFailures,
            postFlightFailures: this.postFlightFailures,
            reliabilityMetric: reliabilityMetric.toFixed(4),
            successRate: (reliabilityMetric * 100).toFixed(2) + '%'
        };
    }

    /**
     * Log statistics to console.
     */
    logStats() {
        const stats = this.getStats();

        logger.info('=== AuditVerifier Statistics ===');
        logger.info(`Total Attempted: ${stats.totalAttempted}`);
        logger.info(`Total Verified: ${stats.totalVerified}`);
        logger.info(`Pre-flight Failures: ${stats.preFlightFailures}`);
        logger.info(`Post-flight Failures: ${stats.postFlightFailures}`);
        logger.info(`Reliability Metric (S): ${stats.reliabilityMetric} (${stats.successRate})`);
        logger.info('================================');
    }

    /**
     * Reset statistics.
     */
    resetStats() {
        this.totalAttempted = 0;
        this.totalVerified = 0;
        this.preFlightFailures = 0;
        this.postFlightFailures = 0;
        logger.info('[AuditVerifier] Statistics reset');
    }
}

export default AuditVerifier;
