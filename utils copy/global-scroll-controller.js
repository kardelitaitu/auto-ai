/**
 * @fileoverview Global Scroll Controller
 * Centralizes all scrolling operations with configurable multiplier
 * @module utils/global-scroll-controller
 */

import { getSettings } from './configLoader.js';
import { createLogger } from './logger.js';
import { mathUtils } from './mathUtils.js';

const logger = createLogger('global-scroll-controller.js');

/**
 * Global Scroll Controller
 * Manages all scrolling with configurable speed multiplier
 */
class GlobalScrollController {
  constructor() {
    this.multiplier = 1.0;
    this.initialized = false;
  }

  /**
   * Initialize and load settings
   */
  async init() {
    if (this.initialized) return;
    
    try {
      const settings = await getSettings();
      this.multiplier = settings?.twitter?.timing?.globalScrollMultiplier ?? 1.0;
      this.initialized = true;
      logger.info(`[GlobalScroll] Initialized with multiplier: ${this.multiplier}x`);
    } catch (error) {
      logger.warn(`[GlobalScroll] Failed to load settings, using default 1.0x: ${error.message}`);
      this.multiplier = 1.0;
      this.initialized = true;
    }
  }

  /**
   * Get current multiplier
   */
  getMultiplier() {
    return this.multiplier;
  }

  /**
   * Apply multiplier to a scroll amount
   */
  apply(amount) {
    return Math.round(amount * this.multiplier);
  }

  /**
   * Apply to random range
   */
  applyRandom(min, max) {
    const randomAmount = mathUtils.randomInRange(min, max);
    return this.apply(randomAmount);
  }

  /**
   * Scroll down using mouse wheel (most common)
   * @param {object} page - Playwright page
   * @param {number} amount - Scroll amount in pixels
   * @param {object} options - Options
   */
  async scrollDown(page, amount, options = {}) {
    await this.init();
    const adjustedAmount = this.apply(amount);
    const { delay = 0 } = options;
    
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    
    await page.mouse.wheel(0, adjustedAmount);
  }

  /**
   * Scroll up using mouse wheel
   */
  async scrollUp(page, amount, options = {}) {
    await this.init();
    const adjustedAmount = this.apply(amount);
    const { delay = 0 } = options;
    
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    
    await page.mouse.wheel(0, -adjustedAmount);
  }

  /**
   * Random scroll (up or down)
   */
  async scrollRandom(page, min, max, options = {}) {
    await this.init();
    const amount = this.applyRandom(min, max);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const { delay = 0 } = options;
    
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    
    await page.mouse.wheel(0, amount * direction);
  }

  /**
   * Scroll to element
   */
  async scrollToElement(page, selector, options = {}) {
    await this.init();
    const { behavior = 'smooth', block = 'center' } = options;
    
    await page.evaluate((sel, beh, blk) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: beh, block: blk });
      }
    }, selector, behavior, block);
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(page, options = {}) {
    await this.init();
    const { behavior = 'auto' } = options;
    
    await page.evaluate((beh) => {
      window.scrollTo({ top: 0, behavior: beh });
    }, behavior);
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(page, options = {}) {
    await this.init();
    const { behavior = 'auto' } = options;
    
    await page.evaluate((beh) => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: beh });
    }, behavior);
  }

  /**
   * Scroll by specific amount (can be positive or negative)
   */
  async scrollBy(page, deltaY, options = {}) {
    await this.init();
    const adjustedAmount = this.apply(deltaY);
    const { delay = 0 } = options;
    
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    
    await page.mouse.wheel(0, adjustedAmount);
  }

  /**
   * Smooth scroll with multiple steps (human-like)
   */
  async smoothScroll(page, totalAmount, options = {}) {
    await this.init();
    const { steps = 3, minDelay = 100, maxDelay = 300 } = options;
    
    const adjustedTotal = this.apply(totalAmount);
    const stepAmount = Math.round(adjustedTotal / steps);
    
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, stepAmount);
      await page.waitForTimeout(mathUtils.randomInRange(minDelay, maxDelay));
    }
  }

  /**
   * Scroll through replies (common pattern)
   */
  async scrollReplies(page, iterations = 5, options = {}) {
    await this.init();
    const { minScroll = 150, maxScroll = 300, minDelay = 150, maxDelay = 300 } = options;
    
    for (let i = 0; i < iterations; i++) {
      const scrollAmount = this.applyRandom(minScroll, maxScroll);
      await page.mouse.wheel(0, scrollAmount);
      await page.waitForTimeout(mathUtils.randomInRange(minDelay, maxDelay));
    }
  }

  /**
   * Reset and reload settings
   */
  async reload() {
    this.initialized = false;
    await this.init();
  }
}

// Singleton instance
export const globalScroll = new GlobalScrollController();

// Convenience exports for common operations
export const scrollDown = (page, amount, opts) => globalScroll.scrollDown(page, amount, opts);
export const scrollUp = (page, amount, opts) => globalScroll.scrollUp(page, amount, opts);
export const scrollRandom = (page, min, max, opts) => globalScroll.scrollRandom(page, min, max, opts);
export const scrollToTop = (page, opts) => globalScroll.scrollToTop(page, opts);
export const scrollToBottom = (page, opts) => globalScroll.scrollToBottom(page, opts);
export const scrollBy = (page, deltaY, opts) => globalScroll.scrollBy(page, deltaY, opts);
export const smoothScroll = (page, amount, opts) => globalScroll.smoothScroll(page, amount, opts);
export const scrollReplies = (page, iterations, opts) => globalScroll.scrollReplies(page, iterations, opts);
export const getScrollMultiplier = () => globalScroll.getMultiplier();

export default globalScroll;
