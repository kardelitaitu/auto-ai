/**
 * @fileoverview Detection API Patching
 * Strips automation markers and patches runtime detection vectors.
 * 
 * @module api/patch
 */

import { getPage } from './context.js';

/**
 * Apply all detection patches to the page.
 * Should be called after setPage() to inject patches into page context.
 * @returns {Promise<void>}
 */
export async function apply() {
    const page = getPage();
    
    // Add init script to patch detection APIs
    await page.addInitScript(() => {
        // 1. Remove CDP automation markers
        try {
            window.cdc_adoQjvpsHSjkbJjLPRbPQ = undefined;
            window.$cdc_asdjflasutopfhvcZLmcfl_ = undefined;
            window.__webdriver = undefined;
            window._WEBDRIVER = undefined;
        } catch (e) {
            // Ignore
        }
        
        // 2. Patch navigator.webdriver
        try {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: false
            });
        } catch (e) {
            // Ignore
        }
        
        // 3. Override Function.prototype.toString to hide automation functions
        try {
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function(...args) {
                // If this function name contains automation keywords, hide it
                const name = this.name || '';
                const keywords = ['playwright', 'puppeteer', 'selenium', 'automation'];
                
                if (keywords.some(k => name.toLowerCase().includes(k))) {
                    return 'function() { [native code] }';
                }
                
                return originalToString.apply(this, args);
            };
        } catch (e) {
            // Ignore
        }
        
        // 4. Patch chrome runtime (if exists)
        try {
            if (window.chrome) {
                // Make chrome.runtime appear non-automation
                Object.defineProperty(window.chrome, 'runtime', {
                    get: () => undefined,
                    configurable: true
                });
            }
        } catch (e) {
            // Ignore
        }
    });
}

/**
 * Strip CDP markers from window object.
 * @returns {void}
 */
export function stripCDPMarkers() {
    // This is handled via addInitScript in apply()
    // Exposed as separate function for explicit calling if needed
    if (typeof window !== 'undefined') {
        try {
            window.cdc_adoQjvpsHSjkbJjLPRbPQ = undefined;
            window.$cdc_asdjflasutopfhvcZLmcfl_ = undefined;
        } catch (e) {
            // Ignore
        }
    }
}

/**
 * Check if page passes basic detection checks.
 * Useful for testing.
 * @returns {Promise<{webdriver: boolean, cdcMarkers: boolean, passed: boolean}>}
 */
export async function check() {
    const page = getPage();
    
    const results = await page.evaluate(() => {
        const webdriver = navigator.webdriver;
        const hasCDC = !!(window.cdc_adoQjvpsHSjkbJjLPRbPQ || window.$cdc_asdjflasutopfhvcZLmcfl_);
        
        return {
            webdriver: webdriver === true,
            cdcMarkers: hasCDC,
            passed: !webdriver && !hasCDC
        };
    });
    
    return results;
}
