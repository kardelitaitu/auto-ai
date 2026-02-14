import { chromium } from 'playwright';

class HealthMonitor {
    constructor() {
        this.checkUrl = 'https://www.google.com';
    }

    /**
     * Check general network connectivity by attempting to load a page.
     * @returns {Promise<object>} Health status and latency.
     */
    async checkNetworkConnectivity() {
        let browserContext = null;
        const startTime = Date.now();

        try {
            // Launch a lightweight browser instance
            // Note: In tests this is mocked to return a context directly from launch
            browserContext = await chromium.launch({ headless: true });
            
            // Handle both browser instance (has newPage) or context
            const page = await browserContext.newPage();
            
            await page.goto(this.checkUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
            
            const latency = Date.now() - startTime;
            return {
                healthy: true,
                latency,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        } finally {
            if (browserContext) {
                await browserContext.close().catch(() => {});
            }
        }
    }

    /**
     * Check if a specific page is responsive.
     * @param {object} page - The page to check.
     * @returns {Promise<object>} Page health status.
     */
    async checkPageResponsive(page) {
        try {
            if (!page || page.isClosed()) {
                return {
                    healthy: false,
                    error: 'Page is closed or undefined',
                    timestamp: new Date().toISOString()
                };
            }

            const evalResult = await page.evaluate(() => {
                return {
                    documentReady: document.readyState,
                    title: document.title,
                    bodyExists: !!document.body
                };
            });

            return {
                healthy: true,
                ...evalResult,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check overall browser health including connection and optional page responsiveness.
     * @param {import('playwright').Browser} browser - The browser instance.
     * @param {object} [page] - Optional page to check (Playwright Page).
     * @returns {Promise<object>} Browser health status.
     */
    async checkBrowserHealth(browser, page = null) {
        const checks = {
            timestamp: new Date().toISOString(),
            browserConnection: false
        };

        if (!browser || !browser.isConnected()) {
            return {
                healthy: false,
                error: 'Browser disconnected',
                checks
            };
        }

        checks.browserConnection = true;
        let isHealthy = true;

        if (page) {
            const pageHealth = await this.checkPageResponsive(page);
            checks.page = pageHealth;
            if (!pageHealth.healthy) {
                isHealthy = false;
            }
        }

        return {
            healthy: isHealthy,
            checks
        };
    }
}

export default HealthMonitor;
