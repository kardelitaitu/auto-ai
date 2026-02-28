/**
 * @fileoverview Browser patching utilities for anti-detection and humanization.
 * @module utils/browserPatch
 */

/**
 * Applies anti-detect and humanization patches to the page context.
 * @param {object} page - The Playwright page instance.
 * @param {object} logger - The logger instance.
 */
export async function applyHumanizationPatch(page, logger) {
    if (logger) logger.info('[HumanizationPatch] Injecting consistency and entropy scripts...');

    await page.addInitScript(() => {
        // 1. Consistency Check: Override Navigator Platform to match likely UA
        // Heuristic: If User-Agent contains "Win", platform is "Win32"
        // If "Mac", "MacIntel". If "Linux", "Linux x86_64".
        try {
            const ua = navigator.userAgent;
            let platform = 'Win32';
            if (ua.includes('Mac')) platform = 'MacIntel';
            else if (ua.includes('Linux')) platform = 'Linux x86_64';

            Object.defineProperty(navigator, 'platform', { get: () => platform });
        } catch (_e) {
            void _e;
        }

        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
        } catch (_e) {
            void _e;
        }

        // Removed media capability spoofing natively per troubleshooting
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (...args) {
                if (this.width > 0 && this.height > 0) {
                    const ctx = this.getContext('2d');
                    if (ctx) {
                        const salt = Math.floor(Math.random() * 255);
                        const oldStyle = ctx.fillStyle;
                        ctx.fillStyle = `rgba(${salt}, ${salt}, ${salt}, 0.01)`;
                        ctx.fillRect(0, 0, 1, 1);
                        ctx.fillStyle = oldStyle;
                    }
                }
                return originalToDataURL.apply(this, args);
            };
        } catch (_e) {
            void _e;
        }



        // 5. Visibility Spoofing (Prevent detection of minimized/background state)
        // Always report the page as visible and active
        try {
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });

            // Also patch event listeners for visibilitychange to stop them from firing 'hidden' logic
            const originalAddEventListener = document.addEventListener;
            document.addEventListener = function (type, listener, options) {
                if (type === 'visibilitychange') {
                    void listener;
                }
                return originalAddEventListener.call(this, type, listener, options);
            };
        } catch (_e) {
            void _e;
        }
    });

    if (logger) logger.info('[HumanizationPatch] Scripts injected.');
}
