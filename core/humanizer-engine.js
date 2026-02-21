/**
 * @fileoverview Humanizer Engine - Generates organic mouse movements and keystrokes.
 * Part of the Distributed Agentic Orchestration (DAO) architecture.
 * @module core/humanizer-engine
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('humanizer-engine.js');

/**
 * @typedef {object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * @typedef {object} BezierCurve
 * @property {Array<Point>} points - Path points
 * @property {number} duration - Movement duration in ms
 * @property {object} metadata - Curve metadata
 */

/**
 * @class HumanizerEngine
 * @description Generates human-like mouse movements using Bezier curves and organic timing.
 */
class HumanizerEngine {
    constructor() {
        /** @type {number} Minimum movement duration in ms */
        this.minDuration = 300;

        /** @type {number} Maximum movement duration in ms */
        this.maxDuration = 2000;

        /** @type {number} Base movement speed (pixels per ms) */
        this.baseSpeed = 1.5; // Slower, more deliberate

        /** @type {number} Jitter range in pixels */
        this.jitterRange = 2; // Reduced jitter, rely on curves more

        // QWERTY Neighbor Map for realistic typos
        this.keyNeighbors = {
            'q': 'wa', 'w': 'qeas', 'e': 'wrsd', 'r': 'edtf', 't': 'rfgy', 'y': 'tghu', 'u': 'yhji', 'i': 'ujko', 'o': 'iklp', 'p': 'ol',
            'a': 'qwsz', 's': 'qweadzx', 'd': 'ersfcx', 'f': 'rtgvcd', 'g': 'tyhbvf', 'h': 'yujnbg', 'j': 'uikmnh', 'k': 'iolmj', 'l': 'opk',
            'z': 'asx', 'x': 'zsdc', 'c': 'xdfv', 'v': 'cfgb', 'b': 'vghn', 'n': 'bhjm', 'm': 'njk'
            // Simplified
        };

        logger.info('HumanizerEngine v2 (Advanced) initialized');
    }

    /**
     * Generate a humanized mouse path from start to end using Fitts's Law and Overshoot.
     * @param {Point} start - Starting point.
     * @param {Point} end - Ending point.
     * @param {object} [options={}] - Movement options.
     * @param {number} [options.steps] - Number of steps (calculated if omitted).
     * @param {boolean} [options.addJitter=true] - Add random jitter.
     * @param {boolean} [options.overshoot=true] - Enable overshoot/correction.
     * @returns {BezierCurve} The Bezier curve path.
     */
    generateMousePath(start, end, options = {}) {
        const { addJitter: _addJitter = true, overshoot = true } = options;

        const distance = this._calculateDistance(start, end);
        const duration = this._calculateDuration(distance);

        let pathPoints;

        // 1. Overshoot Logic (if distance is far enough)
        if (overshoot && distance > 300 && Math.random() > 0.3) {
            // Target a point slightly past/off the real target
            const overshootDist = this._randomRange(10, 40);
            const overshootAngle = Math.atan2(end.y - start.y, end.x - start.x) + this._randomRange(-0.2, 0.2);

            const overshootTarget = {
                x: end.x + Math.cos(overshootAngle) * overshootDist,
                y: end.y + Math.sin(overshootAngle) * overshootDist
            };

            // Main path to overshoot target (approx 80% of steps)
            const mainPath = this._generateComputedPath(start, overshootTarget, Math.floor(duration * 0.8), true);

            // Correction path to real target
            const correctionPath = this._generateComputedPath(overshootTarget, end, Math.floor(duration * 0.4), false); // Slower correction

            pathPoints = [...mainPath, ...correctionPath];
            logger.debug(`[HumanizerEngine] Generated Overshoot Path (${mainPath.length} + ${correctionPath.length} points)`);

        } else {
            // Standard Path
            pathPoints = this._generateComputedPath(start, end, duration, true);
        }

        return {
            points: pathPoints,
            duration: duration * (overshoot ? 1.2 : 1.0), // Adjust total duration if overshoot occurred
            metadata: { distance, overshoot }
        };
    }

    /**
     * Internal generation of a single curve segment with easing.
     */
    _generateComputedPath(start, end, durationMs, applyEasing = true) {
        const steps = Math.max(10, Math.floor(durationMs / 10)); // ~100Hz 

        const controlPoint1 = this._generateControlPoint(start, end, 0.25);
        const controlPoint2 = this._generateControlPoint(start, end, 0.75);

        const points = [];
        for (let i = 0; i <= steps; i++) {
            // Apply Ease-Out-Cubic if easing is on (fast start, slow end)
            // t goes from 0 to 1
            const linearT = i / steps;
            const t = applyEasing ? this._easeOutCubic(linearT) : linearT;

            const point = this._cubicBezier(start, controlPoint1, controlPoint2, end, t);

            if (i > 0 && i < steps) { // Jitter
                point.x += this._randomJitter();
                point.y += this._randomJitter();
            }

            points.push({ x: Math.round(point.x), y: Math.round(point.y) });
        }
        return points;
    }

    /**
     * Ease Out Cubic: 1 - pow(1 - x, 3)
     * Simulates natural deceleration.
     */
    _easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }

    /**
     * Generate humanized keystroke timing with TYPOS.
     * @param {string} text - Text to type.
     * @param {number} [typoChance=0.05] - Probability of a typo per char (0.05 = 5%).
     * @returns {Array<{char: string, delay: number}>} Character delays.
     */
    generateKeystrokeTiming(text, typoChance = 0.05) {
        const chars = text.split('');
        const timings = [];

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const lowerChar = char.toLowerCase();
            const neighbors = this.keyNeighbors[lowerChar];

            // Typo Logic
            if (neighbors && Math.random() < typoChance) {
                const wrongChar = neighbors[Math.floor(Math.random() * neighbors.length)];

                // 1. Type Wrong Char
                timings.push({ char: wrongChar, delay: this._generateKeyDelay() });

                // 2. Realize mistake (Pause)
                timings.push({ char: 'Delay', delay: this._randomRange(200, 500) }); // Logic handle 'Delay' as wait? No, handle 'Delay' as null char in loop? 
                // Actually, cleaner to just increase delay of next key.
                // But let's simulate backspace.

                // 3. Backspace
                timings.push({ char: 'Backspace', delay: this._generateKeyDelay() });

                // 4. Paused Correction
                timings.push({ char: char, delay: this._generateKeyDelay() + 150 });

                logger.debug(`[Humanizer] Injected typo: '${wrongChar}' -> Backspace -> '${char}'`);
            } else {
                // Normal
                timings.push({ char: char, delay: this._generateKeyDelay(char) });
            }
        }

        return timings;
    }

    _generateKeyDelay(char = '') {
        // Base delay: 60-140ms
        let delay = this._gaussianRandom(100, 25);
        if ([' ', '.', ','].includes(char)) delay += 40; // Slower on non-alpha
        return Math.max(40, delay);
    }

    // ... (Keep existing _gaussianRandom, _cubicBezier, _generateControlPoint, etc.)
    // But re-paste them to ensure class integrity if tool requires full replace or careful ranges.
    // I will include the helper methods I need.

    /**
     * Generate random pause duration (for thinking/reading).
     */
    generatePause(options = {}) {
        const { min = 500, max = 2000 } = options;
        return this._randomRange(min, max);
    }

    _cubicBezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

        return { x, y };
    }

    _generateControlPoint(start, end, position) {
        const baseX = start.x + (end.x - start.x) * position;
        const baseY = start.y + (end.y - start.y) * position;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const perpX = -dy;
        const perpY = dx;
        const magnitude = Math.sqrt(perpX * perpX + perpY * perpY);
        // Vary control point distance for curve variety
        const offset = this._randomRange(20, magnitude * 0.3);
        const direction = Math.random() > 0.5 ? 1 : -1;

        return {
            x: baseX + (perpX / magnitude) * offset * direction,
            y: baseY + (perpY / magnitude) * offset * direction
        };
    }

    _calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _calculateDuration(distance) {
        // Fitts's Law approximation: Index of Difficulty
        // T = a + b * log2(D/W + 1). We simplify W (width) as constant target size for now.
        const ID = Math.log2((distance / 20) + 1);
        const ms = 200 + (150 * ID); // ~200ms reaction + 150ms per bit of difficulty

        let duration = ms + this._randomRange(-50, 100);
        return Math.max(this.minDuration, Math.min(this.maxDuration, duration));
    }

    _randomJitter() {
        return (Math.random() - 0.5) * 2 * this.jitterRange;
    }

    _randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    _gaussianRandom(mean, stdDev) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    getStats() {
        return {
            mode: 'Advanced Fitts v2',
            minDuration: this.minDuration,
            maxDuration: this.maxDuration,
            baseSpeed: this.baseSpeed,
            jitterRange: this.jitterRange
        };
    }
}

export default HumanizerEngine;
