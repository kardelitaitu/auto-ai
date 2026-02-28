/**
 * Mistake Engine Module
 * Simulates human imperfections: misclicks, abandonment, typing errors
 * Adds recoverable errors to make behavior more realistic
 * 
 * @module utils/mistake-engine
 */

import { mathUtils } from './mathUtils.js';

const MISTAKE_CONFIG = {
    misclickChance: 0.05,
    misclickOffset: { min: 3, max: 8 },
    abandonmentChance: 0.08,
    abandonmentDelay: { min: 500, max: 2000 },
    typingErrorChance: 0.08,
    navigationErrorChance: 0.02,
    recoveryDelay: { min: 500, max: 1500 }
};

function createMistakeEngine(options = {}) {
    const config = { ...MISTAKE_CONFIG, ...options };
    
    return {
        config,
        
        shouldMisclick() {
            return Math.random() < config.misclickChance;
        },
        
        getMisclickOffset() {
            const dx = mathUtils.randomInRange(config.misclickOffset.min, config.misclickOffset.max);
            const dy = mathUtils.randomInRange(config.misclickOffset.min, config.misclickOffset.max);
            return { dx, dy };
        },
        
        async simulateMisclick(page, targetSelector, options = {}) {
            const { logger = console, actionName: _actionName = 'action' } = options;
            
            try {
                const target = await page.$(targetSelector);
                if (!target) {
                    logger.warn(`[MistakeEngine] Target not found: ${targetSelector}`);
                    return false;
                }
                
                const box = await target.boundingBox();
                if (!box) {
                    logger.warn(`[MistakeEngine] No bounding box for target`);
                    return false;
                }
                
                const offset = this.getMisclickOffset();
                const missX = box.x + offset.dx;
                const missY = box.y + offset.dy;
                
                logger.info(`[MistakeEngine] Misclick simulation: aiming at (${Math.round(box.x)}, ${Math.round(box.y)}) → missing at (${Math.round(missX)}, ${Math.round(missY)})`);
                
                await page.mouse.move(missX, missY);
                await page.waitForTimeout(mathUtils.randomInRange(200, 500));
                
                return { success: true, missedAt: { x: missX, y: missY }, recovered: false };
                
            } catch (error) {
                logger.error(`[MistakeEngine] Misclick error: ${error.message}`);
                return false;
            }
        },
        
        shouldAbandon() {
            return Math.random() < config.abandonmentChance;
        },
        
        getAbandonmentDelay() {
            return mathUtils.randomInRange(config.abandonmentDelay.min, config.abandonmentDelay.max);
        },
        
        async simulateAbandonment(page, options = {}) {
            const { logger = console, reason = 'change of mind' } = options;
            
            const delay = this.getAbandonmentDelay();
            logger.info(`[MistakeEngine] Abandoning action (${reason}) for ${delay}ms...`);
            
            await page.waitForTimeout(delay);
            
            return { abandoned: true, reason, delay };
        },
        
        shouldMakeTypingError() {
            return Math.random() < config.typingErrorChance;
        },
        
        async simulateTypingError(page, _text, _inputEl, options = {}) {
            const { logger: _logger = console } = options;
            
            const errorDelay = mathUtils.randomInRange(80, 200);
            await page.waitForTimeout(errorDelay);
            
            return {
                errorMade: true,
                type: 'adjacent',
                correctionApplied: true
            };
        },
        
        shouldNavigationError() {
            return Math.random() < config.navigationErrorChance;
        },
        
        async simulateNavigationError(page, _targetUrl, options = {}) {
            const { logger = console, intendedSelector: _intendedSelector, wrongSelector } = options;
            
            logger.info(`[MistakeEngine] Navigation error simulation`);
            
            if (wrongSelector) {
                const wrongEl = await page.$(wrongSelector);
                if (wrongEl) {
                    await wrongEl.click();
                    await page.waitForTimeout(mathUtils.randomInRange(1000, 2000));
                    return { navigatedToWrong: true, recovery: 'back' };
                }
            }
            
            return { navigatedToWrong: false };
        },
        
        getRecoveryDelay() {
            return mathUtils.randomInRange(config.recoveryDelay.min, config.recoveryDelay.max);
        },
        
        async recoverFromError(page, options = {}) {
            const { logger = console, errorType = 'unknown' } = options;
            
            const delay = this.getRecoveryDelay();
            logger.info(`[MistakeEngine] Recovering from ${errorType} after ${delay}ms...`);
            
            await page.waitForTimeout(delay);
            
            return { recovered: true, delay };
        },
        
        async executeWithMistakes(page, action, options = {}) {
            const { 
                logger = console, 
                actionName = 'action',
                simulateMisclick = false,
                simulateAbandonment = false 
            } = options;
            
            let result = { success: true, mistakes: [] };
            
            if (simulateMisclick && this.shouldMisclick()) {
                const misclickResult = await this.simulateMisclick(page, action.targetSelector, { logger, actionName });
                if (misclickResult) {
                    result.mistakes.push({ type: 'misclick', ...misclickResult });
                    
                    if (misclickResult.recovered === false) {
                        const recovery = await this.recoverFromError(page, { logger, errorType: 'misclick' });
                        result.mistakes.push(recovery);
                    }
                }
            }
            
            if (simulateAbandonment && this.shouldAbandon()) {
                const abandonResult = await this.simulateAbandonment(page, { logger });
                result.mistakes.push({ type: 'abandonment', ...abandonResult });
                
                if (abandonResult.abandoned) {
                    return { ...result, actionTaken: false };
                }
            }
            
            return { ...result, actionTaken: true };
        }
    };
}


function createHumanizedClick(page, selector, options = {}) {
    const engine = createMistakeEngine();
    const { logger = console } = options;
    
    return async () => {
        const target = await page.$(selector);
        if (!target) {
            logger.warn(`[HumanizedClick] Target not found: ${selector}`);
            return false;
        }
        
        const box = await target.boundingBox();
        if (!box) {
            logger.warn(`[HumanizedClick] No bounding box`);
            return false;
        }
        
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        
        if (engine.shouldMisclick()) {
            const offset = engine.getMisclickOffset();
            const direction = Math.random() > 0.5 ? 1 : -1;
            const finalX = centerX + (offset.dx * direction);
            const finalY = centerY + (offset.dy * direction);
            
            logger.info(`[HumanizedClick] Misclick corrected: (${Math.round(centerX)}, ${Math.round(centerY)}) → (${Math.round(finalX)}, ${Math.round(finalY)})`);
            
            await page.mouse.move(finalX, finalY);
            await page.waitForTimeout(engine.getRecoveryDelay());
            
            return { clicked: true, corrected: true, x: finalX, y: finalY };
        }
        
        await page.mouse.move(centerX, centerY);
        await page.waitForTimeout(mathUtils.randomInRange(100, 300));
        
        return { clicked: true, corrected: false, x: centerX, y: centerY };
    };
}

export const mistakeEngine = {
    createMistakeEngine,
    createHumanizedClick,
    defaults: MISTAKE_CONFIG
};

export default mistakeEngine;
