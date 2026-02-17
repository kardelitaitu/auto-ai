/**
 * @fileoverview Advanced Ghost Cursor
 * Implements human-like mouse physics including Fitts's Law, Overshoot/Correction,
 * Gaussian targeting, variable reaction timing, and Twitter-specific engagement patterns.
 */

import { mathUtils } from './mathUtils.js';
import { createLogger } from './logger.js';

const logger = createLogger('ghostCursor');

// Twitter-specific click profiles for different engagement types
export const TWITTER_CLICK_PROFILES = {
  like: {
    hoverMin: 800,
    hoverMax: 2000,
    holdMs: 150,
    hesitation: true,
    microMove: true
  },
  reply: {
    hoverMin: 1500,
    hoverMax: 3000,
    holdMs: 200,
    hesitation: true,
    microMove: true
  },
  retweet: {
    hoverMin: 1200,
    hoverMax: 2500,
    holdMs: 180,
    hesitation: true,
    microMove: true
  },
  follow: {
    hoverMin: 2000,
    hoverMax: 4000,
    holdMs: 250,
    hesitation: true,
    microMove: false
  },
  bookmark: {
    hoverMin: 1000,
    hoverMax: 2000,
    holdMs: 120,
    hesitation: false,
    microMove: false
  },
  nav: {
    hoverMin: 200,
    hoverMax: 800,
    holdMs: 80,
    hesitation: false,
    microMove: false
  }
};

export class GhostCursor {
    constructor(page, logger = null) {
        this.page = page;
        this.logger = logger || createLogger('ghostCursor.js');
        this.previousPos = { x: 0, y: 0 };
        this.init();
    }

    async init() {
        // Initialize random start position if not known
        // We can try to get it if the page has run before, but random is safer for "wakeup"
        this.previousPos = {
            x: mathUtils.randomInRange(50, 500),
            y: mathUtils.randomInRange(50, 500)
        };
    }

    /**
     * Vector arithmetic helpers
     */
    vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
    vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
    vecMult(a, s) { return { x: a.x * s, y: a.y * s }; }
    vecLen(a) { return Math.sqrt(a.x * a.x + a.y * a.y); }

    /**
     * Cubic Bezier Point
     */
    bezier(t, p0, p1, p2, p3) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
        return { x, y };
    }

    /**
     * Easing function (EaseOutCubic) - starts fast, slows down naturally
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Move the mouse along a path with variable velocity
     */
    async performMove(start, end, durationMs, _steps = 30) {
        // Control Points for Arc
        // Randomize the arc direction and intensity based on distance
        const distance = this.vecLen(this.vecSub(end, start));
        const arcAmount = mathUtils.randomInRange(20, Math.min(200, distance * 0.5));

        // Random control points
        const p0 = start;
        const p3 = end;
        const p1 = {
            x: start.x + (end.x - start.x) * 0.3 + mathUtils.gaussian(0, arcAmount),
            y: start.y + (end.y - start.y) * 0.3 + mathUtils.gaussian(0, arcAmount)
        };
        const p2 = {
            x: start.x + (end.x - start.x) * 0.7 + mathUtils.gaussian(0, arcAmount),
            y: start.y + (end.y - start.y) * 0.7 + mathUtils.gaussian(0, arcAmount)
        };

        const startTime = Date.now();
        let loop = true;

        while (loop) {
            const elapsed = Date.now() - startTime;
            let progress = elapsed / durationMs;

            if (progress >= 1) {
                progress = 1;
                loop = false;
            }

            // Apply Easing (Human Movement is not linear)
            const easedT = this.easeOutCubic(progress);

            const pos = this.bezier(easedT, p0, p1, p2, p3);

            // Add slight high-frequency "tremor" (noise)
            // Tremor reduces as we get closer to target (stabilization)
            const tremorScale = (1 - easedT) * 1.5;
            const noisyX = pos.x + (Math.random() - 0.5) * tremorScale;
            const noisyY = pos.y + (Math.random() - 0.5) * tremorScale;

            await this.page.mouse.move(noisyX, noisyY);

            // Playwright processes are fast, we don't strictly need to sleep every frame
            // but a tiny yield helps timing accuracy
            if (loop) await new Promise(r => setTimeout(r, Math.random() * 8));
        }

        this.previousPos = end;
    }

/**
  * Wait for element to be stable (not moving) before clicking
  * Prevents clicking on animating elements
  * @param {object} locator - Playwright locator
  * @param {number} maxWaitMs - Maximum wait time (default: 3000ms)
  * @returns {Promise<object|null>} - Bounding box if stable, null if timed out
  */
async waitForStableElement(locator, maxWaitMs = 3000) {
  const startTime = Date.now();
  let prevBox = null;
  let stableCount = 0;
  const requiredStableChecks = 3; // Need 3 consecutive stable checks

  while (Date.now() - startTime < maxWaitMs) {
    const bboxPromise = locator.boundingBox ? locator.boundingBox() : null;
    const bbox = await Promise.resolve(bboxPromise).catch(() => null);
    if (!bbox) {
      return null;
    }

    if (prevBox) {
      // Calculate total delta (movement)
      const delta = Math.abs(bbox.x - prevBox.x) + Math.abs(bbox.y - prevBox.y);
      
      // If element is stable (minimal movement)
      if (delta < 2) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          return bbox;
        }
      } else {
        stableCount = 0; // Reset if element moves
      }
    }
    
    prevBox = bbox;
    await new Promise(r => setTimeout(r, 100));
  }

  // Return last known position if we timed out
  return prevBox;
}

/**
  * Twitter-specific reply click with hover-hold and hesitation
  * Simulates reading the tweet before deciding to reply
  * With retry logic and stability checks
  * @param {object} locator - Playwright locator
  * @param {string} actionType - Click profile to use ('reply', 'like', 'retweet', etc.)
  * @param {number} maxRetries - Maximum retry attempts (default: 3)
  */
async twitterClick(locator, actionType = 'reply', maxRetries = 3) {
  const profile = TWITTER_CLICK_PROFILES[actionType] || TWITTER_CLICK_PROFILES.nav;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Get bounding box with stability check
      let bbox = await this.waitForStableElement(locator, 3000);
      
      if (!bbox) {
        console.warn('[GhostCursor] Twitter click: No bounding box found');
        await locator.click({ force: true }).catch(() => {});
        return;
      }

      // HUMAN-LIKE: Target fixation - pause to "look at" the target before moving
      // Reduce fixation delay on retries (human would know where to click)
      const fixationDelay = attempt === 0 
        ? mathUtils.randomInRange(200, 800)
        : mathUtils.randomInRange(50, 200);
      await new Promise(r => setTimeout(r, fixationDelay));

      // Calculate target point (Gaussian distribution)
      const marginX = bbox.width * 0.15;
      const marginY = bbox.height * 0.15;
      const targetX = mathUtils.gaussian(
        bbox.x + bbox.width / 2,
        bbox.width / 6,
        bbox.x + marginX,
        bbox.x + bbox.width - marginX
      );
      const targetY = mathUtils.gaussian(
        bbox.y + bbox.height / 2,
        bbox.height / 6,
        bbox.y + marginY,
        bbox.y + bbox.height - marginY
      );

      // Phase 1: Move to target with hesitation mid-path (for long moves >400px)
      await this.moveWithHesitation(targetX, targetY);

      // Phase 2: Hover with drift (reading time) - reduced drift for stability
      await this.hoverWithDrift(targetX, targetY, profile.hoverMin, profile.hoverMax);

      // Phase 3: Pre-click hesitation
      if (profile.hesitation) {
        await new Promise(r => setTimeout(r, mathUtils.randomInRange(40, 120)));
      }

      // Phase 4: Micro-move before click (aiming pressure simulation)
      if (profile.microMove) {
        const microX = targetX + mathUtils.randomInRange(-2, 2);
        const microY = targetY + mathUtils.randomInRange(-2, 2);
        await this.page.mouse.move(microX, microY);
        await new Promise(r => setTimeout(r, mathUtils.randomInRange(20, 50)));
      }

      // Phase 5: Execute click
      await this.page.mouse.down();
      await new Promise(r => setTimeout(r, profile.holdMs));
      await this.page.mouse.up();

      this.previousPos = { x: targetX, y: targetY };
      return; // Success - exit function

    } catch (error) {
      lastError = error;
      console.warn(`[GhostCursor] Twitter click attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // All retries exhausted - try native click as final fallback
  console.warn(`[GhostCursor] All retries failed, using native fallback: ${lastError?.message}`);
  try {
    await locator.click({ force: true });
  } catch (fallbackError) {
    console.warn(`[GhostCursor] Native fallback also failed: ${fallbackError.message}`);
  }
}

/**
 * Move with mid-path hesitation for long distances
 * Simulates "re-aiming" behavior humans exhibit on long cursor movements
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 */
async moveWithHesitation(targetX, targetY) {
  const start = this.previousPos || { x: 0, y: 0 };
  const distance = this.vecLen(this.vecSub({ x: targetX, y: targetY }, start));

  // Only add hesitation for moves > 400px
  if (distance <= 400) {
    await this.move(targetX, targetY);
    return;
  }

  // Calculate mid-point at 40% of the path
  const midX = start.x + (targetX - start.x) * 0.4;
  const midY = start.y + (targetY - start.y) * 0.4;

  // Move to mid-point (faster initial movement)
  await this.performMove(start, { x: midX, y: midY }, 150);

  // Hesitation: 100-300ms (re-aiming time)
  await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 300)));

  // Move to final target with overshoot logic
  await this.move(targetX, targetY);
}

/**
 * Hover with realistic drift noise
 * Simulates the micro-movements humans make while focusing on content
 * @param {number} startX - Starting X
 * @param {number} startY - Starting Y
 * @param {number} minDuration - Minimum hover duration (ms)
 * @param {number} maxDuration - Maximum hover duration (ms)
 */
async hoverWithDrift(startX, startY, minDuration, maxDuration) {
  const duration = mathUtils.randomInRange(minDuration, maxDuration);
  const startTime = Date.now();
  const driftRange = 1; // Reduced from 3px to 1px for better stability

  while (Date.now() - startTime < duration) {
    // Random drift within small range
    const driftX = (Math.random() - 0.5) * 2 * driftRange;
    const driftY = (Math.random() - 0.5) * 2 * driftRange;

    await this.page.mouse.move(startX + driftX, startY + driftY);

    // Occasional micro-pause (20% chance)
    if (Math.random() < 0.2) {
      await new Promise(r => setTimeout(r, mathUtils.randomInRange(50, 150)));
    }

    // Brief pause between drift updates
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(50, 100)));
  }

  this.previousPos = { x: startX, y: startY };
}

/**
 * Move the cursor with overshoot and correction
 * Maintains existing move() behavior for compatibility
 */
async move(targetX, targetY, _speed = undefined) {
  const start = this.previousPos || { x: 0, y: 0 };
  const end = { x: targetX, y: targetY };
  const pathVector = this.vecSub(end, start);
  const distance = this.vecLen(pathVector);

  // Fitts's Law approximation
  const targetDuration = 250 + (distance * 0.4) + mathUtils.randomInRange(-50, 50);

  // Overshoot check (20% chance on long moves >500px) - reduced from 60% for better accuracy
  const shouldOvershoot = distance > 500 && mathUtils.roll(0.2);

  if (shouldOvershoot) {
    const overshootScale = mathUtils.randomInRange(1.05, 1.15);
    const errorLateral = mathUtils.gaussian(0, 20);

    const overshootPoint = {
      x: start.x + (pathVector.x * overshootScale) + errorLateral,
      y: start.y + (pathVector.y * overshootScale) + errorLateral
    };

    await this.performMove(start, overshootPoint, targetDuration * 0.8);
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(80, 300)));
    await this.performMove(overshootPoint, end, mathUtils.randomInRange(150, 300));
  } else {
    await this.performMove(start, end, targetDuration);
  }
}

/**
 * "Parks" the mouse in a safe zone to avoid obscuring content
 */
async park() {
  try {
    const vp = this.page.viewportSize();
    if (!vp) return;

    const side = mathUtils.roll(0.5) ? 'left' : 'right';
    const margin = vp.width * 0.1;

    let targetX;
    if (side === 'left') {
      targetX = mathUtils.randomInRange(0, margin);
    } else {
      targetX = mathUtils.randomInRange(vp.width - margin, vp.width);
    }

    const targetY = mathUtils.randomInRange(0, vp.height);
    const current = this.previousPos || { x: 0, y: 0 };
    const dist = Math.sqrt(Math.pow(targetX - current.x, 2) + Math.pow(targetY - current.y, 2));
    const duration = Math.max(800, dist * 0.8);

    await this.performMove(current, { x: targetX, y: targetY }, duration);
  } catch (_e) {
    // Ignore viewport error
  }
}

/**
 * Highly Human-Like Click with Dynamic Tracking
 */
async click(selector, options = {}) {
  const {
    allowNativeFallback = false,
    maxStabilityWaitMs = 2000,
    preClickStabilityMs: _preClickStabilityMs = 300,
    label = '',
    hoverBeforeClick = false,
    hoverMinMs = 120,
    hoverMaxMs = 280
  } = options;
  const labelSuffix = label ? ` [${label}]` : '';

  try {
    if (selector.isVisible && !(await selector.isVisible().catch(() => false))) {
      if (allowNativeFallback && selector.click) await selector.click({ force: true }).catch(() => {});
      return { success: false, usedFallback: true };
    }
  } catch (_e) {
    // Ignore visibility check error
  }

  let bbox = await this.waitForStableElement(selector, maxStabilityWaitMs);
  if (!bbox) {
    if (allowNativeFallback && selector.click) await selector.click({ force: true }).catch(() => {});
    return { success: false, usedFallback: true };
  }

  // Tracking loop
  const maxTrackingAttempts = 3;
  let attempt = 0;

  while (attempt < maxTrackingAttempts) {
    attempt++;

    const marginX = bbox.width * 0.15;
    const marginY = bbox.height * 0.15;
    const targetX = mathUtils.gaussian(
      bbox.x + bbox.width / 2, bbox.width / 6,
      bbox.x + marginX, bbox.x + bbox.width - marginX
    );
    const targetY = mathUtils.gaussian(
      bbox.y + bbox.height / 2, bbox.height / 6,
      bbox.y + marginY, bbox.y + bbox.height - marginY
    );

    this.logger.info(`ghostCursor moving to x=${Math.round(targetX)} y=${Math.round(targetY)}${labelSuffix}`);
    await this.moveWithHesitation(targetX, targetY);
    await new Promise(r => setTimeout(r, mathUtils.randomInRange(100, 400)));

    const newBox = await selector.boundingBox();
    if (!newBox) return { success: false, usedFallback: false };

    const currentPos = this.previousPos;
    const insideX = currentPos.x >= newBox.x && currentPos.x <= newBox.x + newBox.width;
    const insideY = currentPos.y >= newBox.y && currentPos.y <= newBox.y + newBox.height;

    if (insideX && insideY) {
      const finalX = currentPos.x + mathUtils.randomInRange(-1, 1);
      const finalY = currentPos.y + mathUtils.randomInRange(-1, 1);
      const holdTime = mathUtils.gaussian(60, 20, 20, 150);

      try {
        if (hoverBeforeClick) {
          await this.hoverWithDrift(finalX, finalY, hoverMinMs, hoverMaxMs);
        }
        await this.page.mouse.move(finalX, finalY);
        await this.page.mouse.down();
        await new Promise(r => setTimeout(r, holdTime));
        await this.page.mouse.up();
        this.logger.info(`ghostCursor clicked x=${Math.round(finalX)} y=${Math.round(finalY)}${labelSuffix}`);
        return { success: true, usedFallback: false, x: finalX, y: finalY };
      } catch {
        break;
      }
    } else {
      bbox = newBox;
    }
  }

  if (allowNativeFallback && selector.click) {
    try {
      await selector.click({ force: true });
    } catch {
      // Ignore native fallback error
    }
    return { success: false, usedFallback: true };
  }
  return { success: false, usedFallback: false };
}
}
