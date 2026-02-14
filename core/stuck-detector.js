/**
 * @fileoverview StuckDetector utility for autonomous agents.
 * Detects if the agent is viewing the same visual state repeatedly.
 * @module core/stuck-detector
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('stuck-detector.js');

class StuckDetector {
    /**
     * @param {number} threshold - Number of identical states before flagging as "stuck".
     */
    constructor(threshold = 3) {
        this.threshold = threshold;
        this.counter = 0;
        this.lastHash = null;
    }

    /**
     * Check current visual state against previous state.
     * @param {string} base64Image - Base64 encoded screenshot.
     * @returns {object} { isStuck: boolean, counter: number }
     */
    check(base64Image) {
        if (!base64Image) {
            return { isStuck: false, counter: 0 };
        }

        // Generate MD5 hash of first 5000 chars (sufficient for detecting screen changes)
        const currentHash = crypto.createHash('md5')
            .update(base64Image.substring(0, 5000))
            .digest('hex');

        if (this.lastHash === currentHash) {
            this.counter++;
        } else {
            this.counter = 0;
        }

        this.lastHash = currentHash;

        const isStuck = this.counter >= this.threshold;

        if (isStuck) {
            logger.warn(`STUCK DETECTED: Counter at ${this.counter}/${this.threshold}`);
        }

        return { isStuck, counter: this.counter };
    }

    /**
     * Reset the detector state.
     */
    reset() {
        this.counter = 0;
        this.lastHash = null;
    }
}

export default StuckDetector;
