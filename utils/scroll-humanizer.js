/**
 * Scroll Humanizer Module - Now uses Unified API
 * Provides natural scroll patterns with easing and variability
 * Uses api.scroll() and api.scroll.focus() for human-like behavior
 * 
 * @module utils/scroll-humanizer
 */

import { api } from '../api/index.js';
import { humanTiming } from './human-timing.js';
import { mathUtils } from './mathUtils.js';

const SCROLL_DEFAULTS = {
    distanceMin: 300,
    distanceMax: 600,
    durationMin: 200,
    durationMax: 500,
    pauseMin: 1000,
    pauseMax: 3000,
    overshootChance: 0.1,
    backtrackChance: 0.05
};

function getScrollDistance(options = {}) {
    const { min = SCROLL_DEFAULTS.distanceMin, max = SCROLL_DEFAULTS.distanceMax } = options;
    return mathUtils.randomInRange(min, max);
}

function getScrollDuration(options = {}) {
    const { min = SCROLL_DEFAULTS.durationMin, max = SCROLL_DEFAULTS.durationMax } = options;
    return mathUtils.randomInRange(min, max);
}

function getPauseDuration(options = {}) {
    const { min = SCROLL_DEFAULTS.pauseMin, max = SCROLL_DEFAULTS.pauseMax } = options;
    return humanTiming.getScrollPause({ min, max });
}

/**
 * Natural scroll - now uses api.scroll()
 * @param {number} distance - Scroll distance
 * @param {object} options - Options
 */
async function naturalScroll(distance, options = {}) {
    const {
        duration = getScrollDuration(options),
        direction = 'down'
    } = options;

    const scrollAmount = direction === 'down' ? distance : -distance;

    // Use API for human-like scrolling
    await api.scroll(scrollAmount);

    return { distance: scrollAmount, duration };
}

/**
 * Scroll with pause after
 * @param {number} distance - Scroll distance
 * @param {object} options - Options including pauseMin, pauseMax
 */
async function scrollWithPause(distance, options = {}) {
    const {
        pauseMin = SCROLL_DEFAULTS.pauseMin,
        pauseMax = SCROLL_DEFAULTS.pauseMax,
        ...scrollOptions
    } = options;

    await naturalScroll(distance, scrollOptions);

    const pauseDuration = getPauseDuration({ min: pauseMin, max: pauseMax });
    await humanTiming.humanDelay(pauseDuration);

    return pauseDuration;
}

/**
 * Scroll multiple times with pauses
 * @param {number} count - Number of scrolls
 * @param {object} options - Scroll options
 */
async function scrollMultiple(count = 3, options = {}) {
    const results = [];

    for (let i = 0; i < count; i++) {
        const distance = getScrollDistance(options);
        const result = await scrollWithPause(distance, options);
        results.push(result);

        if (i < count - 1) {
            const breakDuration = mathUtils.randomInRange(500, 1500);
            await humanTiming.humanDelay(breakDuration);
        }
    }

    return results;
}

/**
 * Scroll to element - now uses api.scroll.focus()
 * @param {string} selector - CSS selector
 * @param {object} options - Options
 */
async function scrollToElement(selector, options = {}) {
    const {
        timeout = 5000
    } = options;

    // Use API's golden view scroll
    await api.scroll.focus(selector, { timeout });

    return true;
}

/**
 * Quick scroll for Twitter timelines
 * Uses api.scroll() with human-like behavior
 * @param {number} [distance] - Optional distance, random if not provided
 */
async function timelineScroll(distance = null) {
    const scrollDistance = distance || mathUtils.randomInRange(300, 600);
    await api.scroll(scrollDistance);
    await humanTiming.humanDelay(mathUtils.randomInRange(200, 500));
}

/**
 * Backscroll (up) 
 * @param {number} [distance] - Optional distance
 */
async function backScroll(distance = null) {
    const scrollDistance = distance || mathUtils.randomInRange(100, 300);
    await api.scroll(-scrollDistance);
}

// Export all functions
export {
    naturalScroll,
    scrollWithPause,
    scrollMultiple,
    scrollToElement,
    timelineScroll,
    backScroll,
    getScrollDistance,
    getScrollDuration,
    getPauseDuration,
    SCROLL_DEFAULTS
};

export default {
    naturalScroll,
    scrollWithPause,
    scrollMultiple,
    scrollToElement,
    timelineScroll,
    backScroll,
    getScrollDistance,
    getScrollDuration,
    getPauseDuration,
    SCROLL_DEFAULTS
};
