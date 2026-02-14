/**
 * Scroll Humanizer Module
 * Provides natural scroll patterns with easing and variability
 * Simulates human scrolling behavior.
 * 
 * @module utils/scroll-humanizer
 */

import { humanTiming } from './human-timing.js';

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
    return humanTiming.randomInRange(min, max);
}

function getScrollDuration(options = {}) {
    const { min = SCROLL_DEFAULTS.durationMin, max = SCROLL_DEFAULTS.durationMax } = options;
    return humanTiming.randomInRange(min, max);
}

function getPauseDuration(options = {}) {
    const { min = SCROLL_DEFAULTS.pauseMin, max = SCROLL_DEFAULTS.pauseMax } = options;
    return humanTiming.getScrollPause({ min, max });
}

async function naturalScroll(page, options = {}) {
    const {
        distance = getScrollDistance(options),
        duration = getScrollDuration(options),
        direction = 'down',
        smooth = true
    } = options;

    const scrollAmount = direction === 'down' ? distance : -distance;
    
    if (smooth) {
        await page.evaluate((deltaY, durationMs) => {
            const start = window.scrollY;
            const startTime = performance.now();
            
            function easeOutQuad(t) {
                return t * (2 - t);
            }
            
            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                const easedProgress = easeOutQuad(progress);
                window.scrollTo(0, start + (deltaY * easedProgress));
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            }
            
            requestAnimationFrame(animate);
        }, scrollAmount, duration);
    } else {
        await page.evaluate((deltaY) => {
            window.scrollBy(0, deltaY);
        }, scrollAmount);
    }

    return { distance, duration };
}

async function scrollWithPause(page, options = {}) {
    const {
        pauseMin = SCROLL_DEFAULTS.pauseMin,
        pauseMax = SCROLL_DEFAULTS.pauseMax,
        ...scrollOptions
    } = options;

    await naturalScroll(page, scrollOptions);

    const pauseDuration = getPauseDuration({ min: pauseMin, max: pauseMax });
    await humanTiming.humanDelay(pauseDuration);

    return pauseDuration;
}

async function scrollMultiple(page, count = 3, options = {}) {
    const results = [];
    
    for (let i = 0; i < count; i++) {
        const result = await scrollWithPause(page, options);
        results.push(result);

        if (i < count - 1) {
            const breakDuration = humanTiming.randomInRange(500, 1500);
            await humanTiming.humanDelay(breakDuration);
        }
    }

    return results;
}

async function scrollToElement(page, selector, options = {}) {
    const {
        offset = 100,
        smooth = true,
        timeout = 5000
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = await page.$(selector);
        
        if (element) {
            const box = await element.boundingBox();
            if (box) {
                const targetY = box.y - offset;
                await page.evaluate((y, smoothScroll) => {
                    if (smoothScroll) {
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    } else {
                        window.scrollTo(0, y);
                    }
                }, targetY, smooth);
                return true;
            }
        }

        await humanTiming.humanDelay(200);
    }

    return false;
}

async function scrollToTop(page) {
    await page.evaluate((smooth) => {
        window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    }, true);
}

async function scrollToBottom(page) {
    await page.evaluate((smooth) => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }, true);
}

async function getScrollPosition(page) {
    return await page.evaluate(() => ({
        y: window.scrollY,
        x: window.scrollX,
        height: window.innerHeight,
        scrollHeight: document.body.scrollHeight,
        percent: (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
    }));
}

async function scrollUntil(page, conditionFn, options = {}) {
    const {
        maxScrolls = 20,
        delay: _delay = 1000
    } = options;

    for (let i = 0; i < maxScrolls; i++) {
        const position = await getScrollPosition(page);
        
        if (await conditionFn(position)) {
            return { success: true, scrolls: i, position };
        }

        await scrollWithPause(page, options);
    }

    return { success: false, scrolls: maxScrolls, position: await getScrollPosition(page) };
}

function calculateScrollProgress(pagePosition) {
    if (pagePosition.scrollHeight <= pagePosition.height) {
        return 100;
    }
    return Math.min(100, Math.max(0, pagePosition.percent));
}

export const scrollHumanizer = {
    defaults: SCROLL_DEFAULTS,
    getScrollDistance,
    getScrollDuration,
    getPauseDuration,
    naturalScroll,
    scrollWithPause,
    scrollMultiple,
    scrollToElement,
    scrollToTop,
    scrollToBottom,
    getScrollPosition,
    scrollUntil,
    calculateScrollProgress
};

export default scrollHumanizer;
