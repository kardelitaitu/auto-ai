import { chromium } from 'playwright';

export default class HealthMonitor {
    constructor() {}

    async checkNetworkConnectivity() {
        let context = null;
        const startTime = Date.now();

        try {
            context = await chromium.launch();
            const page = await context.newPage();

            await page.goto('about:blank');

            const latency = Date.now() - startTime;

            return {
                healthy: true,
                latency
            };
        } catch (error) {
            return {
                healthy: false,
                latency: 0,
                error: error.message
            };
        } finally {
            if (context) {
                try {
                    await context.close();
                } catch (closeError) {
                    // Handle close errors gracefully
                }
            }
        }
    }

    async checkPageResponsive(page) {
        try {
            if (page.isClosed()) {
                return {
                    healthy: false,
                    error: 'Page is closed'
                };
            }

            const result = await page.evaluate(() => ({
                documentReady: document.readyState,
                title: document.title,
                bodyExists: !!document.body
            }));

            return {
                healthy: true,
                title: result.title
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }

    async checkBrowserHealth(browser, page) {
        const browserConnection = browser.isConnected();

        const result = {
            healthy: browserConnection,
            checks: {
                browserConnection
            }
        };

        if (page) {
            const pageHealth = await this.checkPageResponsive(page);
            result.checks.page = pageHealth;
            if (!pageHealth.healthy) {
                result.healthy = false;
            }
        }

        return result;
    }
}
